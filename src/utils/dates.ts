export function dayKey(time: number | Date): string { const date = new Date(time); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function localInput(time: number): string { const date = new Date(time); return `${dayKey(time)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`; }
export function dateLabel(time: number): string { return new Date(time).toLocaleString('zh-CN', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }); }
export const statusLabel = { draft:'待显影', processing:'显影中', revealed:'已显影', failed:'可重试' };
