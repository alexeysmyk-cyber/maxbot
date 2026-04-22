import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ===== РОЛИ =====
  const roles = [
    { key: 'ADMIN', name: 'Директор / Главный врач' },
    { key: 'DOCTOR', name: 'Врач' },
    { key: 'MANAGER', name: 'Администратор' },
    { key: 'CALL_CENTER', name: 'Call-центр' },
    { key: 'CASHIER', name: 'Кассир' },
    { key: 'NURSE', name: 'Медсестра' },
    { key: 'HEAD_NURSE', name: 'Старшая медсестра' },
    { key: 'HEAD_MANAGER', name: 'Старший администратор' },
    { key: 'HEAD_CALL_CENTER', name: 'Руководитель call-центра' },
    { key: 'HEAD_DOCTOR', name: 'Главный врач' },
    { key: 'ACCOUNTANT', name: 'Бухгалтер' },
    { key: 'SYSTEM_ADMINISTRATOR', name: 'Системный администратор' },
    { key: 'PATIENT', name: 'Пациент' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: {},
      create: role,
    });
  }

  // ===== ПРАВА (минимум пока) =====
  const permissions = [
    { key: 'VIEW_SELF_VISITS', name: 'Просмотр своих визитов' },
    { key: 'VIEW_ALL_VISITS', name: 'Просмотр всех визитов' },
    { key: 'RECEIVE_NOTIFICATIONS', name: 'Получение уведомлений' },
    { key: 'MANAGE_USERS', name: 'Управление пользователями' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  console.log('🌱 Seed выполнен');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });