import type { Ctx } from './pages'

// ===== 매장 종류별 메뉴 카테고리 프리셋 =====
// 텍스트 직접 입력은 금지 규칙이라 '직접 입력' 칩은 넣지 않음
// 모든 매장이 항상 4단계로 가도록 기타도 넓은 프리셋을 둠
export const PRESETS: Record<string, string[]> = {
  // 차갑게/따뜻하게는 키오스크에서 나올 때 고르면 됨 (안내 중 확인 질문)
  카페: ['아메리카노', '라떼', '차 / 에이드', '다른 음료'],
  '햄버거 / 패스트푸드': ['불고기 / 치즈 버거', '치킨 버거', '새우 버거', '감자튀김 / 사이드'],
  식당: ['제육', '돈까스'],
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
// action: 카드 대기·바코드 보여주기·영수증 받기 등 기기에서 하는 행동 (박스 없음, 백엔드 PR #5)
export type StepKind = 'guide' | 'action' | 'retake' | 'wrong' | 'ask'
export type GuideStep = {
  kind: StepKind
  message: string
  box: Box | null
  alternatives: string[] // guide일 때 대안 메뉴 칩
  choices?: string[] // ask일 때 답변 칩 (최대 2개)
  // ↓ 실제 API 연동용 (화면은 몰라도 됨)
  mock?: boolean // 목 데이터로 만든 안내인지
  stage?: string // 이번 사진의 단계 (다음 요청의 previousStage)
  targets?: { label: string; box: Box }[] // 대안 메뉴 좌표 (칩 누르면 바로 박스 이동)
  selectedMenu?: string // 사용자가 고른 메뉴 (다음 요청에 계속 전달)
  clarification?: { question: string; answer: string } // 확인 질문 답 (계속 전달)
  target?: string // 이번 안내에서 누르라고 한 버튼 이름 ('눌렀어요' 하면 pressed에 쌓임)
  pressed?: string[] // 지금까지 '눌렀어요'로 확인한 버튼들 (같은 메뉴를 또 누르라고 하지 않게 계속 전달)
}

const g = (message: string, box: Box, alternatives: string[] = []): GuideStep => ({ kind: 'guide', message, box, alternatives, mock: true })

// 목 시나리오 (카페). 고른 내용(ctx)으로 알 수 있는 건 묻지 않고 바로 안내
// 시연용으로 '다시 찍기'와 '엉뚱한 화면'을 한 번씩 넣어 둠 (필요 없으면 해당 줄 삭제)
function mockScript(ctx: Ctx): GuideStep[] {
  const cat = ctx.category
  const temp: GuideStep = cat.includes('시원한')
    ? g("'아이스'를 눌러주세요", [300, 80, 460, 480])
    : cat.includes('따뜻한')
      ? g("'핫'을 눌러주세요", [300, 520, 460, 920])
      : { kind: 'ask', message: '차갑게, 따뜻하게 중 하나를 골라주세요', box: null, alternatives: [], choices: ['차갑게', '따뜻하게'], mock: true }
  return [
    { kind: 'retake', message: '화면이 흐려요. 키오스크에 조금 더 가까이 비춰주세요', box: null, alternatives: [], mock: true },
    g("위쪽 '커피'를 눌러주세요", [120, 80, 260, 420], ['차', '디저트']),
    g("'아메리카노'를 눌러주세요", [300, 520, 480, 900], ['라떼', '아이스티']),
    { kind: 'wrong', message: "다른 화면으로 넘어갔어요. 키오스크 화면 왼쪽 위 '뒤로'를 눌러주세요", box: [30, 20, 120, 260], alternatives: [], mock: true },
    temp,
    // 포장일 때만 일회용품 질문 (매장은 일회용품 안 씀)
    ...(ctx.dineType.startsWith('포장')
      ? [{ kind: 'ask', message: '빨대·뚜껑 같은 일회용품이 필요한지 골라주세요', box: null, alternatives: [], choices: ['필요해요', '필요 없어요'], mock: true } as GuideStep]
      : []),
    g("아래 '결제하기'를 눌러주세요", [820, 300, 960, 700]),
    // 결제: 고른 결제 방법 버튼 → 기기에서 하는 행동(action, 박스 없음) → 다음 호출에서 끝
    ...payMock(ctx.payment),
  ]
}

// 결제 방법별 목 안내 (화면 버튼 1개 + 기기 행동 1개)
function payMock(payment: string): GuideStep[] {
  const act = (message: string): GuideStep => ({ kind: 'action', message, box: null, alternatives: [], mock: true })
  if (payment.startsWith('모바일'))
    return [g("'쿠폰 사용'을 눌러주세요", [400, 520, 560, 920]), act('쿠폰 바코드를 화면 아래 스캐너에 보여주세요')]
  if (payment.startsWith('간편'))
    return [g("'간편결제'를 눌러주세요", [600, 80, 760, 480]), act('휴대폰 결제 바코드를 스캐너에 보여주세요')]
  return [g("'카드 결제'를 눌러주세요", [400, 80, 560, 480]), act('카드를 결제 기계에 대고 끝날 때까지 기다려주세요')]
}

// 이미지/영상을 긴 변 최대 1600px JPEG dataURL로 줄임 (작은 글씨도 AI가 읽게) (화면 표시 + 분석 전송 겸용)
const shrink = (src: CanvasImageSource, sw: number, sh: number) => {
  const scale = Math.min(1, 1600 / Math.max(sw, sh))
  const w = Math.round(sw * scale),
    h = Math.round(sh * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(src, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.85)
}

// 카메라 사진 찍기: 카메라가 없으면 빈 문자열 (목 흐름은 그대로 진행)
export const captureFrame = (video: HTMLVideoElement | null) =>
  !video || !video.videoWidth ? '' : shrink(video, video.videoWidth, video.videoHeight)

// 갤러리 사진 불러오기: 실패하면 빈 문자열
export const loadPhoto = (file: File) =>
  new Promise<string>((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve(shrink(img, img.naturalWidth, img.naturalHeight))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve('')
      URL.revokeObjectURL(url)
    }
    img.src = url
  })

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

// ===== 실제 API 연동 (POST /api/analyze, 백엔드가 학교 BAZE Gateway 호출) =====
// 서버 꺼짐 / API 키 없음 → 목으로 진행 (시연 보호)
class UseMock extends Error {}
const retake = (message: string): GuideStep => ({ kind: 'retake', message, box: null, alternatives: [] })

// 백엔드 호출. 주문 끝이면 null, AI 오류면 서버 문구로 retake, 서버 없으면 UseMock throw
async function callApi(imageBase64: string, ctx: Ctx, prev: GuideStep | undefined, clarification?: GuideStep['clarification']): Promise<GuideStep | null> {
  if (!imageBase64) throw new UseMock() // 카메라 없음 → 목
  // 직전 안내가 버튼 안내였으면 사용자가 '눌렀어요'로 확인한 것 → 누른 목록에 추가 (최근 10개, 백엔드 제한)
  const pressed = [...(prev?.pressed ?? []), ...(prev?.kind === 'guide' && prev.target ? [prev.target] : [])].slice(-10)
  const keep = { selectedMenu: prev?.selectedMenu, clarification: clarification ?? prev?.clarification, pressed }
  // 오류로 다시 찍기여도 기억은 유지 (안 그러면 다음 사진에서 누른 내용을 잊음)
  const retakeKeep = (message: string): GuideStep => ({ ...retake(message), stage: prev?.stage, ...keep })
  let res: Response
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType: 'image/jpeg',
        ctx: {
          ...ctx,
          storeType: ctx.storeType === '식당' ? '기타' : ctx.storeType.startsWith('햄버거') ? '햄버거' : ctx.storeType,
        },
        previousStage: prev?.stage ?? 'place',
        context: { ...keep, pressed: pressed.length ? pressed : undefined },
      }),
      signal: AbortSignal.timeout(65_000), // 서버가 AI를 최대 55초 기다림
    })
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') return retakeKeep('분석이 오래 걸려요. 다시 찍어주세요')
    throw new UseMock() // 서버에 연결 안 됨 → 목
  }
  const data = (await res.json().catch(() => null)) as any
  // code가 없으면 우리 백엔드가 아님(프록시 오류 등) → 목
  if (!res.ok) {
    if (!data?.code || data.code === 'AI_NOT_CONFIGURED') throw new UseMock()
    return retakeKeep(data.error || '화면을 읽지 못했어요. 다시 찍어주세요')
  }
  if (data.kind === 'complete' || data.completed) return null
  return {
    kind: data.kind,
    message: data.message,
    box: data.box ?? null,
    alternatives: data.alternatives ?? [],
    choices: data.choices,
    stage: data.kind === 'retake' ? (prev?.stage ?? data.stage) : data.stage,
    targets: data.candidates ?? [],
    target: data.candidates?.[0]?.label,
    ...keep,
  }
}

// 화면은 이 함수만 호출. 더 안내할 게 없으면 null(=주문 끝)
// prev: 직전 안내 (단계·고른 메뉴·질문 답을 이어서 보냄)
export async function analyzeFrame(imageBase64: string, ctx: Ctx, stepIndex: number, prev?: GuideStep): Promise<GuideStep | null> {
  try {
    return await callApi(imageBase64, ctx, prev)
  } catch {} // UseMock → 아래 목 폴백
  await wait(1000) // 분석 중인 느낌용 1초 지연
  const script = mockScript(ctx)
  return stepIndex < script.length ? script[stepIndex] : null // 목 데이터 폴백
}

// 확인 질문 답변 → 같은 사진 + 답변으로 다시 분석 (별도 API 없음)
export async function answerClarification(step: GuideStep, choice: string, imageBase64: string, ctx: Ctx): Promise<GuideStep> {
  if (!step.mock) {
    try {
      const next = await callApi(imageBase64, ctx, step, { question: step.message, answer: choice })
      // 질문에 답했는데 끝났다고 오는 경우는 거의 없음 → 기억 유지한 채 다시 찍기로 안내
      return next ?? { ...step, ...retake('다음 화면을 찍어주세요'), clarification: { question: step.message, answer: choice } }
    } catch {}
  }
  await wait(500)
  return MOCK_ANSWERS[choice] ?? { ...step, kind: 'retake', message: '다시 한 번 비춰주세요', box: null }
}

// 대안 칩 선택 → API가 준 좌표로 바로 박스 이동 (AI 재호출 없음), 고른 메뉴는 다음 요청에 전달
export function pickAlternative(step: GuideStep, name: string): GuideStep {
  const t = step.targets?.find((x) => x.label === name)
  if (t) {
    return {
      ...step,
      message: `'${name}'을(를) 눌러주세요`,
      box: t.box,
      alternatives: step.targets!.map((x) => x.label).filter((l) => l !== name),
      selectedMenu: name,
      target: name, // 대안을 골랐으면 그 메뉴를 누른 것으로 기록
    }
  }
  const alt = MOCK_ALTS[name]
  if (!alt) return step
  return { ...step, ...alt, alternatives: step.alternatives.filter((a) => a !== name) }
}
