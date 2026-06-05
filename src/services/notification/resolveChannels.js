import { canSendEmail } from './email.util.js';

/**
 * Возвращает список каналов для пользователя
 */
export function resolveChannels(user, patient, key) {
  const channels = [];

  // ===============================
  // ✅ MAX (если есть диалог)
  // ===============================
  if (user?.vk_id) {
    channels.push('MAX');
  }

  // ===============================
  // ✅ EMAIL из MIS
  // ===============================
  if (patient && canSendEmail(patient, key)) {
    channels.push('EMAIL');
  }

  // ===============================
  // 🔥 FALLBACK EMAIL (если MIS не дал пациента)
  // ===============================
  if (!channels.length && user?.email) {
    console.log('⚠️ FALLBACK EMAIL FROM USER');
    channels.push('EMAIL');
  }

  return channels;
}