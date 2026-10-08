const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec % 60).toFixed(1).padStart(4, '0')}`;
}

/** 알림 시각: 방금 · 3분 전 · 2시간 전 · 어제 · 5일 전 · 2026.10.07 */
export function formatRelative(ts: number, now = Date.now()) {
  const minutes = Math.floor((now - ts) / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return formatDate(ts);
}
