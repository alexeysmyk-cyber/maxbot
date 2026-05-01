import { prisma } from '../db/prisma.js';
import { sendWelcome } from '../max/max.handler.js';

export async function requireAuth(ctx, userId) {
 const user = await prisma.user.findFirst({
  where: { vk_id: userId },
  include: {
    roles: {
      include: { role: true }
    }
  }
});

 
  return user;
}