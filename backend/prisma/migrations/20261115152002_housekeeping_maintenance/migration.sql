-- CreateEnum
CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'AWAITING_INSPECTION', 'APPROVED');

-- CreateEnum
CREATE TYPE "HousekeepingTaskType" AS ENUM ('TURNOVER', 'DAILY', 'DEEP', 'MAINTENANCE_RETURN');

-- CreateEnum
CREATE TYPE "OperationsPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('OPEN', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MaintenanceWorkOrderStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_PARTS', 'COMPLETED', 'CLOSED');

-- CreateTable
CREATE TABLE "HousekeepingTask" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "type" "HousekeepingTaskType" NOT NULL DEFAULT 'TURNOVER',
    "priority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMPTZ(6),
    "instructions" VARCHAR(2000),
    "notes" VARCHAR(4000),
    "idempotencyKey" VARCHAR(100),
    "createdByUserId" UUID NOT NULL,
    "assignedToUserId" UUID,
    "startedByUserId" UUID,
    "completedByUserId" UUID,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "approvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingTaskEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromStatus" "HousekeepingTaskStatus",
    "toStatus" "HousekeepingTaskStatus",
    "notes" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HousekeepingTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingInspection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "inspectorId" UUID NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 100,
    "notes" VARCHAR(4000),
    "inspectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HousekeepingInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "roomId" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "location" VARCHAR(200),
    "category" VARCHAR(80) NOT NULL,
    "priority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "blocksRoom" BOOLEAN NOT NULL DEFAULT false,
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reportedByUserId" UUID NOT NULL,
    "reportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(4000),
    "idempotencyKey" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrder" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "status" "MaintenanceWorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "OperationsPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToUserId" UUID,
    "createdByUserId" UUID NOT NULL,
    "dueAt" TIMESTAMPTZ(6),
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "resolution" VARCHAR(4000),
    "notes" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MaintenanceWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWorkOrderEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "hotelId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "fromStatus" "MaintenanceWorkOrderStatus",
    "toStatus" "MaintenanceWorkOrderStatus",
    "notes" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceWorkOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HousekeepingTask_organizationId_hotelId_status_dueAt_idx" ON "HousekeepingTask"("organizationId", "hotelId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "HousekeepingTask_organizationId_hotelId_roomId_status_idx" ON "HousekeepingTask"("organizationId", "hotelId", "roomId", "status");

-- CreateIndex
CREATE INDEX "HousekeepingTask_organizationId_hotelId_assignedToUserId_st_idx" ON "HousekeepingTask"("organizationId", "hotelId", "assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HousekeepingTask_organizationId_hotelId_id_key" ON "HousekeepingTask"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "HousekeepingTask_hotelId_idempotencyKey_key" ON "HousekeepingTask"("hotelId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "HousekeepingTaskEvent_organizationId_hotelId_taskId_created_idx" ON "HousekeepingTaskEvent"("organizationId", "hotelId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "HousekeepingInspection_organizationId_hotelId_result_inspec_idx" ON "HousekeepingInspection"("organizationId", "hotelId", "result", "inspectedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_hotelId_status_priority_r_idx" ON "MaintenanceRequest"("organizationId", "hotelId", "status", "priority", "reportedAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_hotelId_roomId_idx" ON "MaintenanceRequest"("organizationId", "hotelId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_organizationId_hotelId_id_key" ON "MaintenanceRequest"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_hotelId_idempotencyKey_key" ON "MaintenanceRequest"("hotelId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_requestId_key" ON "MaintenanceWorkOrder"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_organizationId_hotelId_status_priority_idx" ON "MaintenanceWorkOrder"("organizationId", "hotelId", "status", "priority", "dueAt");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrder_organizationId_hotelId_assignedToUserI_idx" ON "MaintenanceWorkOrder"("organizationId", "hotelId", "assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_organizationId_hotelId_id_key" ON "MaintenanceWorkOrder"("organizationId", "hotelId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWorkOrder_organizationId_hotelId_requestId_key" ON "MaintenanceWorkOrder"("organizationId", "hotelId", "requestId");

-- CreateIndex
CREATE INDEX "MaintenanceWorkOrderEvent_organizationId_hotelId_workOrderI_idx" ON "MaintenanceWorkOrderEvent"("organizationId", "hotelId", "workOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_organizationId_hotelId_roomId_fkey" FOREIGN KEY ("organizationId", "hotelId", "roomId") REFERENCES "HotelRoom"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTaskEvent" ADD CONSTRAINT "HousekeepingTaskEvent_organizationId_hotelId_taskId_fkey" FOREIGN KEY ("organizationId", "hotelId", "taskId") REFERENCES "HousekeepingTask"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTaskEvent" ADD CONSTRAINT "HousekeepingTaskEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTaskEvent" ADD CONSTRAINT "HousekeepingTaskEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTaskEvent" ADD CONSTRAINT "HousekeepingTaskEvent_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingInspection" ADD CONSTRAINT "HousekeepingInspection_organizationId_hotelId_taskId_fkey" FOREIGN KEY ("organizationId", "hotelId", "taskId") REFERENCES "HousekeepingTask"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingInspection" ADD CONSTRAINT "HousekeepingInspection_organizationId_hotelId_roomId_fkey" FOREIGN KEY ("organizationId", "hotelId", "roomId") REFERENCES "HotelRoom"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingInspection" ADD CONSTRAINT "HousekeepingInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingInspection" ADD CONSTRAINT "HousekeepingInspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingInspection" ADD CONSTRAINT "HousekeepingInspection_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_hotelId_roomId_fkey" FOREIGN KEY ("organizationId", "hotelId", "roomId") REFERENCES "HotelRoom"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_organizationId_hotelId_requestId_fkey" FOREIGN KEY ("organizationId", "hotelId", "requestId") REFERENCES "MaintenanceRequest"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrder" ADD CONSTRAINT "MaintenanceWorkOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrderEvent" ADD CONSTRAINT "MaintenanceWorkOrderEvent_organizationId_hotelId_workOrder_fkey" FOREIGN KEY ("organizationId", "hotelId", "workOrderId") REFERENCES "MaintenanceWorkOrder"("organizationId", "hotelId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrderEvent" ADD CONSTRAINT "MaintenanceWorkOrderEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrderEvent" ADD CONSTRAINT "MaintenanceWorkOrderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWorkOrderEvent" ADD CONSTRAINT "MaintenanceWorkOrderEvent_organizationId_hotelId_fkey" FOREIGN KEY ("organizationId", "hotelId") REFERENCES "Hotel"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
