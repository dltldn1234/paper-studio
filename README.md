# Paper Studio

브라우저에서 종이 구조물을 설계하고 조립 모습을 살펴보는 클라이언트 전용 CAD 스튜디오입니다. 서버나 계정 없이 동작합니다.

## 현재 기능

- 직육면체 너비·깊이·높이 입력 (기본값 100 × 80 × 60 mm)
- 0.1–10,000 mm 범위 검증과 잘못된 입력에 대한 마지막 유효 모델 보존
- 치수에서 6개 면, 12개 모서리, 2D 전개도를 계산하는 순수 TypeScript geometry core
- 격자, 재단선, 접힘선, 면 치수가 표시되는 SVG 전개도 뷰
- 전개도 팬·줌·화면 맞춤과 키보드 가능한 면 선택
- Three.js 원근 카메라, 조명, OrbitControls가 있는 3D 미리보기
- 2D와 3D 면 선택 및 Inspector 상태 동기화
- 크기 조절 가능한 패널과 좁은 화면을 위한 세로 배치

설계는 현재 탭의 메모리에만 보관되며 새로고침하면 초기화됩니다. 브라우저 저장, 자유형 전개도 편집, 접힘 시뮬레이션, PDF/SVG 내보내기, 실행 취소/다시 실행은 아직 구현되지 않았습니다.

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
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

## 개발 방향

다음 기능을 작은 단위로 확장할 예정입니다.

1. 자유형 2D 종이 전개도 편집
2. 종이 접힘 시뮬레이션
3. 로컬 우선 프로젝트 저장
4. PDF 및 SVG 내보내기

설계 데이터와 렌더링은 브라우저 안에서 처리하며, 추후 저장 기능도 로컬 우선으로 검토합니다.
