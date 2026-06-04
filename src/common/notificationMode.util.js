export function resolveMode(userMode, roleMode) {
  const normalize = (m) =>
    (m || 'none').toString().trim().toLowerCase();

  let u = normalize(userMode);
  let r = normalize(roleMode);

  // поддержка старых значений
  if (u === 'true') u = 'all';
  if (u === 'false') u = 'none';

  if (r === 'true') r = 'all';
  if (r === 'false') r = 'none';

  // 🔥 role = ограничение
  if (r === 'none') return 'none';

  if (r === 'self') {
    if (u === 'all') return 'self';
    return u; // self или none
  }

  // r === 'all'
  return u;
}