import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HousekeepingTaskStatus, MaintenanceWorkOrderStatus, OperationsPriority, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';
import { AuthorizationContextService } from '../authorization/authorization-context.service';

const housekeepingOpen: HousekeepingTaskStatus[] = [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.ASSIGNED, HousekeepingTaskStatus.IN_PROGRESS, HousekeepingTaskStatus.COMPLETED, HousekeepingTaskStatus.AWAITING_INSPECTION];
const staffPermission: Record<'housekeeping' | 'maintenance', string> = { housekeeping: 'housekeeping.tasks.self', maintenance: 'maintenance.work.self' };
const parseDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ConflictException('Due date is invalid.');
  return date;
};

@Injectable()
export class HotelFacilitiesService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationContextService) {}

  private scope(context: AuthorizationContext, hotelId: string) {
    this.authorization.assertHotelAccess(context, hotelId);
    return context.organization.id;
  }

  private async audit(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, actor: AuthenticatedIdentity, correlationId: string, action: string, resource: string, resourceId: string, metadata?: Prisma.InputJsonValue) {
    await tx.auditEvent.create({ data: { organizationId, hotelId, actorUserId: actor.identityId, correlationId, action, resource, resourceId, ...(metadata ? { metadata } : {}) } });
  }

  private async taskEvent(tx: Prisma.TransactionClient, data: { organizationId: string; hotelId: string; taskId: string; actorUserId: string; action: string; fromStatus?: HousekeepingTaskStatus; toStatus?: HousekeepingTaskStatus; notes?: string }) {
    await tx.housekeepingTaskEvent.create({ data });
  }

  private async workEvent(tx: Prisma.TransactionClient, data: { organizationId: string; hotelId: string; workOrderId: string; actorUserId: string; action: string; fromStatus?: MaintenanceWorkOrderStatus; toStatus?: MaintenanceWorkOrderStatus; notes?: string }) {
    await tx.maintenanceWorkOrderEvent.create({ data });
  }

  private async room(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, roomId: string) {
    const room = await tx.hotelRoom.findFirst({ where: { id: roomId, organizationId, hotelId }, include: { category: true } });
    if (!room) throw new NotFoundException('Room not found at this hotel.');
    return room;
  }

  private async staffMember(organizationId: string, hotelId: string, userId: string, area: 'housekeeping' | 'maintenance') {
    const member = await this.prisma.hotelMembership.findFirst({
      where: { organizationId, hotelId, userId, status: 'ACTIVE', organizationMembership: { status: 'ACTIVE' } },
      include: {
        roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        organizationMembership: { include: { user: true } },
      },
    });
    if (!member) throw new ConflictException('Assignee must be an active member of this hotel.');
    const permission = staffPermission[area];
    const allowed = member.roleAssignments.some(({ role }) => role.permissions.some(({ permission: p }) => `${p.resource}.${p.action}` === permission));
    if (!allowed) throw new ConflictException(`Assignee must have the ${area} staff role at this hotel.`);
    return member;
  }

  async staff(context: AuthorizationContext, hotelId: string, area: 'housekeeping' | 'maintenance') {
    const org = this.scope(context, hotelId);
    const memberships = await this.prisma.hotelMembership.findMany({
      where: { organizationId: org, hotelId, status: 'ACTIVE', organizationMembership: { status: 'ACTIVE' } },
      include: { organizationMembership: { include: { user: true } }, roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const permission = staffPermission[area];
    return memberships.filter((member) => member.roleAssignments.some(({ role }) => role.permissions.some(({ permission: p }) => `${p.resource}.${p.action}` === permission)))
      .map((member) => ({ userId: member.userId, name: member.organizationMembership.user.email ?? 'Hotel staff', email: member.organizationMembership.user.email, roleNames: member.roleAssignments.map(({ role }) => role.name) }));
  }

  async staffCandidates(context: AuthorizationContext, hotelId: string, area: 'housekeeping' | 'maintenance') {
    const organizationId = this.scope(context, hotelId);
    const roleName = area === 'housekeeping' ? 'Housekeeping' : 'Maintenance';
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { organizationId, status: 'ACTIVE', hotelMemberships: { none: { hotelId, status: 'ACTIVE', roleAssignments: { some: { role: { name: roleName } } } } } },
      include: { user: { select: { id: true, email: true } }, roleAssignments: { include: { role: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' }, take: 500,
    });
    return memberships.map((membership) => ({ userId: membership.userId, name: membership.user.email ?? 'Hotel staff', email: membership.user.email, roleNames: membership.roleAssignments.map(({ role }) => role.name) }));
  }

  async addStaff(context: AuthorizationContext, hotelId: string, userId: string, area: 'housekeeping' | 'maintenance', actor: AuthenticatedIdentity, correlationId: string) {
    const organizationId = this.scope(context, hotelId);
    const roleName = area === 'housekeeping' ? 'Housekeeping' : 'Maintenance';
    return this.prisma.$transaction(async (tx) => {
      const organizationMembership = await tx.organizationMembership.findFirst({ where: { organizationId, userId, status: 'ACTIVE' } });
      if (!organizationMembership) throw new NotFoundException('Active organization membership not found. Invite this person and activate their organization membership first.');
      const role = await tx.role.findFirst({ where: { organizationId, hotelId: null, name: roleName, isSystem: true } });
      if (!role) throw new ConflictException(`The system ${roleName} role is unavailable. Run the access catalogue seed first.`);
      const existing = await tx.hotelMembership.findUnique({ where: { hotelId_userId: { hotelId, userId } } });
      if (existing && existing.status !== 'ACTIVE') throw new ConflictException('This hotel membership is inactive and requires an administrator to review it.');
      const membership = existing ?? await tx.hotelMembership.create({ data: { organizationId, hotelId, userId, status: 'ACTIVE', activatedAt: new Date() } });
      await tx.hotelMembershipRole.upsert({
        where: { hotelMembershipId_roleId: { hotelMembershipId: membership.id, roleId: role.id } },
        create: { organizationId, hotelMembershipId: membership.id, roleId: role.id }, update: {},
      });
      await this.audit(tx, organizationId, hotelId, actor, correlationId, 'hotel.staff.assigned', 'hotel-membership', membership.id, { userId, area, roleId: role.id });
      return { userId, hotelId, area, role: roleName, status: 'ACTIVE' as const };
    });
  }

  async tasks(context: AuthorizationContext, hotelId: string, actor: AuthenticatedIdentity, onlyMine = false, status?: HousekeepingTaskStatus) {
    const org = this.scope(context, hotelId);
    return this.prisma.housekeepingTask.findMany({
      where: { organizationId: org, hotelId, ...(onlyMine ? { assignedToUserId: actor.identityId } : {}), ...(status ? { status } : {}) },
      include: { room: { include: { category: true } }, creator: { select: { id: true, email: true } }, assignee: { select: { id: true, email: true } }, events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, email: true } } } }, inspections: { orderBy: { inspectedAt: 'desc' }, include: { inspector: { select: { id: true, email: true } } } } },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }], take: 500,
    });
  }

  async createTask(context: AuthorizationContext, hotelId: string, input: { roomId: string; type: 'TURNOVER' | 'DAILY' | 'DEEP' | 'MAINTENANCE_RETURN'; priority: OperationsPriority; dueAt?: string; instructions?: string; notes?: string }, actor: AuthenticatedIdentity, correlationId: string, key?: string) {
    const org = this.scope(context, hotelId);
    const idem = key?.trim() || randomUUID();
    if (idem.length > 100 || !/^[a-zA-Z0-9._:-]+$/.test(idem)) throw new ConflictException('Idempotency key must be 1–100 safe characters.');
    const room = await this.room(this.prisma, org, hotelId, input.roomId);
    if (['OCCUPIED', 'RESERVED', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(room.status)) throw new ConflictException('Cleaning tasks cannot be opened for occupied, reserved or unavailable rooms.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${room.id}))`;
      const prior = await tx.housekeepingTask.findFirst({ where: { organizationId: org, hotelId, idempotencyKey: idem } });
      if (prior) return prior;
      const open = await tx.housekeepingTask.findFirst({ where: { organizationId: org, hotelId, roomId: room.id, status: { in: housekeepingOpen } } });
      if (open) throw new ConflictException('Room already has an open housekeeping task.');
      const task = await tx.housekeepingTask.create({ data: { organizationId: org, hotelId, roomId: room.id, type: input.type, priority: input.priority, dueAt: parseDate(input.dueAt), instructions: input.instructions?.trim() || null, notes: input.notes?.trim() || null, createdByUserId: actor.identityId, idempotencyKey: idem } });
      await this.taskEvent(tx, { organizationId: org, hotelId, taskId: task.id, actorUserId: actor.identityId, action: 'CREATED', toStatus: task.status, notes: task.notes ?? undefined });
      await this.audit(tx, org, hotelId, actor, correlationId, 'housekeeping.task.created', 'housekeeping-task', task.id, { roomId: room.id, priority: task.priority });
      return task;
    });
  }

  async assignTask(context: AuthorizationContext, hotelId: string, taskId: string, userId: string, priority: OperationsPriority | undefined, dueAt: string | undefined, instructions: string | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    await this.staffMember(org, hotelId, userId, 'housekeeping');
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.housekeepingTask.findFirst({ where: { id: taskId, organizationId: org, hotelId } });
      if (!task) throw new NotFoundException('Housekeeping task not found.');
      if (!( [HousekeepingTaskStatus.PENDING, HousekeepingTaskStatus.ASSIGNED] as HousekeepingTaskStatus[]).includes(task.status)) throw new ConflictException('Only pending tasks may be assigned or reassigned.');
      const updated = await tx.housekeepingTask.update({ where: { id: task.id }, data: { assignedToUserId: userId, priority: priority ?? task.priority, dueAt: dueAt === undefined ? task.dueAt : parseDate(dueAt), instructions: instructions === undefined ? task.instructions : instructions.trim() || null, status: HousekeepingTaskStatus.ASSIGNED } });
      await this.taskEvent(tx, { organizationId: org, hotelId, taskId, actorUserId: actor.identityId, action: task.assignedToUserId ? 'REASSIGNED' : 'ASSIGNED', fromStatus: task.status, toStatus: updated.status });
      await this.audit(tx, org, hotelId, actor, correlationId, 'housekeeping.task.assigned', 'housekeeping-task', taskId, { assignedToUserId: userId });
      return updated;
    });
  }

  async startTask(context: AuthorizationContext, hotelId: string, taskId: string, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.housekeepingTask.findFirst({ where: { id: taskId, organizationId: org, hotelId }, include: { room: true } });
      if (!task) throw new NotFoundException('Housekeeping task not found.');
      if (task.status !== HousekeepingTaskStatus.ASSIGNED) throw new ConflictException('Only assigned tasks can be started.');
      if (task.assignedToUserId !== actor.identityId && !context.permissions.includes('housekeeping.manage')) throw new ForbiddenException('Only the assigned housekeeper or a supervisor may start this task.');
      if (!['DIRTY', 'CLEANING', 'AVAILABLE', 'INSPECTED'].includes(task.room.status)) throw new ConflictException('The room is not in a cleanable status.');
      if (task.room.status === 'AVAILABLE' || task.room.status === 'INSPECTED') await tx.hotelRoom.update({ where: { id: task.roomId }, data: { status: 'DIRTY' } });
      if (task.room.status !== 'CLEANING') await tx.hotelRoom.update({ where: { id: task.roomId }, data: { status: 'CLEANING' } });
      const updated = await tx.housekeepingTask.update({ where: { id: task.id }, data: { status: HousekeepingTaskStatus.IN_PROGRESS, startedAt: new Date(), startedByUserId: actor.identityId } });
      await this.taskEvent(tx, { organizationId: org, hotelId, taskId, actorUserId: actor.identityId, action: 'STARTED', fromStatus: task.status, toStatus: updated.status });
      await this.audit(tx, org, hotelId, actor, correlationId, 'housekeeping.task.started', 'housekeeping-task', taskId);
      return updated;
    });
  }

  async completeTask(context: AuthorizationContext, hotelId: string, taskId: string, notes: string | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.housekeepingTask.findFirst({ where: { id: taskId, organizationId: org, hotelId }, include: { room: true } });
      if (!task) throw new NotFoundException('Housekeeping task not found.');
      if (task.status !== HousekeepingTaskStatus.IN_PROGRESS) throw new ConflictException('Only in-progress tasks can be completed.');
      if (task.assignedToUserId !== actor.identityId && !context.permissions.includes('housekeeping.manage')) throw new ForbiddenException('Only the assigned housekeeper or a supervisor may complete this task.');
      if (task.room.status !== 'CLEANING') throw new ConflictException('The room must remain in cleaning status until inspection.');
      const updated = await tx.housekeepingTask.update({ where: { id: task.id }, data: { status: HousekeepingTaskStatus.COMPLETED, completedAt: new Date(), completedByUserId: actor.identityId, notes: notes === undefined ? task.notes : notes.trim() || null } });
      await this.taskEvent(tx, { organizationId: org, hotelId, taskId, actorUserId: actor.identityId, action: 'COMPLETED', fromStatus: task.status, toStatus: updated.status, notes: notes?.trim() });
      await this.audit(tx, org, hotelId, actor, correlationId, 'housekeeping.task.completed', 'housekeeping-task', taskId);
      return updated;
    });
  }

  async inspections(context: AuthorizationContext, hotelId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.housekeepingInspection.findMany({ where: { organizationId: org, hotelId }, include: { room: true, inspector: { select: { id: true, email: true } }, task: true }, orderBy: { inspectedAt: 'desc' }, take: 500 });
  }

  async inspectTask(context: AuthorizationContext, hotelId: string, taskId: string, result: 'APPROVED' | 'REJECTED', score: number, notes: string | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.housekeepingTask.findFirst({ where: { id: taskId, organizationId: org, hotelId }, include: { room: true } });
      if (!task) throw new NotFoundException('Housekeeping task not found.');
      if (task.status !== HousekeepingTaskStatus.COMPLETED) throw new ConflictException('Only completed cleaning tasks can be inspected.');
      if (task.completedByUserId === actor.identityId && !context.permissions.includes('housekeeping.inspect.self')) throw new ForbiddenException('A cleaner cannot approve their own inspection.');
      if (result === 'REJECTED' && !notes?.trim()) throw new ConflictException('Inspection rejection requires notes.');
      if (task.room.status !== 'CLEANING') throw new ConflictException('Room status changed before inspection.');
      const inspection = await tx.housekeepingInspection.create({ data: { organizationId: org, hotelId, taskId, roomId: task.roomId, inspectorId: actor.identityId, result, score, notes: notes?.trim() || null } });
      const nextStatus = result === 'APPROVED' ? HousekeepingTaskStatus.APPROVED : HousekeepingTaskStatus.ASSIGNED;
      const updated = await tx.housekeepingTask.update({ where: { id: task.id }, data: { status: nextStatus, ...(result === 'APPROVED' ? { approvedAt: new Date() } : { completedAt: null, completedByUserId: null }) } });
      await tx.hotelRoom.update({ where: { id: task.roomId }, data: { status: result === 'APPROVED' ? 'INSPECTED' : 'DIRTY' } });
      await this.taskEvent(tx, { organizationId: org, hotelId, taskId, actorUserId: actor.identityId, action: result, fromStatus: task.status, toStatus: updated.status, notes });
      await this.audit(tx, org, hotelId, actor, correlationId, `housekeeping.inspection.${result.toLowerCase()}`, 'housekeeping-inspection', inspection.id, { taskId, roomId: task.roomId, score });
      return { inspection, task: updated };
    });
  }

  async maintenanceRequests(context: AuthorizationContext, hotelId: string, actor: AuthenticatedIdentity, onlyMine = false, reportedOnly = false) {
    const org = this.scope(context, hotelId);
    return this.prisma.maintenanceRequest.findMany({ where: { organizationId: org, hotelId, ...(onlyMine ? { workOrder: { is: { assignedToUserId: actor.identityId } } } : {}), ...(reportedOnly ? { reportedByUserId: actor.identityId } : {}) }, include: { room: true, reporter: { select: { id: true, email: true } }, workOrder: { include: { assignee: { select: { id: true, email: true } }, creator: { select: { id: true, email: true } }, events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, email: true } } } } } } }, orderBy: [{ priority: 'desc' }, { reportedAt: 'desc' }], take: 500 });
  }

  async createMaintenanceRequest(context: AuthorizationContext, hotelId: string, input: { title: string; description: string; roomId?: string; location?: string; category: string; priority: OperationsPriority; blocksRoom: boolean; notes?: string }, actor: AuthenticatedIdentity, correlationId: string, key?: string) {
    const org = this.scope(context, hotelId);
    if (!input.roomId && !input.location?.trim()) throw new ConflictException('Choose a room or enter a facility location.');
    const idem = key?.trim() || randomUUID();
    if (idem.length > 100 || !/^[a-zA-Z0-9._:-]+$/.test(idem)) throw new ConflictException('Idempotency key must be 1–100 safe characters.');
    const room = input.roomId ? await this.room(this.prisma, org, hotelId, input.roomId) : null;
    if (room && input.blocksRoom && ['OCCUPIED', 'RESERVED'].includes(room.status)) throw new ConflictException('Occupied or reserved rooms cannot be taken out of service.');
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.maintenanceRequest.findFirst({ where: { organizationId: org, hotelId, idempotencyKey: idem } });
      if (prior) return prior;
      if (room && input.blocksRoom) await tx.hotelRoom.update({ where: { id: room.id }, data: { status: 'MAINTENANCE' } });
      const request = await tx.maintenanceRequest.create({ data: { organizationId: org, hotelId, roomId: room?.id, title: input.title.trim(), description: input.description.trim(), location: room ? null : input.location?.trim(), category: input.category.trim(), priority: input.priority, blocksRoom: Boolean(room && input.blocksRoom), reportedByUserId: actor.identityId, notes: input.notes?.trim() || null, idempotencyKey: idem } });
      await this.audit(tx, org, hotelId, actor, correlationId, 'maintenance.request.created', 'maintenance-request', request.id, { roomId: room?.id ?? null, blocksRoom: request.blocksRoom, category: request.category });
      return request;
    });
  }

  async createWorkOrder(context: AuthorizationContext, hotelId: string, requestId: string, input: { priority?: OperationsPriority; dueAt?: string; notes?: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.maintenanceRequest.findFirst({ where: { id: requestId, organizationId: org, hotelId } });
      if (!request) throw new NotFoundException('Maintenance request not found.');
      if (request.status !== 'OPEN') throw new ConflictException('Only open maintenance requests can become work orders.');
      const workOrder = await tx.maintenanceWorkOrder.create({ data: { organizationId: org, hotelId, requestId, priority: input.priority ?? request.priority, dueAt: parseDate(input.dueAt), notes: input.notes?.trim() || null, createdByUserId: actor.identityId } });
      await tx.maintenanceRequest.update({ where: { id: request.id }, data: { status: 'CONVERTED' } });
      await this.workEvent(tx, { organizationId: org, hotelId, workOrderId: workOrder.id, actorUserId: actor.identityId, action: 'CREATED', toStatus: workOrder.status, notes: workOrder.notes ?? undefined });
      await this.audit(tx, org, hotelId, actor, correlationId, 'maintenance.work-order.created', 'maintenance-work-order', workOrder.id, { requestId });
      return workOrder;
    });
  }

  async assignWorkOrder(context: AuthorizationContext, hotelId: string, workOrderId: string, userId: string, dueAt: string | undefined, priority: OperationsPriority | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    await this.staffMember(org, hotelId, userId, 'maintenance');
    return this.prisma.$transaction(async (tx) => {
      const work = await tx.maintenanceWorkOrder.findFirst({ where: { id: workOrderId, organizationId: org, hotelId } });
      if (!work) throw new NotFoundException('Work order not found.');
      if (!( [MaintenanceWorkOrderStatus.OPEN, MaintenanceWorkOrderStatus.ASSIGNED] as MaintenanceWorkOrderStatus[]).includes(work.status)) throw new ConflictException('Only open work orders can be assigned or reassigned.');
      const updated = await tx.maintenanceWorkOrder.update({ where: { id: work.id }, data: { assignedToUserId: userId, dueAt: dueAt === undefined ? work.dueAt : parseDate(dueAt), priority: priority ?? work.priority, status: MaintenanceWorkOrderStatus.ASSIGNED } });
      await this.workEvent(tx, { organizationId: org, hotelId, workOrderId, actorUserId: actor.identityId, action: work.assignedToUserId ? 'REASSIGNED' : 'ASSIGNED', fromStatus: work.status, toStatus: updated.status });
      await this.audit(tx, org, hotelId, actor, correlationId, 'maintenance.work-order.assigned', 'maintenance-work-order', workOrderId, { assignedToUserId: userId });
      return updated;
    });
  }

  async transitionWorkOrder(context: AuthorizationContext, hotelId: string, workOrderId: string, action: 'START' | 'HOLD' | 'PARTS' | 'COMPLETE' | 'CLOSE', notes: string | undefined, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const work = await tx.maintenanceWorkOrder.findFirst({ where: { id: workOrderId, organizationId: org, hotelId }, include: { request: true } });
      if (!work) throw new NotFoundException('Work order not found.');
      const technicianAction = ['START', 'HOLD', 'PARTS', 'COMPLETE'].includes(action);
      if (technicianAction && work.assignedToUserId !== actor.identityId && !context.permissions.includes('maintenance.manage')) throw new ForbiddenException('Only the assigned technician or a maintenance manager may update this work order.');
      const targets: Record<typeof action, MaintenanceWorkOrderStatus> = { START: MaintenanceWorkOrderStatus.IN_PROGRESS, HOLD: MaintenanceWorkOrderStatus.ON_HOLD, PARTS: MaintenanceWorkOrderStatus.AWAITING_PARTS, COMPLETE: MaintenanceWorkOrderStatus.COMPLETED, CLOSE: MaintenanceWorkOrderStatus.CLOSED };
      const allowed: Record<typeof action, MaintenanceWorkOrderStatus[]> = { START: [MaintenanceWorkOrderStatus.ASSIGNED, MaintenanceWorkOrderStatus.ON_HOLD, MaintenanceWorkOrderStatus.AWAITING_PARTS], HOLD: [MaintenanceWorkOrderStatus.IN_PROGRESS], PARTS: [MaintenanceWorkOrderStatus.IN_PROGRESS], COMPLETE: [MaintenanceWorkOrderStatus.IN_PROGRESS, MaintenanceWorkOrderStatus.ON_HOLD, MaintenanceWorkOrderStatus.AWAITING_PARTS], CLOSE: [MaintenanceWorkOrderStatus.COMPLETED] };
      if (!allowed[action].includes(work.status)) throw new ConflictException(`Cannot ${action.toLowerCase()} a ${work.status.toLowerCase().replaceAll('_', ' ')} work order.`);
      if (['HOLD', 'PARTS'].includes(action) && !notes?.trim()) throw new ConflictException('A progress note is required for this update.');
      if (action === 'COMPLETE' && !notes?.trim()) throw new ConflictException('Resolution details are required to complete work.');
      const status = targets[action];
      const updated = await tx.maintenanceWorkOrder.update({ where: { id: work.id }, data: { status, ...(action === 'START' ? { startedAt: new Date() } : {}), ...(action === 'COMPLETE' ? { completedAt: new Date(), resolution: notes!.trim() } : {}), ...(action === 'CLOSE' ? { closedAt: new Date() } : {}), ...(notes ? { notes: `${work.notes ? `${work.notes}\n` : ''}${notes.trim()}` } : {}) } });
      if (action === 'CLOSE') {
        await tx.maintenanceRequest.update({ where: { id: work.requestId }, data: { status: 'CLOSED' } });
        if (work.request.blocksRoom && work.request.roomId) {
          const otherBlockingRequests = await tx.maintenanceRequest.count({ where: { organizationId: org, hotelId, roomId: work.request.roomId, blocksRoom: true, status: { in: ['OPEN', 'CONVERTED'] }, id: { not: work.requestId } } });
          if (otherBlockingRequests === 0) await tx.hotelRoom.updateMany({ where: { id: work.request.roomId, organizationId: org, hotelId, status: { in: ['MAINTENANCE', 'OUT_OF_SERVICE'] } }, data: { status: 'DIRTY' } });
        }
      }
      await this.workEvent(tx, { organizationId: org, hotelId, workOrderId, actorUserId: actor.identityId, action, fromStatus: work.status, toStatus: status, notes });
      await this.audit(tx, org, hotelId, actor, correlationId, `maintenance.work-order.${action.toLowerCase()}`, 'maintenance-work-order', workOrderId, { requestId: work.requestId, roomId: work.request.roomId });
      return updated;
    });
  }
}
