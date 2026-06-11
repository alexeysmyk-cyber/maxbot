import { canSendEmail } from './email.util.js';

/**
 * Возвращает список каналов для пользователя
 */
export function resolveChannels(user, patient, key) {
  const channels = [];

  // ===============================
  // MAX (для всех)
  // ===============================
  if (user?.vk_id) {
    channels.push('MAX');
  }

  // ===============================
  // EMAIL (только для PATIENT)
  // ===============================
  if (user?.type === 'PATIENT') {
    if (patient && canSendEmail(patient, key)) {
      channels.push('EMAIL');
    }
  }

  return channels.filter(Boolean);
}