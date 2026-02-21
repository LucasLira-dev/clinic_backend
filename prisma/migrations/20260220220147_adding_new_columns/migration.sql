/*
  Warnings:

  - Added the required column `endTime` to the `DoctorWorkingDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `DoctorWorkingDay` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_doctorProfileId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- DropIndex
DROP INDEX "Specialty_name_idx";

ALTER TABLE "DoctorWorkingDay" ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "startTime" TIMESTAMP(3);

-- Atualiza todos os registros existentes para 08:00 e 18:00
UPDATE "DoctorWorkingDay" SET "startTime" = '2000-01-01 08:00:00', "endTime" = '2000-01-01 18:00:00' WHERE "startTime" IS NULL OR "endTime" IS NULL;

-- Torna as colunas NOT NULL
ALTER TABLE "DoctorWorkingDay" ALTER COLUMN "startTime" SET NOT NULL;
ALTER TABLE "DoctorWorkingDay" ALTER COLUMN "endTime" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
