import { prisma } from '../../db/prisma.js';

export async function getTemplate({ key, channel }) {
  return prisma.notificationTemplate.findUnique({
    where: {
      key_channel: {
        key,
        channel
      }
    }
  });
}