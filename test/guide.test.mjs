import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalysis, makePrompt } from '../lib/guide.mjs';
import { demoScreen } from '../public/demo.js';

test('rejects invalid, reversed, nonnumeric, or missing coordinates', () => {
  for (const box of [[0, 0, 1200, 50], [100, 50, 20, 80], [0, 0, '50', 50], [0, 0, 50]]) {
    assert.throws(() => validateAnalysis({ stage: 'menu', message: '선택해 주세요', candidates: [{ label: '메뉴', box }] }));
  }
  assert.throws(() => validateAnalysis({ stage: 'unknown', message: '', candidates: [] }));
});
test('uncertain screen has no invented target', () => {
  assert.deepEqual(validateAnalysis({ stage: 'menu', message: '다시 촬영해 주세요.', candidates: [] }).candidates, []);
});
test('demo loops target selected options and finish with receipt guidance', () => {
  for (const type of ['cafe', 'meal']) {
    const settings = { place: '매장 식사', store: type === 'cafe' ? '카페' : '기타', category: type === 'cafe' ? '시원한 아메리카노' : '오늘의 식사', payment: '모바일 상품권/쿠폰' };
    for (const stage of ['place', 'menu', 'payment', 'complete']) {
      const result = validateAnalysis(demoScreen(type, stage, settings));
      assert.equal(result.stage, stage);
      assert.equal(result.candidates.length > 0, stage !== 'complete');
      if (stage === 'place') assert.equal(result.candidates[0].label, '매장 식사');
      if (stage === 'payment') assert.equal(result.candidates[0].label, '모바일 상품권 / 쿠폰');
      if (stage === 'complete') assert.match(result.message, /영수증|번호표/);
    }
  }
});
test('basic chicken ranks before spicy alternative and boxes are separate', () => {
  const screen = demoScreen('meal', 'menu', { store: '햄버거', category: '치킨 버거' });
  assert.equal(screen.candidates[0].label, '롱치킨버거');
  assert.equal(screen.candidates[1].label, '매운 치킨버거');
  assert.notDeepEqual(screen.candidates[0].box, screen.candidates[1].box);
});
test('unavailable custom menu does not highlight unrelated menu', () => {
  const screen = demoScreen('cafe', 'menu', { store: '카페', category: '딸기빙수' });
  assert.deepEqual(screen.candidates, []); assert.match(screen.message, /없어요/);
});
test('AI context includes goal, previous stage and no invented coordinates instruction', () => {
  const prompt = makePrompt({ category: '라떼' }, 'place');
  assert.match(prompt, /라떼/); assert.match(prompt, /Previous step: "place"/); assert.match(prompt, /Never invent button coordinates/);
});
