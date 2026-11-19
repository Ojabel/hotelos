-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "folioEntryId" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "serviceDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceLine_organizationId_hotelId_invoiceId_idx" ON "InvoiceLine"("organizationId", "hotelId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_organizationId_hotelId_id_key" ON "InvoiceLine"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_folioEntryId_key" ON "InvoiceLine"("invoiceId", "folioEntryId");

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_organizationId_hotelId_invoiceId_fkey" FOREIGN KEY ("organizationId", "hotelId", "invoiceId") REFERENCES "FinancialInvoice"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_organizationId_hotelId_folioEntryId_fkey" FOREIGN KEY ("organizationId", "hotelId", "folioEntryId") REFERENCES "FolioEntry"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
