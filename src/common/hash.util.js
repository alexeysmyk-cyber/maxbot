import crypto from 'crypto';

export function hashPhone(phone) {
  if (!phone) return null;

  return crypto
    .createHash('sha256')
    .update(phone)
    .digest('hex');
}