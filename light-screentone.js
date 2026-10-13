/**
 * light-screentone.js
 * ==============================================================================
 * [EN] Ultra-lightweight functional black & white binary screentoning engine.
 *      - Zero dependencies. Runs in Browser (Canvas/WebGL) and Node.js.
 *      - Fast mathematical point shaders: Dot (Halftone), Line, Crosshatch, Bayer, Stochastic.
 *      - Vector Eulerian path generator for pen-plotters and Etch A Sketch (Pen Lifts: 0).
 * [KO] 초경량 함수형 흑백 이진 스크린톤 생성 엔진.
 *      - 무의존성(Zero-dependency). 브라우저(Canvas/WebGL) 및 Node.js 완벽 호환.
 *      - 고속 수학적 포인트 셰이더: 도트(하프톤), 라인, 크로스해치, 베이어 디더링, 확률적 노이즈.
 *      - 펜 플로터 및 에치 어 스케치를 위한 무절단 오일러 벡터 경로 생성기 탑재 (펜 리프트: 0).
 * ==============================================================================
 * (C) 2026 Minicom365. MIT License.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LightScreentone = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bayer 4x4 Dither Matrix (Normalized 0..1)
  const BAYER_4X4 = new Float32Array([
     0 / 16,  8 / 16,  2 / 16, 10 / 16,
    12 / 16,  4 / 16, 14 / 16,  6 / 16,
     3 / 16, 11 / 16,  1 / 16,  9 / 16,
    15 / 16,  7 / 16, 13 / 16,  5 / 16
  ]);

  // Bayer 8x8 Dither Matrix (Normalized 0..1)
  const BAYER_8X8 = new Float32Array([
     0 / 64, 32 / 64,  8 / 64, 40 / 64,  2 / 64, 34 / 64, 10 / 64, 42 / 64,
    48 / 64, 16 / 64, 56 / 64, 24 / 64, 50 / 64, 18 / 64, 58 / 64, 26 / 64,
    12 / 64, 44 / 64,  4 / 64, 36 / 64, 14 / 64, 46 / 64,  6 / 64, 38 / 64,
    60 / 64, 28 / 64, 52 / 64, 20 / 64, 62 / 64, 30 / 64, 54 / 64, 22 / 64,
     3 / 64, 35 / 64, 11 / 64, 43 / 64,  1 / 64, 33 / 64,  9 / 64, 41 / 64,
    51 / 64, 19 / 64, 59 / 64, 27 / 64, 49 / 64, 17 / 64, 57 / 64, 25 / 64,
    15 / 64, 47 / 64,  7 / 64, 39 / 64, 13 / 64, 45 / 64,  5 / 64, 37 / 64,
    63 / 64, 31 / 64, 55 / 64, 23 / 64, 61 / 64, 29 / 64, 53 / 64, 21 / 64
  ]);

  // Deterministic 2D integer hash (Wang / Jenkins style for fast blue-ish noise)
  function hash2D(x, y) {
    let n = (Math.imul((x | 0) + 1, 374761393) ^ Math.imul((y | 0) + 1, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return (((n ^ (n >>> 16)) >>> 0) / 4294967296.0);
  }

  /**
   * Evaluates a single pixel at (x, y) with brightness intensity [0..1].
   * Returns 1 (white) or 0 (black).
   *
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {number} intensity - Grayscale value [0.0 (black) .. 1.0 (white)]
   * @param {Object} [opts] - Screentone options
   * @param {string} [opts.pattern='dot'] - Pattern type: 'dot' | 'line' | 'cross' | 'bayer4' | 'bayer8' | 'stochastic' | 'concentric'
   * @param {number} [opts.frequency=8] - Grid cell size / period in pixels
   * @param {number} [opts.angle=45] - Screen angle in degrees
   * @param {boolean} [opts.invert=false] - Invert output bits
   * @returns {number} 0 (black) or 1 (white)
   */
  function screentone(x, y, intensity, opts) {
    const pattern = (opts && opts.pattern) || 'dot';
    const freq = (opts && opts.frequency) || 8;
    const angleDeg = (opts && opts.angle !== undefined) ? opts.angle : 45;
    const invert = (opts && opts.invert) || false;

    // Fast boundary shortcuts
    if (intensity <= 0.001) return invert ? 1 : 0;
    if (intensity >= 0.999) return invert ? 0 : 1;

    let isWhite = 1;

    if (pattern === 'bayer4') {
      const bx = ((x % 4) + 4) % 4;
      const by = ((y % 4) + 4) % 4;
      isWhite = intensity >= BAYER_4X4[by * 4 + bx] ? 1 : 0;
    } else if (pattern === 'bayer8') {
      const bx = ((x % 8) + 8) % 8;
      const by = ((y % 8) + 8) % 8;
      isWhite = intensity >= BAYER_8X8[by * 8 + bx] ? 1 : 0;
    } else if (pattern === 'stochastic') {
      const noise = hash2D(Math.floor(x), Math.floor(y));
      isWhite = intensity >= noise ? 1 : 0;
    } else {
      // Coordinate rotation for frequency-based patterns
      const rad = (angleDeg * Math.PI) / 180.0;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const xr = x * cosA - y * sinA;
      const yr = x * sinA + y * cosA;

      const u = (((xr % freq) + freq) % freq) / freq - 0.5;
      const v = (((yr % freq) + freq) % freq) / freq - 0.5;

      switch (pattern) {
        case 'line': {
          // Linear parallel lines: line width varies with darkness
          const dist = Math.abs(u); // 0 at center of line, 0.5 at edge
          const blackWidth = (1.0 - intensity) * 0.5;
          isWhite = dist > blackWidth ? 1 : 0;
          break;
        }

        case 'cross': {
          // Crosshatching: two perpendicular lines
          const distU = Math.abs(u);
          const distV = Math.abs(v);
          const blackWidth = (1.0 - intensity) * 0.35;
          isWhite = (distU > blackWidth && distV > blackWidth) ? 1 : 0;
          break;
        }

        case 'concentric': {
          const r = Math.sqrt(u * u + v * v);
          const ring = Math.abs((r * 2.0) % 1.0 - 0.5);
          isWhite = ring > (1.0 - intensity) * 0.5 ? 1 : 0;
          break;
        }

        case 'dot':
        default: {
          // Traditional circular halftone dot
          const dist = Math.sqrt(u * u + v * v);
          // Dot radius grows with darkness (1 - intensity)
          // Max radius = 0.5 * sqrt(2) approx 0.707
          const maxRadius = Math.sqrt((1.0 - intensity) / Math.PI) * 1.12;
          isWhite = dist > maxRadius ? 1 : 0;
          break;
        }
      }
    }

    return invert ? (1 - isWhite) : isWhite;
  }

  /**
   * Applies screentone transformation to a Canvas ImageData in-place.
   *
   * @param {ImageData} imageData - Canvas ImageData object (RGBA)
   * @param {Object} [opts] - Screentone options
   * @returns {ImageData} Processed ImageData
   */
  function applyToImageData(imageData, opts) {
    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    for (let y = 0; y < h; y++) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        const idx = rowOffset + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 10) {
          // Transparent -> white
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
          data[idx + 3] = 255;
          continue;
        }

        // Standard Rec. 709 luma luminance
        const intensity = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
        const bit = screentone(x, y, intensity, opts);
        const col = bit * 255;

        data[idx] = col;
        data[idx + 1] = col;
        data[idx + 2] = col;
        data[idx + 3] = 255;
      }
    }

    return imageData;
  }

  /**
   * Generates a 100% continuous unbroken Eulerian vector path (Pen Lifts: 0)
   * across an intensity map using boustrophedon screentone hatching with bezel border routing.
   *
   * @param {number} width - Canvas width in points
   * @param {number} height - Canvas height in points
   * @param {Function|Float32Array|Uint8Array} intensitySource - Function (x, y) -> [0..1] or flat 1D array
   * @param {Object} [opts] - Options (step, threshold, pattern)
   * @returns {Array<{x: number, y: number}>} Array of continuous polyline vertices
   */
  function generateEulerianHatch(width, height, intensitySource, opts) {
    const step = (opts && opts.step) || 6;
    const threshold = (opts && opts.threshold !== undefined) ? opts.threshold : 0.5;
    const isFunc = typeof intensitySource === 'function';

    const getIntensity = (px, py) => {
      if (isFunc) return intensitySource(px, py);
      const ix = Math.min(Math.max(Math.floor(px), 0), width - 1);
      const iy = Math.min(Math.max(Math.floor(py), 0), height - 1);
      return intensitySource[iy * width + ix];
    };

    const path = [];
    let currentX = 0;
    let currentY = height - 1;
    path.push({ x: currentX, y: currentY });

    let dir = 1; // 1: left->right, -1: right->left

    for (let y = 10; y < height - 10; y += step) {
      // Find dark spans on this horizontal scanline
      const segments = [];
      let inSpan = false;
      let startX = 0;

      for (let x = 10; x < width - 10; x += 2) {
        const val = getIntensity(x, y);
        // Val < threshold means dark / foreground
        if (val < threshold) {
          if (!inSpan) {
            inSpan = true;
            startX = x;
          }
        } else {
          if (inSpan) {
            inSpan = false;
            segments.push([startX, x - 2]);
          }
        }
      }
      if (inSpan) {
        segments.push([startX, width - 12]);
      }

      if (segments.length === 0) continue;

      // Connect to first segment
      if (dir === 1) {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          path.push({ x: seg[0], y: y });
          path.push({ x: seg[1], y: y });
        }
      } else {
        for (let i = segments.length - 1; i >= 0; i--) {
          const seg = segments[i];
          path.push({ x: seg[1], y: y });
          path.push({ x: seg[0], y: y });
        }
      }

      dir = -dir;
    }

    // Return to home base along screen perimeter (border-hugging)
    path.push({ x: width - 1, y: path[path.length - 1].y });
    path.push({ x: width - 1, y: height - 1 });
    path.push({ x: 0, y: height - 1 });

    return path;
  }

  return {
    screentone,
    applyToImageData,
    generateEulerianHatch,
    BAYER_4X4,
    BAYER_8X8
  };
}));
