import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockRevealProvider } from './MockRevealProvider.ts';
import type { RevealInput, ProcessingStep } from '../types/reveal.ts';
const input: RevealInput = { image: { src: 'local.jpg', width: 1200, height: 1200, mode: 'sample', sampleId: 'fox' }, selection: { x: .16, y: .29, width: .7, height: .5 }, perceptionText: '一只蜷缩的小狐狸' };
test('sample returns registered fox paths after three ordered stages', async () => {
  const steps: ProcessingStep[] = [];
  const start = Date.now();
  const result = await new MockRevealProvider().reveal(input, { onProgress: step => steps.push(step) });
  assert.deepEqual(steps, ['contours', 'relations', 'drawing']);
  assert.ok(Date.now() - start >= 2900);
  assert.equal(result.interpretation.subject, 'fox'); assert.ok(result.overlay.paths.length >= 5);
  assert.ok(result.mapping.every(m => m.region.every(v => v >= 0 && v <= 1)));
});
test('abort prevents completion and subsequent progress', async () => {
  const controller = new AbortController(); const steps: ProcessingStep[] = [];
  const pending = new MockRevealProvider().reveal(input, { signal: controller.signal, onProgress: step => steps.push(step) });
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(steps, ['contours']);
});
test('invalid selection and empty descriptions fail explicitly', async () => {
  await assert.rejects(new MockRevealProvider().reveal({ ...input, perceptionText: '   ' }));
  await assert.rejects(new MockRevealProvider().reveal({ ...input, selection: { x: 1, y: 0, width: .5, height: .5 } }));
});
test('uploads produce an honestly labeled region-bound generic overlay', async () => {
  const result = await new MockRevealProvider().reveal({ ...input, image: { ...input.image, mode: 'upload', sampleId: undefined } });
  assert.deepEqual(result.overlay.bounds, input.selection);
  assert.match(result.notice, /通用曲线/);
  assert.notEqual(result.interpretation.subject, 'fox');
});
