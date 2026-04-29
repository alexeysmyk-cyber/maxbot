import 'dotenv/config';
import { prisma } from '../../db/prisma.js';

// маппинг ролей МИС → твои роли
const MIS_ROLE_MAP = {
  "16353": "ADMIN",
  "16354": "DOCTOR",
  "16355": "MANAGER",
  "16356": "CALL_CENTER",
  "16357": "CASHIER",
  "16358": "NURSE",
  "16359": "HEAD_NURSE",
  "16360": "HEAD_MANAGER",
  "16361": "HEAD_CALL_CENTER",
  "16362": "HEAD_DOCTOR",
  "16363": "ACCOUNTANT",
  "16364": "SYSTEM_ADMINISTRATOR",
};

const ROLE_NAME_MAP = {
  ADMIN: 'Директор',
  DOCTOR: 'Врач',
  MANAGER: 'Администратор',
  CALL_CENTER: 'Call-центр',
  CASHIER: 'Кассир',
  NURSE: 'Медсестра',
  HEAD_NURSE: 'Старшая медсестра',
  HEAD_MANAGER: 'Старший администратор',
  HEAD_CALL_CENTER: 'Руководитель call-центра',
  HEAD_DOCTOR: 'Главный врач',
  ACCOUNTANT: 'Бухгалтер',
  SYSTEM_ADMINISTRATOR: 'Системный администратор',
  PATIENT: 'Пациент'
};

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
export async function confirmAuth({ vk_id, type, data }) {
  if (!vk_id) throw new Error('VK_ID_REQUIRED');
  if (!type) throw new Error('TYPE_REQUIRED');

  let user;

  // ===== EMPLOYEE =====
  if (type === 'EMPLOYEE') {
    const employee = data;

 const rolesRaw = Array.isArray(employee.role)
  ? employee.role
  : employee.role
    ? [employee.role]
    : [];

console.log('MIS RAW ROLE:', rolesRaw);

const roleKeys = rolesRaw
  .map(r => MIS_ROLE_MAP[r])
  .filter(Boolean);

console.log('MAPPED ROLES:', roleKeys);

    // 1. создаём или обновляем пользователя
    user = await prisma.user.upsert({
      where: { vk_id },
      update: {
        email: employee.email,
        mis_id: String(employee.id),
        type: 'EMPLOYEE',
        name: employee.name || null,
      },
      create: {
        vk_id,
        email: employee.email,
        mis_id: String(employee.id),
        type: 'EMPLOYEE',
        name: employee.name || null,
      }
    });

    // 2. очищаем роли
    await prisma.userRole.deleteMany({
      where: { userId: user.id }
    });

    // 3. назначаем роли
   for (const raw of rolesRaw) {
  const key = MIS_ROLE_MAP[raw];

  if (!key) continue;

  const role = await prisma.role.upsert({
    where: { key },
    update: {
      name: ROLE_NAME_MAP[key] || key,
      mis_code: String(raw) // 👈 ВАЖНО
    },
    create: {
      key,
      name: ROLE_NAME_MAP[key] || key,
      mis_code: String(raw)
    }
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id,
    }
  });
}


  }

  // ===== PATIENT =====
  if (type === 'PATIENT') {
    const patient = data;

    user = await prisma.user.upsert({
      where: { vk_id },
      update: {
        email: patient.email,
        mis_id: String(patient.patient_id),
        type: 'PATIENT',
        name: `${patient.last_name || ''} ${patient.first_name || ''}`.trim(),
      },
      create: {
        vk_id,
        email: patient.email,
        mis_id: String(patient.patient_id),
        type: 'PATIENT',
        name: `${patient.last_name || ''} ${patient.first_name || ''}`.trim(),
      }
    });

    // пациенту можно назначить роль PATIENT (если хочешь)
const role = await prisma.role.upsert({
  where: { key: 'PATIENT' },
  update: {
    name: 'Пациент'
  },
  create: {
    key: 'PATIENT',
    name: 'Пациент'
  }
});

    if (role) {
      await prisma.userRole.deleteMany({
        where: { userId: user.id }
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        }
      });
    }
  }

  // ===== вернуть пользователя с ролями =====
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });
  return fullUser;








}