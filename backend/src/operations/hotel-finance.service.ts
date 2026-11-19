import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FinancialPaymentMethod, FinancialRefundStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';
import { AuthorizationContextService } from '../authorization/authorization-context.service';

const includeFolio = { entries: { orderBy: { serviceDate: 'asc' as const } }, invoices: { orderBy: { issuedAt: 'desc' as const }, include: { allocations: true, lines: { orderBy: { serviceDate: 'asc' as const } } } }, payments: { orderBy: { receivedAt: 'desc' as const }, include: { receipt: true, allocations: true, refunds: true } }, refunds: { orderBy: { requestedAt: 'desc' as const } } } as const;
const minor = (value: number) => { if (!Number.isSafeInteger(value) || value <= 0) throw new BadRequestException('Amount must be a positive integer number of minor currency units.'); return value; };
const parseDate = (value: string) => { const date = new Date(`${value}T00:00:00.000Z`); if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Date must use YYYY-MM-DD.'); return date; };
const methodMap: Record<string, FinancialPaymentMethod> = { cash: 'CASH', bank_transfer: 'BANK_TRANSFER', pos: 'CARD', online: 'OTHER', CASH: 'CASH', BANK_TRANSFER: 'BANK_TRANSFER', CARD: 'CARD', OTHER: 'OTHER' };
const idKey = (key?: string) => { const value = key?.trim() || randomUUID(); if (value.length > 100 || !/^[a-zA-Z0-9._:-]+$/.test(value)) throw new BadRequestException('Idempotency key must be 1–100 safe characters.'); return value; };

@Injectable()
export class HotelFinanceService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationContextService) {}
  private scope(context: AuthorizationContext, hotelId: string) { this.authorization.assertHotelAccess(context, hotelId); return context.organization.id; }
  private async audit(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, actor: AuthenticatedIdentity, correlationId: string, action: string, resource: string, resourceId: string, metadata?: Prisma.InputJsonValue) {
    await tx.auditEvent.create({ data: { organizationId, hotelId, actorUserId: actor.identityId, correlationId, action, resource, resourceId, ...(metadata ? { metadata } : {}) } });
  }
  private async getFolio(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, reservationId: string) {
    const reservation = await tx.hotelReservation.findFirst({ where: { id: reservationId, organizationId, hotelId } });
    if (!reservation) throw new NotFoundException('Reservation not found.');
    return tx.guestFolio.upsert({ where: { organizationId_hotelId_reservationId: { organizationId, hotelId, reservationId } }, create: { organizationId, hotelId, reservationId, guestId: reservation.guestId }, update: {} });
  }
  private async totals(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, folioId: string) {
    const [entries, refunds] = await Promise.all([tx.folioEntry.findMany({ where: { organizationId, hotelId, folioId } }), tx.financialRefund.findMany({ where: { organizationId, hotelId, folioId, status: 'PROCESSED' } })]);
    const chargesMinor = entries.filter((e) => ['ROOM_CHARGE', 'SERVICE_CHARGE', 'ADJUSTMENT'].includes(e.kind)).reduce((s, e) => s + e.amountMinor, 0);
    const paidMinor = entries.filter((e) => e.kind === 'PAYMENT').reduce((s, e) => s + e.amountMinor, 0);
    const refundedMinor = refunds.reduce((s, r) => s + r.amountMinor, 0);
    return { chargesMinor, paidMinor, refundedMinor, balanceMinor: chargesMinor - paidMinor + refundedMinor };
  }
  private async view(tx: Prisma.TransactionClient, organizationId: string, hotelId: string, folioId: string) {
    const folio = await tx.guestFolio.findFirst({ where: { id: folioId, organizationId, hotelId }, include: { ...includeFolio, guest: { select: { id: true, fullName: true, email: true, phone: true } }, reservation: { include: { room: { select: { id: true, number: true } } } } } });
    if (!folio) throw new NotFoundException('Folio not found.');
    return { ...folio, totals: await this.totals(tx, organizationId, hotelId, folioId) };
  }
  async folioForReservation(context: AuthorizationContext, hotelId: string, reservationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => { const folio = await this.getFolio(tx, org, hotelId, reservationId); return this.view(tx, org, hotelId, folio.id); });
  }
  async folios(context: AuthorizationContext, hotelId: string) {
    const org = this.scope(context, hotelId); const rows = await this.prisma.hotelReservation.findMany({ where: { organizationId: org, hotelId }, select: { id: true, guestId: true }, take: 100 });
    await this.prisma.guestFolio.createMany({ data: rows.map((row) => ({ organizationId: org, hotelId, reservationId: row.id, guestId: row.guestId })), skipDuplicates: true });
    const folios = await this.prisma.guestFolio.findMany({ where: { organizationId: org, hotelId }, include: { ...includeFolio, guest: { select: { id: true, fullName: true, email: true, phone: true } }, reservation: { include: { room: { select: { id: true, number: true } } } } } });
    return folios.map((folio) => { const chargesMinor = folio.entries.filter((entry) => ['ROOM_CHARGE', 'SERVICE_CHARGE', 'ADJUSTMENT'].includes(entry.kind)).reduce((sum, entry) => sum + entry.amountMinor, 0); const paidMinor = folio.entries.filter((entry) => entry.kind === 'PAYMENT').reduce((sum, entry) => sum + entry.amountMinor, 0); const refundedMinor = folio.refunds.filter((refund) => refund.status === 'PROCESSED').reduce((sum, refund) => sum + refund.amountMinor, 0); return { ...folio, totals: { chargesMinor, paidMinor, refundedMinor, balanceMinor: chargesMinor - paidMinor + refundedMinor } }; });
  }
  async addRoomCharges(context: AuthorizationContext, hotelId: string, reservationId: string, actor: AuthenticatedIdentity, correlationId: string, key?: string) {
    const org = this.scope(context, hotelId); const idem = idKey(key);
    return this.prisma.$transaction(async (tx) => {
      const folio = await this.getFolio(tx, org, hotelId, reservationId); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${folio.id}))`; const prior = await tx.folioEntry.findFirst({ where: { folioId: folio.id, kind: 'ROOM_CHARGE' } });
      if (!prior) {
        const reservation = await tx.hotelReservation.findFirstOrThrow({ where: { id: reservationId, organizationId: org, hotelId } }); const nights = (reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86_400_000;
        if (!Number.isInteger(nights) || nights < 1) throw new BadRequestException('Reservation dates are invalid.');
        for (let i = 0; i < nights; i++) await tx.folioEntry.create({ data: { organizationId: org, hotelId, folioId: folio.id, kind: 'ROOM_CHARGE', description: `Room charge — night ${i + 1}`, amountMinor: reservation.nightlyRate * 100, currency: folio.currency, serviceDate: new Date(reservation.checkIn.getTime() + i * 86_400_000), idempotencyKey: `${idem}:${i}` } });
        await this.audit(tx, org, hotelId, actor, correlationId, 'finance.room-charges.posted', 'guest-folio', folio.id, { reservationId, nights });
      }
      return this.view(tx, org, hotelId, folio.id);
    });
  }
  async getInvoice(context: AuthorizationContext, hotelId: string, invoiceId: string) { const org = this.scope(context, hotelId); const invoice = await this.prisma.financialInvoice.findFirst({ where: { id: invoiceId, organizationId: org, hotelId }, include: { folio: { include: { guest: true, reservation: { include: { room: true } } } }, allocations: true, lines: { orderBy: { serviceDate: 'asc' } } } }); if (!invoice) throw new NotFoundException('Invoice not found.'); return invoice; }
  async getReceipt(context: AuthorizationContext, hotelId: string, receiptId: string) { const org = this.scope(context, hotelId); const receipt = await this.prisma.paymentReceipt.findFirst({ where: { id: receiptId, organizationId: org, hotelId }, include: { payment: { include: { folio: { include: { guest: true, reservation: true } } } } } }); if (!receipt) throw new NotFoundException('Receipt not found.'); return receipt; }
  async addCharge(context: AuthorizationContext, hotelId: string, reservationId: string, input: { description: string; amountMinor: number; serviceDate: string; reason?: string }, actor: AuthenticatedIdentity, correlationId: string, key?: string) {
    const org = this.scope(context, hotelId); const amountMinor = minor(input.amountMinor); const description = input.description.trim(); if (!description) throw new BadRequestException('Description is required.'); if (input.reason !== undefined && !input.reason.trim()) throw new BadRequestException('Adjustment reason is required.'); const idem = idKey(key); const serviceDate = parseDate(input.serviceDate);
    return this.prisma.$transaction(async (tx) => {
      const folio = await this.getFolio(tx, org, hotelId, reservationId); const existing = await tx.folioEntry.findFirst({ where: { folioId: folio.id, idempotencyKey: idem } });
      if (!existing) { const entry = await tx.folioEntry.create({ data: { organizationId: org, hotelId, folioId: folio.id, kind: input.reason ? 'ADJUSTMENT' : 'SERVICE_CHARGE', description, amountMinor, currency: folio.currency, serviceDate, reason: input.reason?.trim(), idempotencyKey: idem } }); await this.audit(tx, org, hotelId, actor, correlationId, input.reason ? 'finance.folio.adjusted' : 'finance.charge.posted', 'folio-entry', entry.id, { amountMinor, currency: folio.currency, reason: input.reason }); }
      return this.view(tx, org, hotelId, folio.id);
    });
  }
  async invoice(context: AuthorizationContext, hotelId: string, reservationId: string, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const folio = await this.getFolio(tx, org, hotelId, reservationId); await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${folio.id}))`; const existing = await tx.financialInvoice.findFirst({ where: { organizationId: org, hotelId, folioId: folio.id, status: { not: 'CANCELLED' } }, orderBy: { issuedAt: 'desc' } });
      const entries = await tx.folioEntry.findMany({ where: { organizationId: org, hotelId, folioId: folio.id, kind: { in: ['ROOM_CHARGE', 'SERVICE_CHARGE', 'ADJUSTMENT'] }, invoiceLines: { none: {} } }, orderBy: { serviceDate: 'asc' } });
      if (!entries.length) { if (existing) return existing; throw new ConflictException('Post room charges before issuing an invoice.'); }
      const totalMinor = entries.reduce((s, e) => s + e.amountMinor, 0); const seq = await tx.financialInvoice.count({ where: { organizationId: org, hotelId } }) + 1;
      const invoice = await tx.financialInvoice.create({ data: { organizationId: org, hotelId, folioId: folio.id, reference: `INV-${new Date().toISOString().slice(2, 7).replace('-', '')}-${String(seq).padStart(5, '0')}`, currency: folio.currency, subtotalMinor: totalMinor, totalMinor, snapshot: JSON.parse(JSON.stringify({ guest: (await tx.hotelGuest.findFirst({ where: { id: folio.guestId, organizationId: org, hotelId }, select: { fullName: true, email: true, phone: true } })), reservation: await tx.hotelReservation.findFirst({ where: { id: reservationId, organizationId: org, hotelId }, include: { room: { select: { number: true } } } }), lines: entries.map(({ id, description, amountMinor, currency, serviceDate }) => ({ folioEntryId: id, description, amountMinor, currency, serviceDate })), subtotalMinor: totalMinor, totalMinor })) as Prisma.InputJsonValue, lines: { create: entries.map((entry) => ({ description: entry.description, amountMinor: entry.amountMinor, currency: entry.currency, serviceDate: entry.serviceDate, folioEntry: { connect: { organizationId_hotelId_id: { organizationId: org, hotelId, id: entry.id } } } })) } }, include: { lines: true } });
      await this.audit(tx, org, hotelId, actor, correlationId, 'finance.invoice.issued', 'financial-invoice', invoice.id, { reference: invoice.reference, totalMinor, currency: folio.currency }); return invoice;
    });
  }
  async recordPayment(context: AuthorizationContext, hotelId: string, reservationId: string, input: { amountMinor: number; method: string; idempotencyKey: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId); const amountMinor = minor(input.amountMinor); const method = methodMap[input.method]; if (!method) throw new BadRequestException('Unsupported payment method.'); const idem = idKey(input.idempotencyKey);
    return this.prisma.$transaction(async (tx) => {
      const folio = await this.getFolio(tx, org, hotelId, reservationId); const duplicate = await tx.financialPayment.findFirst({ where: { organizationId: org, hotelId, idempotencyKey: idem }, include: { receipt: true, allocations: true } }); if (duplicate) return { ...duplicate, totals: await this.totals(tx, org, hotelId, folio.id) };
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${folio.id}))`;
      const totals = await this.totals(tx, org, hotelId, folio.id); if (amountMinor > totals.balanceMinor) throw new ConflictException('Payment exceeds the outstanding folio balance.');
      const invoices = await tx.financialInvoice.findMany({ where: { organizationId: org, hotelId, folioId: folio.id, status: { not: 'CANCELLED' } }, orderBy: { issuedAt: 'asc' } }); if (!invoices.length) throw new ConflictException('Issue an invoice before recording payment.');
      let unallocated = amountMinor;
      const invoiceAllocations: Array<{ invoiceId: string; amountMinor: number; paidMinor: number }> = [];
      for (const invoice of invoices) {
        if (unallocated <= 0) break;
        const invoicePaid = await tx.paymentAllocation.aggregate({ where: { organizationId: org, hotelId, invoiceId: invoice.id }, _sum: { amountMinor: true } });
        const due = Math.max(0, invoice.totalMinor - (invoicePaid._sum.amountMinor ?? 0));
        const allocated = Math.min(due, unallocated);
        if (allocated > 0) { invoiceAllocations.push({ invoiceId: invoice.id, amountMinor: allocated, paidMinor: (invoicePaid._sum.amountMinor ?? 0) + allocated }); unallocated -= allocated; }
      }
      if (unallocated > 0) throw new ConflictException('Payment exceeds invoiced balances. Issue an invoice for new charges.');
      const seq = await tx.financialPayment.count({ where: { organizationId: org, hotelId } }) + 1; const reference = `PAY-${String(seq).padStart(7, '0')}`;
      const payment = await tx.financialPayment.create({ data: { organizationId: org, hotelId, folioId: folio.id, reference, idempotencyKey: idem, method, amountMinor, allocatedMinor: amountMinor, currency: folio.currency } });
      const entry = await tx.folioEntry.create({ data: { organizationId: org, hotelId, folioId: folio.id, kind: 'PAYMENT', description: `Payment ${reference}`, amountMinor, currency: folio.currency, serviceDate: new Date() } });
      const receipt = await tx.paymentReceipt.create({ data: { organizationId: org, hotelId, paymentId: payment.id, reference: reference.replace('PAY-', 'RCT-'), snapshot: { paymentReference: reference, amountMinor, currency: folio.currency, method, guestId: folio.guestId, reservationId } } });
      await tx.paymentAllocation.createMany({ data: invoiceAllocations.map(({ invoiceId, amountMinor: allocated }) => ({ organizationId: org, hotelId, paymentId: payment.id, invoiceId, folioEntryId: entry.id, amountMinor: allocated })) }); const balanceMinor = totals.balanceMinor - amountMinor;
      for (const allocation of invoiceAllocations) { const invoice = invoices.find((item) => item.id === allocation.invoiceId)!; await tx.financialInvoice.update({ where: { id: invoice.id }, data: { status: allocation.paidMinor >= invoice.totalMinor ? 'PAID' : 'PARTIALLY_PAID' } }); } await this.audit(tx, org, hotelId, actor, correlationId, 'finance.payment.recorded', 'financial-payment', payment.id, { reference, amountMinor, currency: folio.currency, method });
      return { ...payment, receipt, totals: { ...totals, paidMinor: totals.paidMinor + amountMinor, balanceMinor } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ConflictException('Concurrent financial update; retry with the same idempotency key.'); throw error; });
  }
  async payments(context: AuthorizationContext, hotelId: string) { const org = this.scope(context, hotelId); return this.prisma.financialPayment.findMany({ where: { organizationId: org, hotelId }, include: { receipt: true, folio: { include: { guest: true, reservation: true } }, refunds: true }, orderBy: { receivedAt: 'desc' } }); }
  async invoiceList(context: AuthorizationContext, hotelId: string) { const org = this.scope(context, hotelId); return this.prisma.financialInvoice.findMany({ where: { organizationId: org, hotelId }, include: { folio: { include: { guest: true, reservation: true } }, allocations: true, lines: { orderBy: { serviceDate: 'asc' } } }, orderBy: { issuedAt: 'desc' } }); }
  async refunds(context: AuthorizationContext, hotelId: string) { const org = this.scope(context, hotelId); return this.prisma.financialRefund.findMany({ where: { organizationId: org, hotelId }, include: { payment: { include: { folio: { include: { guest: true, reservation: true } } } } }, orderBy: { requestedAt: 'desc' } }); }
  async requestRefund(context: AuthorizationContext, hotelId: string, paymentId: string, input: { amountMinor: number; reason: string; idempotencyKey: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId); const amountMinor = minor(input.amountMinor); const reason = input.reason.trim(); if (!reason) throw new BadRequestException('Refund reason is required.'); const idem = idKey(input.idempotencyKey);
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.financialPayment.findFirst({ where: { id: paymentId, organizationId: org, hotelId }, include: { refunds: true } }); if (!payment) throw new NotFoundException('Payment not found.');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
      const prior = await tx.financialRefund.findFirst({ where: { organizationId: org, hotelId, idempotencyKey: idem } }); if (prior) return prior;
      const pending = payment.refunds.filter((r) => r.status === 'PENDING' || r.status === 'APPROVED').reduce((s, r) => s + r.amountMinor, 0); const processed = payment.refunds.filter((r) => r.status === 'PROCESSED').reduce((s, r) => s + r.amountMinor, 0); if (amountMinor > payment.amountMinor - pending - processed) throw new ConflictException('Refund exceeds the unrefunded payment amount.');
      const seq = await tx.financialRefund.count({ where: { organizationId: org, hotelId } }) + 1; const refund = await tx.financialRefund.create({ data: { organizationId: org, hotelId, folioId: payment.folioId, paymentId, amountMinor, currency: payment.currency, reason, idempotencyKey: idem, reference: `RFD-${String(seq).padStart(7, '0')}` } });
      await this.audit(tx, org, hotelId, actor, correlationId, 'finance.refund.requested', 'financial-refund', refund.id, { paymentId, amountMinor, reason }); return refund;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async updateRefund(context: AuthorizationContext, hotelId: string, refundId: string, status: FinancialRefundStatus, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId);
    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.financialRefund.findFirst({ where: { id: refundId, organizationId: org, hotelId } }); if (!refund) throw new NotFoundException('Refund not found.');
      const allowed = refund.status === 'PENDING' ? ['APPROVED', 'REJECTED'] : refund.status === 'APPROVED' ? ['PROCESSED'] : []; if (!allowed.includes(status)) throw new ConflictException('Invalid refund state transition.');
      const updated = await tx.financialRefund.update({ where: { id: refund.id }, data: { status, processedAt: status === 'PROCESSED' ? new Date() : undefined } });
      if (status === 'PROCESSED') {
        await tx.folioEntry.create({ data: { organizationId: org, hotelId, folioId: refund.folioId, kind: 'REFUND', description: `Refund ${refund.reference}`, amountMinor: refund.amountMinor, currency: refund.currency, serviceDate: new Date(), idempotencyKey: `refund:${refund.id}` } });
        const allocations = await tx.paymentAllocation.findMany({ where: { organizationId: org, hotelId, paymentId: refund.paymentId }, select: { invoiceId: true, amountMinor: true } });
        for (const allocation of allocations) {
          const allocatedTotal = allocations.filter((item) => item.invoiceId === allocation.invoiceId).reduce((sum, item) => sum + item.amountMinor, 0);
          const refunded = await tx.financialRefund.aggregate({ where: { organizationId: org, hotelId, paymentId: refund.paymentId, status: 'PROCESSED' }, _sum: { amountMinor: true } });
          const invoice = await tx.financialInvoice.findFirst({ where: { id: allocation.invoiceId, organizationId: org, hotelId } });
          if (invoice) { const netPaid = Math.max(0, allocatedTotal - (refunded._sum.amountMinor ?? 0)); await tx.financialInvoice.update({ where: { id: invoice.id }, data: { status: netPaid >= invoice.totalMinor ? 'PAID' : netPaid > 0 ? 'PARTIALLY_PAID' : 'ISSUED' } }); }
        }
      }
      await this.audit(tx, org, hotelId, actor, correlationId, `finance.refund.${status.toLowerCase()}`, 'financial-refund', refund.id, { paymentId: refund.paymentId, amountMinor: refund.amountMinor }); return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async expenses(context: AuthorizationContext, hotelId: string, from?: string, to?: string, categoryId?: string, category?: string) { const org = this.scope(context, hotelId); return this.prisma.hotelExpense.findMany({ where: { organizationId: org, hotelId, ...(categoryId ? { categoryId } : category ? { category: { name: category } } : {}), ...(from || to ? { expenseDate: { ...(from ? { gte: parseDate(from) } : {}), ...(to ? { lte: parseDate(to) } : {}) } } : {}) }, include: { category: true }, orderBy: { expenseDate: 'desc' } }); }
  async expenseCategories(context: AuthorizationContext, hotelId: string) { const org = this.scope(context, hotelId); return this.prisma.expenseCategory.findMany({ where: { organizationId: org, hotelId }, orderBy: { name: 'asc' } }); }
  async createExpense(context: AuthorizationContext, hotelId: string, input: { category: string; vendor: string; description: string; amountMinor: number; method: string; date: string; status: 'PAID' | 'PENDING'; reference?: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId); const amountMinor = minor(input.amountMinor); const method = methodMap[input.method]; if (!method) throw new BadRequestException('Unsupported payment method.'); const categoryName = input.category.trim(); if (!categoryName || !input.vendor.trim() || !input.description.trim()) throw new BadRequestException('Category, vendor and description are required.'); const expenseDate = parseDate(input.date); if (expenseDate > parseDate(new Date().toISOString().slice(0, 10))) throw new BadRequestException('Expense date cannot be in the future.');
    return this.prisma.$transaction(async (tx) => { const category = await tx.expenseCategory.upsert({ where: { hotelId_name: { hotelId, name: categoryName } }, create: { organizationId: org, hotelId, name: categoryName }, update: {} }); const expense = await tx.hotelExpense.create({ data: { organizationId: org, hotelId, categoryId: category.id, vendor: input.vendor.trim(), description: input.description.trim(), amountMinor, currency: 'NGN', method, status: input.status, expenseDate, reference: input.reference?.trim() || null }, include: { category: true } }); await this.audit(tx, org, hotelId, actor, correlationId, 'finance.expense.created', 'hotel-expense', expense.id, { amountMinor, currency: 'NGN', category: categoryName }); return expense; });
  }
  async updateExpense(context: AuthorizationContext, hotelId: string, expenseId: string, input: { category: string; vendor: string; description: string; amountMinor: number; method: string; date: string; status: 'PAID' | 'PENDING'; reference?: string }, actor: AuthenticatedIdentity, correlationId: string) {
    const org = this.scope(context, hotelId); const amountMinor = minor(input.amountMinor); const method = methodMap[input.method]; if (!method) throw new BadRequestException('Unsupported payment method.');
    return this.prisma.$transaction(async (tx) => { const current = await tx.hotelExpense.findFirst({ where: { id: expenseId, organizationId: org, hotelId } }); if (!current) throw new NotFoundException('Expense not found.'); if (current.status === 'VOID') throw new ConflictException('Voided expenses cannot be edited.'); const category = await tx.expenseCategory.upsert({ where: { hotelId_name: { hotelId, name: input.category.trim() } }, create: { organizationId: org, hotelId, name: input.category.trim() }, update: {} }); const updated = await tx.hotelExpense.update({ where: { id: current.id }, data: { categoryId: category.id, vendor: input.vendor.trim(), description: input.description.trim(), amountMinor, method, status: input.status, expenseDate: parseDate(input.date), reference: input.reference?.trim() || null }, include: { category: true } }); await this.audit(tx, org, hotelId, actor, correlationId, 'finance.expense.updated', 'hotel-expense', current.id, { before: { amountMinor: current.amountMinor, status: current.status }, after: { amountMinor, status: input.status } }); return updated; });
  }
}
