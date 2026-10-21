import type { ImportPhoto, Inspiration, InspirationPatch, InspirationRepository } from '../types/inspiration';
export function assetDataURL(blob: Blob): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('照片读取失败。')); reader.readAsDataURL(blob); }); }
export async function thumbnail(image: ImportPhoto['image']): Promise<string> {
  const img = new Image(); img.src = image.src; await img.decode(); const scale = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('缩略图无法保存。'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', .75);
}
interface Native { postMessage(message: Record<string, unknown>): Promise<unknown> }
function native(): Native | undefined { return (window.webkit?.messageHandlers as unknown as Record<string, Native> | undefined)?.glimpseRecords; }
export class NativeInspirationRepository implements InspirationRepository {
  private revisions = new Map<string,number>();
  private remember(record:Inspiration){this.revisions.set(record.id,record.updatedAt);return record;}
  private send(message: Record<string, unknown>) { const bridge = native(); if (!bridge) throw new Error('本机照片仓库无法访问。'); return bridge.postMessage(message); }
  async list() { return await this.send({ action: 'list' }) as Inspiration[]; }
  async get(id: string) { return this.remember(await this.send({ action: 'get', id }) as Inspiration); }
  async create(input: ImportPhoto) { return this.remember(await this.send({ action: 'create', image: input.image, original: await assetDataURL(input.original), thumbnail: input.thumbnail, timezone: input.timezone }) as Inspiration); }
  async patch(id: string, patch: InspirationPatch) { return this.remember(await this.send({ action: 'patch', id, patch,expectedUpdatedAt:this.revisions.get(id) }) as Inspiration); }
  async remove(id: string) { await this.send({ action: 'remove', id }); }
  async original(id: string) { return await this.send({ action: 'original', id }) as string; }
}
type Stored = { record: Inspiration; original: Blob };
export class IndexedDBInspirationRepository implements InspirationRepository {
  private database?: Promise<IDBDatabase>;
  private db() { return this.database ??= new Promise((resolve, reject) => { const request = indexedDB.open('glimpse-inspirations', 1); request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'record.id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('无法打开照片仓库，请检查浏览器存储权限。')); }); }
  private async transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, set: (value: T) => void) => void): Promise<T> {
    const db = await this.db(); return new Promise((resolve, reject) => { const tx = db.transaction('records', mode); let result: T; const set = (value: T) => { result = value; }; tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(new Error('照片保存失败，可能空间不足。请重试；已有记录不会被清空。')); operation(tx.objectStore('records'), set); });
  }
  async list() {
    return this.transact<Inspiration[]>('readwrite', (store, set) => { const req = store.getAll(); req.onsuccess = () => { const values = req.result as Stored[]; for (const value of values) if (value.record.status === 'processing') { value.record.status = 'draft'; store.put(value); } set(values.map(({ record }) => ({ ...record, image: { ...record.image, src: record.thumbnail } })).sort((a,b) => b.occurredAt - a.occurredAt)); }; });
  }
  async get(id: string) { return this.transact<Inspiration>('readonly', (store, set) => { const req = store.get(id); req.onsuccess = () => { if (!req.result) { req.transaction?.abort(); return; } set(req.result.record); }; }); }
  async create(input: ImportPhoto) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await input.original.arrayBuffer()))].map(n => n.toString(16).padStart(2,'0')).join(''); const now = Date.now();
    const record: Inspiration = { schemaVersion: 1, id: crypto.randomUUID(), status: 'draft', image: input.image, thumbnail: input.thumbnail, originalMime: input.original.type, originalSha256: hash, uploadedAt: now, occurredAt: now, updatedAt: now, timezone: input.timezone, placeName: '', description: '', selection: null, versions: [] };
    return this.transact<Inspiration>('readwrite', (store, set) => { store.add({ record, original: input.original } satisfies Stored); set(record); });
  }
  async patch(id: string, patch: InspirationPatch) { return this.transact<Inspiration>('readwrite', (store, set) => { const req = store.get(id); req.onsuccess = () => { if (!req.result) { req.transaction?.abort(); return; } const value = req.result as Stored; value.record = { ...value.record, ...patch, updatedAt: Date.now() }; store.put(value); set(value.record); }; }); }
  async remove(id: string) { return this.transact<void>('readwrite', (store, set) => { store.delete(id); set(undefined); }); }
  async original(id: string) { const value = await this.transact<Stored>('readonly', (store, set) => { const req = store.get(id); req.onsuccess = () => { if (!req.result) { req.transaction?.abort(); return; } set(req.result); }; }); const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await value.original.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==value.record.originalSha256)throw new Error('原照片校验失败，请保留记录并检查。');return assetDataURL(value.original); }
}
export function createRepository(): InspirationRepository { return native() ? new NativeInspirationRepository() : new IndexedDBInspirationRepository(); }
