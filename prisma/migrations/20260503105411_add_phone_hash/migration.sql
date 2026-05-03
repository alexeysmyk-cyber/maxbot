/*
  Warnings:

  - A unique constraint covering the columns `[phone_hash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_hash_key" ON "User"("phone_hash");
