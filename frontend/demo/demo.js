const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function demoScreen(type, stage, settings) {
  const cafe = type === 'cafe';
  const title = cafe ? 'GREEN COFFEE' : '오늘의 학생식당';
  let labels, message;
  if (stage === 'place') {
    labels = ['포장', '매장 식사'];
    message = `화면에서 ‘${settings.place}’ 버튼을 눌러 주세요.`;
  } else if (stage === 'menu') {
    const category = settings.category;
    labels = cafe
      ? category.includes('따뜻한') ? ['따뜻한 아메리카노', '따뜻한 카페라떼', '따뜻한 차', '시원한 아메리카노']
        : category.includes('라떼') ? ['카페라떼', '바닐라 라떼', '디카페인 라떼', '아메리카노']
        : category.includes('차/에이드') ? ['레몬 에이드', '자몽 에이드', '캐모마일 차', '아메리카노']
        : ['시원한 아메리카노', '시원한 카페라떼', '콜드브루', '따뜻한 아메리카노']
      : category.includes('치킨') ? ['롱치킨버거', '매운 치킨버거', '치킨버거 세트', '감자튀김']
        : category.includes('고기') ? ['비프버거', '더블 비프버거', '불고기버거', '감자튀김']
        : category.includes('감자') ? ['감자튀김', '치즈스틱', '어니언링', '치킨너겟']
        : settings.store === '기타' ? ['오늘의 백반', '돈가스', '제육덮밥', '우동']
        : ['불고기버거', '치즈버거', '더블 치즈버거', '감자튀김'];
    message = `가장 기본인 ‘${labels[0]}’부터 추천해요. 실제 키오스크에서 초록색 테두리 위치를 눌러 주세요.`;
  } else if (stage === 'payment') {
    labels = ['카드 / 삼성페이', '모바일 상품권 / 쿠폰', '네이버 / 카카오페이'];
    message = settings.payment.startsWith('카드') ? '카드 / 삼성페이를 누르세요. 다음 화면에 따라 카드를 꽂거나 삼성페이를 결제 단말기에 대 주세요.' : settings.payment.startsWith('모바일') ? '모바일 상품권 / 쿠폰을 누르고, 안내에 따라 쿠폰 바코드를 스캐너에 보여 주세요.' : '네이버 / 카카오페이를 누르고, 결제 화면 안내에 따라 QR 또는 바코드를 보여 주세요.';
  } else {
    labels = [];
    message = '주문 완료 화면이에요. 영수증이나 번호표에서 주문 번호를 확인하고, 음식을 받을 때까지 보관해 주세요.';
  }
  const cards = labels.map((label, i) => {
    const x = i % 2 ? 336 : 40, y = 200 + Math.floor(i / 2) * 200;
    return { label, box: [y / 800 * 1000, x / 640 * 1000, (y + 170) / 800 * 1000, (x + 264) / 640 * 1000], x, y };
  });
  let selected = stage === 'place' ? cards.find(c => c.label === settings.place) : stage === 'payment' ? cards[settings.payment.startsWith('카드') ? 0 : settings.payment.startsWith('모바일') ? 1 : 2] : cards[0];
  const customAbsent = stage === 'menu' && !['기본(불고기/치즈)', '치킨 버거', '고기 패티', '감자튀김/사이드', '시원한 아메리카노', '따뜻한 아메리카노', '라떼', '차/에이드', '오늘의 식사'].includes(settings.category);
  if (customAbsent) { selected = null; message = '이 예시 화면에는 입력하신 메뉴가 없어요. 다른 화면을 촬영하거나 주문 설정을 바꿔 주세요.'; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="#f7f4ed"/><rect width="640" height="112" fill="${cafe ? '#176b54' : '#254c70'}"/><text x="320" y="65" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="bold" fill="white">${title}</text><text x="320" y="152" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#283e36">${{ place: '어디에서 드시나요?', menu: '메뉴를 선택해 주세요', payment: '결제 방법을 선택해 주세요', complete: '주문이 완료되었습니다' }[stage]}</text>${cards.map((c, i) => `<rect x="${c.x}" y="${c.y}" width="264" height="170" rx="14" fill="white" stroke="#d3dcd6" stroke-width="2"/><circle cx="${c.x + 132}" cy="${c.y + 60}" r="25" fill="${cafe ? '#d6e9df' : '#f1dfbd'}"/><text x="${c.x + 132}" y="${c.y + 69}" text-anchor="middle" font-family="sans-serif" font-size="23" fill="#36584a">${stage === 'menu' ? (cafe ? '☕' : '밥') : String(i + 1)}</text><text x="${c.x + 132}" y="${c.y + 126}" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="bold" fill="#233a31">${escape(c.label)}</text>`).join('')}${stage === 'complete' ? '<circle cx="320" cy="320" r="65" fill="#d6e9df"/><text x="320" y="343" text-anchor="middle" font-size="65" fill="#176b54">✓</text><text x="320" y="455" text-anchor="middle" font-family="sans-serif" font-size="29" fill="#233a31">주문 번호 108</text>' : ''}<text x="320" y="748" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#66796e">EasyView 시연용 가상 키오스크 · 실제 매장 화면 아님</text></svg>`;
  return { image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, stage, store: cafe ? '카페 예시' : '학식 예시', message, candidates: selected ? [selected, ...cards.filter(c => c !== selected)].slice(0, stage === 'menu' ? 4 : 1).map(({ label, box }) => ({ label, box })) : [] };
}
