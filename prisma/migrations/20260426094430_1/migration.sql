-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoleNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roleId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "defaultMode" TEXT NOT NULL,
    CONSTRAINT "RoleNotification_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoleNotification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "NotificationType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoleNotification" ("defaultMode", "id", "roleId", "typeId") SELECT "defaultMode", "id", "roleId", "typeId" FROM "RoleNotification";
DROP TABLE "RoleNotification";
ALTER TABLE "new_RoleNotification" RENAME TO "RoleNotification";
CREATE UNIQUE INDEX "RoleNotification_roleId_typeId_key" ON "RoleNotification"("roleId", "typeId");
CREATE TABLE "new_RolePermission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RolePermission" ("id", "permissionId", "roleId") SELECT "id", "permissionId", "roleId" FROM "RolePermission";
DROP TABLE "RolePermission";
ALTER TABLE "new_RolePermission" RENAME TO "RolePermission";
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE TABLE "new_UserNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserNotification_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "NotificationType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserNotification" ("id", "mode", "typeId", "userId") SELECT "id", "mode", "typeId", "userId" FROM "UserNotification";
DROP TABLE "UserNotification";
ALTER TABLE "new_UserNotification" RENAME TO "UserNotification";
CREATE UNIQUE INDEX "UserNotification_userId_typeId_key" ON "UserNotification"("userId", "typeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
