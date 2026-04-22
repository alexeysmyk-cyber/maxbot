-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuthCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_AuthCode" ("code", "createdAt", "email", "expiresAt", "id", "used") SELECT "code", "createdAt", "email", "expiresAt", "id", "used" FROM "AuthCode";
DROP TABLE "AuthCode";
ALTER TABLE "new_AuthCode" RENAME TO "AuthCode";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
