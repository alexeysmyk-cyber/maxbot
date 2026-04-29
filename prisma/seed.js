import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ===== РОЛИ =====
  const roles = [
    { key: 'ADMIN', name: 'Директор', mis_code: '16353' },
    { key: 'DOCTOR', name: 'Врач' , mis_code: '16354'},
    { key: 'MANAGER', name: 'Администратор' , mis_code: '16355'},
    { key: 'CALL_CENTER', name: 'Call-центр', mis_code: '16356' },
    { key: 'CASHIER', name: 'Кассир' , mis_code: '16357'},
    { key: 'NURSE', name: 'Медсестра', mis_code: '16358' },
    { key: 'HEAD_NURSE', name: 'Старшая медсестра', mis_code: '16359' },
    { key: 'HEAD_MANAGER', name: 'Старший администратор', mis_code: '16360' },
    { key: 'HEAD_CALL_CENTER', name: 'Руководитель call-центра', mis_code: '16361' },
    { key: 'HEAD_DOCTOR', name: 'Главный врач', mis_code: '16362' },
    { key: 'ACCOUNTANT', name: 'Бухгалтер', mis_code: '16363' },
    { key: 'SYSTEM_ADMINISTRATOR', name: 'Системный администратор', mis_code: '16364' },
    { key: 'PATIENT', name: 'Пациент' },
  ];



    for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: {},
      create: role,
    });
  }


const notificationTypes = [
  { key: 'visit_create', name: 'Создание визита', modeType: 'TRIPLE' },
  { key: 'visit_cancel', name: 'Отмена визита', modeType: 'TRIPLE' },
  { key: 'visit_move', name: 'Перенос визита', modeType: 'TRIPLE' },
  { key: 'visit_finish', name: 'Завершение визита', modeType: 'TRIPLE' },
  { key: 'patient_create', name: 'Создание пациента' , modeType: 'BOOLEAN'},
  { key: 'invoice_create', name: 'Создание счета' , modeType: 'BOOLEAN'},
  { key: 'invoice_pay', name: 'Оплата счета', modeType: 'BOOLEAN' },
  { key: 'lab_partial', name: 'Частичные анализы', modeType: 'BOOLEAN' },
  { key: 'lab_full', name: 'Готовность анализов' , modeType: 'BOOLEAN'}
];

for (const type of notificationTypes) {
  await prisma.notificationType.upsert({
    where: { key: type.key },
    update: {},
    create: type
  });
}

// ===== ROLE NOTIFICATIONS =====

const roleDefaults = {

  ADMIN: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'true',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'true',
    lab_full: 'true'
  },

  SYSTEM_ADMINISTRATOR: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'true',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'true',
    lab_full: 'true'
  },

  HEAD_DOCTOR: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'true',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'true',
    lab_full: 'true'
  },

  DOCTOR: {
    visit_create: 'self',
    visit_cancel: 'self',
    visit_move: 'self',
    visit_finish: 'self',
    patient_create: 'false',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'true',
    lab_full: 'true'
  },

  NURSE: {
    visit_create: 'self',
    visit_cancel: 'self',
    visit_move: 'self',
    visit_finish: 'self',
    patient_create: 'false',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'true',
    lab_full: 'true'
  },

  HEAD_NURSE: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'false',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'true',
    lab_full: 'true'
  },

  MANAGER: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'true',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'false',
    lab_full: 'false'
  },

  HEAD_MANAGER: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'all',
    patient_create: 'true',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'false',
    lab_full: 'false'
  },

  CALL_CENTER: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'none',
    patient_create: 'true',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'false',
    lab_full: 'false'
  },

  HEAD_CALL_CENTER: {
    visit_create: 'all',
    visit_cancel: 'all',
    visit_move: 'all',
    visit_finish: 'none',
    patient_create: 'true',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'false',
    lab_full: 'false'
  },

  CASHIER: {
    visit_create: 'none',
    visit_cancel: 'none',
    visit_move: 'none',
    visit_finish: 'none',
    patient_create: 'false',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'false',
    lab_full: 'false'
  },

  ACCOUNTANT: {
    visit_create: 'none',
    visit_cancel: 'none',
    visit_move: 'none',
    visit_finish: 'none',
    patient_create: 'false',
    invoice_create: 'true',
    invoice_pay: 'true',
    lab_partial: 'false',
    lab_full: 'false'
  },

  PATIENT: {
    visit_create: 'none',
    visit_cancel: 'none',
    visit_move: 'none',
    visit_finish: 'none',
    patient_create: 'false',
    invoice_create: 'false',
    invoice_pay: 'false',
    lab_partial: 'true',
    lab_full: 'true'
  }

};


// получаем роли и типы
const rolesDb = await prisma.role.findMany();
const typesDb = await prisma.notificationType.findMany();

for (const role of rolesDb) {
  const defaults = roleDefaults[role.key];
  if (!defaults) continue;

  for (const type of typesDb) {
    const mode = defaults[type.key];
    if (!mode) continue;

    await prisma.roleNotification.upsert({
      where: {
        roleId_typeId: {
          roleId: role.id,
          typeId: type.id
        }
      },
      update: {},
      create: {
        roleId: role.id,
        typeId: type.id,
        defaultMode: mode
      }
    });
  }
}

console.log('✅ RoleNotification seeded');



console.log('✅ Notification types seeded');



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