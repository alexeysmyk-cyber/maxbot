-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vk_id" TEXT,
    "email" TEXT,
    "mis_id" TEXT,
    "name" TEXT,
    "type" TEXT,
    "activeRole" TEXT,
    "phone_hash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("activeRole", "createdAt", "email", "id", "mis_id", "name", "phone_hash", "type", "vk_id") SELECT "activeRole", "createdAt", "email", "id", "mis_id", "name", "phone_hash", "type", "vk_id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_hash_key" ON "User"("phone_hash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
