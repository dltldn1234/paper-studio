# Paper Studio

브라우저에서 종이 구조물을 설계하고 조립 모습을 살펴보는 클라이언트 전용 웹 앱입니다. 서버나 계정 없이 동작하는 것을 목표로 합니다.

## 기술 스택

- React, TypeScript, Vite
- Tailwind CSS
- Three.js
- pnpm
- ESLint, Prettier, Vitest, Testing Library
- GitHub Actions

## 시작하기

Node.js 22 이상과 pnpm 10.18.3이 필요합니다.

```sh
pnpm install
pnpm dev
```

## 검증 명령

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

## 개발 방향

다음 기능을 작은 단위로 확장할 예정입니다.

1. 2D 종이 전개도 편집
2. Three.js 기반 3D 미리보기
3. 종이 접힘 시뮬레이션
4. PDF 및 SVG 내보내기

설계 데이터와 렌더링은 브라우저 안에서 처리하며, 추후 저장 기능도 로컬 우선으로 검토합니다.
