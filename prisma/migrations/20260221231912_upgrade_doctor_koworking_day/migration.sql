/*
  Warnings:

  - You are about to drop the column `endTime` on the `DoctorWorkingDay` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `DoctorWorkingDay` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DoctorWorkingDay" DROP COLUMN "endTime",
DROP COLUMN "startTime",
ADD COLUMN     "endHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "endMinute" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startHour" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startMinute" INTEGER NOT NULL DEFAULT 0;
