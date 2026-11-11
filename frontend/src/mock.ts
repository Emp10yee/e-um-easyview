import type { Ctx } from './pages'

// ===== 매장 종류별 메뉴 카테고리 프리셋 =====
// 텍스트 직접 입력은 금지 규칙이라 '직접 입력' 칩은 넣지 않음
// 모든 매장이 항상 4단계로 가도록 기타도 넓은 프리셋을 둠
export const PRESETS: Record<string, string[]> = {
  카페: ['시원한 아메리카노', '따뜻한 아메리카노', '라떼', '차 / 에이드', '디저트'],
  '햄버거·패스트푸드': ['불고기 / 치즈 버거', '치킨 버거', '새우 버거', '감자튀김 / 사이드'],
  기타: ['식사', '간식 / 디저트'],
}

// ===== 시작 화면 단계별 선택지 =====
export const DINE_OPTIONS = ['포장해 갈게요', '매장에서 먹을게요']
export const STORE_OPTIONS = Object.keys(PRESETS)
// 현금 키오스크는 거의 없어서 제외
export const PAYMENT_OPTIONS = ['카드 (삼성페이 포함)', '모바일 상품권 / 쿠폰', '간편결제 (네이버·카카오페이)']

// ===== AI 안내 데이터 =====
// 좌표 규격: [ymin, xmin, ymax, xmax], 각각 0~1000 (좌상단 원점)
export type Box = [number, number, number, number]

// 안내 종류
// guide: 버튼 안내(박스) / retake: 흐리거나 못 알아봄 → 다시 찍기
// wrong: 엉뚱한 화면 → 벗어나는 버튼 안내(박스) / ask: 사용자에게 확인 질문(choices 칩으로 답)
export type StepKind = 'guide' | 'retake' | 'wrong' | 'ask'
export type GuideStep = {
  kind: StepKind
  message: string
  box: Box | null
  alternatives: string[] // guide일 때 대안 메뉴 칩
  choices?: string[] // ask일 때 답변 칩 (최대 2개)
}

const g = (message: string, box: Box, alternatives: string[] = []): GuideStep => ({ kind: 'guide', message, box, alternatives })

// 목 시나리오 (카페). 고른 내용(ctx)으로 알 수 있는 건 묻지 않고 바로 안내
// 시연용으로 '다시 찍기'와 '엉뚱한 화면'을 한 번씩 넣어 둠 (필요 없으면 해당 줄 삭제)
function mockScript(ctx: Ctx): GuideStep[] {
  const cat = ctx.category
  const temp: GuideStep = cat.includes('시원한')
    ? g("'아이스'를 눌러주세요", [300, 80, 460, 480])
    : cat.includes('따뜻한')
      ? g("'핫'을 눌러주세요", [300, 520, 460, 920])
      : { kind: 'ask', message: '차갑게 드실까요, 따뜻하게 드실까요?', box: null, alternatives: [], choices: ['차갑게', '따뜻하게'] }
  return [
    { kind: 'retake', message: '화면이 흐려요. 키오스크에 조금 더 가까이 비춰주세요', box: null, alternatives: [] },
    g("위쪽 '커피'를 눌러주세요", [120, 80, 260, 420], ['차', '디저트']),
    g("'아메리카노'를 눌러주세요", [300, 520, 480, 900], ['라떼', '아이스티']),
    { kind: 'wrong', message: "다른 화면으로 넘어갔어요. 왼쪽 위 '뒤로'를 눌러주세요", box: [30, 20, 120, 260], alternatives: [] },
    temp,
    // 포장일 때만 일회용품 질문 (매장은 일회용품 안 씀)
    ...(ctx.dineType.startsWith('포장')
      ? [{ kind: 'ask', message: '빨대·뚜껑 같은 일회용품이 필요하세요?', box: null, alternatives: [], choices: ['필요해요', '필요 없어요'] } as GuideStep]
      : []),
    g("아래 '결제하기'를 눌러주세요", [820, 300, 960, 700]),
  ]
}

// 프레임 캡처: 가로 640px로 줄여 JPEG base64(헤더 제거)로 반환
// 카메라가 없으면 빈 문자열 (목 흐름은 그대로 진행)
export const captureFrame = (video: HTMLVideoElement | null) => {
  if (!video || !video.videoWidth) return ''
  const w = 640,
    h = Math.round((video.videoHeight / video.videoWidth) * w)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(video, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.6).split(',')[1]
}

// 대안 칩을 눌렀을 때 보여줄 안내 (목)
export const MOCK_ALTS: Record<string, { message: string; box: Box }> = {
  차: { message: "위쪽 '차'를 눌러주세요", box: [120, 440, 260, 700] },
  디저트: { message: "위쪽 '디저트'를 눌러주세요", box: [120, 720, 260, 960] },
  라떼: { message: "'라떼'를 눌러주세요", box: [300, 80, 480, 460] },
  아이스티: { message: "'아이스티'를 눌러주세요", box: [520, 80, 700, 460] },
}

// 확인 질문에 답했을 때 이어질 안내 (목)
export const MOCK_ANSWERS: Record<string, GuideStep> = {
  차갑게: g("'아이스'를 눌러주세요", [300, 80, 460, 480]),
  따뜻하게: g("'핫'을 눌러주세요", [300, 520, 460, 920]),
  필요해요: g("'일회용품 필요'를 눌러주세요", [560, 80, 700, 480]),
  '필요 없어요': g("'필요 없어요'를 눌러주세요", [560, 520, 700, 920]),
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 화면은 이 함수만 호출. 더 안내할 게 없으면 null(=주문 끝)
// TODO: 실제 API 연동 → POST /tasks/{taskId}/analyses (BAZE Gateway)
export async function analyzeFrame(imageBase64: string, ctx: Ctx, stepIndex: number): Promise<GuideStep | null> {
  try {
    // TODO: 실제 API 연동 (8초 타임아웃, 응답은 JSON만 받도록 프롬프트에 고정)
    // 응답에 ```json 펜스가 섞이면 제거 후 JSON.parse, 끝났으면 null 반환
    // 실패 시 아래 폴백으로 이동
    void imageBase64
  } catch {}
  await wait(1000) // 분석 중인 느낌용 1초 지연
  const script = mockScript(ctx)
  return stepIndex < script.length ? script[stepIndex] : null // 목 데이터 폴백
}

// 확인 질문 답변 → 다음 안내
// TODO: 실제 API 연동 → POST /tasks/{taskId}/analyses/{analysisId}/clarifications 후 재분석
export async function answerClarification(step: GuideStep, choice: string): Promise<GuideStep> {
  await wait(500)
  return MOCK_ANSWERS[choice] ?? { ...step, kind: 'retake', message: '다시 한 번 비춰주세요', box: null }
}

// 대안 칩 선택 시 안내 (목)
// TODO: 실제 API 연동 시 고른 메뉴 이름을 넣어 analyzeFrame 재호출
export function pickAlternative(step: GuideStep, name: string): GuideStep {
  const alt = MOCK_ALTS[name]
  if (!alt) return step
  return { ...step, ...alt, alternatives: step.alternatives.filter((a) => a !== name) }
}
