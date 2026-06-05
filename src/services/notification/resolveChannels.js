import { canSendEmail } from './email.util.js';

/**
 * Возвращает список каналов для пользователя
 */
export function resolveChannels(user, patient, key) {
  const channels = [];

  // ✅ MAX
  if (user?.vk_id) {
    channels.push('MAX');
  }

  // ✅ EMAIL
if (patient && canSendEmail(patient, key)) {
  channels.push('EMAIL');
}
  return channels;
}