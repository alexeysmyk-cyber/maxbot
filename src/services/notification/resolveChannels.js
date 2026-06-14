import { canSendEmail } from './email.util.js';


/**
 * Возвращает список каналов для пользователя
 */
export function resolveChannels({ user, patient, key  }) {

  // 👨‍⚕️ СОТРУДНИК
  if (user.type === 'EMPLOYEE') {
    const channels = [];

    if (user.vk_id) {
      channels.push('MAX');
    }

    return channels; // ❗ НЕ ЗАВИСИТ ОТ PATIENT
  }

  // 👤 ПАЦИЕНТ
  if (user.type === 'PATIENT') {
    const channels = [];

    if (user.vk_id) {
      channels.push('MAX');
    }

    if (patient?.email) {
      channels.push('EMAIL');
    }

    return channels;
  }

  return [];
}