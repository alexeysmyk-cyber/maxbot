import { prisma } from '../../db/prisma.js';
export async function initUserNotifications(userId, roleKey) {

const existing = await prisma.userNotification.findFirst({
  where: { userId }
});

if (existing) {
  console.log('⚠️ Notifications already exist, skip init');
  return;
}


  const dbRole = await prisma.role.findFirst({
    where: { key: roleKey }
  });

  if (!dbRole) return;

  const roleNotifications = await prisma.roleNotification.findMany({
    where: { roleId: dbRole.id }
  });

  for (const rn of roleNotifications) {
    await prisma.userNotification.upsert({
      where: {
        userId_typeId: {
          userId,
          typeId: rn.typeId
        }
      },
      update: {},
      create: {
        userId,
        typeId: rn.typeId,
        mode: rn.defaultMode
      }
    });
  }

  console.log('✅ UserNotification initialized for role:', roleKey);
}