-- CreateEnum
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('ROOM_CHARGE', 'SERVICE_CHARGE', 'ADJUSTMENT', 'PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "FinancialInvoiceStatus" AS ENUM ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialPaymentStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialRefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PAID', 'PENDING', 'VOID');

-- CreateTable
CREATE TABLE "GuestFolio" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NGN',
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GuestFolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "kind" "LedgerEntryKind" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "serviceDate" DATE NOT NULL,
    "reason" VARCHAR(1000),
    "idempotencyKey" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialInvoice" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "status" "FinancialInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" CHAR(3) NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "method" "FinancialPaymentMethod" NOT NULL,
    "status" "FinancialPaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "amountMinor" INTEGER NOT NULL,
    "allocatedMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "folioEntryId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialRefund" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "FinancialRefundStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "FinancialRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelExpense" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "vendor" VARCHAR(200) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "method" "FinancialPaymentMethod" NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PAID',
    "reference" VARCHAR(100),
    "expenseDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HotelExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestFolio_organizationId_hotelId_guestId_idx" ON "GuestFolio"("organizationId", "hotelId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestFolio_organizationId_hotelId_id_key" ON "GuestFolio"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GuestFolio_organizationId_hotelId_reservationId_key" ON "GuestFolio"("organizationId", "hotelId", "reservationId");

-- CreateIndex
CREATE INDEX "FolioEntry_organizationId_hotelId_folioId_serviceDate_idx" ON "FolioEntry"("organizationId", "hotelId", "folioId", "serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "FolioEntry_organizationId_hotelId_id_key" ON "FolioEntry"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FolioEntry_folioId_idempotencyKey_key" ON "FolioEntry"("folioId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialInvoice_organizationId_hotelId_folioId_issuedAt_idx" ON "FinancialInvoice"("organizationId", "hotelId", "folioId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_organizationId_hotelId_id_key" ON "FinancialInvoice"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInvoice_hotelId_reference_key" ON "FinancialInvoice"("hotelId", "reference");

-- CreateIndex
CREATE INDEX "FinancialPayment_organizationId_hotelId_folioId_receivedAt_idx" ON "FinancialPayment"("organizationId", "hotelId", "folioId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_organizationId_hotelId_id_key" ON "FinancialPayment"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_hotelId_reference_key" ON "FinancialPayment"("hotelId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_organizationId_hotelId_idempotencyKey_key" ON "FinancialPayment"("organizationId", "hotelId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAllocation_organizationId_hotelId_invoiceId_idx" ON "PaymentAllocation"("organizationId", "hotelId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_paymentId_key" ON "PaymentReceipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_organizationId_hotelId_id_key" ON "PaymentReceipt"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_organizationId_hotelId_paymentId_key" ON "PaymentReceipt"("organizationId", "hotelId", "paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_hotelId_reference_key" ON "PaymentReceipt"("hotelId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRefund_organizationId_hotelId_id_key" ON "FinancialRefund"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRefund_hotelId_reference_key" ON "FinancialRefund"("hotelId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialRefund_organizationId_hotelId_idempotencyKey_key" ON "FinancialRefund"("organizationId", "hotelId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_organizationId_hotelId_id_key" ON "ExpenseCategory"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_hotelId_name_key" ON "ExpenseCategory"("hotelId", "name");

-- CreateIndex
CREATE INDEX "HotelExpense_organizationId_hotelId_expenseDate_categoryId_idx" ON "HotelExpense"("organizationId", "hotelId", "expenseDate", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelExpense_organizationId_hotelId_id_key" ON "HotelExpense"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_organizationId_hotelId_id_key" ON "HotelReservation"("organizationId", "hotelId", "id");

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_organizationId_hotelId_guestId_fkey" FOREIGN KEY ("organizationId", "hotelId", "guestId") REFERENCES "HotelGuest"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_organizationId_hotelId_reservationId_fkey" FOREIGN KEY ("organizationId", "hotelId", "reservationId") REFERENCES "HotelReservation"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioEntry" ADD CONSTRAINT "FolioEntry_organizationId_hotelId_folioId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioId") REFERENCES "GuestFolio"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialInvoice" ADD CONSTRAINT "FinancialInvoice_organizationId_hotelId_folioId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioId") REFERENCES "GuestFolio"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_organizationId_hotelId_folioId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioId") REFERENCES "GuestFolio"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_organizationId_hotelId_paymentId_fkey" FOREIGN KEY ("organizationId", "hotelId", "paymentId") REFERENCES "FinancialPayment"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_organizationId_hotelId_invoiceId_fkey" FOREIGN KEY ("organizationId", "hotelId", "invoiceId") REFERENCES "FinancialInvoice"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_organizationId_hotelId_folioEntryId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioEntryId") REFERENCES "FolioEntry"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_organizationId_hotelId_paymentId_fkey" FOREIGN KEY ("organizationId", "hotelId", "paymentId") REFERENCES "FinancialPayment"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRefund" ADD CONSTRAINT "FinancialRefund_organizationId_hotelId_folioId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioId") REFERENCES "GuestFolio"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRefund" ADD CONSTRAINT "FinancialRefund_organizationId_hotelId_paymentId_fkey" FOREIGN KEY ("organizationId", "hotelId", "paymentId") REFERENCES "FinancialPayment"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelExpense" ADD CONSTRAINT "HotelExpense_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelExpense" ADD CONSTRAINT "HotelExpense_organizationId_hotelId_categoryId_fkey" FOREIGN KEY ("organizationId", "hotelId", "categoryId") REFERENCES "ExpenseCategory"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
