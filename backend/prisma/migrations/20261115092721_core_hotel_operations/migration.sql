-- CreateEnum
CREATE TYPE "RoomOperationalStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'INSPECTED', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "ReservationOperationalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateTable
CREATE TABLE "RoomCategory" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "basePrice" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bedConfiguration" VARCHAR(200) NOT NULL,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "RoomCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "number" VARCHAR(30) NOT NULL,
    "floor" INTEGER NOT NULL,
    "status" "RoomOperationalStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelGuest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "fullName" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "nationality" VARCHAR(100),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HotelGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelReservation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "reference" VARCHAR(40) NOT NULL,
    "status" "ReservationOperationalStatus" NOT NULL DEFAULT 'CONFIRMED',
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "nightlyRate" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "notes" VARCHAR(1000),
    "idempotencyKey" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HotelReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomCategory_organizationId_hotelId_idx" ON "RoomCategory"("organizationId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCategory_hotelId_id_key" ON "RoomCategory"("hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCategory_organizationId_hotelId_id_key" ON "RoomCategory"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RoomCategory_hotelId_name_key" ON "RoomCategory"("hotelId", "name");

-- CreateIndex
CREATE INDEX "HotelRoom_organizationId_hotelId_status_idx" ON "HotelRoom"("organizationId", "hotelId", "status");

-- CreateIndex
CREATE INDEX "HotelRoom_organizationId_hotelId_categoryId_idx" ON "HotelRoom"("organizationId", "hotelId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_hotelId_number_key" ON "HotelRoom"("hotelId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_organizationId_hotelId_id_key" ON "HotelRoom"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE INDEX "HotelGuest_organizationId_hotelId_fullName_idx" ON "HotelGuest"("organizationId", "hotelId", "fullName");

-- CreateIndex
CREATE INDEX "HotelGuest_organizationId_hotelId_email_idx" ON "HotelGuest"("organizationId", "hotelId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "HotelGuest_organizationId_hotelId_id_key" ON "HotelGuest"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_hotelId_checkIn_checkOut_idx" ON "HotelReservation"("organizationId", "hotelId", "checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_hotelId_status_checkIn_idx" ON "HotelReservation"("organizationId", "hotelId", "status", "checkIn");

-- CreateIndex
CREATE INDEX "HotelReservation_organizationId_hotelId_guestId_idx" ON "HotelReservation"("organizationId", "hotelId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_hotelId_id_key" ON "HotelReservation"("hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_hotelId_reference_key" ON "HotelReservation"("hotelId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_hotelId_idempotencyKey_key" ON "HotelReservation"("hotelId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "RoomCategory" ADD CONSTRAINT "RoomCategory_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_organizationId_hotelId_categoryId_fkey" FOREIGN KEY ("organizationId", "hotelId", "categoryId") REFERENCES "RoomCategory"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelGuest" ADD CONSTRAINT "HotelGuest_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_organizationId_hotelId_roomId_fkey" FOREIGN KEY ("organizationId", "hotelId", "roomId") REFERENCES "HotelRoom"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_organizationId_hotelId_categoryId_fkey" FOREIGN KEY ("organizationId", "hotelId", "categoryId") REFERENCES "RoomCategory"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_organizationId_hotelId_guestId_fkey" FOREIGN KEY ("organizationId", "hotelId", "guestId") REFERENCES "HotelGuest"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reservation ranges must not overlap while the reservation can still occupy inventory.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "RoomCategory"
  ADD CONSTRAINT "RoomCategory_basePrice_check" CHECK ("basePrice" >= 0),
  ADD CONSTRAINT "RoomCategory_capacity_check" CHECK ("capacity" > 0);

ALTER TABLE "HotelReservation"
  ADD CONSTRAINT "HotelReservation_stay_dates_check" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "HotelReservation_guest_counts_check" CHECK ("adults" > 0 AND "children" >= 0),
  ADD CONSTRAINT "HotelReservation_price_check" CHECK ("nightlyRate" >= 0 AND "total" >= 0);

ALTER TABLE "HotelReservation"
  ADD CONSTRAINT "HotelReservation_room_date_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  ) WHERE ("status" IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));
