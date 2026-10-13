# light-screentone

Ultra-lightweight, zero-dependency functional engine for black-and-white (1-bit) binary screentoning, halftone patterns, and continuous Eulerian vector hatching.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependency](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()

## Features

- **Zero Dependencies**: Pure ES6 / UMD, runs in browsers (Canvas 2D / WebGL) and Node.js.
- **Pure Functional Core**: Mathematical point-shaders evaluating `screentone(x, y, intensity, options) -> 0 | 1`.
- **7 Screentone Patterns**:
  - `dot`: Circular halftone dot matrix with adjustable angle and frequency.
  - `line`: Linear parallel hatching with variable stroke widths.
  - `cross`: Bidirectional crosshatching.
  - `bayer4` & `bayer8`: Classic ordered threshold matrices.
  - `stochastic`: Blue-noise pseudorandom hashing.
  - `concentric`: Concentric ring screentones.
- **Eulerian Vector Toolpath Generator**: Produces 100% continuous unbroken polylines (`Pen Lifts: 0`) for pen plotters, CNC, and Etch A Sketch emulators.
- **Interactive Playground**: Ready-to-run `index.html` with real-time parameter tweaking and SVG vector export.

## Installation

```bash
npm install light-screentone
# or include directly via <script src="light-screentone.js"></script>
```

## Quick Start

### 1. Point Shader (Pixel-level)

```javascript
import { screentone } from 'light-screentone';

// x: 120, y: 80, intensity: 0.35 (dark gray)
const bit = screentone(120, 80, 0.35, {
  pattern: 'dot',
  frequency: 8,
  angle: 45
});
console.log(bit); // 0 (black) or 1 (white)
```

### 2. Canvas ImageData Processing

```javascript
import { applyToImageData } from 'light-screentone';

const ctx = canvas.getContext('2d');
const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

applyToImageData(imgData, {
  pattern: 'line',
  frequency: 6,
  angle: 30
});

ctx.putImageData(imgData, 0, 0);
```

### 3. Eulerian Vector Toolpath (Zero Pen Lifts)

```javascript
import { generateEulerianHatch } from 'light-screentone';

const path = generateEulerianHatch(width, height, (x, y) => {
  return getGrayscaleBrightness(x, y); // [0..1]
}, { step: 6, threshold: 0.5 });

// path is [{x, y}, ...] with 0 pen lifts, routed along borders
```

## License

MIT License. (C) 2026 Minicom365.
