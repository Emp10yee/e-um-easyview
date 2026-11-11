# 이음 EasyView

디지털 취약계층을 위한 키오스크 안내 웹앱입니다. `develop` 브랜치에서 백엔드와 프런트엔드의 담당 영역을 분리했습니다.

## 폴더 구조

```text
e-um-easyview/
├── backend/                  # 백엔드 담당 영역 (Node.js)
│   ├── src/
│   │   ├── server.mjs         # HTTP API, 입력 검증, Gemini 호출
│   │   └── lib/
│   │       └── guide.mjs      # 안내 프롬프트, 분석 응답 검증
│   ├── test/
│   │   └── guide.test.mjs
│   ├── .env.example
│   ├── package.json
│   └── README.md
├── frontend/                 # 프런트엔드 담당 영역 (React + TypeScript + Vite)
│   ├── src/                  # front 브랜치의 팀원 소스
│   │   ├── App.tsx
│   │   ├── pages.tsx
│   │   ├── mock.ts
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── demo/                 # 기존 HTML/JS 시연 화면 보존
│   │   ├── index.html
│   │   ├── app.js
│   │   ├── demo.js
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
├── .gitignore
├── package.json              # 각 폴더 실행을 위한 편의 명령
└── README.md
```

프런트엔드 소스는 공유된 저장소의 `front` 브랜치 커밋 `8cc68d7bc68cafd0e8a76c8d8ddbf8a562e7e7c1`과 일치하는 로컬 `origin/front`에서 복사했습니다. 화면 코드와 Vite 설정은 변경하지 않았습니다. 기존 시연 UI는 삭제하지 않고 `frontend/demo/`로 이동했습니다.

## IntelliJ에서 실행

저장소 루트 폴더를 Open한 뒤 내장 Terminal에서 실행합니다. Node.js 22.9 이상이 필요합니다. 프런트엔드의 Vite가 요구하는 버전도 충족하도록 Node.js 24 사용을 권장합니다.

### 백엔드 + 기존 시연 화면

```powershell
npm run dev
```

또는 `npm run dev:backend`로 실행합니다. 별도 npm 패키지 설치가 필요 없습니다. 기본 주소는 `http://localhost:3000`입니다. 루트에서 실행하면 백엔드 폴더로 이동해 실행하므로 환경변수는 `backend/.env`에서 읽습니다.

포트가 이미 사용 중이면 같은 터미널에서 다음과 같이 실행합니다.

```powershell
$env:PORT = "3001"
npm run dev
```

그 뒤 `http://localhost:3001`로 접속합니다.

### 팀원 React 프런트엔드

다른 터미널에서 실행합니다.

```powershell
npm --prefix frontend ci
npm run dev:frontend
```

접속 주소는 Vite가 출력하는 URL을 사용합니다. 현재 팀원 설정은 HTTPS이며 기본 포트는 5173입니다. 이 프런트엔드는 아직 목 데이터로 동작합니다. 실제 백엔드 연결은 이번 구조 분리에 포함하지 않았습니다.

빌드는 `npm run build:frontend`입니다. React 프런트엔드의 의존성 설치와 빌드 검증은 별도로 진행해야 합니다.

## 실제 사진 분석 설정

`backend/.env.example`을 `backend/.env`로 복사해 설정하고 백엔드를 다시 실행합니다.

```dotenv
GEMINI_API_KEY=발급받은_API_키
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
HOST=127.0.0.1
```

API 키를 프런트엔드 소스나 GitHub에 올리지 마세요. `.env`는 하위 폴더에서도 Git에서 제외됩니다. 키가 없으면 기존 시연 화면에서 가상 키오스크 체험이 가능합니다. 실제 사진은 서버를 거쳐 Google Gemini로 전송되며 이 서버는 사진을 디스크에 저장하지 않습니다.

## 현재 연동 상태

- 백엔드: `GET /api/status`, `POST /api/analyze` 제공
- 기존 시연 화면 (`frontend/demo/`): 위 API와 연결되어 있으며 백엔드가 `/`에서 함께 제공
- 팀원 React 화면 (`frontend/src/`): `mock.ts`의 목 데이터 사용. 요청·응답 필드와 API 경로를 맞추는 후속 작업 필요

현재 API 명세와 요청 예시는 `backend/README.md`를 확인하세요. 이번 변경에서는 Spring Boot 전환, 실제 프런트엔드 API 연동, 추가 기능 구현을 하지 않았습니다.

## 검증

```powershell
npm test
npm run check
```

백엔드와 기존 시연 화면의 테스트·문법 검사를 실행합니다. 이 명령은 React TypeScript 빌드를 포함하지 않습니다. 실제 Gemini 분석은 API 키와 스타벅스·학식 키오스크 사진으로 별도 검증해야 합니다.

## 모바일 및 배포

실시간 카메라는 HTTPS 또는 localhost 환경이 필요합니다. PC의 localhost는 휴대폰에서 접속할 수 없습니다. 백엔드는 Node.js 서버와 환경변수를 지원하는 호스팅이 필요하며, 정적 GitHub Pages에 그대로 배포할 수 없습니다. 공개 운영 전에는 인증과 사용자별 요청 제한 등 비용 보호가 필요합니다. 현재는 로컬 시연 단계입니다.
