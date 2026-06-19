-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnboardingToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OnboardingToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OnboardingToken" ("createdAt", "expiresAt", "id", "token", "usedAt", "userId") SELECT "createdAt", "expiresAt", "id", "token", "usedAt", "userId" FROM "OnboardingToken";
DROP TABLE "OnboardingToken";
ALTER TABLE "new_OnboardingToken" RENAME TO "OnboardingToken";
CREATE UNIQUE INDEX "OnboardingToken_token_key" ON "OnboardingToken"("token");
CREATE INDEX "OnboardingToken_userId_idx" ON "OnboardingToken"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
