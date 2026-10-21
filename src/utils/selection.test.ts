import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizedPoint, selectionFromPoints, validSelection } from './selection.ts';
test('selection remains normalized across rendered image sizes', () => {
  for (const width of [343, 424, 960]) {
    assert.deepEqual(normalizedPoint(10 + width * .25, 20 + width * .75, { left: 10, top: 20, width, height: width }), { x: .25, y: .75 });
  }
});
test('reverse dragging and off-image release clamp to image bounds', () => {
  assert.deepEqual(selectionFromPoints({ x: .8, y: .9 }, { x: -.4, y: .2 }), { x: 0, y: .2, width: .8, height: .7 });
});
test('invalid, degenerate, non-finite and out-of-bounds boxes are rejected', () => {
  for (const s of [{x:0,y:0,width:0,height:1},{x:-.1,y:0,width:.5,height:.5},{x:0,y:0,width:NaN,height:1},{x:.8,y:0,width:.5,height:1}]) assert.equal(validSelection(s), false);
  assert.equal(validSelection({ x: 0, y: 0, width: 1, height: 1 }), true);
});
