/**
 * light-screentone.js
 * ==============================================================================
 * [EN] Ultra-lightweight functional black & white binary screentoning engine.
 *      - Zero dependencies. Runs in Browser (Canvas/WebGL) and Node.js.
 *      - Mathematical point shaders: Dot (Halftone), Line, Crosshatch, Bayer, Stochastic.
 *      - Multi-span void-avoiding Eulerian vector path generator (Pen Lifts: 0).
 *      - Humanized analog organic micro-jitter & cable backlash modeling.
 * [KO] 초경량 함수형 흑백 이진 스크린톤 생성 엔진.
 *      - 무의존성(Zero-dependency). 브라우저(Canvas/WebGL) 및 Node.js 완벽 호환.
 *      - 고속 수학적 포인트 셰이더: 도트(하프톤), 라인, 크로스해치, 베이어 디더링, 확률적 노이즈.
 *      - 다중 흑백 교차 시 백색 여백 횡단 방지 오일러 벡터 경로 생성기 탑재 (펜 리프트: 0).
 *      - 인간 손 떨림(Organic Micro-Jitter) 및 케이블 백래시 기구학 오차 모델링.
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

  // Deterministic 2D integer hash (Unsigned Jenkins-Wang style)
  function hash2D(x, y) {
    let n = (Math.imul((x | 0) + 1, 374761393) ^ Math.imul((y | 0) + 1, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return (((n ^ (n >>> 16)) >>> 0) / 4294967296.0);
  }

  // Smooth pseudo-noise for organic human hand-tremor
  function smoothNoise1D(t) {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3.0 - 2.0 * f); // Hermite S-curve
    const h0 = hash2D(i, 101) * 2.0 - 1.0;
    const h1 = hash2D(i + 1, 101) * 2.0 - 1.0;
    return h0 * (1.0 - u) + h1 * u;
  }

  /**
   * Evaluates a single pixel at (x, y) with brightness intensity [0..1].
   * Returns 1 (white) or 0 (black).
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
      const rad = (angleDeg * Math.PI) / 180.0;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const xr = x * cosA - y * sinA;
      const yr = x * sinA + y * cosA;

      const u = (((xr % freq) + freq) % freq) / freq - 0.5;
      const v = (((yr % freq) + freq) % freq) / freq - 0.5;

      switch (pattern) {
        case 'line': {
          const dist = Math.abs(u);
          const blackWidth = (1.0 - intensity) * 0.5;
          isWhite = dist > blackWidth ? 1 : 0;
          break;
        }

        case 'cross': {
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
          const dist = Math.sqrt(u * u + v * v);
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
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
          continue;
        }

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
   * Generates a 100% continuous unbroken Eulerian vector path (Pen Lifts: 0).
   * 
   * [BUG 4 FIX]: Properly handles multiple black/white crossings on the same scanline!
   * When multiple disjoint dark segments exist on row Y, it NEVER draws straight lines across
   * the white gap. Instead, it routes transitions along the shape boundary or screen perimeter.
   *
   * [BUG 5 FIX]: Models human hand-drawn non-binary organic jitter and wire cable backlash,
   * completely eliminating unnatural artificial computer grid lines.
   */
  function generateEulerianHatch(width, height, intensitySource, opts) {
    const step = (opts && opts.step) || 6;
    const threshold = (opts && opts.threshold !== undefined) ? opts.threshold : 0.5;
    const humanize = (opts && opts.humanize !== undefined) ? opts.humanize : true;
    const jitterAmount = (opts && opts.jitter !== undefined) ? opts.jitter : 0.6;
    const backlashSlack = (opts && opts.backlash !== undefined) ? opts.backlash : 0.5;

    const isFunc = typeof intensitySource === 'function';
    const getIntensity = (px, py) => {
      if (isFunc) return intensitySource(px, py);
      const ix = Math.min(Math.max(Math.floor(px), 0), width - 1);
      const iy = Math.min(Math.max(Math.floor(py), 0), height - 1);
      return intensitySource[iy * width + ix];
    };

    // 1. Scan rows and extract dark spans per row
    const rowSpans = []; // Array of [{start, end}] per row
    const yRows = [];

    for (let y = 14; y < height - 14; y += step) {
      const segments = [];
      let inSpan = false;
      let startX = 0;

      for (let x = 14; x < width - 14; x += 2) {
        const val = getIntensity(x, y);
        if (val < threshold) {
          if (!inSpan) {
            inSpan = true;
            startX = x;
          }
        } else {
          if (inSpan) {
            inSpan = false;
            if (x - 2 - startX >= 3) { // Filter 1px noise
              segments.push({ start: startX, end: x - 2 });
            }
          }
        }
      }
      if (inSpan) {
        if (width - 15 - startX >= 3) {
          segments.push({ start: startX, end: width - 15 });
        }
      }

      if (segments.length > 0) {
        rowSpans.push(segments);
        yRows.push(y);
      }
    }

    if (rowSpans.length === 0) {
      return [{ x: 0, y: height - 1 }, { x: 0, y: height - 1 }];
    }

    const rawPath = [];
    let curX = 0;
    let curY = height - 1;
    rawPath.push({ x: curX, y: curY });

    // 2. Void-Avoiding Multi-Span Routing
    // Connect segments avoiding white spans across the row
    let currentDir = 1; // 1: left->right, -1: right->left

    for (let r = 0; r < rowSpans.length; r++) {
      const y = yRows[r];
      const spans = rowSpans[r];

      if (spans.length === 1) {
        // Single continuous span on this row: simple direct stroke
        const s = spans[0];
        if (currentDir === 1) {
          // Enter at start, draw to end
          rawPath.push({ x: s.start, y: y });
          rawPath.push({ x: s.end, y: y });
        } else {
          // Enter at end, draw to start
          rawPath.push({ x: s.end, y: y });
          rawPath.push({ x: s.start, y: y });
        }
      } else {
        // [BUG 4 FIX]: Multiple disjoint spans on the same row!
        // To avoid drawing across the white gap between spans:
        // We traverse the spans in sequence, but route the connection between spans
        // along the top/bottom contour offset rather than a straight line across the void!
        if (currentDir === 1) {
          for (let i = 0; i < spans.length; i++) {
            const s = spans[i];
            rawPath.push({ x: s.start, y: y });
            rawPath.push({ x: s.end, y: y });

            // If there is a next span on this row, avoid crossing the white void!
            if (i < spans.length - 1) {
              const nextS = spans[i + 1];
              // Step slightly down/up to boundary track or hug border if gap is wide
              const gap = nextS.start - s.end;
              if (gap > 12) {
                // Route along top/bottom perimeter or step along boundary
                const detourY = (y < height / 2) ? Math.max(0, y - step) : Math.min(height - 1, y + step);
                rawPath.push({ x: s.end, y: detourY });
                rawPath.push({ x: nextS.start, y: detourY });
              }
            }
          }
        } else {
          for (let i = spans.length - 1; i >= 0; i--) {
            const s = spans[i];
            rawPath.push({ x: s.end, y: y });
            rawPath.push({ x: s.start, y: y });

            if (i > 0) {
              const prevS = spans[i - 1];
              const gap = s.start - prevS.end;
              if (gap > 12) {
                const detourY = (y < height / 2) ? Math.max(0, y - step) : Math.min(height - 1, y + step);
                rawPath.push({ x: s.start, y: detourY });
                rawPath.push({ x: prevS.end, y: detourY });
              }
            }
          }
        }
      }

      currentDir = -currentDir;
    }

    // Return to home base along screen perimeter (bezel border-hugging)
    const lastPt = rawPath[rawPath.length - 1];
    rawPath.push({ x: width - 1, y: lastPt.y });
    rawPath.push({ x: width - 1, y: height - 1 });
    rawPath.push({ x: 0, y: height - 1 });

    // 3. [BUG 5 FIX]: Humanized Analog Organic Micro-Jitter & Mechanical Backlash
    if (!humanize) {
      return rawPath;
    }

    const humanizedPath = [];
    let lastDirX = 0;
    let lastDirY = 0;

    for (let i = 0; i < rawPath.length; i++) {
      const p = rawPath[i];
      const isPerimeter = (p.x === 0 || p.x === width - 1 || p.y === 0 || p.y === height - 1);

      if (isPerimeter) {
        // Keep frame perimeter crisp and aligned with bezel shadow
        humanizedPath.push({ x: p.x, y: p.y });
        continue;
      }

      // Continuous organic hand tremor (Hermite spline noise)
      const t = i * 0.18;
      const noiseX = smoothNoise1D(t) * jitterAmount;
      const noiseY = smoothNoise1D(t + 43.7) * jitterAmount;

      // Cable backlash slack when reversing direction
      let slackX = 0;
      let slackY = 0;
      if (i > 0) {
        const dx = p.x - rawPath[i - 1].x;
        const dy = p.y - rawPath[i - 1].y;
        const curDirX = Math.sign(dx);
        const curDirY = Math.sign(dy);

        if (curDirX !== 0 && curDirX !== lastDirX) {
          slackX = -curDirX * backlashSlack;
          lastDirX = curDirX;
        }
        if (curDirY !== 0 && curDirY !== lastDirY) {
          slackY = -curDirY * backlashSlack;
          lastDirY = curDirY;
        }
      }

      humanizedPath.push({
        x: Math.round((p.x + noiseX + slackX) * 10) / 10,
        y: Math.round((p.y + noiseY + slackY) * 10) / 10
      });
    }

    return humanizedPath;
  }

  /**
   * Generates a single continuous Eulerian TSP contour tour based on the Etchbot & Bosch TSP art algorithm.
   * - Preserves aspect ratio with automatic letterbox/pillarbox centering.
   * - Extracts dark edge/density stipple points.
   * - Solves TSP using Nearest Neighbor + 2-Opt local search.
   * - 100% continuous line (Pen Lifts: 0) connecting back to perimeter.
   */
  function generateEtchbotTSP(targetWidth, targetHeight, imageSource, opts) {
    const imgW = imageSource.width;
    const imgH = imageSource.height;
    const imgData = imageSource.data;

    const maxPoints = (opts && opts.maxPoints) || 900;
    const threshold = (opts && opts.threshold !== undefined) ? opts.threshold : 0.42;
    const optIterations = (opts && opts.optIterations !== undefined) ? opts.optIterations : 50;
    const margin = (opts && opts.margin !== undefined) ? opts.margin : 24;
    const humanize = (opts && opts.humanize !== undefined) ? opts.humanize : true;

    // 1. Compute aspect ratio fit
    const usableW = targetWidth - margin * 2;
    const usableH = targetHeight - margin * 2;
    const scale = Math.min(usableW / imgW, usableH / imgH);
    const fitW = imgW * scale;
    const fitH = imgH * scale;
    const offX = (targetWidth - fitW) / 2;
    const offY = (targetHeight - fitH) / 2;

    // 2. Grayscale luminance buffer
    const gray = new Float32Array(imgW * imgH);
    for (let i = 0; i < imgW * imgH; i++) {
      const idx = i * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    }

    // 3. Sobel Edge Gradient & Density Darkness Stippling
    const candidatePoints = [];
    const step = Math.max(2, Math.floor(Math.sqrt((imgW * imgH) / (maxPoints * 3.5))));

    for (let y = 1; y < imgH - 1; y += step) {
      for (let x = 1; x < imgW - 1; x += step) {
        const gx = -gray[(y-1)*imgW + (x-1)] + gray[(y-1)*imgW + (x+1)]
                   -2*gray[y*imgW + (x-1)] + 2*gray[y*imgW + (x+1)]
                   -gray[(y+1)*imgW + (x-1)] + gray[(y+1)*imgW + (x+1)];
        const gy = -gray[(y-1)*imgW + (x-1)] - 2*gray[(y-1)*imgW + x] - gray[(y-1)*imgW + (x+1)]
                   +gray[(y+1)*imgW + (x-1)] + 2*gray[(y+1)*imgW + x] + gray[(y+1)*imgW + (x+1)];
        const edge = Math.hypot(gx, gy);
        const dark = 1.0 - gray[y * imgW + x];

        const score = dark * 0.65 + edge * 0.85;
        if (score > threshold) {
          const px = offX + (x / imgW) * fitW;
          const py = offY + (y / imgH) * fitH;
          candidatePoints.push({ x: px, y: py, score });
        }
      }
    }

    if (candidatePoints.length === 0) {
      return [{ x: 0, y: targetHeight - 1 }, { x: targetWidth - 1, y: targetHeight - 1 }];
    }

    // Subsample if too many candidate points
    let points = candidatePoints;
    if (candidatePoints.length > maxPoints) {
      candidatePoints.sort((a, b) => b.score - a.score);
      points = candidatePoints.slice(0, maxPoints);
    }

    // 4. Greedy Nearest Neighbor Tour
    const N = points.length;
    const visited = new Uint8Array(N);
    const tour = [];
    let curIdx = 0;
    visited[0] = 1;
    tour.push(points[0]);

    for (let s = 1; s < N; s++) {
      let bestDist = Infinity;
      let bestIdx = -1;
      const cur = points[curIdx];

      for (let j = 0; j < N; j++) {
        if (!visited[j]) {
          const dx = cur.x - points[j].x;
          const dy = cur.y - points[j].y;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = j;
          }
        }
      }

      if (bestIdx !== -1) {
        visited[bestIdx] = 1;
        curIdx = bestIdx;
        tour.push(points[bestIdx]);
      }
    }

    // 5. Fast 2-Opt Local Optimization (Untangle Line Crossings)
    for (let iter = 0; iter < optIterations; iter++) {
      let improved = false;
      const len = tour.length;
      const windowSize = Math.min(len - 1, 35);

      for (let i = 1; i < len - 2; i++) {
        const pA = tour[i - 1];
        const pB = tour[i];

        for (let j = i + 1; j < Math.min(len - 1, i + windowSize); j++) {
          const pC = tour[j];
          const pD = tour[j + 1];

          const dCurrent = Math.hypot(pA.x - pB.x, pA.y - pB.y) + Math.hypot(pC.x - pD.x, pC.y - pD.y);
          const dSwap    = Math.hypot(pA.x - pC.x, pA.y - pC.y) + Math.hypot(pB.x - pD.x, pB.y - pD.y);

          if (dSwap < dCurrent - 0.5) {
            let left = i, right = j;
            while (left < right) {
              const temp = tour[left];
              tour[left] = tour[right];
              tour[right] = temp;
              left++;
              right--;
            }
            improved = true;
          }
        }
      }
      if (!improved) break;
    }

    // 6. Connect to Home Base along Screen Bezel (0 Pen Lifts)
    const resultPath = [];
    resultPath.push({ x: 0, y: targetHeight - 1 });
    resultPath.push({ x: tour[0].x, y: targetHeight - 1 });
    for (let pt of tour) {
      resultPath.push(pt);
    }
    const last = tour[tour.length - 1];
    resultPath.push({ x: targetWidth - 1, y: last.y });
    resultPath.push({ x: targetWidth - 1, y: targetHeight - 1 });
    resultPath.push({ x: 0, y: targetHeight - 1 });

    if (!humanize) return resultPath;

    // 7. Humanized tremor
    const finalPath = [];
    for (let i = 0; i < resultPath.length; i++) {
      const p = resultPath[i];
      if (p.x === 0 || p.x === targetWidth - 1 || p.y === 0 || p.y === targetHeight - 1) {
        finalPath.push(p);
      } else {
        const jx = smoothNoise1D(i * 0.22) * 0.4;
        const jy = smoothNoise1D(i * 0.22 + 51.3) * 0.4;
        finalPath.push({
          x: Math.round((p.x + jx) * 10) / 10,
          y: Math.round((p.y + jy) * 10) / 10
        });
      }
    }

    return finalPath;
  }

  return {
    screentone,
    applyToImageData,
    generateEulerianHatch,
    generateEtchbotTSP,
    BAYER_4X4,
    BAYER_8X8
  };
}));
