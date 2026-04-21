-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vk_id" TEXT NOT NULL,
    "telegram_id" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "name" TEXT,
    "role" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_vk_id_key" ON "User"("vk_id");
