import { demoScreen } from './demo.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = {
  place: ['포장', '매장 식사'],
  store: ['햄버거', '카페', '기타'],
  payment: ['카드 (삼성페이 포함)', '모바일 상품권/쿠폰', '간편결제 (네이버·카카오페이)']
};
const categories = {
  '햄버거': ['기본(불고기/치즈)', '치킨 버거', '고기 패티', '감자튀김/사이드', '직접 입력'],
  '카페': ['시원한 아메리카노', '따뜻한 아메리카노', '라떼', '차/에이드', '직접 입력'],
  '기타': ['오늘의 식사', '직접 입력']
};
const steps = [
  { key: 'place', title: '어디에서 드실 건가요?', hint: '원하는 방법을 하나 골라 주세요.', icon: '↗' },
  { key: 'store', title: '어떤 매장에 오셨나요?', hint: '매장 종류를 골라 주세요.', icon: '⌂' },
  { key: 'category', title: '무엇을 드시고 싶으세요?', hint: '정확한 메뉴 이름을 몰라도 괜찮아요.', icon: '☕' },
  { key: 'payment', title: '어떻게 결제하시겠어요?', hint: '선택하신 방법에 맞춰 안내해 드릴게요.', icon: '▤' }
];
const stageTitles = { place: '포장·매장 선택', menu: '메뉴 선택', payment: '결제 안내', complete: '주문 완료' };
const state = { screen: 'setup', step: 0, settings: { place: '', store: '', category: '', payment: '' }, custom: '', mode: 'real', demoType: 'cafe', stage: 'place', result: null, image: '', selected: 0, busy: false, error: '', configured: false, sound: false };
let stream, generation = 0;

function say(text) {
  if (!state.sound || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const voice = new SpeechSynthesisUtterance(text); voice.lang = 'ko-KR'; voice.rate = 0.85; speechSynthesis.speak(voice);
}
function notify(text) { $('#notice').textContent = text; setTimeout(() => { $('#notice').textContent = ''; }, 5000); }
function stopCamera() { stream?.getTracks().forEach(t => t.stop()); stream = null; }
function resetResult() { state.result = null; state.selected = 0; state.error = ''; }
function focusHeading() { requestAnimationFrame(() => (app.querySelector('#step-title') || app.querySelector('h1, h2'))?.focus()); }

function renderSetup() {
  const step = steps[state.step];
  const choices = step.key === 'category' ? categories[state.settings.store] || categories['기타'] : options[step.key];
  const selected = state.settings[step.key];
  app.innerHTML = `<div class="setup-layout"><aside class="intro"><div class="eyebrow">당신의 디지털 길잡이</div><h1 tabindex="-1">키오스크 앞에서,<br>이제 <em>천천히 해도</em><br>괜찮아요.</h1><p>원하는 것을 고르면<br>이음이 누를 곳을 알려드려요.</p><div class="path-art" aria-hidden="true"><span>1</span><i></i><span>2</span><i></i><span>✓</span></div><div class="intro-note">설치 없이, 웹에서 바로 함께해요.</div></aside><section class="setup-card" aria-labelledby="step-title"><div class="step-meta"><span>주문 전 준비</span><strong>${state.step + 1} / 4</strong></div><div class="progress" aria-label="4단계 중 ${state.step + 1}단계">${steps.map((_, i) => `<span class="${i <= state.step ? 'filled' : ''}"></span>`).join('')}</div><span class="step-icon" aria-hidden="true">${step.icon}</span><h2 id="step-title" tabindex="-1">${step.title}</h2><p class="hint">${step.hint}</p><div class="choices ${choices.length > 3 ? 'compact' : ''}">${choices.map((label, i) => `<button class="choice ${selected === label ? 'selected' : ''}" data-choice="${i}" aria-pressed="${selected === label}"><span>${escape(label)}</span><span class="radio" aria-hidden="true">${selected === label ? '✓' : ''}</span></button>`).join('')}</div>${step.key === 'category' && selected === '직접 입력' ? `<label class="custom-label" for="custom">먹고 싶은 메뉴를 적어 주세요</label><input id="custom" maxlength="80" value="${escape(state.custom)}" placeholder="예: 돈가스, 녹차">` : ''}<div class="setup-actions"><button class="secondary" id="back" ${state.step === 0 ? 'disabled' : ''}>이전</button><button class="primary" id="next" ${!selected || (selected === '직접 입력' && !state.custom.trim()) ? 'disabled' : ''}>${state.step === 3 ? '안내 시작하기' : '다음으로'} <span aria-hidden="true">→</span></button></div><p class="reassure">선택은 나중에 다시 바꿀 수 있어요.</p></section></div><section class="demo-banner"><div><strong>먼저 경험해 보세요</strong><p>키오스크가 없어도 예시 화면으로 연습할 수 있어요.</p></div><button class="text-button" id="quick-demo">시연 체험하기 →</button></section>`;
  app.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => {
    const value = choices[Number(button.dataset.choice)];
    if (step.key === 'store' && value !== state.settings.store) { state.settings.category = ''; state.custom = ''; }
    state.settings[step.key] = value; renderSetup();
    app.querySelector(`[data-choice="${button.dataset.choice}"]`)?.focus();
    if (value === '직접 입력') $('#custom')?.focus();
    say(value);
  });
  if ($('#custom')) $('#custom').oninput = event => { state.custom = event.target.value; $('#next').disabled = !state.custom.trim(); };
  $('#back').onclick = () => { state.step--; renderSetup(); focusHeading(); };
  $('#next').onclick = () => {
    if (state.step < 3) { state.step++; renderSetup(); focusHeading(); say(steps[state.step].title); }
    else enterGuide('real');
  };
  $('#quick-demo').onclick = () => {
    state.settings = { place: '포장', store: '카페', category: '시원한 아메리카노', payment: '카드 (삼성페이 포함)' };
    state.custom = ''; state.demoType = 'cafe'; enterGuide('demo');
  };
}
function actualSettings() { return { ...state.settings, category: state.settings.category === '직접 입력' ? state.custom.trim() : state.settings.category }; }
function loadDemo() {
  const result = demoScreen(state.demoType, state.stage, actualSettings());
  state.result = result; state.image = result.image; state.selected = 0; state.error = '';
}
function enterGuide(mode) {
  if (mode === 'demo') { state.demoBackup = { settings: { ...state.settings }, custom: state.custom }; state.demoType = state.settings.store === '카페' ? 'cafe' : 'meal'; }
  else if (state.demoBackup) { state.settings = state.demoBackup.settings; state.custom = state.demoBackup.custom; state.demoBackup = null; }
  generation++; stopCamera(); state.screen = 'guide'; state.mode = mode; state.stage = 'place'; state.busy = false; resetResult(); state.image = '';
  if (mode === 'demo') loadDemo();
  renderGuide(); focusHeading();
}
function guideMessage() { return state.error || (state.selected > 0 && state.result?.candidates[state.selected] ? `‘${state.result.candidates[state.selected].label}’ 메뉴를 선택하셨어요. 초록색 테두리 위치를 실제 키오스크에서 눌러 주세요.` : state.result?.message) || '키오스크를 촬영하면 누를 곳을 알려드릴게요.'; }
function renderGuide() {
  const result = state.result;
  const selected = result?.candidates[state.selected];
  const complete = result?.stage === 'complete';
  app.innerHTML = `<section class="guide-shell"><div class="guide-top"><div><span class="eyebrow">${state.mode === 'demo' ? '시연 안내' : '촬영 안내'}</span><h1 tabindex="-1">${state.mode === 'demo' ? '예시 화면으로 연습하기' : '키오스크 화면을 보여 주세요'}</h1></div><button class="quiet" id="edit">설정 변경</button></div><div class="order-summary"><span>${escape(state.settings.place)}</span><span>${escape(actualSettings().category)}</span><span>${escape(state.settings.payment)}</span></div><div class="guide-content"><section class="camera-panel" aria-label="키오스크 화면"><div class="camera-bar"><span class="live-dot"></span><strong>${state.mode === 'demo' ? '시연 모드 · 가상 화면' : state.image ? '촬영한 화면' : '카메라 / 사진'}</strong><span class="stage-badge">${stageTitles[state.stage]}</span></div><div class="viewfinder" id="viewfinder">${state.image ? `<img id="kiosk-image" src="${state.image}" alt="${state.mode === 'demo' ? '시연용 가상 키오스크' : '촬영한 키오스크'} 화면"><div id="target" class="target" hidden><span>여기를 눌러 주세요</span></div>` : `<div class="camera-placeholder"><div class="scan-icon" aria-hidden="true">⌗</div><h2>키오스크 화면을<br>네모 안에 담아 주세요</h2><p>화면 전체가 잘 보이게 촬영해 주세요.</p><button class="primary" id="open-camera">카메라 켜기</button><button class="quiet" id="upload-empty">저장된 사진 선택</button></div>`}</div><div class="camera-tools">${state.mode === 'demo' ? `<button class="camera-button" id="demo-cafe" aria-pressed="${state.demoType === 'cafe'}">카페 예시</button><button class="camera-button" id="demo-meal" aria-pressed="${state.demoType === 'meal'}">학식 예시</button>` : `<button class="camera-button" id="capture-photo" ${state.busy ? 'disabled' : ''}>◉ 화면 촬영</button><button class="camera-button" id="upload" ${state.busy ? 'disabled' : ''}>＋ 사진 선택</button>`}</div>${state.mode === 'demo' ? '<p class="camera-caption">실제 스타벅스·학식 사진이 아닌 시연용 화면입니다.</p>' : '<p class="camera-caption">사진 분석 시 촬영 이미지가 Google Gemini로 전송됩니다.</p>'}</section><section class="guidance" aria-label="다음 행동 안내"><div class="guide-progress">${Object.entries(stageTitles).map(([key, label], i) => `<span class="${state.stage === key ? 'active' : ''}" ${state.stage === key ? 'aria-current="step"' : ''}>${i + 1} ${label}</span>`).join('')}</div><div class="instruction" role="status" aria-live="polite"><div class="instruction-icon" aria-hidden="true">${state.busy ? '◌' : complete ? '✓' : '↖'}</div><div><p class="eyebrow">${state.error ? '다시 확인해 주세요' : state.busy ? '화면을 확인하고 있어요' : complete ? '마지막으로 확인해 주세요' : selected ? '지금은 이렇게 해 보세요' : '한 번에 한 걸음'}</p><h2>${state.busy ? '누를 곳을 찾고 있어요…' : escape(guideMessage())}</h2></div></div>${result?.candidates.length > 1 && !state.error && !state.busy ? `<div class="alternatives"><p>다른 메뉴를 원하시나요?</p><div class="chips">${result.candidates.map((c, i) => `<button data-candidate="${i}" class="chip ${i === state.selected ? 'chosen' : ''}" aria-pressed="${i === state.selected}">${escape(c.label)}${i === 0 ? ' · 기본 추천' : ''}</button>`).join('')}</div></div>` : ''}<div class="guide-actions">${complete ? '<button class="primary" id="finish">확인했어요 · 처음으로</button>' : state.mode === 'demo' ? `<button class="primary" id="demo-next" ${result?.candidates.length ? '' : 'disabled'}>눌렀어요 · 다음 화면 →</button>` : `<button class="primary" id="next-photo" ${state.busy ? 'disabled' : ''}>${state.image ? '다음 화면 촬영하기' : '키오스크 촬영하기'} →</button>`}<button class="secondary" id="read-guide">♬ 안내 듣기</button></div><div class="mode-note">${state.mode === 'demo' ? '실제 키오스크에서는 안내된 위치를 직접 눌러 주세요.' : state.configured ? '키오스크를 누른 후 바뀐 화면을 다시 촬영해 주세요.' : '사진 분석 연결이 필요해요. 시연 모드로 먼저 체험할 수 있어요.'}<button class="text-button" id="toggle-mode">${state.mode === 'demo' ? '실제 사진으로 안내받기' : '시연 모드로 연습하기'} →</button></div></section></div></section>`;
  $('#edit').onclick = () => { generation++; stopCamera(); state.busy = false; state.screen = 'setup'; state.step = 0; renderSetup(); focusHeading(); };
  $('#toggle-mode').onclick = () => enterGuide(state.mode === 'demo' ? 'real' : 'demo');
  $('#read-guide').onclick = () => { if (!('speechSynthesis' in window)) return notify('이 브라우저는 음성 안내를 지원하지 않아요.'); const old = state.sound; state.sound = true; say(guideMessage()); state.sound = old; };
  app.querySelectorAll('[data-candidate]').forEach(button => button.onclick = () => {
    state.selected = Number(button.dataset.candidate);
    renderGuide(); app.querySelector(`[data-candidate="${state.selected}"]`)?.focus();
    say(`${state.result.candidates[state.selected].label}. 초록색 테두리 위치를 눌러 주세요.`);
  });
  if ($('#finish')) $('#finish').onclick = () => { stopCamera(); state.screen = 'setup'; state.step = 0; state.settings = { place: '', store: '', category: '', payment: '' }; state.custom = ''; renderSetup(); focusHeading(); };
  if (state.mode === 'demo') {
    for (const type of ['cafe', 'meal']) $(`#demo-${type}`).onclick = () => { state.demoType = type; state.settings.store = type === 'cafe' ? '카페' : '기타'; state.settings.category = type === 'cafe' ? '시원한 아메리카노' : '오늘의 식사'; state.custom = ''; state.stage = 'place'; loadDemo(); renderGuide(); };
    if ($('#demo-next')) $('#demo-next').onclick = () => { const stages = Object.keys(stageTitles); state.stage = stages[stages.indexOf(state.stage) + 1]; loadDemo(); renderGuide(); say(state.result.message); };
  } else {
    for (const selector of ['#open-camera', '#next-photo', '#capture-photo']) if ($(selector)) $(selector).onclick = () => { if (stream && $('#video')) captureFrame(); else openCamera(); };
    for (const selector of ['#upload', '#upload-empty']) if ($(selector)) $(selector).onclick = () => $('#photo').click();
  }
  const img = $('#kiosk-image'); if (img) { img.onload = positionTarget; if (img.complete) positionTarget(); }
}
function positionTarget() {
  const img = $('#kiosk-image'), target = $('#target'), area = $('#viewfinder');
  const item = state.result?.candidates[state.selected];
  if (!img || !target || !item || state.busy || state.error || !img.naturalWidth) { if (target) target.hidden = true; return; }
  const scale = Math.min(area.clientWidth / img.naturalWidth, area.clientHeight / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  const [y1, x1, y2, x2] = item.box;
  Object.assign(target.style, { left: `${(area.clientWidth - w) / 2 + x1 / 1000 * w}px`, top: `${(area.clientHeight - h) / 2 + y1 / 1000 * h}px`, width: `${(x2 - x1) / 1000 * w}px`, height: `${(y2 - y1) / 1000 * h}px` });
  target.hidden = false;
}
new ResizeObserver(positionTarget).observe(app);
window.addEventListener('resize', positionTarget);

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { $('#capture').click(); return; }
  const token = ++generation;
  try {
    stopCamera();
    const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    if (token !== generation || state.screen !== 'guide') { camera.getTracks().forEach(t => t.stop()); return; }
    stream = camera; resetResult(); state.image = ''; renderGuide();
    $('#viewfinder').innerHTML = '<video id="video" autoplay playsinline muted aria-label="키오스크 실시간 카메라"></video><div class="camera-reticle" aria-hidden="true"></div>';
    $('#video').srcObject = stream;
    await $('#video').play(); notify('화면 전체가 보이면 아래 ‘화면 촬영’을 눌러 주세요.');
  } catch { stopCamera(); notify('카메라를 열지 못했어요. 촬영 또는 사진 선택을 이용해 주세요.'); $('#capture').click(); }
}
function captureFrame() {
  const video = $('#video'); if (!video?.videoWidth) return notify('카메라가 준비될 때까지 잠시 기다려 주세요.');
  const canvas = document.createElement('canvas'); const ratio = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  stopCamera(); analyze(canvas.toDataURL('image/jpeg', 0.88));
}
async function selectFile(event) {
  const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
  if (file.size > 20_000_000) return notify('20MB 이하의 사진을 선택해 주세요.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('JPG, PNG, WEBP 사진을 선택해 주세요. HEIC 사진은 JPG로 바꿔 주세요.');
  const token = ++generation;
  try {
    const url = URL.createObjectURL(file); const img = new Image();
    try { img.src = url; await img.decode(); } finally { URL.revokeObjectURL(url); }
    if (token !== generation || state.screen !== 'guide') return;
    const canvas = document.createElement('canvas'); const ratio = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * ratio); canvas.height = Math.round(img.naturalHeight * ratio);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    stopCamera(); analyze(canvas.toDataURL('image/jpeg', 0.88));
  } catch { notify('사진을 열지 못했어요. 다른 사진을 선택해 주세요.'); }
}
async function analyze(image) {
  const token = ++generation;
  resetResult(); state.image = image; state.busy = true; renderGuide();
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: image.split(',')[1], mimeType: 'image/jpeg', settings: actualSettings(), previousStage: state.stage }), signal: AbortSignal.timeout(65_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '분석하지 못했어요. 다시 촬영해 주세요.');
    if (token !== generation) return;
    state.result = data; state.stage = data.stage; say(data.message);
  } catch (error) { if (token === generation) state.error = error.name === 'TimeoutError' ? '분석이 오래 걸려요. 다시 촬영해 주세요.' : error.message; }
  finally { if (token === generation) { state.busy = false; renderGuide(); } }
}
$('#photo').onchange = selectFile; $('#capture').onchange = selectFile;
$('#sound').onclick = () => {
  if (!('speechSynthesis' in window)) return notify('이 브라우저는 음성 안내를 지원하지 않아요.');
  state.sound = !state.sound; $('#sound').textContent = `♬ 음성 안내 ${state.sound ? '켬' : '끔'}`; $('#sound').setAttribute('aria-pressed', state.sound);
  if (state.sound) say('음성 안내를 켰어요.'); else speechSynthesis.cancel();
};
window.addEventListener('pagehide', stopCamera);
fetch('/api/status').then(r => r.json()).then(data => { state.configured = data.configured; }).catch(() => {});
renderSetup();
