


export function normalizePhone(phone) {
  if (!phone) return null;

  return phone
    .replace(/\D/g, '')      // только цифры
    .replace(/^8/, '7');     // 8 → 7 (если РФ)
}