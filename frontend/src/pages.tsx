import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  // 새로고침·카메라 앱 복귀 시에도 고른 설정이 날아가지 않게 sessionStorage에 유지
  const [ctx, setCtxState] = useState<Ctx>(() => {
    try { return JSON.parse(sessionStorage.getItem('ctx') || '') } catch { return EMPTY_CTX }
  })
  const setCtx = (c: Ctx) => {
    setCtxState(c)
    try { sessionStorage.setItem('ctx', JSON.stringify(c)) } catch {}
  }
  const [sound, setSound] = useState(true) // 음성 안내 기본 켬
  return <AppContext.Provider value={{ ctx, setCtx, sound, setSound }}>{children}</AppContext.Provider>
}

export const useAppCtx = () => useContext(AppContext)

// ===== 공통 버튼 스타일 (진한 녹색 + 흰 글씨, 아이콘 없이 글자만, 파랑/파스텔 안 씀) =====
const BTN = 'touch-manipulation active:scale-95 transition-transform rounded-2xl font-extrabold'
const PRIMARY = `${BTN} min-h-[72px] w-full text-2xl bg-green-800 text-white active:bg-green-900 disabled:bg-gray-300 disabled:text-gray-700`

const CUSTOM = '직접 입력'

// 음성 안내: 지원될 때만 조용히 실행
const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = 0.9 // 조금 천천히
  speechSynthesis.speak(u)
}

// ===== 소개 화면 `/` (로고 + 이지뷰 / EasyView + 소개 + 시작 버튼을 한 묶음으로, 화면 중앙보다 살짝 위) =====
export function IntroPage() {
  const navigate = useNavigate()
  const [logoOk, setLogoOk] = useState(true) // 로고 파일이 없으면 글자로 대신
  return (
    // 아래 여백(pb-20)을 위보다 크게 둬서 묶음 전체가 중앙보다 조금 위에 오게 함
    <div className="h-dvh w-full max-w-md mx-auto bg-white text-gray-950 flex flex-col items-center justify-center text-center px-6 pt-8 pb-20">
      {logoOk && (
        <img src="/logo.png" alt="이지뷰 로고" onError={() => setLogoOk(false)} className="w-32 object-contain mb-6" />
      )}
      <h1 className="text-7xl font-extrabold text-green-800 leading-none">이지뷰</h1>
      <p className="text-3xl font-extrabold text-yellow-400 leading-none mt-2">EasyView</p>
      <p className="mt-10 text-2xl font-bold leading-snug break-keep">
        화면 찍고, 따라 보고, 주문하고!
        <br />
        어려운 주문도 쉽게 할 수 있어요
      </p>
      {/* 소개 문구 바로 아래 시작 버튼 (팀명은 뺌) */}
      <button onClick={() => navigate('/setup')} className={`${PRIMARY} mt-14`}>
        주문 시작하기
      </button>
    </div>
  )
}

// ===== 설정 화면 `/setup` (사전 설정 4단계) =====
export function StartPage() {
  const { ctx, setCtx, sound, setSound } = useAppCtx()
  const navigate = useNavigate()
  // 가이드에서 '뒤로'로 왔으면 고른 내용을 유지한 채 마지막(계산 방법) 단계부터
  const fromGuide = !!(useLocation().state as any)?.toLast && !!ctx.payment
  const [step, setStep] = useState(fromGuide ? 3 : 0)
  const [sel, setSel] = useState<Ctx>(fromGuide ? ctx : EMPTY_CTX)
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

  // 단계가 바뀔 때마다 질문을 읽어줌 (소개 화면에서 '주문 시작하기'를 누른 뒤라 소리가 남)
  const question = typing ? '드시고 싶은 메뉴를 적어주세요' : cur.q
  useEffect(() => {
    if (sound) speak(question)
  }, [question, sound])
  // 화면을 떠나면 읽던 것 멈춤
  useEffect(() => () => void ('speechSynthesis' in window && speechSynthesis.cancel()), [])

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
    // 전체 배경은 연한 회색(bg-stone-50), 상단바만 흰색(bg-white)으로 구분
    <div className="h-dvh w-full max-w-md mx-auto bg-stone-50 text-gray-950 flex flex-col">
      {/* 흰색 상단바 (슬림형): 1줄(← 이전 / 음성 켜짐) + 2줄(순서 + 바로 오른쪽에 고른 내용) + 3줄(진행 막대) */}
      <header className="shrink-0 bg-white px-4 pt-2 pb-2.5 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="touch-manipulation active:scale-95 transition-transform min-h-[36px] pr-2 flex items-center gap-1.5 text-lg font-extrabold text-green-800"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="4 4 16 16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            이전
          </button>
          <button
            onClick={() => {
              // 끌 때는 읽던 것 바로 멈춤, 켜면 지금 질문을 다시 읽어줌
              if (sound && 'speechSynthesis' in window) speechSynthesis.cancel()
              setSound(!sound)
            }}
            aria-pressed={sound}
            className={`touch-manipulation active:scale-95 transition-transform min-h-[36px] px-3 py-1 rounded-full border-2 border-green-800 flex items-center gap-1.5 text-lg font-bold ${
              sound ? 'bg-green-800 text-white' : 'bg-white text-green-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {sound ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              ) : (
                <path d="M23 9l-6 6M17 9l6 6" />
              )}
            </svg>
            {sound ? '음성 켜짐' : '음성 꺼짐'}
          </button>
        </div>

        {/* 순서(왼쪽) + 바로 오른쪽 옆에 지금까지 고른 내용 */}
        <div className="flex items-baseline gap-2.5 mt-1 min-h-[26px]">
          <span className="shrink-0 text-xl font-extrabold">
            <span className="text-green-800">{step + 1}</span>{' '}
            <span className="text-gray-400 font-bold">/ {steps.length}</span>
          </span>
          <p className="min-w-0 text-xl font-bold text-green-800 break-keep truncate">
            {steps
              .slice(0, step)
              .map((st) => (st.key === 'dineType' ? (sel.dineType.startsWith('포장') ? '포장' : '매장') : sel[st.key]))
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {/* 진행 막대 (녹색 = 지난 단계) */}
        <div className="flex gap-2 mt-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-green-800' : 'bg-gray-200'}`} />
          ))}
        </div>
      </header>

      {/* 본문 영역 (연한 회색 배경 위 질문 + 흰색 선택 카드) */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-5 pb-6">
        {/* 질문 */}
        <h1 className="text-3xl font-extrabold leading-snug mb-4 break-keep">
          {question}
        </h1>

        {typing ? (
          // 직접 입력: 모달 없이 같은 화면에서 큰 입력칸 + 확인 버튼
          <div className="flex flex-col gap-5">
            <input
              autoFocus
              value={text}
              maxLength={30}
              enterKeyHint="done"
              placeholder="예: 김치볶음밥"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitText()}
              className="min-h-[72px] w-full px-4 bg-white rounded-2xl border-[3px] border-gray-950 text-2xl font-bold placeholder:text-gray-500 outline-none focus:ring-4 focus:ring-green-700"
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
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
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

// 한 번 찾은 메인 후면 카메라 (다시 켤 때 바로 이 렌즈로)
let mainCamId = ''

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
    const md = navigator.mediaDevices
    // 해상도를 안 정하면 640x480으로 열려서 흐림 → 고해상도 요청 (안 되면 폰이 가능한 최대로)
    const open = (cam: MediaTrackConstraints) =>
      md.getUserMedia({ video: { ...cam, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
    ;(async () => {
      let s = await open(mainCamId ? { deviceId: { exact: mainCamId } } : { facingMode: 'environment' }).catch(() =>
        open({ facingMode: 'environment' }),
      )
      // 후면 카메라가 여러 개인 폰은 초광각(0.6배, 가장자리 휘어짐)이 잡히기도 함 → 메인 렌즈로 다시 열기
      if (!mainCamId) {
        const backs = (await md.enumerateDevices()).filter(
          (d) => d.kind === 'videoinput' && /back|rear|environment|후면/i.test(d.label),
        )
        // 안드로이드 라벨 "camera2 0, facing back" → 번호가 가장 작은 게 메인 렌즈
        const num = (d: MediaDeviceInfo) => Number(d.label.match(/camera2? (\d+)/)?.[1] ?? 99)
        const main = backs.sort((a, b) => num(a) - num(b))[0]
        if (main) {
          mainCamId = main.deviceId
          if (s.getVideoTracks()[0]?.getSettings().deviceId !== main.deviceId) {
            s.getTracks().forEach((t) => t.stop())
            s = await open({ deviceId: { exact: main.deviceId } })
          }
        }
      }
      if (cancelled) return s.getTracks().forEach((t) => t.stop())
      stream = s
      // 연속 자동 초점 (지원하는 폰에서만, 실패해도 무시)
      const track = s.getVideoTracks()[0] as any
      if (track?.getCapabilities?.().focusMode?.includes('continuous'))
        track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {})
      if (videoRef.current) videoRef.current.srcObject = s
    })().catch(() => !cancelled && setError(true))
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
    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-gray-950 flex items-center justify-center [container-type:size]">
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
          {/* 누를 곳: 노랑 + 진한 녹색 바깥 테두리 (녹색 테마와 어울리고 밝은/어두운 화면 모두에서 보이게, 깜빡임 없음) */}
          {box && (
            <div
              className="absolute border-[3px] border-yellow-400 rounded-md shadow-[0_0_0_2px_#14532d]"
              style={boxStyle(box)}
            />
          )}
        </div>
      </div>

      {/* 카메라 오류: 사진·박스가 없을 때만 덮어서 표시 (갤러리 사진, 카메라 없는 목 시연은 계속 보이게) */}
      {error && !photo && !box && (
        <div className="absolute inset-0 bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-2xl font-extrabold leading-snug break-keep">
            지금은 카메라를 사용할 수 없어요.
            <br />
            다시 시도해주세요.
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
  const captureRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('camera')
  const [history, setHistory] = useState<Entry[]>([]) // 지나온 안내 (단계 번호·이어 보낼 정보용)
  const [pending, setPending] = useState('') // 분석 중인(또는 마지막) 사진
  const last = history[history.length - 1]
  const cur = last?.step

  // 설정 없이 바로 /guide로 들어온 경우 설정 화면으로 이동
  useEffect(() => {
    if (!ctx.category) navigate('/setup', { replace: true })
  }, [ctx.category, navigate])

  // 화면 꺼짐 방지 (지원될 때만)
  // 카메라 앱·갤러리에 다녀오면 자동으로 풀리므로 화면이 다시 보일 때 재요청
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const request = () => {
      if (document.visibilityState !== 'visible') return
      ;(navigator as any).wakeLock
        ?.request('screen')
        .then((l: any) => (lock = l))
        .catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    }
  }, [])

  // 상태별 문구
  // 카메라 상태의 알림 (사진 불러오기 실패 등). 다른 사진을 고르거나 찍으면 지움
  const [notice, setNotice] = useState('')

  const message =
    status === 'camera'
      ? notice || (history.length ? '바뀐 화면을 찍어주세요' : '키오스크 화면이 꽉 차게 가까이 찍어주세요')
      : status === 'analyzing'
        ? '화면을 살펴보고 있어요'
        : status === 'done'
          ? '주문이 끝났어요. 영수증의 주문 번호를 확인해주세요'
          : cur?.message ?? ''

  // 문구가 바뀔 때마다 읽어줌 (소리 켬일 때만, 첫 안내부터)
  useEffect(() => {
    if (sound) speak(message)
  }, [message, status, sound]) // eslint-disable-line

  const toggleSound = () => {
    vibrate()
    if (sound && 'speechSynthesis' in window) speechSynthesis.cancel()
    setSound(!sound)
  }

  // 사진(dataURL) → analyzeFrame → guiding 또는 done
  const analyze = async (img: string) => {
    vibrate()
    setNotice('')
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

  // 사진 찍기
  // 화면 카메라가 안 켜졌을 때: 폰이면 폰 기본 카메라 앱으로, PC면 빈 사진으로 목 흐름 진행(시연용)
  const takePhoto = () => {
    const img = captureFrame(videoRef.current)
    if (!img && matchMedia('(pointer: coarse)').matches) return captureRef.current?.click()
    analyze(img)
  }

  // 갤러리 / 폰 카메라 앱에서 받은 사진
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 사진 다시 골라도 동작하게
    if (!file) return
    const img = await loadPhoto(file)
    if (img) analyze(img)
    else {
      // HEIC 등 열 수 없는 사진 → 조용히 무시하지 않고 알려줌
      vibrate()
      setNotice('사진을 열지 못했어요. 다른 사진을 골라주세요')
    }
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

  // 뒤로: 언제든 설정 화면의 계산 방법 단계로 (다시 찍기는 메인 버튼으로 하니, 뒤로는 선택을 바꾸고 싶은 것)
  const goBack = () => {
    vibrate()
    if (status === 'analyzing') return
    navigate('/setup', { state: { toLast: true } })
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
        : kind === 'action' // 카드 대기·바코드 등 기기에서 하는 행동 (박스 없음, 정상 안내)
          ? '했어요, 다음 화면 찍기'
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
  const warn = kind === 'retake' || kind === 'wrong' || (status === 'camera' && !!notice) // 예외 안내는 빨간 글씨

  return (
    <div className="h-dvh w-full max-w-md mx-auto bg-stone-50 text-gray-950 flex flex-col">
      {/* 맨 위 흰색 상단바 (슬림형): 1줄(← 이전 / 음성 켜짐) + 2줄(하단에 선택한 요소들) */}
      <header className="shrink-0 bg-white px-4 pt-2 pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            disabled={status === 'analyzing'}
            className="touch-manipulation active:scale-95 transition-transform shrink-0 min-h-[36px] pr-2 flex items-center gap-1.5 text-lg font-extrabold text-green-800 disabled:opacity-40"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="4 4 16 16" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            이전
          </button>
          <button
            onClick={toggleSound}
            aria-pressed={sound}
            className={`touch-manipulation active:scale-95 transition-transform shrink-0 min-h-[36px] px-3 py-1 rounded-full border-2 border-green-800 flex items-center gap-1.5 text-lg font-bold ${
              sound ? 'bg-green-800 text-white' : 'bg-white text-green-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {sound ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
              ) : (
                <path d="M23 9l-6 6M17 9l6 6" />
              )}
            </svg>
            {sound ? '음성 켜짐' : '음성 꺼짐'}
          </button>
        </div>
        <p className="mt-1 text-xl font-bold text-green-800 leading-tight break-keep">
          {summarize(ctx)}
        </p>
      </header>

      {/* 가운데: 카메라 / 찍은 사진 (최대한 크게 확보), 박스는 안내 중일 때만 */}
      <div className="flex-1 min-h-0 px-4 pt-2 pb-1">
        <CameraView
          photo={shownPhoto}
          box={status === 'guiding' && cur ? cur.box : null}
          videoRef={videoRef}
        />
      </div>

      {/* 하단: 별도 흰색 바 없이 회색 바탕에 바로 문구 + 버튼 배치 (높이 줄여서 카메라 영역 확대) */}
      <div className="shrink-0 px-4 pt-1 pb-3 flex flex-col gap-2">
        <p
          className={`min-h-[36px] flex items-center text-2xl font-extrabold leading-snug line-clamp-2 break-keep ${warn ? 'text-red-700' : ''}`}
        >
          {message}
        </p>
        {/* 칩이 없어도 자리를 유지해서 카메라 크기가 출렁이지 않게 함 */}
        <div className="grid grid-cols-2 gap-2.5 h-[50px]">
          {status === 'camera' ? (
            // 카메라 상태: 칩 자리에 갤러리 버튼 (흰 바탕 + 회색 테두리로 깔끔하게 차등)
            <button
              onClick={() => fileRef.current?.click()}
              className="touch-manipulation active:scale-95 transition-transform col-span-2 min-h-[50px] rounded-2xl bg-white text-gray-800 border-2 border-gray-300 text-xl font-extrabold active:bg-gray-100"
            >
              앨범에서 사진 불러오기
            </button>
          ) : kind === 'action' ? (
            // 기기에서 하는 행동: 버튼처럼 보이지 않게 글자만 (화면 누르기와 구분)
            <p className="col-span-2 self-center text-xl font-extrabold text-green-800">
              화면 밖에서 이렇게 해주세요
            </p>
          ) : (
            chips.map((c) => (
              <button
                key={c}
                onClick={() => onChip(c)}
                className={`${BTN} min-h-[50px] px-2 text-xl leading-tight break-keep border-[3px] border-green-800 ${
                  isAsk ? 'bg-green-800 text-white' : 'bg-white active:bg-gray-100'
                }`}
              >
                {/* 긴 메뉴명은 잘리지 않게 2줄까지 줄바꿈 */}
                <span className="line-clamp-2">{c}</span>
              </button>
            ))
          )}
        </div>
        <button
          onClick={action.onClick}
          disabled={status === 'analyzing' || isAsk}
          className={`${BTN} min-h-[60px] w-full text-2xl bg-green-800 text-white active:bg-green-900 ${
            status === 'analyzing'
              ? 'disabled:bg-[#5b7a66] disabled:text-white' // 기존 녹색의 채도만 낮춘 색 (흰 글씨 대비 4.7:1)
              : 'disabled:bg-gray-300 disabled:text-gray-700'
          }`}
        >
          {action.label}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {/* 화면 카메라가 안 될 때 폰 기본 카메라 앱으로 찍기 */}
        <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      </div>
    </div>
  )
}
