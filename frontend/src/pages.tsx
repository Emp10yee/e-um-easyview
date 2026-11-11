import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  analyzeFrame,
  answerClarification,
  captureFrame,
  DINE_OPTIONS,
  loadPhoto,
  PAYMENT_OPTIONS,
  pickAlternative,
  PRESETS,
  STORE_OPTIONS,
} from './mock'
import type { Box, GuideStep } from './mock'

// ===== 공용 상태 (시작 화면 선택 결과 + 음성 안내 켜짐 여부) =====
export type Ctx = { dineType: string; storeType: string; category: string; payment: string }

const EMPTY_CTX: Ctx = { dineType: '', storeType: '', category: '', payment: '' }

const AppContext = createContext<{
  ctx: Ctx
  setCtx: (c: Ctx) => void
  sound: boolean
  setSound: (v: boolean) => void
}>({ ctx: EMPTY_CTX, setCtx: () => {}, sound: true, setSound: () => {} })

export function AppProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<Ctx>(EMPTY_CTX)
  const [sound, setSound] = useState(true) // 음성 안내 기본 켬
  return <AppContext.Provider value={{ ctx, setCtx, sound, setSound }}>{children}</AppContext.Provider>
}

export const useAppCtx = () => useContext(AppContext)

// ===== 공통 버튼 스타일 (진한 녹색 + 흰 글씨, 아이콘 없이 글자만, 파랑/파스텔 안 씀) =====
const BTN = 'touch-manipulation active:scale-95 rounded-2xl font-extrabold'
const PRIMARY = `${BTN} min-h-[72px] w-full text-2xl bg-green-800 text-white active:bg-green-900 disabled:bg-gray-300 disabled:text-gray-700`
const SECONDARY = `${BTN} min-h-[60px] text-xl bg-white text-gray-950 border-[3px] border-green-800 active:bg-gray-100 disabled:opacity-40`
// 맨 위 작은 버튼 (이전/뒤로, 소리) — 사용자 요청으로 60px 규칙 예외
const SMALL = `${BTN} shrink-0 min-h-[48px] px-3 text-xl border-2 border-green-800 disabled:opacity-40`

const CUSTOM = '직접 입력'

// ===== 소개 화면 `/` (로고 + 이지뷰 / EasyView + 소개 + 시작하기 + 팀명) =====
export function IntroPage() {
  const navigate = useNavigate()
  const [logoOk, setLogoOk] = useState(true) // 로고 파일이 없으면 글자로 대신
  return (
    // 모든 요소를 화면 가운데에 모음 (중요한 건 중앙에)
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-950 flex flex-col items-center justify-center text-center px-6 py-8">
      {/* 서비스명: 로고(이지뷰 폭의 약 45%) → 이지뷰(크게) → EasyView(이지뷰 폭의 약 70%), 촘촘하게 */}
      {logoOk && (
        <img src="/logo.png" alt="이지뷰 로고" onError={() => setLogoOk(false)} className="w-24 object-contain mb-6" />
      )}
      <h1 className="text-7xl font-extrabold text-green-800 leading-none">이지뷰</h1>
      <p className="text-3xl font-extrabold text-green-800 leading-none mt-2">EasyView</p>
      {/* 여백 → 문구 */}
      <p className="mt-10 text-2xl font-bold leading-snug break-keep">
        함께하는 쉬운 주문
        <br />
        키오스크 화면을 찍으면
        <br />
        누를 곳을 하나씩 알려드려요
      </p>
      {/* 큰 여백 → 버튼 */}
      <div className="w-full flex flex-col items-center gap-3 mt-20">
        <button onClick={() => navigate('/setup')} className={PRIMARY}>
          주문 시작하기
        </button>
        <p className="text-xl font-bold text-gray-700">E:UM</p>
      </div>
    </div>
  )
}

// ===== 설정 화면 `/setup` (사전 설정 4단계) =====
export function StartPage() {
  const { setCtx } = useAppCtx()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sel, setSel] = useState<Ctx>(EMPTY_CTX)
  const [typing, setTyping] = useState(false) // 메뉴 직접 입력 중
  const [text, setText] = useState('')

  // 단계별 질문, 선택지, 저장할 키 (프리셋 없는 매장은 카테고리 단계 제외)
  const presets = PRESETS[sel.storeType]
  const steps: { q: string; options: string[]; key: keyof Ctx }[] = [
    { q: '드실 곳을 골라주세요', options: DINE_OPTIONS, key: 'dineType' },
    { q: '가게 종류를 골라주세요', options: STORE_OPTIONS, key: 'storeType' },
    // 가게를 고르기 전에도 단계 수가 4로 보이게 (모든 가게에 프리셋이 있음)
    ...(presets || !sel.storeType ? [{ q: '드실 메뉴를 골라주세요', options: [...(presets ?? []), CUSTOM], key: 'category' as keyof Ctx }] : []),
    { q: '계산 방법을 골라주세요', options: PAYMENT_OPTIONS, key: 'payment' },
  ]
  const cur = steps[step]

  // 다음 단계로 (마지막이면 가이드 화면으로)
  const advance = (next: Ctx) => {
    setSel(next)
    setTyping(false)
    if (step === steps.length - 1) {
      setCtx(next)
      navigate('/guide')
    } else {
      setStep(step + 1)
    }
  }

  // 누른 버튼을 0.3초 강조한 뒤 이동 (그동안 추가 탭 무시 → 두 번 눌림 방지)
  const [picked, setPicked] = useState('')
  const choose = (value: string) => {
    if (picked) return
    setPicked(value)
    setTimeout(() => {
      setPicked('')
      if (value === CUSTOM) return setTyping(true) // 직접 입력 칸 열기 (같은 화면 안에서)
      const next = { ...sel, [cur.key]: value }
      if (cur.key === 'storeType') next.category = '' // 매장 바뀌면 카테고리 초기화
      advance(next)
    }, 300)
  }

  const submitText = () => {
    if (text.trim()) advance({ ...sel, category: text.trim() })
  }

  const goBack = () => {
    if (picked) return
    if (typing) return setTyping(false)
    if (step === 0) return navigate('/') // 첫 단계 → 소개 화면
    setStep(step - 1)
  }

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-950 flex flex-col px-4 pt-4 pb-6">
      {/* 상단: 뒤로 + 진행 표시 */}
      <div className="flex items-center justify-between min-h-[60px]">
        <button onClick={goBack} className={`${SMALL} bg-white text-gray-950`}>
          뒤로
        </button>
        <span className="text-2xl font-extrabold">
          {step + 1} / {steps.length}
        </span>
      </div>

      {/* 진행 막대 (녹색 = 지난 단계) */}
      <div className="flex gap-2 mt-4">
        {steps.map((_, i) => (
          <div key={i} className={`h-3 flex-1 rounded-full ${i <= step ? 'bg-green-800' : 'bg-gray-300'}`} />
        ))}
      </div>

      {/* 질문 */}
      <h1 className="text-3xl font-extrabold leading-snug mt-6 mb-4 break-keep">
        {typing ? '드시고 싶은 메뉴를 적어주세요' : cur.q}
      </h1>

      {typing ? (
        // 직접 입력: 모달 없이 같은 화면에서 큰 입력칸 + 확인 버튼
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={text}
            maxLength={30}
            enterKeyHint="done"
            placeholder="예: 김치볶음밥"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitText()}
            className="min-h-[72px] w-full px-4 rounded-2xl border-[3px] border-gray-950 text-2xl font-bold placeholder:text-gray-500 outline-none focus:ring-4 focus:ring-green-700"
          />
          <button onClick={submitText} disabled={!text.trim()} className={PRIMARY}>
            이 메뉴로 할게요
          </button>
          <button onClick={() => setTyping(false)} className={`${BTN} w-full min-h-[72px] text-2xl bg-white text-gray-950 border-[3px] border-green-800`}>
            목록에서 고를게요
          </button>
        </div>
      ) : (
        // 선택 버튼: 남은 세로 공간을 꽉 채움 (시니어는 스크롤을 잘 안 해서 6개까지 한 화면에 들어가게)
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3">
          {cur.options.map((opt) => (
            <button
              key={opt}
              onClick={() => choose(opt)}
              className={`${BTN} flex-1 min-h-[60px] w-full px-4 border-[3px] border-green-800 text-2xl leading-snug break-keep ${
                picked === opt
                  ? 'bg-green-800 text-white'
                  : opt === CUSTOM
                    ? 'bg-white border-dashed'
                    : 'bg-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
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

// 카메라 미리보기 / 찍은 사진 + Bounding Box
// photo가 있으면 사진 위에 박스, 없으면 실시간 카메라 (영상은 계속 켜둬서 다시 찍기가 빠름)
function CameraView({
  photo,
  box,
  videoRef,
}: {
  photo: string
  box: Box | null
  videoRef: RefObject<HTMLVideoElement>
}) {
  const [videoRatio, setVideoRatio] = useState(3 / 4) // 메타데이터 오기 전 기본 비율(세로)
  const [photoRatio, setPhotoRatio] = useState(3 / 4)
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

  // 사진 → 카메라로 돌아올 때 영상 재생 재개
  useEffect(() => {
    if (!photo) videoRef.current?.play().catch(() => {})
  }, [photo, videoRef])

  const ratio = photo ? photoRatio : videoRatio

  return (
    // 컨테이너 크기를 기준으로 래퍼가 영상/사진 비율을 유지한 채 최대 크기로 맞춰짐
    <div className="relative h-full w-full bg-gray-950 flex items-center justify-center [container-type:size]">
      <div
        className="relative max-h-full max-w-full mx-auto"
        style={{ aspectRatio: ratio, width: `min(100cqw, ${ratio * 100}cqh)` }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            const v = e.currentTarget
            if (v.videoWidth && v.videoHeight) setVideoRatio(v.videoWidth / v.videoHeight)
          }}
          className={`w-full h-full object-fill ${photo ? 'hidden' : ''}`}
        />
        {photo && (
          <img
            src={photo}
            alt="찍은 키오스크 화면"
            onLoad={(e) => {
              const i = e.currentTarget
              if (i.naturalWidth && i.naturalHeight) setPhotoRatio(i.naturalWidth / i.naturalHeight)
            }}
            className="w-full h-full object-fill"
          />
        )}
        <div className="absolute inset-0 pointer-events-none">
          {/* 빨강 박스 + 굵은 흰 테두리 (빨간 배경에서도 보이게, 깜빡임은 주의를 뺏어서 안 씀) */}
          {box && (
            <div
              className="absolute border-[6px] border-red-600 rounded-lg shadow-[0_0_0_4px_white]"
              style={boxStyle(box)}
            />
          )}
        </div>
      </div>

      {/* 카메라 오류: 사진·박스가 없을 때만 덮어서 표시 (갤러리 사진, 카메라 없는 목 시연은 계속 보이게) */}
      {error && !photo && !box && (
        <div className="absolute inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-2xl font-extrabold leading-snug break-keep">
            카메라를 켤 수 없어요
            <br />
            카메라 사용을 허용하거나
            <br />
            아래 &apos;사진 불러오기&apos;를 눌러주세요
          </p>
          <button
            onClick={() => setRetry(retry + 1)}
            className={`${BTN} min-h-[72px] px-8 text-2xl bg-green-700 text-white`}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  )
}

// camera: 카메라 미리보기(찍기 전) / analyzing: 사진 분석 중 / guiding: 사진 + 박스 안내 / done: 주문 끝
type Status = 'camera' | 'analyzing' | 'guiding' | 'done'
type Entry = { step: GuideStep; photo: string } // 지나온 안내 + 그때 찍은 사진

// 보조 기능: 지원될 때만 조용히 실행
const vibrate = () => navigator.vibrate?.(100)
const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = 0.9 // 조금 천천히
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
  const { ctx, setCtx, sound, setSound } = useAppCtx()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('camera')
  const [history, setHistory] = useState<Entry[]>([]) // 지나온 안내 (이전 버튼용)
  const [pending, setPending] = useState('') // 분석 중인(또는 마지막) 사진
  const last = history[history.length - 1]
  const cur = last?.step

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
    status === 'camera'
      ? history.length
        ? '바뀐 화면을 다시 찍어주세요'
        : '키오스크 화면을 찍어주세요'
      : status === 'analyzing'
        ? '화면을 살펴보고 있어요'
        : status === 'done'
          ? '주문이 끝났어요!'
          : cur?.message ?? ''

  // 문구가 바뀔 때마다 읽어줌 (소리 켬일 때만, 첫 화면은 사용자가 누르기 전이라 생략)
  useEffect(() => {
    if (sound && (status !== 'camera' || history.length)) speak(message)
  }, [message, status, sound]) // eslint-disable-line

  const toggleSound = () => {
    vibrate()
    if (sound && 'speechSynthesis' in window) speechSynthesis.cancel()
    setSound(!sound)
  }

  // 사진(dataURL) → analyzeFrame → guiding 또는 done
  const analyze = async (img: string) => {
    vibrate()
    setPending(img)
    setStatus('analyzing')
    const step = await analyzeFrame(img.split(',')[1] ?? '', ctx, history.length, cur)
    if (step) {
      setHistory([...history, { step, photo: img }])
      setStatus('guiding')
    } else {
      setStatus('done')
    }
  }

  // 사진 찍기 (카메라 없으면 빈 사진으로 목 흐름 진행)
  const takePhoto = () => analyze(captureFrame(videoRef.current))

  // 갤러리에서 사진 불러오기
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 사진 다시 골라도 동작하게
    if (!file) return
    const img = await loadPhoto(file)
    if (img) analyze(img)
  }

  // 다음 단계 → 다시 카메라로
  const toCamera = () => {
    vibrate()
    setStatus('camera')
  }

  // 대안 칩: 현재 안내를 그 메뉴 기준으로 교체
  const chooseAlt = (name: string) => {
    vibrate()
    setHistory([...history.slice(0, -1), { ...last, step: pickAlternative(cur, name) }])
  }

  // 이전: 완료 → 마지막 안내 / 카메라 → 마지막 안내 / 안내 중 → 직전 안내 / 첫 안내 → 카메라 / 처음 → 시작 화면
  const goBack = () => {
    vibrate()
    if (status === 'analyzing') return
    if ((status === 'done' || status === 'camera') && cur) return setStatus('guiding')
    if (status === 'guiding' && history.length > 1) return setHistory(history.slice(0, -1))
    if (status === 'guiding') {
      setHistory([])
      return setStatus('camera')
    }
    navigate('/setup')
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
    const next = await answerClarification(cur, choice, last.photo.split(',')[1] ?? '', ctx)
    setHistory([...history.slice(0, -1), { ...last, step: next }])
    setStatus('guiding')
  }

  const kind = status === 'guiding' ? cur?.kind : undefined
  const isAsk = kind === 'ask'

  // 안내 종류별 메인 버튼 문구
  const guidingLabel =
    kind === 'retake'
      ? '다시 찍기'
      : kind === 'wrong'
        ? '눌렀어요, 다시 찍기'
        : isAsk
          ? '위에서 골라주세요'
          : '눌렀어요, 다음 화면 찍기'

  const action =
    status === 'camera'
      ? { label: '사진 찍기', onClick: takePhoto }
      : status === 'analyzing'
        ? { label: '잠시만요…', onClick: () => {} }
        : status === 'guiding'
          ? { label: guidingLabel, onClick: toCamera }
          : { label: '처음으로', onClick: restart }

  // 화면에 띄울 사진: 카메라 상태면 없음(실시간), 안내 중이면 그 안내의 사진
  const shownPhoto = status === 'camera' ? '' : status === 'guiding' ? last?.photo ?? '' : pending

  // 칩: 질문이면 답변, 아니면 대안 메뉴 (최대 2개)
  const chips = status !== 'guiding' ? [] : ((isAsk ? cur?.choices : cur?.alternatives) ?? []).slice(0, 2)
  const onChip = isAsk ? answer : chooseAlt
  const warn = kind === 'retake' || kind === 'wrong' // 예외 안내는 빨간 글씨

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-950 flex flex-col">
      {/* 맨 위: 작은 이전/소리 버튼 + 고른 내용 (잘리지 않게 줄바꿈) */}
      <div className="shrink-0 flex items-start gap-2 px-3 pt-2 pb-2">
        <button onClick={goBack} disabled={status === 'analyzing'} className={`${SMALL} bg-white text-gray-950`}>
          이전
        </button>
        <p className="flex-1 min-w-0 pt-2 text-xl font-extrabold text-center leading-snug break-keep">
          {summarize(ctx)}
        </p>
        <button
          onClick={toggleSound}
          aria-pressed={sound}
          className={`${SMALL} ${sound ? 'bg-green-800 text-white' : 'bg-white text-gray-950'}`}
        >
          {sound ? '소리 켬' : '소리 끔'}
        </button>
      </div>

      {/* 가운데: 카메라 / 찍은 사진 (남는 공간 전부), 박스는 안내 중일 때만 */}
      <div className="flex-1 min-h-0">
        <CameraView
          photo={shownPhoto}
          box={status === 'guiding' && cur ? cur.box : null}
          videoRef={videoRef}
        />
      </div>

      {/* 하단: 안내 문구(최대 2줄) → 칩 줄(최대 2개) → 메인 버튼 1개 */}
      <div className="shrink-0 p-3 flex flex-col gap-3">
        <p
          className={`min-h-[64px] text-2xl font-extrabold leading-8 line-clamp-2 break-keep ${warn ? 'text-red-700' : ''}`}
        >
          {message}
        </p>
        {/* 칩이 없어도 자리를 유지해서 카메라 크기가 출렁이지 않게 함 */}
        <div className="grid grid-cols-2 gap-3 h-[60px]">
          {status === 'camera' ? (
            // 카메라 상태: 칩 자리에 갤러리 버튼
            <button onClick={() => fileRef.current?.click()} className={`${SECONDARY} col-span-2`}>
              사진 불러오기
            </button>
          ) : (
            chips.map((c) => (
              <button
                key={c}
                onClick={() => onChip(c)}
                className={`${BTN} min-h-[60px] px-2 truncate text-xl border-[3px] border-green-800 ${
                  isAsk ? 'bg-green-800 text-white' : 'bg-white active:bg-gray-100'
                }`}
              >
                {c}
              </button>
            ))
          )}
        </div>
        <button onClick={action.onClick} disabled={status === 'analyzing' || isAsk} className={PRIMARY}>
          {action.label}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
    </div>
  )
}
