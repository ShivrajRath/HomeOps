export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!value || Number.isNaN(value) || value <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const precision = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function stripExtension(fileName = '') {
  return fileName.replace(/\.[^.]+$/, '');
}

export function initialsFromEmail(email = '') {
  const name = String(email).split('@')[0] || '';
  return name.slice(0, 2).toUpperCase() || 'HO';
}
