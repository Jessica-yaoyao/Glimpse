import type { QualitySuite } from '../types/quality';

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
}
// Rebase only edits whose original task is still unchanged on disk. A newer
// first outcome or rating is never silently replaced by a stale window.
export function mergeSuite(base: QualitySuite, proposed: QualitySuite, current: QualitySuite): QualitySuite {
  if (base.id !== current.id || proposed.id !== current.id) throw new Error('验收任务集已变化，当前修改保留在页面中。');
  for (const field of ['engine','baselineId','inputProtocolSha256','createdAt'] as const) if (canonical(base[field]) !== canonical(current[field]) || canonical(proposed[field]) !== canonical(current[field])) throw new Error('验收基线及引擎不可替换。');
  const tasks = current.tasks.map((task, i) => {
    const before = base.tasks[i], after = proposed.tasks[i];
    if (!before || !after || before.id !== task.id || after.id !== task.id) throw new Error('固定验收任务编号不一致。');
    if (canonical(before) === canonical(after) || canonical(task) === canonical(after)) return task;
    if (canonical(before) !== canonical(task)) throw new Error('这项验收已在另一窗口更新，当前修改未覆盖磁盘结果。');
    return after;
  });
  const pairAssessments={...current.pairAssessments};
  for(const id of Object.keys(proposed.pairAssessments??{})){
    const before=base.pairAssessments?.[id],after=proposed.pairAssessments?.[id],now=current.pairAssessments?.[id];
    if(canonical(before)===canonical(after)||canonical(now)===canonical(after))continue;
    if(canonical(before)!==canonical(now))throw new Error('这张照片的对比评阅已在另一窗口更新。');
    pairAssessments[id]=after!;
  }
  return { ...current, tasks, ...(Object.keys(pairAssessments).length?{pairAssessments}:{}) };
}
