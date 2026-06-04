export function resolveMode(userMode, roleMode) {
  const normalize = (m) =>
    m == null ? null : m.toString().trim().toLowerCase();

  let u = normalize(userMode);
  let r = normalize(roleMode);

  // поддержка старых значений
  if (u === 'true') u = 'all';
  if (u === 'false') u = 'none';

  if (r === 'true') r = 'all';
  if (r === 'false') r = 'none';

  // 🚫 глобальный запрет — всегда приоритет
  if (r === 'none') return 'none';

  // 👤 если пользователь НЕ задал — берём роль
  if (!u) return r;

  // 👤 пользователь не может расширить ограничения
  if (r === 'self' && u === 'all') return 'self';

  return u;
}