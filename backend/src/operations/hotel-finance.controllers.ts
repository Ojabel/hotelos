import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { Request } from 'express';
import { CurrentAuthorization, CurrentUser, RequirePermissions } from '../auth/auth.decorators';
import type { AuthenticatedIdentity, AuthorizationContext } from '../auth/auth.types';
import { HotelFinanceService } from './hotel-finance.service';

class FolioChargeDto { @IsString() @MaxLength(500) description!: string; @IsInt() @Min(1) amountMinor!: number; @IsDateString({ strict: true }) serviceDate!: string; @IsOptional() @IsString() @MaxLength(1000) reason?: string; }
class PaymentDto { @IsInt() @Min(1) amountMinor!: number; @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER', 'cash', 'bank_transfer', 'pos', 'online']) method!: string; @IsString() @MaxLength(100) idempotencyKey!: string; }
class RefundDto { @IsInt() @Min(1) amountMinor!: number; @IsString() @MaxLength(1000) reason!: string; @IsString() @MaxLength(100) idempotencyKey!: string; }
class RefundStatusDto { @IsIn(['APPROVED', 'REJECTED', 'PROCESSED']) status!: 'APPROVED' | 'REJECTED' | 'PROCESSED'; }
class ExpenseDto { @IsString() @MaxLength(100) category!: string; @IsString() @MaxLength(200) vendor!: string; @IsString() @MaxLength(500) description!: string; @IsInt() @Min(1) amountMinor!: number; @IsIn(['CASH', 'BANK_TRANSFER', 'CARD', 'OTHER', 'cash', 'bank_transfer', 'pos', 'online']) method!: string; @IsDateString({ strict: true }) date!: string; @IsIn(['PAID', 'PENDING']) status!: 'PAID' | 'PENDING'; @IsOptional() @IsString() @MaxLength(100) reference?: string; }
const correlationId = (request: Request) => typeof request.id === 'string' ? request.id : 'unknown';

@ApiTags('financial-management')
@ApiBearerAuth()
@Controller('hotels/:hotelId')
export class HotelFinanceController {
  constructor(private readonly finance: HotelFinanceService) {}

  @Get('folios') @RequirePermissions('hotel.read', 'finance.read')
  folios(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.folios(auth, hotelId); }
  @Get('reservations/:reservationId/folio') @RequirePermissions('hotel.read', 'finance.read')
  folio(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.folioForReservation(auth, hotelId, reservationId); }
  @Post('reservations/:reservationId/folio/room-charges') @RequirePermissions('hotel.read', 'finance.payments.manage')
  roomCharges(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string, @Headers('idempotency-key') key: string | undefined, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.addRoomCharges(auth, hotelId, reservationId, actor, correlationId(request), key); }
  @Post('reservations/:reservationId/folio/charges') @RequirePermissions('hotel.read', 'finance.payments.manage')
  charge(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string, @Body() body: FolioChargeDto, @Headers('idempotency-key') key: string | undefined, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.addCharge(auth, hotelId, reservationId, body, actor, correlationId(request), key); }
  @Post('reservations/:reservationId/invoices') @RequirePermissions('hotel.read', 'finance.payments.manage')
  invoice(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.invoice(auth, hotelId, reservationId, actor, correlationId(request)); }
  @Get('invoices') @RequirePermissions('hotel.read', 'finance.read')
  invoices(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.invoiceList(auth, hotelId); }
  @Get('invoices/:invoiceId') @RequirePermissions('hotel.read', 'finance.read')
  invoiceDetail(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('invoiceId', ParseUUIDPipe) invoiceId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.getInvoice(auth, hotelId, invoiceId); }
  @Get('receipts/:receiptId') @RequirePermissions('hotel.read', 'finance.payments.read')
  receipt(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('receiptId', ParseUUIDPipe) receiptId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.getReceipt(auth, hotelId, receiptId); }
  @Get('payments') @RequirePermissions('hotel.read', 'finance.payments.read')
  payments(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.payments(auth, hotelId); }
  @Post('reservations/:reservationId/payments') @RequirePermissions('hotel.read', 'finance.payments.manage')
  payment(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('reservationId', ParseUUIDPipe) reservationId: string, @Body() body: PaymentDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.recordPayment(auth, hotelId, reservationId, body, actor, correlationId(request)); }
  @Post('payments/:paymentId/refunds') @RequirePermissions('hotel.read', 'finance.refunds.manage')
  requestRefund(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('paymentId', ParseUUIDPipe) paymentId: string, @Body() body: RefundDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.requestRefund(auth, hotelId, paymentId, body, actor, correlationId(request)); }
  @Get('refunds') @RequirePermissions('hotel.read', 'finance.payments.read')
  refunds(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.refunds(auth, hotelId); }
  @Patch('refunds/:refundId') @RequirePermissions('hotel.read', 'finance.refunds.manage')
  refundStatus(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('refundId', ParseUUIDPipe) refundId: string, @Body() body: RefundStatusDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.updateRefund(auth, hotelId, refundId, body.status, actor, correlationId(request)); }
  @Get('expenses') @RequirePermissions('hotel.read', 'finance.expenses.manage')
  expenses(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Query('from') from: string | undefined, @Query('to') to: string | undefined, @Query('categoryId') categoryId: string | undefined, @Query('category') category: string | undefined, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.expenses(auth, hotelId, from, to, categoryId, category); }
  @Get('expense-categories') @RequirePermissions('hotel.read', 'finance.expenses.manage')
  expenseCategories(@Param('hotelId', ParseUUIDPipe) hotelId: string, @CurrentAuthorization() auth: AuthorizationContext) { return this.finance.expenseCategories(auth, hotelId); }
  @Post('expenses') @RequirePermissions('hotel.read', 'finance.expenses.manage')
  expense(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Body() body: ExpenseDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.createExpense(auth, hotelId, body, actor, correlationId(request)); }
  @Patch('expenses/:expenseId') @RequirePermissions('hotel.read', 'finance.expenses.manage')
  updateExpense(@Param('hotelId', ParseUUIDPipe) hotelId: string, @Param('expenseId', ParseUUIDPipe) expenseId: string, @Body() body: ExpenseDto, @CurrentAuthorization() auth: AuthorizationContext, @CurrentUser() actor: AuthenticatedIdentity, @Req() request: Request) { return this.finance.updateExpense(auth, hotelId, expenseId, body, actor, correlationId(request)); }
}
