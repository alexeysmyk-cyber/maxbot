-- CreateTable
CREATE TABLE "VkSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vk_id" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "VkSession_vk_id_key" ON "VkSession"("vk_id");
