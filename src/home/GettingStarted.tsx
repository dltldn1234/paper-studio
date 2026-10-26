const steps = [
  ['01', '모델 선택', '기본 형상을 고르고 원하는 치수를 입력하세요.'],
  ['02', '전개도 편집', '접힘선과 접착 날개를 다듬어 설계하세요.'],
  ['03', '3D 형태 확인', '접힘을 조절하며 완성된 구조를 확인하세요.'],
  [
    '04',
    'PDF 내보내기 및 출력',
    '실제 크기로 출력하고 나만의 구조를 완성하세요.',
  ],
]

export function GettingStarted() {
  return (
    <section id="guide" className="home-guide">
      <div className="home-section-heading">
        <div>
          <span className="home-eyebrow">FROM IDEA TO OBJECT</span>
          <h2>처음이어도, 차근차근.</h2>
        </div>
        <span>네 단계면 충분합니다.</span>
      </div>
      <div className="home-steps">
        {steps.map(([number, title, description]) => (
          <div key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
