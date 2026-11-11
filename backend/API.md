# EasyView API 명세

갱신일: 2026-11-11 · 기준 브랜치: `back`

현재 Node.js 백엔드 구현 기준입니다. React 화면은 아직 `mock.ts`를 사용하므로 실제 API 호출 교체는 프런트 담당 작업입니다. 기존 `frontend/demo`의 `stage`, `message`, `candidates` 응답은 유지했습니다.

## 경로와 실행

- 개발: `npm run dev:backend` → `http://127.0.0.1:3000`
- GET `/api/status`: `{ "configured": true, "provider": "baze", "model": "google/gemma-4-31B-it" }`. API 키 존재 여부이며 유효성·할당량 확인은 아닙니다.
- POST `/api/analyze`: 현재 화면과 주문 목표 분석
- 과거 `/api/v1/tasks/...` 설계는 미구현입니다. 세션·Firestore·서버 주문 이력 저장은 없습니다.

## 분석 요청

`Content-Type: application/json`

React 화면의 사전 설정을 그대로 담는 방식:

```json
{
  "imageBase64": "BASE64_IMAGE_WITHOUT_DATA_URL_PREFIX",
  "mimeType": "image/jpeg",
  "ctx": {
    "dineType": "포장해 갈게요",
    "storeType": "햄버거·패스트푸드",
    "category": "치킨 버거",
    "payment": "모바일 상품권 / 쿠폰"
  },
  "previousStage": "menu",
  "context": {
    "selectedMenu": "매운 치킨버거",
    "options": ["단품"],
    "clarification": {
      "question": "차갑게 드실까요, 따뜻하게 드실까요?",
      "answer": "차갑게"
    }
  }
}
```

위 예시는 각 필드의 구조를 보여 주며 특정 주문 시나리오를 의미하지 않습니다. 최초 분석에서는 `context`를 생략하고 `previousStage`는 `place`로 보냅니다. 질문·답변은 실제로 제시한 질문에 사용자가 답한 경우에만 전달합니다.

기존 시연 화면의 요청 방식도 계속 지원합니다:

```json
{
  "image": "BASE64_IMAGE_WITHOUT_DATA_URL_PREFIX",
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

- `image` / `imageBase64` 중 하나, `settings` / `ctx` 중 하나만 보냅니다. 중복 지정은 400입니다.
- `mimeType`: image/jpeg(생략 시 기본값), image/png, image/webp. Base64 정규 형식 및 파일 서명과 MIME 일치 여부를 검사합니다. 전체 이미지 디코딩 검사는 아닙니다.
- 요청 전체 제한: 7,000,000바이트. Base64와 JSON 포함. 프런트에서 축소 후 전송하세요.
- `previousStage`: place / menu / payment / complete. 생략하면 place.
- 문자열 필드는 앞뒤 공백 제거 후 검증합니다. category는 필수이며 최대 100자입니다.

### 사전 설정 값

| 필드 | 허용 값 및 정규화 |
| --- | --- |
| place 또는 dineType | 포장 / 포장해 갈게요 → 포장, 매장 식사 / 매장에서 먹을게요 → 매장 식사 |
| store 또는 storeType | 햄버거 / 햄버거·패스트푸드 → 햄버거, 카페, 기타 |
| payment | 카드 (삼성페이 포함), 모바일 상품권/쿠폰, 모바일 상품권 / 쿠폰, 간편결제 (네이버·카카오페이) |

### 후속 선택 유지

| context 필드 | 조건 |
| --- | --- |
| selectedMenu | 사용자가 고른 메뉴 이름, 최대 100자 |
| options | 선택한 옵션 문자열 목록, 최대 10개, 각 최대 80자 |
| clarification.question | 실제 확인 질문, 최대 300자 |
| clarification.answer | 사용자의 답변, 최대 100자 |

모두 선택 필드입니다. clarification을 보내면 question과 answer를 함께 보냅니다. 서버는 이 정보를 저장하지 않으므로 프런트에서 유지하고 다음 촬영마다 다시 전달해야 합니다. 사용자가 설정을 새로 시작하면 이전 주문의 context를 초기화하세요. 사용자 선택은 실제 키오스크 조작·결제 성공의 증거가 아니며 모델은 현재 사진도 확인하도록 요청받습니다.

## 분석 성공 응답

HTTP 200. 좌표는 형식 설명을 위한 예시이며 실제 사진의 검증 좌표가 아닙니다.

```json
{
  "stage": "menu",
  "kind": "guide",
  "store": "키오스크",
  "message": "기본 치킨버거를 눌러 주세요.",
  "candidates": [
    { "label": "롱치킨버거", "box": [100, 100, 300, 400] },
    { "label": "매운 치킨버거", "box": [100, 500, 300, 900] }
  ],
  "box": [100, 100, 300, 400],
  "alternatives": ["매운 치킨버거"],
  "alternativeTargets": [
    { "label": "매운 치킨버거", "box": [100, 500, 300, 900] }
  ],
  "choices": [],
  "completed": false
}
```

- `stage`: 사진에서 판별한 현재 단계. 요청의 previousStage를 자동 증가시키지 않습니다.
- `kind`: 안내 종류. 아래 표 기준으로 화면을 처리하세요.
- `candidates`: 기본 추천이 첫 번째인 좌표 목록. 동일 이름의 중복 후보는 거부합니다.
- `box`: 기본 추천 좌표 또는 null.
- `alternatives`: 기본 추천을 제외한 대안 이름 목록. React 기존 필드와 호환하도록 문자열 배열을 유지합니다.
- `alternativeTargets`: 대안 이름과 좌표. 후보 칩 클릭 시 이 좌표로 즉시 박스를 옮기고 선택 이름을 context.selectedMenu에 저장하세요. 같은 사진의 대안을 고르기 위해 추가 AI 호출은 필요하지 않습니다.
- `choices`: ask의 확인 선택지, 정확히 2개. 다른 kind에서는 빈 배열.
- `completed`: kind가 complete일 때만 true. 실제 영수증 발급·결제 처리를 대신하지 않습니다.

| kind | 화면 처리 | 좌표 및 완료 |
| --- | --- | --- |
| guide | 현재 누를 버튼 안내 | 후보 1개 이상, completed=false |
| retake | 사진을 다시 찍도록 안내 | 후보 없음, box=null, completed=false |
| wrong | 잘못 들어간 키오스크 화면의 복귀 안내 | 보이는 복귀 버튼만 후보로 허용. 없으면 box=null. completed=false |
| ask | 누락된 선호를 두 선택지로 확인 | 후보 없음, box=null, completed=false |
| complete | 영수증·주문 번호 확인 안내 | stage=complete, 후보 없음, completed=true |

retake와 ask를 완료로 처리하지 않습니다. stage=complete와 kind=complete는 항상 함께여야 합니다. 빈 후보 배열 자체는 완료 근거가 아닙니다. 모순된 모델 응답은 성공으로 돌려주지 않고 502로 거부합니다.

### 좌표 표시

메뉴명이 현재 화면에 없어도 상위 카테고리로 이동할 수 있으면 `kind=guide`로 안내합니다. 예를 들어 라떼를 원하는데 모닝세트 화면에 `음료` 탭이 보이면, 음료 탭의 실제 좌표를 후보로 반환합니다. 숨겨진 라떼 상품의 좌표를 만들거나 바로 재촬영을 요구하지 않습니다. 카테고리 이동은 한 번에 한 행동만 안내하고, 다른 카테고리를 메뉴 대안으로 나열하지 않습니다. 관련 탭이 이미 선택되어 있으면 같은 탭을 반복 안내하지 않고 보이는 하위 카테고리·페이지 이동 수단을 찾습니다.

전체 업로드 사진 기준 `[ymin, xmin, ymax, xmax]`, 범위 0~1000. `x = 사진 표시 시작 x + 정규화 x / 1000 × 사진 표시 너비`이며 y도 같습니다. 카메라 영역에서 여백을 제외한 실제 이미지 크기를 사용하세요.

### 확인 질문 처리

작은 버튼의 좌표는 전체 사진의 테두리·주변 배경을 포함한 기준으로 환산합니다. 모델에는 버튼명과 중심 위치를 다시 대조하도록 지시하며, 앱이 덧그린 초록 안내 표시는 실제 키오스크 버튼으로 취급하지 않습니다. 시연 UI는 안내 배지를 버튼 박스 밖에 표시하고 박스 중심점을 함께 보여 줍니다. 제공된 Tall 화면의 영역으로 실제 Gateway 위치 검증을 수행했지만 모든 사진의 좌표 정확도를 보장하지는 않습니다.

kind=ask 응답의 message와 choices를 보여 주고 사용자가 답하면 context.clarification에 질문·답변을 저장합니다. 그 뒤 현재 또는 새 사진으로 같은 `/api/analyze`를 호출합니다. 별도 clarification API는 없습니다.

### React 담당자 연동 순서

1. `analyzeFrame`의 목 호출을 `/api/analyze` fetch로 교체하고 ctx, 이미지, previousStage, context를 보냅니다.
2. 응답의 completed=true일 때만 기존 화면의 완료 흐름(null 반환 등)으로 연결합니다. GuideStep에 complete를 그대로 넣으면 기존 StepKind와 타입이 맞지 않습니다.
3. guide/retake/wrong/ask는 기존 GuideStep 필드로 넘기되 alternativeTargets를 별도 보관하거나 타입에 추가합니다.
4. `pickAlternative`의 고정 좌표 대신 이번 API 응답의 대안 좌표를 사용하고 selectedMenu를 유지합니다.
5. 실제 API 오류를 목 데이터로 대체하지 않습니다. 오류 안내와 가상 시연은 분리합니다.

## 오류 응답

기존 error 문자열을 유지하고 기계 판별용 code를 추가했습니다.

```json
{ "error": "분석이 오래 걸려요. 잠시 후 다시 촬영해 주세요.", "code": "AI_TIMEOUT" }
```

| HTTP | code | 처리 |
| --- | --- | --- |
| 400 | INVALID_JSON / INVALID_REQUEST | JSON·필드·사진 형식 확인 |
| 403 | ORIGIN_NOT_ALLOWED | 허용된 프런트 주소 설정 확인 |
| 404 | NOT_FOUND | API 경로 확인 |
| 405 | METHOD_NOT_ALLOWED | HTTP 메서드 확인 |
| 413 | PAYLOAD_TOO_LARGE | 사진 크기 축소 |
| 415 | UNSUPPORTED_MEDIA_TYPE | application/json으로 전송 |
| 429 | RATE_LIMITED / AI_RATE_LIMITED | Retry-After: 5 이후 사용자가 다시 시도 |
| 503 | AI_NOT_CONFIGURED | 서버 API 키 설정 |
| 503 | AI_BUSY | Gateway 모델 일시적 혼잡. 잠시 후 다시 시도 |
| 503 | AI_CREDITS_EXHAUSTED | 학교 크레딧 잔액 확인 |
| 502 | AI_MODEL_NOT_FOUND | BAZE_MODEL이 현재 계정에서 사용 가능한지 확인 |
| 502 | AI_AUTH_FAILED / AI_REQUEST_REJECTED | 키·프로젝트 권한·모델 입력 지원 확인 |
| 502 | AI_UNAVAILABLE / AI_INVALID_RESPONSE | 재시도·재촬영 안내 |
| 504 | AI_TIMEOUT | 재시도·재촬영 안내 |
| 500 | INTERNAL_ERROR | 서버 설정·로그 확인 |

서버 BAZE Gateway 호출 제한 시간은 55초입니다. 프런트 TODO의 8초 제한은 이보다 짧으므로 연동 시 65초 등 여유 있는 클라이언트 제한으로 조율하세요. 모델의 kind·좌표·메시지는 서버 검증을 통과해야 하며 명세 구조 검증이 실제 인식 정확도를 보장하지는 않습니다.


## 개발 출처 및 배포

기본 CORS 허용 출처는 http/https 각각 localhost:5173, 127.0.0.1:5173입니다. 외부 프런트 주소는 backend/.env의 FRONTEND_ORIGINS에 경로·끝 슬래시 없이 쉼표로 구분해 지정합니다. 설정하면 기본 목록을 대체합니다. 출처를 보내지 않는 CLI와 같은 출처의 요청도 지원합니다. CORS는 사용자 인증을 대신하지 않습니다.

```dotenv
FRONTEND_ORIGINS=https://frontend.example.com
```

다른 기기에서 직접 API에 접근하려면 서버 HOST와 방화벽 설정도 필요합니다. HTTPS 페이지에서 HTTP API를 직접 호출하면 혼합 콘텐츠 제한이 적용될 수 있어, 실제 시연은 HTTPS API 또는 동일 출처 프록시로 연결하세요. API 키는 backend/.env에서만 관리하고 프런트 번들·Notion·GitHub에 기록하지 않습니다.

## 검증 상태

- 요청 정규화, 선택 문맥 전달, 안내 종류·좌표 검증, 오류·CORS·동시 요청 처리: 자동 테스트 추가
- 기존 시연 응답 호환: 테스트 확인
- 실제 BAZE Gateway 호출·스타벅스/학식 사진 인식: 키와 사진이 없어 미검증
- React 실제 API 호출 및 현장 PC 시연: 후속 작업
- 제공된 스타벅스 모닝세트 화면의 키오스크 영역으로 실제 Gateway 회귀 검증: 라떼 요청에 `kind=guide`, `label=음료`, 유효한 탭 좌표 반환 확인. 다른 화면의 정확도까지 보장하는 결과는 아닙니다.

## 학교 Gateway 연결 설정

Google Gemini 직접 호출을 제거하고 학교 BAZE의 Chat Completions 경로로 전환했습니다. `backend/.env`에 다음을 설정한 뒤 서버를 재시작하세요.

```dotenv
BAZE_API_KEY=학교에서_발급받은_키
BAZE_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
BAZE_MODEL=google/gemma-4-31B-it
```

Bearer 인증, messages의 text/image_url(data URL), strict json_schema 요청을 사용합니다. 응답은 choices[0].message.content에서 읽고 finish_reason=stop, 거부 응답 없음, JSON 구조 및 좌표 검증을 모두 통과해야 성공으로 반환합니다.

Gemma 4는 학교 키의 모델 목록에 표시되는 것을 확인했고, 1픽셀 테스트 이미지를 전송해 HTTP 200 및 kind=retake를 확인했습니다. 이 테스트는 이미지 전송·응답 구조의 호환성만 확인하며 한국어 메뉴 인식·추천·버튼 위치 정확도를 보장하지 않습니다. 실제 스타벅스·학식 사진으로 후속 검증해야 합니다.

기존 Gemini 환경변수는 더 이상 사용하지 않습니다. 학교 키를 Gemini 키 변수에 넣지 마세요. 크레딧은 학교 키를 발급한 계정에서 차감됩니다. 이미지 전송 대상은 학교 Gateway 및 해당 모델 제공업체입니다. 본 서비스의 API 경로와 프런트에 반환하는 필드는 유지합니다.

참고: [학교 모델 목록](https://docs.mindlogic.ai/docs/sookmyung/api-gateway/getting-started/models), [학교 Chat Completions](https://docs.mindlogic.ai/docs/sookmyung/api-gateway/reference/chat-completions), [Gemma 4 공식 설명](https://ai.google.dev/gemma/docs/core).
