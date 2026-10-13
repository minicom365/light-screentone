# light-screentone (한국어 가이드)

흑백 이진(1비트) 디스플레이, 펜 플로터, 에치 어 스케치, 만화 인쇄를 위한 무의존성 초경량 함수형 스크린톤 및 오일러 벡터 해칭 엔진입니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

## 핵심 기능

- **외부 의존성 제로 (Zero-Dependency)**: 브라우저(Canvas 2D / WebGL)와 Node.js 어디서나 단일 파일로 동작합니다.
- **수학적 포인트 셰이더**: 좌표 $(x, y)$와 명도 $I \in [0, 1]$를 받아 0(흑) 또는 1(백)을 즉시 산출하는 순수 함수 인터페이스.
- **7대 스크린톤 패턴**:
  - `dot`: 회전각 및 주파수 조절이 가능한 원형 하프톤 도트 매트릭스.
  - `line`: 선 두께 가변형 선형 평행 해칭.
  - `cross`: 직교 격자 크로스해칭.
  - `bayer4` & `bayer8`: 클래식 순서화 디더링(Ordered Dithering) 임계 행렬.
  - `stochastic`: 결정론적 정수 해시 기반 의사 블루 노이즈.
  - `concentric`: 동심원 링 스크린톤.
- **오일러 연속 벡터 경로 생성기 (`Pen Lifts: 0`)**: 펜을 뗄 수 없는 물리 플로터나 에치 어 스케치를 위해 외곽 베젤 테두리를 타고 이동하며 전체 영역을 단일 연속선으로 해칭합니다.
- **웹 테스트벤치 (`index.html`)**: 파라미터 조절, 이미지 업로드, SVG 벡터 경로 다운로드를 지원합니다.

## 설치 및 가져오기

```bash
# npm 사용 시
npm install light-screentone

# 브라우저 직접 로드
<script src="light-screentone.js"></script>
```

## 사용법

### 1. 픽셀 단위 함수 호출

```javascript
const { screentone } = require('light-screentone');

// x: 100, y: 50, 명도 0.4 (어두운 회색)
const bit = screentone(100, 50, 0.4, {
  pattern: 'dot',
  frequency: 8,
  angle: 45
});
// bit: 0 (검정) 또는 1 (흰색)
```

### 2. Canvas ImageData 고속 변환

```javascript
const ctx = canvas.getContext('2d');
const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

LightScreentone.applyToImageData(imgData, {
  pattern: 'line',
  frequency: 6,
  angle: 30
});

ctx.putImageData(imgData, 0, 0);
```

### 3. 무절단 오일러 벡터 경로 추출 (펜 리프트 0회)

```javascript
const path = LightScreentone.generateEulerianHatch(width, height, (x, y) => {
  return getBrightness(x, y); // [0..1]
}, { step: 6, threshold: 0.5 });

// path: [{x: 0, y: height-1}, ...]
// 캔버스 여백 횡단 없이 베젤 테두리를 경유하는 단일 연속선
```

## 라이선스

MIT License. (C) 2026 Minicom365.
