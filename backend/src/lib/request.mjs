import { stages } from './guide.mjs';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const invalid = message => { throw new ApiError(400, 'INVALID_REQUEST', message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function text(value, limit, name) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) invalid(`${name} 값을 확인해 주세요.`);
  return value.trim();
}
function pick(value, mapping, name) {
  const key = text(value, 100, name);
  if (!Object.hasOwn(mapping, key)) invalid(`${name} 값을 확인해 주세요.`);
  const result = mapping[key];
  return result;
}
export function normalizeRequest(data) {
  if (!object(data)) invalid('JSON 객체를 보내 주세요.');
  if (data.settings !== undefined && data.ctx !== undefined) invalid('settings와 ctx 중 하나만 보내 주세요.');
  const source = data.settings ?? data.ctx;
  if (!object(source)) invalid('주문 설정을 보내 주세요.');
  const settings = {
    place: pick(source.place ?? source.dineType, { '포장': '포장', '매장 식사': '매장 식사', '포장해 갈게요': '포장', '매장에서 먹을게요': '매장 식사' }, '포장/매장'),
    store: pick(source.store ?? source.storeType, { '햄버거': '햄버거', '햄버거·패스트푸드': '햄버거', '카페': '카페', '기타': '기타' }, '매장 종류'),
    category: text(source.category, 100, '메뉴 카테고리'),
    payment: pick(source.payment, { '카드 (삼성페이 포함)': '카드 (삼성페이 포함)', '모바일 상품권/쿠폰': '모바일 상품권/쿠폰', '모바일 상품권 / 쿠폰': '모바일 상품권/쿠폰', '간편결제 (네이버·카카오페이)': '간편결제 (네이버·카카오페이)' }, '결제 방법')
  };
  if (data.image !== undefined && data.imageBase64 !== undefined) invalid('image와 imageBase64 중 하나만 보내 주세요.');
  const image = data.image ?? data.imageBase64;
  const mimeType = data.mimeType ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || typeof image !== 'string' || !image.length || image.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) invalid('접두사 없는 JPG, PNG, WEBP Base64 사진을 보내 주세요.');
  const bytes = Buffer.from(image, 'base64');
  if (bytes.toString('base64') !== image) invalid('사진의 Base64 형식이 올바르지 않아요.');
  const signatureMatches = mimeType === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!signatureMatches) invalid('사진 형식과 mimeType이 일치하지 않아요.');
  const previousStage = data.previousStage ?? 'place';
  if (!stages.includes(previousStage)) invalid('이전 안내 단계를 확인해 주세요.');
  const context = {};
  if (data.context !== undefined) {
    if (!object(data.context)) invalid('context는 객체로 보내 주세요.');
    const input = data.context;
    if (input.selectedMenu !== undefined) context.selectedMenu = text(input.selectedMenu, 100, '선택한 메뉴');
    if (input.options !== undefined) {
      if (!Array.isArray(input.options) || input.options.length > 10) invalid('옵션은 최대 10개까지 보내 주세요.');
      context.options = input.options.map(value => text(value, 80, '선택 옵션'));
    }
    if (input.clarification !== undefined) {
      if (!object(input.clarification)) invalid('확인 질문과 답변을 함께 보내 주세요.');
      context.clarification = { question: text(input.clarification.question, 300, '확인 질문'), answer: text(input.clarification.answer, 100, '확인 답변') };
    }
  }
  return { image, mimeType, settings, previousStage, context };
}
