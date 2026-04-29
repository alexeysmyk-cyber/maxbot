-- CreateTable
CREATE TABLE "NotificationType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modeType" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RoleNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roleId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "defaultMode" TEXT NOT NULL,
    CONSTRAINT "RoleNotification_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleNotification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "NotificationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "NotificationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationType_key_key" ON "NotificationType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RoleNotification_roleId_typeId_key" ON "RoleNotification"("roleId", "typeId");
