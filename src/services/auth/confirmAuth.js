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

// ===== ОСНОВНАЯ ФУНКЦИЯ =====
export async function confirmAuth({ vk_id, type, data }) {
  if (!vk_id) throw new Error('VK_ID_REQUIRED');
  if (!type) throw new Error('TYPE_REQUIRED');

  let user;

  // ===== EMPLOYEE =====
  if (type === 'EMPLOYEE') {
    const employee = data;

    const roleKeys = (employee.role || [])
      .map(r => MIS_ROLE_MAP[r])
      .filter(Boolean);

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
    for (const key of roleKeys) {
      const role = await prisma.role.findUnique({
        where: { key }
      });

      if (role) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          }
        });
      }
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
    const role = await prisma.role.findUnique({
      where: { key: 'PATIENT' }
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