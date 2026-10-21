import { useEffect, useState } from 'react';
import { KIMI_MODELS, checkKimiConnection, isKimiModel, isNativeSettings, loadKimiSettings, loadKimiUsage, removeKimiKey, saveKimiSettings } from '../platform/kimiSettings';
import type { KimiModel, KimiSettings, KimiUsage } from '../platform/kimiSettings';

export function Settings() {
  const [settings, setSettings] = useState<KimiSettings | null>(null);
  const [model, setModel] = useState<KimiModel>('kimi-for-coding');
  const [key, setKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [availableModels, setAvailableModels] = useState<string[] | null>(null);
  const [usage, setUsage] = useState<KimiUsage | null>(null);
  const [operation, setOperation] = useState<'save' | 'remove' | 'check'>('save');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([loadKimiSettings(), loadKimiUsage()]).then(([value, budget]) => { if (active) { setSettings(value); setModel(value.model); setUsage(budget); } }).catch(() => { if (active) setError('读取配置或用量失败，请重试。若系统询问钥匙串权限，请允许此应用访问自己的配置。'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  async function save() {
    setOperation('save'); setBusy(true); setError(''); setMessage('');
    try {
      const value = await saveKimiSettings(model, key);
      setSettings(value); setKey(''); setVisible(false); setAvailableModels(null);
      setMessage(value.storage === 'keychain' ? '配置已保存到本机。尚未进行接口验证。' : '配置仅保留在本次预览内，刷新后清除。');
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function remove() {
    setOperation('remove'); setBusy(true); setError(''); setMessage('');
    try { setSettings(await removeKimiKey()); setKey(''); setVisible(false); setAvailableModels(null); setMessage('已移除保存的 API Key。'); }
    catch { setError('移除失败，请重试。'); }
    finally { setBusy(false); }
  }
  async function checkConnection() {
    setOperation('check'); setBusy(true); setError(''); setMessage(''); setAvailableModels(null);
    try { const value = await checkKimiConnection(); setAvailableModels(value.models); setMessage('已读取账号模型列表。照片识别权限和质量仍需单独验证。'); }
    catch (e) { setError(e instanceof Error ? e.message : '连接检查失败，请重试。'); }
    finally { setBusy(false); }
  }
  return <section className="settings page-enter">
    <p className="eyebrow">YOUR CREATIVE TOOLS</p><h1>显影设置</h1><p className="settings-intro">为你的观察，准备合适的模型。</p>
    <div className="settings-status"><span className="status-dot" />{isNativeSettings() && !window.glimpseDemo ? settings?.hasKey ? 'Kimi Code 实时显影 · Key 已配置' : 'Kimi Code 实时显影 · 请先配置 Key' : '当前为预置演示 · 实时显影请使用 macOS 应用'}</div>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={loading || busy || !settings}>
        <div className="settings-section"><span className="field-label">服务平台</span><strong>Kimi Code</strong><p className="field-help">使用你的编程会员 Key。接口固定为 api.kimi.com/coding/v1，消耗与其他客户端共享的会员额度。</p><a href="https://www.kimi.com/code/console" target="_blank" rel="noreferrer">管理 Kimi Code Key ↗</a></div>
        <div className="settings-section"><label htmlFor="kimi-key" className="field-label">API Key <span>{settings?.hasKey ? '已保存 · 未验证' : '未配置'}</span></label><div className="key-field"><input id="kimi-key" type={visible ? 'text' : 'password'} value={key} onChange={event => { setKey(event.target.value); setError(''); setMessage(''); }} placeholder={settings?.hasKey ? '留空保留现有 Key，输入可替换' : '粘贴 Kimi Code API Key'} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} /><button type="button" disabled={!key || busy || loading} aria-label={visible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setVisible(!visible)}>{visible ? '隐藏' : '显示'}</button></div><p className="field-help">{isNativeSettings() ? 'Key 保存在 macOS 钥匙串。已保存的内容不会回填到页面。' : '网页预览只在内存中保留 Key；刷新后清除。'}</p></div>
        <div className="settings-section"><label htmlFor="kimi-model" className="field-label">模型</label><select id="kimi-model" value={model} onChange={event => { if (isKimiModel(event.target.value)) { setModel(event.target.value); setMessage(''); } }}>{KIMI_MODELS.map(option => <option key={option.id} value={option.id}>{option.label}{availableModels && !availableModels.includes(option.id) ? ' · 账号列表未提供' : ''}</option>)}</select><p className="field-help">{KIMI_MODELS.find(option => option.id === model)?.detail}<br />{model} · 实际可用性以账号和服务端响应为准</p></div>
        <div className="settings-section"><span className="field-label">本轮测试上限</span><strong>3,000,000 总 Token</strong><p className="field-help">累计输入与输出，包含图片、思考与重试。请求前预留安全预算；超时或取消不记作零用量。会员额度另有模型倍率和频率限制，不自动购买加油包。</p>{usage && <p className="field-help">本机已确认：{usage.knownTokens.toLocaleString()} Token<br />未确认请求预留：{usage.reservedTokens.toLocaleString()} Token（{usage.unknownRequests} 次）<br />剩余安全预算：{usage.remainingTokens.toLocaleString()} Token</p>}</div>
        <button className="button primary" type="submit">{busy && operation === 'save' ? '正在保存…' : '保存配置'}</button>
        <button className="button secondary connection-button" type="button" disabled={!settings?.hasKey || Boolean(key.trim()) || !isNativeSettings()} onClick={() => void checkConnection()}>{busy && operation === 'check' ? '正在检查…' : '检查连接与模型'}</button>
        <p className="field-help">连接检查只读取模型列表，不发送照片，也不生成内容。修改 Key 后请先保存。</p>
        {settings?.hasKey && <button className="remove-key" type="button" onClick={() => void remove()}>移除已保存的 Key</button>}
      </fieldset>
    </form>
    {loading && <p role="status" className="field-help">正在读取本机配置…</p>}
    {error && <div className="settings-error" role="alert">{error}{!settings && <button onClick={() => setReload(reload + 1)}>重新读取</button>}</div>}
    {message && <p role="status" className="settings-message">{message}</p>}
    <p className="settings-footnote">在线显影只发送照片选区和你的描述，保留原图，用 SVG 描出联想。账户剩余额度与扣费来源以 Kimi Code 控制台为准。</p>
  </section>;
}
