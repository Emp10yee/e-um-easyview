# 이음 EasyView

실제 React 화면(`frontend/src`)과 API를 Render 한 서버에서 제공합니다. `frontend/demo`는 기존 확인용 소스로 보존합니다. 배포 설정은 `render.yaml`이며 팀 저장소의 `main` 브랜치를 사용합니다.

## 통합 실행 및 배포

로컬에서 배포 형태로 확인하려면 프로젝트 루트에서 실행합니다.

```powershell
npm --prefix frontend ci --include=dev
npm run build:frontend
npm test
npm run check
npm start
```

`http://localhost:3000`에서 React 화면과 API를 함께 사용합니다. 이미 3000번 서버가 실행 중이면 먼저 해당 서버를 종료하거나 다른 PORT를 설정하세요. 프런트 수정 후에는 다시 빌드해야 합니다. 개발 중에는 기존처럼 `npm run dev:backend`와 `npm run dev:frontend`를 별도 터미널에서 실행할 수 있습니다. 백엔드 주소에서 화면을 보려면 먼저 빌드해야 하며, 빌드가 없으면 실행 방법을 포함한 503 응답을 반환합니다.

배포 순서:

1. 배포 준비 코드를 팀 `develop`에 반영하고 검증합니다.
2. 팀 저장소에서 `develop → main` PR을 검토·머지합니다.
3. Render에서 팀 저장소를 연결해 Blueprint를 생성하고 루트의 `render.yaml`을 사용합니다. 서비스 생성 화면에서 요금제와 설정을 확인합니다. 수동 Web Service 생성 시에도 아래 값을 동일하게 설정합니다.
4. Branch는 `main`, Root Directory는 비워 두고, Build Command는 `npm --prefix frontend ci --include=dev && npm run build:frontend`, Start Command는 `npm start`, Health Check Path는 `/api/status`로 설정합니다.
5. 서버 환경변수에 `BAZE_API_KEY`를 직접 등록합니다. 키는 저장소나 `VITE_` 변수에 넣지 않습니다. `render.yaml`은 Node 24.15.0, `NODE_ENV=production`, `HOST=0.0.0.0`, BAZE 모델과 Gateway 주소를 지정합니다. PORT는 Render 제공 값을 그대로 사용합니다. 로컬 `.env` 파일은 업로드하지 않습니다.
6. Render가 제공하는 `RENDER_EXTERNAL_URL`은 API 허용 출처에 자동 포함됩니다. 커스텀 도메인을 사용하면 `FRONTEND_ORIGINS=https://실제도메인`을 추가합니다. 여러 주소는 쉼표로 구분하고 경로나 마지막 `/`는 제외합니다.
7. 배포 HTTPS 주소에서 첫 화면, `/setup`, `/guide` 새로고침, 휴대폰 카메라·사진 선택·실제 분석·버튼 위치·결제 행동 안내를 확인합니다. `/api/status`의 `configured: true`는 키 존재만 의미하며 실제 분석 성공까지 확인해야 합니다.

카메라·음성 안내·고령층 UI의 사용성은 실제 휴대폰에서 확인해야 합니다. GitHub PR 머지, push, Render 서비스 생성과 비밀키 등록은 별도 작업이며 이 설정 파일만으로 수행되지 않습니다.

디지털 취약계층을 위한 키오스크 안내 웹앱입니다. `develop` 브랜치에서 백엔드와 프런트엔드의 담당 영역을 분리했습니다.

## 폴더 구조

```text
e-um-easyview/
├── backend/                  # 백엔드 담당 영역 (Node.js)
│   ├── src/
│   │   ├── server.mjs         # HTTP API, 입력 검증, BAZE Gateway 호출
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
BAZE_API_KEY=발급받은_API_키
BAZE_MODEL=google/gemma-4-31B-it
BAZE_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
PORT=3000
HOST=127.0.0.1
```

API 키를 프런트엔드 소스나 GitHub에 올리지 마세요. `.env`는 하위 폴더에서도 Git에서 제외됩니다. 키가 없으면 기존 시연 화면에서 가상 키오스크 체험이 가능합니다. 실제 사진은 서버를 거쳐 학교 BAZE Gateway와 선택한 모델 제공업체로 전송되며 이 서버는 사진을 디스크에 저장하지 않습니다.

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

백엔드와 기존 시연 화면의 테스트·문법 검사를 실행합니다. 이 명령은 React TypeScript 빌드를 포함하지 않습니다. 실제 Gateway 분석은 API 키와 스타벅스·학식 키오스크 사진으로 별도 검증해야 합니다.

## 모바일 및 배포

실시간 카메라는 HTTPS 또는 localhost 환경이 필요합니다. PC의 localhost는 휴대폰에서 접속할 수 없습니다. 백엔드는 Node.js 서버와 환경변수를 지원하는 호스팅이 필요하며, 정적 GitHub Pages에 그대로 배포할 수 없습니다. 공개 운영 전에는 인증과 사용자별 요청 제한 등 비용 보호가 필요합니다. 현재는 로컬 시연 단계입니다.
