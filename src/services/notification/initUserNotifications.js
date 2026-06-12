import { prisma } from '../../db/prisma.js';
export async function initUserNotifications(userId, roleKey) {

    console.log('🧪 INIT USER NOTIFICATIONS:', {
    userId,
    roleKey
  });

const existingCount = await prisma.userNotification.count({
  where: { userId }
});

if (existingCount > 0) {
  console.log('⚠️ Already initialized');
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
  console.log('✅ INIT DONE:', {
  userId,
  total: roleNotifications.length
});
}