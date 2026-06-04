import 'dotenv/config';
import { prisma } from '../../db/prisma.js';
import { normalizePhone } from '../../common/phone.util.js';
import { hashPhone } from '../../common/hash.util.js';


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

  const phone = normalizePhone(
    employee.phone || employee.mobile
  );

  const phoneHash = phone ? hashPhone(phone) : null;

  let existingByPhone = null;

  if (phoneHash) {
    existingByPhone = await prisma.user.findFirst({
      where: { phone_hash: phoneHash }
    });
  }

  // ===== MERGE =====
  if (existingByPhone && existingByPhone.vk_id !== vk_id) {
    console.log('🔗 MERGE EMPLOYEE USERS');

    user = await prisma.user.update({
      where: { id: existingByPhone.id },
      data: {
        vk_id,
        email: employee.email,
        mis_id: String(employee.id),
        type: 'EMPLOYEE',
        name: employee.name || null
      }
    });

    await prisma.user.deleteMany({
      where: {
        vk_id,
        NOT: { id: existingByPhone.id }
      }
    });
  }

  // ===== UPSERT =====
  else {
    user = await prisma.user.upsert({
      where: { vk_id },
      update: {
        email: employee.email,
        mis_id: String(employee.id),
        type: 'EMPLOYEE',
        name: employee.name || null,
        phone_hash: phoneHash ?? undefined
      },
      create: {
        vk_id,
        email: employee.email,
        mis_id: String(employee.id),
        type: 'EMPLOYEE',
        name: employee.name || null,
        phone_hash: phoneHash
      }
    });
  }

  // ===== ROLES =====
  await prisma.userRole.deleteMany({
    where: { userId: user.id }
  });

  for (const raw of rolesRaw) {
    const key = MIS_ROLE_MAP[raw];
    if (!key) continue;

    const role = await prisma.role.upsert({
      where: { key },
      update: {
        name: ROLE_NAME_MAP[key] || key,
        mis_code: String(raw)
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

  const phone = normalizePhone(
    patient.phone || patient.mobile
  );

  const phoneHash = phone ? hashPhone(phone) : null;

  // 🔥 НЕ let
  user = await prisma.user.findFirst({
    where: { vk_id }
  });

  if (!user && phoneHash) {
    user = await prisma.user.findFirst({
      where: { phone_hash: phoneHash }
    });
  }

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        vk_id,
        email: patient.email,
        mis_id: String(patient.patient_id),
        type: 'PATIENT',
        activeRole: 'PATIENT', // 🔥 ДОБАВЬ ЭТО
        name: `${patient.last_name || ''} ${patient.first_name || ''}`.trim(),
        phone_hash: phoneHash ?? undefined
      }
    });
  } else {
    user = await prisma.user.create({
      data: {
        vk_id,
        email: patient.email,
        mis_id: String(patient.patient_id),
        type: 'PATIENT',
        activeRole: 'PATIENT', // 🔥 ДОБАВЬ ЭТО
        name: `${patient.last_name || ''} ${patient.first_name || ''}`.trim(),
        phone_hash: phoneHash ?? undefined
      }
    });
  }
  // 🔥 гарантируем роль PATIENT
let role = await prisma.role.findUnique({
  where: { key: 'PATIENT' }
});

if (!role) {
  role = await prisma.role.create({
    data: {
      key: 'PATIENT',
      name: ROLE_NAME_MAP['PATIENT']
    }
  });
}

// 🔥 проверяем есть ли уже связь
const existing = await prisma.userRole.findUnique({
  where: {
    userId_roleId: {
      userId: user.id,
      roleId: role.id
    }
  }
});

if (!existing) {
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: role.id
    }
  });
}
}

  // ===== вернуть пользователя с ролями =====

  if (!user) {
  console.log('❌ USER NOT RESOLVED');
  throw new Error('USER_NOT_FOUND_AFTER_AUTH');
}



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