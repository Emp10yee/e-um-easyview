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

이 폴더의 `.env.example`을 `.env`로 복사해 `BAZE_API_KEY`를 설정합니다. **환경변수 파일 위치는 `backend/.env`입니다.** 저장소 루트에서 실행해도 backend 폴더의 파일을 읽습니다. 키가 없어도 상태 API와 기존 시연 화면은 이용할 수 있습니다.

학교 SnowChat Gateway 키를 사용합니다. `BAZE_MODEL=google/gemma-4-31B-it`, `BAZE_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway`가 기본값입니다. 직접 호출용 Google 키는 사용하지 않습니다. 현재 학교 키에서 Gemma 4 모델 목록 조회와 테스트 이미지의 JSON 응답을 확인했으며 실제 키오스크 사진 정확도는 추가 검증이 필요합니다.

## 구조

- `src/server.mjs`: 서버 실행 및 포트 오류 안내
- `src/app.mjs`: HTTP 라우팅, CORS, BAZE Gateway 호출 및 오류 처리
- `src/lib/gateway.mjs`: BAZE 이미지·JSON 요청 생성 및 Chat Completions 응답 파싱
- `src/lib/request.mjs`: 사진·사전 설정·후속 선택 입력 검증 및 정규화
- `src/lib/guide.mjs`: 안내 프롬프트 및 AI 응답 검증
- `test/guide.test.mjs`: 응답 검증 및 기존 시연 계약 테스트

## 현재 API

요청·응답 상세와 React 담당자의 연결 절차는 [API 명세](./API.md)를 확인하세요. 백엔드 연동 규격은 구현했으며 React의 실제 호출 교체와 실사진 검증은 남아 있습니다.

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

`frontend/src/mock.ts`는 아직 목 데이터를 사용합니다. 백엔드는 React의 `ctx`와 `imageBase64` 요청을 받을 수 있도록 보완했으며, 응답에 `kind`, `box`, `alternatives`, `alternativeTargets`, `choices`, `completed`를 추가했습니다. 대안 메뉴와 확인 답변은 선택적 `context`에 담아 다음 분석에 전달합니다. 서버가 주문 이력을 저장하지 않으므로 프런트에서 유지해야 합니다. 실제 호출 교체 방법과 완료 처리 주의 사항은 [API 명세](./API.md)를 확인하세요.

기존 동작을 유지하기 위해 `/`에서 `../frontend/demo/`의 시연 UI도 제공합니다. API 코드는 이 폴더에서만 관리하고, UI 변경은 프런트엔드 영역에서 진행합니다.
