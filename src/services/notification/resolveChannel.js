import { canSendEmail } from './email.util.js';

export function resolveChannel(user, patient, key) {

  // 1. MAX приоритет
  if (user?.vk_id) {
    return 'MAX';
  }

  // 2. EMAIL fallback
  if (canSendEmail(patient, key)) {
    return 'EMAIL';
  }

  // 3. ничего
  return null;
}

