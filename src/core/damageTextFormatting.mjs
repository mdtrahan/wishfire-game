export function formatDamageValue({ value, type, isCrit = false }) {
  const amount = Math.max(0, Number(value) || 0);
  return `${amount}`;
}
