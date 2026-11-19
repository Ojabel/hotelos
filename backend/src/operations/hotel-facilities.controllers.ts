import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { CurrentAuthorization, CurrentUser, RequireAnyPermissions, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';
import { HotelFacilitiesService } from './hotel-facilities.service';

const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const taskTypes = ['TURNOVER', 'DAILY', 'DEEP', 'MAINTENANCE_RETURN'] as const;
const staffAreas = ['housekeeping', 'maintenance'] as const;
function correlationId(request: Request) { return typeof request.id === 'string' ? request.id : 'unknown'; }

class CreateTaskDto {
  @IsUUID() roomId!: string;
  @IsIn(taskTypes) type!: typeof taskTypes[number];
  @IsIn(priorities) priority!: typeof priorities[number];
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
class AssignTaskDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsIn(priorities) priority?: typeof priorities[number];
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
}
class CompleteTaskDto { @IsOptional() @IsString() @MaxLength(4000) notes?: string; }
class InspectTaskDto {
  @IsIn(['APPROVED', 'REJECTED']) result!: 'APPROVED' | 'REJECTED';
  @IsInt() @Min(0) @Max(100) score!: number;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
class CreateMaintenanceRequestDto {
  @IsString() @MaxLength(200) title!: string;
  @IsString() @MaxLength(4000) description!: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsString() @MaxLength(80) category!: string;
  @IsIn(priorities) priority!: typeof priorities[number];
  @IsBoolean() blocksRoom!: boolean;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
class CreateWorkOrderDto {
  @IsOptional() @IsIn(priorities) priority?: typeof priorities[number];
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
class AssignWorkOrderDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsIn(priorities) priority?: typeof priorities[number];
}
class WorkOrderActionDto { @IsOptional() @IsString() @MaxLength(4000) notes?: string; }

@ApiTags('hotel-facilities')
@ApiBearerAuth()
@Controller('hotels/:hotelId')
export class HotelFacilitiesController {
  constructor(private readonly facilities: HotelFacilitiesService) {}

  @Get('operations-staff/housekeeping')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.manage', 'housekeeping.tasks.self')
  housekeepingStaff(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.facilities.staff(auth, hotelId, 'housekeeping'); }

  @Get('operations-staff/maintenance')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('maintenance.manage', 'maintenance.work.self')
  maintenanceStaff(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.facilities.staff(auth, hotelId, 'maintenance'); }

  @Get('operations-staff/candidates')
  @RequirePermissions('hotel.read', 'staff.manage')
  staffCandidates(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Query('area') area: string, @CurrentAuthorization() auth: AuthorizationContext) {
    if (!staffAreas.includes(area as typeof staffAreas[number])) throw new BadRequestException('Choose a valid staff area.');
    return this.facilities.staffCandidates(auth, hotelId, area as 'housekeeping' | 'maintenance');
  }

  @Post('operations-staff/:area/:userId')
  @RequirePermissions('hotel.read', 'staff.manage')
  addStaff(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('area') area: string, @Param('userId', ParseUUIDPipe) userId: string, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) {
    if (!staffAreas.includes(area as typeof staffAreas[number])) throw new BadRequestException('Invalid staff area.');
    return this.facilities.addStaff(auth, hotelId, userId, area as 'housekeeping' | 'maintenance', actor, correlationId(request));
  }

  @Get('housekeeping/tasks')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.read', 'housekeeping.manage', 'housekeeping.tasks.self')
  tasks(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Query('status') status: string | undefined, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity) {
    const allowed = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'AWAITING_INSPECTION', 'APPROVED'];
    if (status && !allowed.includes(status)) throw new BadRequestException('Invalid housekeeping status.');
    const onlyMine = auth.permissions.includes('housekeeping.tasks.self') && !auth.permissions.includes('housekeeping.manage');
    return this.facilities.tasks(auth, hotelId, actor, onlyMine, status as never);
  }

  @Post('housekeeping/tasks')
  @RequirePermissions('hotel.read', 'housekeeping.manage')
  createTask(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateTaskDto, @Headers('idempotency-key') key: string | undefined, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) {
    return this.facilities.createTask(auth, hotelId, body, actor, correlationId(request), key);
  }

  @Patch('housekeeping/tasks/:taskId/assign')
  @RequirePermissions('hotel.read', 'housekeeping.manage')
  assignTask(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() body: AssignTaskDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) {
    return this.facilities.assignTask(auth, hotelId, taskId, body.userId, body.priority, body.dueAt, body.instructions, actor, correlationId(request));
  }

  @Patch('housekeeping/tasks/:taskId/start')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.manage', 'housekeeping.tasks.self')
  startTask(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('taskId', ParseUUIDPipe) taskId: string, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.startTask(auth, hotelId, taskId, actor, correlationId(request)); }

  @Patch('housekeeping/tasks/:taskId/complete')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.manage', 'housekeeping.tasks.self')
  completeTask(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() body: CompleteTaskDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.completeTask(auth, hotelId, taskId, body.notes, actor, correlationId(request)); }

  @Get('housekeeping/inspections')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.inspect', 'housekeeping.inspect.self')
  inspections(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.facilities.inspections(auth, hotelId); }

  @Post('housekeeping/tasks/:taskId/inspection')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('housekeeping.inspect', 'housekeeping.inspect.self')
  inspectTask(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() body: InspectTaskDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.inspectTask(auth, hotelId, taskId, body.result, body.score, body.notes, actor, correlationId(request)); }

  @Get('maintenance/requests')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('maintenance.read', 'maintenance.manage', 'maintenance.report', 'maintenance.work.self')
  maintenanceRequests(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity) {
    const onlyMine = auth.permissions.includes('maintenance.work.self') && !auth.permissions.includes('maintenance.manage');
    const reportedOnly = auth.permissions.includes('maintenance.report') && !auth.permissions.includes('maintenance.read') && !auth.permissions.includes('maintenance.manage') && !onlyMine;
    return this.facilities.maintenanceRequests(auth, hotelId, actor, onlyMine, reportedOnly);
  }

  @Post('maintenance/requests')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('maintenance.report', 'maintenance.manage')
  createMaintenanceRequest(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: CreateMaintenanceRequestDto, @Headers('idempotency-key') key: string | undefined, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.createMaintenanceRequest(auth, hotelId, body, actor, correlationId(request), key); }

  @Post('maintenance/requests/:requestId/work-orders')
  @RequirePermissions('hotel.read', 'maintenance.manage')
  createWorkOrder(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('requestId', ParseUUIDPipe) requestId: string, @Body() body: CreateWorkOrderDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.createWorkOrder(auth, hotelId, requestId, body, actor, correlationId(request)); }

  @Patch('maintenance/work-orders/:workOrderId/assign')
  @RequirePermissions('hotel.read', 'maintenance.manage')
  assignWorkOrder(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('workOrderId', ParseUUIDPipe) id: string, @Body() body: AssignWorkOrderDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.facilities.assignWorkOrder(auth, hotelId, id, body.userId, body.dueAt, body.priority, actor, correlationId(request)); }

  @Patch('maintenance/work-orders/:workOrderId/:action')
  @RequirePermissions('hotel.read') @RequireAnyPermissions('maintenance.manage', 'maintenance.work.self')
  workOrderAction(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('workOrderId', ParseUUIDPipe) id: string, @Param('action') rawAction: string, @Body() body: WorkOrderActionDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) {
    const actions = ['start', 'hold', 'parts', 'complete', 'close'] as const;
    if (!actions.includes(rawAction as typeof actions[number])) throw new BadRequestException('Invalid work order action.');
    const action = rawAction.toUpperCase() as 'START' | 'HOLD' | 'PARTS' | 'COMPLETE' | 'CLOSE';
    if (action === 'CLOSE' && !auth.permissions.includes('maintenance.manage')) throw new ForbiddenException('Only maintenance management can close a work order.');
    return this.facilities.transitionWorkOrder(auth, hotelId, id, action, body.notes, actor, correlationId(request));
  }
}
