import test from 'node:test';
import assert from 'node:assert/strict';
import { snapBlueButton, refineButtonBounds } from '../src/buttonBounds.ts';

function scene(rectangles) {
  const pixels = new Uint8ClampedArray(200 * 200 * 4);
  for (const [left, top, right, bottom] of rectangles) {
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) pixels.set([20, 90, 210, 255], (y * 200 + x) * 4);
  }
  return pixels;
}

test('uses actual blue button boundaries when the model box falls below it', () => {
  const pixels = scene([[100, 150, 150, 165]]);
  assert.deepEqual(snapBlueButton(pixels, 200, 200, [825, 550, 875, 700]), [750, 500, 825, 750]);
});

test('does not invent a correction without a qualifying blue control', () => {
  const box = [825, 550, 875, 700];
  assert.deepEqual(snapBlueButton(scene([]), 200, 200, box), box);
  assert.deepEqual(snapBlueButton(scene([[20, 150, 60, 165]]), 200, 200, box), box);
});

test('keeps ambiguous nearby blue controls unchanged', () => {
  const box = [780, 550, 820, 700];
  assert.deepEqual(snapBlueButton(scene([[100, 145, 150, 155], [100, 165, 150, 175]]), 200, 200, box), box);
});

test('credit-card and product guides bypass color refinement entirely', async () => {
  const box = [700, 400, 760, 600];
  assert.deepEqual(await refineButtonBounds('', '신용카드', box), box);
  assert.deepEqual(await refineButtonBounds('', '카레우동', box), box);
});
