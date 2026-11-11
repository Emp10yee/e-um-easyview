# EasyView frontend

React + TypeScript + Vite 기반 팀원 프런트엔드입니다. `front` 브랜치 커밋 `8cc68d7bc68cafd0e8a76c8d8ddbf8a562e7e7c1`의 화면 소스와 설정을 보존했습니다.

## 실행

이 폴더에서:

```powershell
npm ci
npm run dev
```

또는 저장소 루트에서:

```powershell
npm --prefix frontend ci
npm run dev:frontend
```

Vite가 출력하는 URL로 접속합니다. 현재 Vite 설정은 HTTPS, 기본 포트 5173입니다. Node.js 24 환경을 사용할 수 있습니다.

## 구조와 연동 상태

- `src/`: 팀원 React 화면. `mock.ts`를 사용한 목 데이터 흐름이며 아직 백엔드 API와 연결되지 않았습니다.
- `public/`: 팀원 정적 에셋
- `demo/`: 기존 HTML/CSS/JavaScript 시연 화면. 백엔드 서버가 제공하며 `/api/status`, `/api/analyze`와 연결되어 있습니다.

현재 백엔드 API 명세는 `../backend/README.md`를 확인하세요. `mock.ts`의 TODO 경로와 백엔드의 실제 API는 다르므로 후속 연동 시 조율이 필요합니다. API 키는 프런트엔드 환경변수에 넣지 않습니다.

## 빌드

```powershell
npm run build
```

루트에서는 `npm run build:frontend`로 실행합니다. 이번 변경은 폴더 분리만 수행하며 React 의존성 설치·빌드·API 연동은 별도 작업입니다.
