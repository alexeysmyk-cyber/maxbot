/*
  Warnings:

  - A unique constraint covering the columns `[userId,typeId]` on the table `UserNotification` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_userId_typeId_key" ON "UserNotification"("userId", "typeId");
