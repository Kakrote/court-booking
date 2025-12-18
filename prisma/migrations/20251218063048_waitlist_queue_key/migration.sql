/*
  Warnings:

  - A unique constraint covering the columns `[queueKey,position]` on the table `WaitlistEntry` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `queueKey` to the `WaitlistEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "WaitlistEntry_startAt_endAt_position_key";

-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "queueKey" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "WaitlistEntry_queueKey_status_position_idx" ON "WaitlistEntry"("queueKey", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_queueKey_position_key" ON "WaitlistEntry"("queueKey", "position");
