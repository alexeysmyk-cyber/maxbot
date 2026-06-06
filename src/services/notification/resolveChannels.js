import { canSendEmail } from './email.util.js';

/**
 * Возвращает список каналов для пользователя
 */
export function resolveChannels(user, patient, key) {
  const channels = [];

  // MAX
  if (user?.vk_id) {
    channels.push('MAX');
  }

  // EMAIL (только через настройки пациента)
  if (patient && canSendEmail(patient, key)) {
    channels.push('EMAIL');
  }

  // ❌ УБЕРИ fallback полностью
  // if (!channels.length && user?.email) {
  //   channels.push('EMAIL');
  // }

  return channels.filter(Boolean);
}