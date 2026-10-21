export const KIMI_MODELS = [
  { id: 'k3-256k', label: 'K3 · 256K', detail: '图片输入 · 与 K3 同能力，额度消耗较少' },
  { id: 'k3', label: 'K3', detail: '图片与视频 · 额度消耗约为 256K 版两倍' },
  { id: 'kimi-for-coding', label: 'Kimi for Coding', detail: '图片与视频 · 具体版本由 Kimi Code 平台管理' },
  { id: 'kimi-for-coding-highspeed', label: 'Kimi for Coding HighSpeed', detail: '高速版本 · 额度消耗约为普速版三倍' },
] as const;
export type KimiModel = typeof KIMI_MODELS[number]['id'];
export interface KimiSettings { model: KimiModel; hasKey: boolean; storage: 'keychain' | 'memory' }
export interface KimiUsage { limit: number; knownTokens: number; reservedTokens: number; unknownRequests: number; remainingTokens: number }
interface SettingsBridge { postMessage(message: { action: string; model?: string; apiKey?: string }): Promise<unknown> }
declare global { interface Window { webkit?: { messageHandlers?: { glimpseSettings?: SettingsBridge } } } }
const DEFAULT_MODEL: KimiModel = 'kimi-for-coding';
let previewKey = '';
let previewModel: KimiModel = DEFAULT_MODEL;
export function isKimiModel(value: unknown): value is KimiModel { return KIMI_MODELS.some(model => model.id === value); }
export function validateKimiKey(value: string): string {
  const key = value.trim();
  if (!/^sk-[A-Za-z0-9_-]{8,}$/.test(key) || key.length > 512) throw new Error('请检查 API Key 格式，去掉多余的空格后重试。');
  return key;
}
function bridge() { return window.webkit?.messageHandlers?.glimpseSettings; }
export function isNativeSettings() { return Boolean(bridge()); }
function parseSettings(value: unknown): KimiSettings {
  if (!value || typeof value !== 'object') throw new Error('无法读取模型配置，请重新打开设置。');
  const result = value as Partial<KimiSettings>;
  if (!isKimiModel(result.model) || typeof result.hasKey !== 'boolean' || !['keychain', 'memory'].includes(result.storage ?? '')) throw new Error('模型配置格式有误，请重新打开设置。');
  return result as KimiSettings;
}
export async function loadKimiSettings(): Promise<KimiSettings> {
  const native = bridge();
  return native ? parseSettings(await native.postMessage({ action: 'read' })) : { model: previewModel, hasKey: Boolean(previewKey), storage: 'memory' };
}
export async function saveKimiSettings(model: KimiModel, apiKey: string): Promise<KimiSettings> {
  if (!isKimiModel(model)) throw new Error('请选择列表中的模型。');
  const key = apiKey.trim() ? validateKimiKey(apiKey) : '';
  const native = bridge();
  if (native) return parseSettings(await native.postMessage({ action: 'save', model, apiKey: key }));
  previewModel = model;
  if (key) previewKey = key;
  return { model, hasKey: Boolean(previewKey), storage: 'memory' };
}
export async function removeKimiKey(): Promise<KimiSettings> {
  const native = bridge();
  if (native) return parseSettings(await native.postMessage({ action: 'removeKey' }));
  previewKey = '';
  return { model: previewModel, hasKey: false, storage: 'memory' };
}
export async function checkKimiConnection(): Promise<{ models: string[] }> {
  const native = bridge();
  if (!native) throw new Error('连接检查请使用 macOS 应用，网页预览只提供配置界面。');
  const value = await native.postMessage({ action: 'checkConnection' });
  if (!value || typeof value !== 'object' || !('models' in value) || !Array.isArray(value.models) || value.models.some((model: unknown) => typeof model !== 'string')) throw new Error('服务端返回了无法读取的模型列表。');
  return value as { models: string[] };
}
export async function loadKimiUsage(): Promise<KimiUsage | null> {
  const reveal = (window.webkit?.messageHandlers as unknown as Record<string, SettingsBridge> | undefined)?.glimpseReveal;
  if (!reveal) return null;
  const value = await reveal.postMessage({ action: 'usage' });
  if (!value || typeof value !== 'object' || !['limit', 'knownTokens', 'reservedTokens', 'unknownRequests', 'remainingTokens'].every(key => key in value && Number.isInteger((value as Record<string, unknown>)[key]) && Number((value as Record<string, unknown>)[key]) >= 0)) throw new Error('无法读取本轮预算，已暂停新请求。');
  return value as KimiUsage;
}
