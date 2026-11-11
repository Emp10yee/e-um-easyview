import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  analyzeFrame,
  answerClarification,
  captureFrame,
  DINE_OPTIONS,
  PAYMENT_OPTIONS,
  pickAlternative,
  PRESETS,
  STORE_OPTIONS,
} from './mock'
import type { Box, GuideStep } from './mock'

// ===== 공용 상태 (시작 화면 선택 결과) =====
export type Ctx = { dineType: string; storeType: string; category: string; payment: string }

const EMPTY_CTX: Ctx = { dineType: '', storeType: '', category: '', payment: '' }

const AppContext = createContext<{ ctx: Ctx; setCtx: (c: Ctx) => void }>({
  ctx: EMPTY_CTX,
  setCtx: () => {},
})

export function AppProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<Ctx>(EMPTY_CTX)
  return <AppContext.Provider value={{ ctx, setCtx }}>{children}</AppContext.Provider>
}

export const useAppCtx = () => useContext(AppContext)

// ===== 시작 화면 `/` (사전 설정 4단계) =====
export function StartPage() {
  const { setCtx } = useAppCtx()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState<Ctx>(EMPTY_CTX)

  // 단계별 질문, 선택지, 저장할 키 (프리셋 없는 매장은 카테고리 단계 제외)
  const presets = PRESETS[sel.storeType]
  const steps: { q: string; options: string[]; key: keyof Ctx }[] = [
    { q: '어디서 드시나요?', options: DINE_OPTIONS, key: 'dineType' },
    { q: '어떤 가게인가요?', options: STORE_OPTIONS, key: 'storeType' },
    ...(presets ? [{ q: '무엇을 드시고 싶나요?', options: presets, key: 'category' as keyof Ctx }] : []),
    { q: '어떻게 계산하시나요?', options: PAYMENT_OPTIONS, key: 'payment' },
  ]
  const cur = steps[step]

  // 누른 버튼을 0.3초 강조한 뒤 이동 (그동안 추가 탭 무시 → 두 번 눌림 방지)
  const [picked, setPicked] = useState('')
  const choose = (value: string) => {
    if (picked) return
    setPicked(value)
    const next = { ...sel, [cur.key]: value }
    if (cur.key === 'storeType') next.category = '' // 매장 바뀌면 카테고리 초기화
    setTimeout(() => {
      setSel(next)
      setPicked('')
      if (step === steps.length - 1) {
        setCtx(next)
        navigate('/guide')
      } else {
        setStep(step + 1)
      }
    }, 300)
  }

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-900 flex flex-col px-4 pt-4 pb-6">
      {/* 상단: 뒤로 + 진행 표시 */}
      <div className="flex items-center justify-between min-h-[60px]">
        {step > 0 ? (
          <button
            onClick={() => !picked && setStep(step - 1)}
            className="min-h-[60px] px-5 text-xl font-bold rounded-2xl border-2 border-gray-900 bg-white touch-manipulation active:scale-95 active:bg-gray-100"
          >
            ← 뒤로
          </button>
        ) : (
          <span />
        )}
        <span className="text-2xl font-bold">
          {step + 1} / {steps.length}
        </span>
      </div>

      {/* 진행 막대 (단색 칸) */}
      <div className="flex gap-2 mt-4">
        {steps.map((_, i) => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-blue-800' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* 질문 */}
      <h1 className="text-3xl font-bold leading-snug mt-8 mb-6">{cur.q}</h1>

      {/* 선택 버튼: 남은 세로 공간을 꽉 채움 */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {cur.options.map((opt) => (
          <button
            key={opt}
            onClick={() => choose(opt)}
            className={`flex-1 min-h-[72px] w-full px-4 rounded-2xl border-2 text-2xl font-bold leading-snug break-keep touch-manipulation active:scale-95 ${
              picked === opt ? 'bg-blue-800 text-white border-blue-800' : 'bg-white border-gray-900'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ===== 메인 카메라 가이드 `/guide` =====
// 0~1000 정규화 좌표 → 래퍼 기준 퍼센트
const boxStyle = ([ymin, xmin, ymax, xmax]: Box) => ({
  top: `${ymin / 10}%`,
  left: `${xmin / 10}%`,
  height: `${(ymax - ymin) / 10}%`,
  width: `${(xmax - xmin) / 10}%`,
})

// 카메라 + Bounding Box (영상과 오버레이를 같은 비율 래퍼에 둬서 좌표 정렬)
function CameraView({ box, videoRef }: { box: Box | null; videoRef: RefObject<HTMLVideoElement> }) {
  const [ratio, setRatio] = useState(3 / 4) // 메타데이터 오기 전 기본 비율(세로)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    // 기능 감지: 미지원이면 오류 안내만 표시
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(true)
      return
    }
    let stream: MediaStream | null = null
    let cancelled = false
    setError(false)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [retry, videoRef])

  if (error) {
    return (
      <div className="h-full w-full bg-gray-900 text-white flex flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-3xl font-bold leading-snug break-keep">
          카메라를 켤 수 없어요
          <br />
          카메라 사용을 허용해 주세요
        </p>
        <button
          onClick={() => setRetry(retry + 1)}
          className="min-h-[72px] px-8 text-2xl font-bold rounded-2xl bg-yellow-400 text-gray-900 touch-manipulation active:scale-95"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    // 컨테이너 크기를 기준으로 래퍼가 영상 비율을 유지한 채 최대 크기로 맞춰짐
    <div className="h-full w-full bg-black flex items-center justify-center [container-type:size]">
      <div
        className="relative max-h-full max-w-full mx-auto bg-black"
        style={{ aspectRatio: ratio, width: `min(100cqw, ${ratio * 100}cqh)` }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight)
          }}
          className="w-full h-full object-fill"
        />
        <div className="absolute inset-0 pointer-events-none">
          {/* 빨강 박스 + 흰 테두리 (빨간 키오스크 배경에서도 보이게) */}
          {box && (
            <div
              className="absolute border-[6px] border-red-600 rounded-lg shadow-[0_0_0_3px_white] animate-pulse"
              style={boxStyle(box)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ===== 메인 카메라 가이드 `/guide` =====
type Status = 'idle' | 'analyzing' | 'guiding' | 'done'

// 보조 기능: 지원될 때만 조용히 실행
const vibrate = () => navigator.vibrate?.(100)
const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  speechSynthesis.speak(u)
}

// 선택 내용 한 줄 요약 (예: "포장 · 라떼 · 카드")
const summarize = (c: Ctx) =>
  [
    c.dineType && (c.dineType.startsWith('포장') ? '포장' : '매장'),
    c.category || c.storeType,
    c.payment && c.payment.split(/[ (]/)[0],
  ]
    .filter(Boolean)
    .join(' · ')

export function GuidePage() {
  const { ctx, setCtx } = useAppCtx()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [history, setHistory] = useState<GuideStep[]>([]) // 지나온 안내 (이전 버튼용)
  const cur = history[history.length - 1]

  // 화면 꺼짐 방지 (지원될 때만)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    ;(navigator as any).wakeLock
      ?.request('screen')
      .then((l: any) => (lock = l))
      .catch(() => {})
    return () => {
      lock?.release().catch(() => {})
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    }
  }, [])

  // 상태별 문구
  const message =
    status === 'idle'
      ? '키오스크 화면을 비춰주세요'
      : status === 'analyzing'
        ? '화면을 살펴보고 있어요'
        : status === 'done'
          ? '주문이 끝났어요!'
          : cur?.message ?? ''

  // 문구가 바뀔 때마다 읽어줌 (첫 호출은 "분석 시작" 탭 직후라 허용됨)
  useEffect(() => {
    if (status !== 'idle') speak(message)
  }, [message, status])

  // 분석 시작 / 눌렀어요 → 캡처 → analyzeFrame → guiding 또는 done
  const analyze = async () => {
    vibrate()
    setStatus('analyzing')
    const step = await analyzeFrame(captureFrame(videoRef.current), ctx, history.length)
    if (step) {
      setHistory([...history, step])
      setStatus('guiding')
    } else {
      setStatus('done')
    }
  }

  // 대안 칩: 현재 안내를 그 메뉴 기준으로 교체
  const chooseAlt = (name: string) => {
    vibrate()
    setHistory([...history.slice(0, -1), pickAlternative(cur, name)])
  }

  // 이전: 완료 → 마지막 안내, 안내 중 → 직전 안내, 첫 안내/대기 → 시작 화면
  const goBack = () => {
    vibrate()
    if (status === 'analyzing') return
    if (status === 'done' && cur) return setStatus('guiding')
    if (status === 'guiding' && history.length > 1) return setHistory(history.slice(0, -1))
    if (status === 'guiding') {
      setHistory([])
      return setStatus('idle')
    }
    navigate('/')
  }

  const restart = () => {
    vibrate()
    setCtx(EMPTY_CTX)
    navigate('/')
  }

  // 확인 질문 답변 → 질문 자리를 이어지는 안내로 교체 (단계 번호 유지)
  const answer = async (choice: string) => {
    vibrate()
    setStatus('analyzing')
    const next = await answerClarification(cur, choice)
    setHistory([...history.slice(0, -1), next])
    setStatus('guiding')
  }

  const kind = status === 'guiding' ? cur?.kind : undefined
  const isAsk = kind === 'ask'

  // 안내 종류별 메인 버튼 문구
  const guidingLabel =
    kind === 'retake' ? '다시 찍기' : kind === 'wrong' ? '눌렀어요, 다시 보기' : isAsk ? '위에서 골라주세요' : '눌렀어요, 다음 안내'

  const action =
    status === 'idle'
      ? { label: '주문 시작', onClick: analyze }
      : status === 'analyzing'
        ? { label: '잠시만요…', onClick: () => {} }
        : status === 'guiding'
          ? { label: guidingLabel, onClick: analyze }
          : { label: '처음으로', onClick: restart }

  // 칩: 질문이면 답변, 아니면 대안 메뉴 (최대 2개)
  const chips = status !== 'guiding' ? [] : ((isAsk ? cur?.choices : cur?.alternatives) ?? []).slice(0, 2)
  const onChip = isAsk ? answer : chooseAlt
  const warn = kind === 'retake' || kind === 'wrong' // 예외 안내는 빨간 글씨

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-900 flex flex-col">
      {/* 맨 위: 이전 + 고른 내용 한 줄 */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2">
        <button
          onClick={goBack}
          disabled={status === 'analyzing'}
          className="shrink-0 min-h-[60px] px-4 text-xl font-bold rounded-2xl border-2 border-gray-900 bg-white touch-manipulation active:scale-95 active:bg-gray-100 disabled:opacity-40"
        >
          ← 이전
        </button>
        <p className="flex-1 min-w-0 truncate text-xl font-bold text-right">{summarize(ctx)}</p>
      </div>

      {/* 상단: 카메라 (남는 공간 전부), 박스는 안내 중일 때만 */}
      <div className="flex-1 min-h-0">
        <CameraView box={status === 'guiding' && cur ? cur.box : null} videoRef={videoRef} />
      </div>

      {/* 하단: 안내 문구(최대 2줄) → 대안 칩(최대 2개 한 줄) → 메인 버튼 1개 */}
      <div className="shrink-0 p-3 flex flex-col gap-3">
        <p className={`min-h-[64px] text-2xl font-bold leading-8 line-clamp-2 break-keep ${warn ? 'text-red-700' : ''}`}>
          {message}
        </p>
        {/* 칩이 없어도 자리를 유지해서 카메라 크기가 출렁이지 않게 함 */}
        <div className="grid grid-cols-2 gap-3 h-[60px]">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => onChip(c)}
              className={`min-h-[60px] px-2 truncate text-xl font-bold rounded-2xl border-2 touch-manipulation active:scale-95 ${
                isAsk ? 'border-blue-800 bg-blue-50 text-blue-900' : 'border-gray-900 bg-white active:bg-gray-100'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          onClick={action.onClick}
          disabled={status === 'analyzing' || isAsk}
          className="min-h-[72px] w-full text-2xl font-bold rounded-2xl bg-blue-800 text-white touch-manipulation active:scale-95 disabled:bg-gray-400"
        >
          {action.label}
        </button>
      </div>
    </div>
  )
}
