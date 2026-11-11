# EasyView backend

키오스크 이미지 분석 API를 담당하는 Node.js 서버입니다. 별도의 npm 의존성 설치는 필요하지 않습니다.

## 실행

저장소 루트에서:

```powershell
npm run dev:backend
```

또는 이 폴더에서:

```powershell
npm run dev
```

기본 주소는 `http://127.0.0.1:3000`입니다. 이미 사용 중이면 PowerShell에서 `$env:PORT = "3001"`로 바꾸고 실행합니다.

## 환경변수

이 폴더의 `.env.example`을 `.env`로 복사해 `GEMINI_API_KEY`를 설정합니다. **환경변수 파일 위치는 `backend/.env`입니다.** 저장소 루트에서 실행해도 backend 폴더의 파일을 읽습니다. 키가 없어도 상태 API와 기존 시연 화면은 이용할 수 있습니다.

## 구조

- `src/server.mjs`: HTTP 서버, 요청 검증, Gemini 호출
- `src/lib/guide.mjs`: 안내 프롬프트 및 AI 응답 검증
- `test/guide.test.mjs`: 응답 검증 및 기존 시연 계약 테스트

## 현재 API

- `GET /api/status`: `{ "configured": false }` 등 API 키 설정 여부 반환
- `POST /api/analyze`: 사진 및 주문 설정에 따른 안내 반환

분석 요청 형식:

```json
{
  "image": "JPEG_BASE64_WITHOUT_DATA_URL_PREFIX",
  "mimeType": "image/jpeg",
  "settings": {
    "place": "포장",
    "store": "카페",
    "category": "시원한 아메리카노",
    "payment": "카드 (삼성페이 포함)"
  },
  "previousStage": "place"
}
```

성공 응답 예시:

```json
{
  "stage": "menu",
  "store": "카페",
  "message": "아메리카노 버튼을 눌러 주세요.",
  "candidates": [
    { "label": "아메리카노", "box": [200, 100, 400, 500] }
  ]
}
```

`stage`는 `place | menu | payment | complete`, `box`는 전체 사진 기준 `[ymin, xmin, ymax, xmax]` 0~1000 좌표입니다. 화면을 확인하지 못하면 `candidates`가 비어 있을 수 있습니다. 오류 응답은 `{ "error": "안내 문구" }`입니다.

`frontend/src/mock.ts`의 목 데이터 및 TODO API와 현재 백엔드 API는 아직 연결되지 않았습니다. 이번 변경은 폴더 구조 분리만 수행합니다. 후속 연동 시 요청 필드·응답 필드·단계 모델을 맞춰야 합니다.

기존 동작을 유지하기 위해 `/`에서 `../frontend/demo/`의 시연 UI도 제공합니다. API 코드는 이 폴더에서만 관리하고, UI 변경은 프런트엔드 영역에서 진행합니다.
