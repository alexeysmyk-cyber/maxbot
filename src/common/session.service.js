import { prisma } from '../db/prisma.js';

// получить состояние
export async function getState(userId) {
  return prisma.vkSession.findUnique({
    where: { vk_id: userId }
  });
}

// установить состояние
export async function setState(userId, step, data = {}) {
  return prisma.vkSession.upsert({
    where: { vk_id: userId },
    update: {
      step,
      data,
    },
    create: {
      vk_id: userId,
      step,
      data,
    }
  });
}

// очистить
export async function clearState(userId) {
  return prisma.vkSession.deleteMany({
    where: { vk_id: userId }
  });
}