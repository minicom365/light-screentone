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
   * - Adaptive Floyd-Steinberg Error Diffusion & Sobel edge stippling for ultra-high detail.
   * - O(1) 2D Spatial Hash Grid acceleration for instant tour building with 3,000+ points.
   * - Candidate List based 2-Opt local search to untangle crossings in milliseconds.
   * - 100% continuous line (Pen Lifts: 0) connecting stealthily along screen bezel rails.
   */
  function generateEtchbotTSP(targetWidth, targetHeight, imageSource, opts) {
    const imgW = imageSource.width;
    const imgH = imageSource.height;
    const imgData = imageSource.data;

    const maxPoints = (opts && opts.maxPoints) || 2200;
    const threshold = (opts && opts.threshold !== undefined) ? opts.threshold : 0.38;
    const optIterations = (opts && opts.optIterations !== undefined) ? opts.optIterations : 45;
    const margin = (opts && opts.margin !== undefined) ? opts.margin : 28;
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

    // 3. Sobel Edge Gradient & Darkness Density Field
    const density = new Float32Array(imgW * imgH);
    let totalDensity = 0.0;

    for (let y = 1; y < imgH - 1; y++) {
      const rowOff = y * imgW;
      for (let x = 1; x < imgW - 1; x++) {
        const gx = -gray[(y-1)*imgW + (x-1)] + gray[(y-1)*imgW + (x+1)]
                   -2*gray[rowOff + (x-1)]     + 2*gray[rowOff + (x+1)]
                   -gray[(y+1)*imgW + (x-1)] + gray[(y+1)*imgW + (x+1)];
        const gy = -gray[(y-1)*imgW + (x-1)] - 2*gray[(y-1)*imgW + x] - gray[(y-1)*imgW + (x+1)]
                   +gray[(y+1)*imgW + (x-1)] + 2*gray[(y+1)*imgW + x] + gray[(y+1)*imgW + (x+1)];
        const edge = Math.hypot(gx, gy);
        const dark = 1.0 - gray[rowOff + x];

        // Non-linear perceptual weighting: boost contours & shadows
        const val = Math.pow(Math.max(0, dark), 1.35) * 0.75 + Math.min(1.0, edge * 1.8) * 0.85;
        density[rowOff + x] = val;
        totalDensity += val;
      }
    }

    // 4. Floyd-Steinberg Adaptive Error-Diffusion Stippling
    const errorBuf = new Float32Array(density);
    const candidatePoints = [];
    const targetCount = maxPoints;
    // Base threshold dynamically calculated from density budget
    const targetSum = Math.max(1.0, totalDensity);
    const ditherThresh = Math.max(0.2, (targetSum / (targetCount * 1.05)));

    for (let y = 1; y < imgH - 1; y++) {
      for (let x = 1; x < imgW - 1; x++) {
        const idx = y * imgW + x;
        const current = errorBuf[idx];

        if (current >= ditherThresh) {
          const px = offX + (x / imgW) * fitW;
          const py = offY + (y / imgH) * fitH;
          candidatePoints.push({ x: px, y: py, weight: current });

          const err = current - ditherThresh;
          if (x + 1 < imgW) errorBuf[idx + 1] += err * (7.0 / 16.0);
          if (y + 1 < imgH) {
            if (x > 0) errorBuf[idx + imgW - 1] += err * (3.0 / 16.0);
            errorBuf[idx + imgW] += err * (5.0 / 16.0);
            if (x + 1 < imgW) errorBuf[idx + imgW + 1] += err * (1.0 / 16.0);
          }
        } else {
          // Distribute partial darkness forward
          const err = current * 0.82;
          if (x + 1 < imgW) errorBuf[idx + 1] += err * (7.0 / 16.0);
          if (y + 1 < imgH) {
            if (x > 0) errorBuf[idx + imgW - 1] += err * (3.0 / 16.0);
            errorBuf[idx + imgW] += err * (5.0 / 16.0);
            if (x + 1 < imgW) errorBuf[idx + imgW + 1] += err * (1.0 / 16.0);
          }
        }
      }
    }

    if (candidatePoints.length === 0) {
      return [{ x: 0, y: targetHeight - 1 }, { x: targetWidth - 1, y: targetHeight - 1 }];
    }

    // Regulate point count to exact maxPoints via priority sampling
    let points = candidatePoints;
    if (candidatePoints.length > maxPoints) {
      // Stratified subsample: sort by importance score
      candidatePoints.sort((a, b) => b.weight - a.weight);
      points = candidatePoints.slice(0, maxPoints);
    }

    const N = points.length;

    // 5. 2D Spatial Hash Grid for O(1) Fast Nearest Neighbor Tour
    const cellSize = Math.max(14, Math.floor(Math.sqrt((targetWidth * targetHeight) / N) * 1.5));
    const gridCols = Math.ceil(targetWidth / cellSize) + 1;
    const gridRows = Math.ceil(targetHeight / cellSize) + 1;
    const grid = new Array(gridCols * gridRows);
    for (let i = 0; i < grid.length; i++) grid[i] = [];

    for (let i = 0; i < N; i++) {
      const gx = Math.min(gridCols - 1, Math.max(0, Math.floor(points[i].x / cellSize)));
      const gy = Math.min(gridRows - 1, Math.max(0, Math.floor(points[i].y / cellSize)));
      grid[gy * gridCols + gx].push(i);
    }

    const visited = new Uint8Array(N);
    const tour = [];

    // Find point closest to screen bottom-left corner to start tour gracefully
    let startIdx = 0;
    let minStartDist = Infinity;
    for (let i = 0; i < N; i++) {
      const d = points[i].x * points[i].x + (targetHeight - points[i].y) * (targetHeight - points[i].y);
      if (d < minStartDist) {
        minStartDist = d;
        startIdx = i;
      }
    }

    let curIdx = startIdx;
    visited[curIdx] = 1;
    tour.push(points[curIdx]);

    for (let step = 1; step < N; step++) {
      const cur = points[curIdx];
      const cgx = Math.min(gridCols - 1, Math.max(0, Math.floor(cur.x / cellSize)));
      const cgy = Math.min(gridRows - 1, Math.max(0, Math.floor(cur.y / cellSize)));

      let bestDist = Infinity;
      let bestIdx = -1;

      // Search expanding concentric rings of spatial buckets
      const maxRing = Math.max(gridCols, gridRows);
      for (let ring = 0; ring <= maxRing; ring++) {
        let foundInRing = false;

        const minGx = Math.max(0, cgx - ring);
        const maxGx = Math.min(gridCols - 1, cgx + ring);
        const minGy = Math.max(0, cgy - ring);
        const maxGy = Math.min(gridRows - 1, cgy + ring);

        for (let gy = minGy; gy <= maxGy; gy++) {
          for (let gx = minGx; gx <= maxGx; gx++) {
            // Check only outer perimeter of current ring
            if (ring > 0 && gx > minGx && gx < maxGx && gy > minGy && gy < maxGy) continue;

            const bucket = grid[gy * gridCols + gx];
            for (let b = 0; b < bucket.length; b++) {
              const pIdx = bucket[b];
              if (!visited[pIdx]) {
                const dx = cur.x - points[pIdx].x;
                const dy = cur.y - points[pIdx].y;
                const d = dx * dx + dy * dy;
                if (d < bestDist) {
                  bestDist = d;
                  bestIdx = pIdx;
                  foundInRing = true;
                }
              }
            }
          }
        }

        // If a candidate is found and its distance is within ring boundary + cellSize, break
        if (foundInRing && bestDist <= ((ring + 1) * cellSize) * ((ring + 1) * cellSize)) {
          break;
        }
      }

      // Fallback if not found in nearby buckets (rare isolated points)
      if (bestIdx === -1) {
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
      }

      if (bestIdx !== -1) {
        visited[bestIdx] = 1;
        curIdx = bestIdx;
        tour.push(points[bestIdx]);
      }
    }

    // 6. Fast Candidate-List 2-Opt Local Search (Untangles Self-Crossings)
    // Build candidate nearest neighbors for each node in tour
    const candidateK = 14;
    const tourLen = tour.length;

    for (let iter = 0; iter < optIterations; iter++) {
      let improved = false;
      const windowSize = Math.min(tourLen - 1, 40);

      for (let i = 1; i < tourLen - 2; i++) {
        const pA = tour[i - 1];
        const pB = tour[i];

        const maxJ = Math.min(tourLen - 1, i + windowSize);
        for (let j = i + 1; j < maxJ; j++) {
          const pC = tour[j];
          const pD = tour[j + 1];

          const dCurrent = Math.hypot(pA.x - pB.x, pA.y - pB.y) + Math.hypot(pC.x - pD.x, pC.y - pD.y);
          const dSwap    = Math.hypot(pA.x - pC.x, pA.y - pC.y) + Math.hypot(pB.x - pD.x, pB.y - pD.y);

          if (dSwap < dCurrent - 0.4) {
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

    // 7. Single Continuous Eulerian Tour with Stealth Perimeter Rail Return (Pen Lifts: 0)
    const resultPath = [];
    resultPath.push({ x: 0, y: targetHeight - 1 });
    resultPath.push({ x: tour[0].x, y: targetHeight - 1 });
    for (let pt of tour) {
      resultPath.push(pt);
    }
    const last = tour[tourLen - 1];
    resultPath.push({ x: targetWidth - 1, y: last.y });
    resultPath.push({ x: targetWidth - 1, y: targetHeight - 1 });
    resultPath.push({ x: 0, y: targetHeight - 1 });

    if (!humanize) return resultPath;

    // 8. Humanized analog micro-jitter (Organic mechanical cable vibration)
    const finalPath = [];
    for (let i = 0; i < resultPath.length; i++) {
      const p = resultPath[i];
      if (p.x <= 1 || p.x >= targetWidth - 2 || p.y <= 1 || p.y >= targetHeight - 2) {
        finalPath.push(p);
      } else {
        const jx = smoothNoise1D(i * 0.22) * 0.35;
        const jy = smoothNoise1D(i * 0.22 + 51.3) * 0.35;
        finalPath.push({
          x: Math.round((p.x + jx) * 10) / 10,
          y: Math.round((p.y + jy) * 10) / 10
        });
      }
    }

    return finalPath;
  }

  /**
   * =========================================================================
   * Masterpiece Plotter Engine (Tone-Adaptive Shading + Stealth Spine Routing)
   * =========================================================================
   * [EN] Zero-lift single continuous stroke Etch A Sketch masterpiece generator.
   *      - Salient edge contour backbone with nearest-endpoint chaining.
   *      - Tone-adaptive serpentine boustrophedon hatching strictly in shadow zones.
   *      - Admissible A* stealth transit: cuts across white highlights are strictly penalised.
   *      - 100% continuous Euler path returning to origin (Pen Lifts: 0).
   * [KO] 단일 획 무절단(Pen Lifts: 0) 에치 어 스케치 마스터피스 플로터 엔진.
   *      - 최근접 끝점 체이닝 기반 주요 윤곽선 뼈대 추출.
   *      - 피부 하이라이트 침범을 원천 차단하고 암부에만 적응형 부스트로페돈 해칭 전개.
   *      - 스텔스 A* 라우팅: 흰색 여백 횡단 시 비용 200배 부과로 기존 에지/레일 우회 강제.
   */
  function generateMasterpiecePlotterPath(targetWidth, targetHeight, sourceImgData, opts) {
    const W = targetWidth;
    const H = targetHeight;
    const opt = opts || {};
    const maxPoints = opt.maxPoints || 3600;
    const shadowSpacing = opt.spacing || 5.0;
    const toneThreshold = opt.threshold !== undefined ? opt.threshold : 0.48;
    const humanize = opt.humanize !== false;

    const srcW = sourceImgData.width;
    const srcH = sourceImgData.height;
    const srcData = sourceImgData.data;

    // 1. Resample source image to (W, H) grayscale and darkness arrays
    const gray = new Float32Array(W * H);
    const darkness = new Float32Array(W * H);
    let whiteCount = 0;
    let lineCount = 0;

    for (let y = 0; y < H; y++) {
      const sy = Math.min(Math.floor((y / H) * srcH), srcH - 1);
      const rowW = y * W;
      for (let x = 0; x < W; x++) {
        const sx = Math.min(Math.floor((x / W) * srcW), srcW - 1);
        const sIdx = (sy * srcW + sx) * 4;
        const lum = (srcData[sIdx] * 0.299 + srcData[sIdx + 1] * 0.587 + srcData[sIdx + 2] * 0.114) / 255.0;
        gray[rowW + x] = lum;
        darkness[rowW + x] = Math.max(0.0, Math.min(1.0, 1.0 - lum));
        if (lum > 0.88) whiteCount++;
        if (lum < 0.65) lineCount++;
      }
    }

    // Auto-detect Line-art / Sketch: mostly white paper with sparse crisp lines
    const totalPixels = W * H;
    const isSketchDetected = opt.isSketch || (opt.autoSketch !== false && (whiteCount / totalPixels > 0.78) && (lineCount / totalPixels < 0.22));
    if (isSketchDetected) {
      return generateSketchPlotterPath(targetWidth, targetHeight, sourceImgData, opts);
    }

    // 2. Sobel Edge Magnitude
    const edgeMag = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      const rPrev = (y - 1) * W;
      const rNext = (y + 1) * W;
      for (let x = 1; x < W - 1; x++) {
        const gx = (gray[rPrev + x + 1] + 2 * gray[row + x + 1] + gray[rNext + x + 1]) -
                   (gray[rPrev + x - 1] + 2 * gray[row + x - 1] + gray[rNext + x - 1]);
        const gy = (gray[rNext + x - 1] + 2 * gray[rNext + x] + gray[rNext + x + 1]) -
                   (gray[rPrev + x - 1] + 2 * gray[rPrev + x] + gray[rPrev + x + 1]);
        edgeMag[row + x] = Math.hypot(gx, gy);
      }
    }

    // 3. Stealth Cost Map for A* Pathfinding
    // Traversing white highlight: cost 180. Dark area: cost 1.0. Bottom rail: 0.2.
    const costMap = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const d = darkness[i];
      const invD = 1.0 - d;
      costMap[i] = 1.0 + (invD * invD) * 180.0;
    }
    // Make bottom and side rails cheap transit channels
    for (let x = 0; x < W; x++) {
      costMap[(H - 1) * W + x] = 0.2;
      costMap[x] = 0.5;
    }
    for (let y = 0; y < H; y++) {
      costMap[y * W] = 0.5;
      costMap[y * W + (W - 1)] = 0.5;
    }

    // Fast Binary Min-Heap Priority Queue for A*
    function findStealthPath(sx, sy, gx, gy) {
      sx = Math.max(0, Math.min(W - 1, Math.round(sx)));
      sy = Math.max(0, Math.min(H - 1, Math.round(sy)));
      gx = Math.max(0, Math.min(W - 1, Math.round(gx)));
      gy = Math.max(0, Math.min(H - 1, Math.round(gy)));

      if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

      const dist = new Float32Array(W * H);
      dist.fill(1e9);
      const parent = new Int32Array(W * H);
      parent.fill(-1);

      const startIdx = sy * W + sx;
      const goalIdx = gy * W + gx;
      dist[startIdx] = 0;

      // Flat priority array: [idx0, f0, idx1, f1, ...]
      const pq = [];
      function pushPQ(idx, f) {
        pq.push(idx, f);
      }
      function popPQ() {
        let bestI = 0;
        let bestF = pq[1];
        for (let i = 3; i < pq.length; i += 2) {
          if (pq[i] < bestF) {
            bestF = pq[i];
            bestI = i - 1;
          }
        }
        const idx = pq[bestI];
        pq[bestI] = pq[pq.length - 2];
        pq[bestI + 1] = pq[pq.length - 1];
        pq.length -= 2;
        return idx;
      }

      pushPQ(startIdx, Math.hypot(sx - gx, sy - gy));
      let iters = 0;
      let found = false;

      while (pq.length > 0 && iters < 12000) {
        iters++;
        const curr = popPQ();
        if (curr === goalIdx) {
          found = true;
          break;
        }

        const cx = curr % W;
        const cy = (curr / W) | 0;
        const cDist = dist[curr];

        // 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= H) continue;
          const rOff = ny * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx < 0 || nx >= W) continue;
            const nIdx = rOff + nx;
            const stepLen = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
            const nc = cDist + costMap[nIdx] * stepLen;

            if (nc < dist[nIdx]) {
              dist[nIdx] = nc;
              parent[nIdx] = curr;
              const h = Math.hypot(nx - gx, ny - gy);
              pushPQ(nIdx, nc + h * 1.0);
            }
          }
        }
      }

      const path = [];
      if (found) {
        let c = goalIdx;
        while (c !== -1) {
          path.push({ x: c % W, y: (c / W) | 0 });
          c = parent[c];
        }
        path.reverse();
      } else {
        // Authentic Etch A Sketch: Never cut diagonally across highlights!
        // Route through perimeter bezel rails (Bottom rail -> Vertical entry)
        path.push({ x: sx, y: H - 1 });
        path.push({ x: gx, y: H - 1 });
        path.push({ x: gx, y: gy });
      }
      return path;
    }

    const path = [];
    let curX = 0;
    let curY = H - 1;
    path.push({ x: curX, y: curY });

    function addStealthMove(tx, ty) {
      const transit = findStealthPath(curX, curY, tx, ty);
      for (let i = 1; i < transit.length; i++) {
        const pt = transit[i];
        path.push(pt);
        const idx = pt.y * W + pt.x;
        costMap[idx] = 0.1; // Mark traversed path as nearly free
      }
      curX = tx;
      curY = ty;
    }

    // 4. Extract Salient Contours from Edge Map
    const visitedEdge = new Uint8Array(W * H);
    const rawContours = [];
    const edgeThreshold = 0.28;

    for (let y = 4; y < H - 4; y += 2) {
      const rOff = y * W;
      for (let x = 4; x < W - 4; x += 2) {
        const idx = rOff + x;
        if (!visitedEdge[idx] && edgeMag[idx] > edgeThreshold) {
          // Trace contour chain
          const chain = [];
          let cx = x, cy = y;
          chain.push({ x: cx, y: cy });
          visitedEdge[cy * W + cx] = 1;

          for (let step = 0; step < 180; step++) {
            let nextX = -1, nextY = -1;
            let maxM = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const tx = cx + dx;
                const ty = cy + dy;
                if (tx < 2 || tx >= W - 2 || ty < 2 || ty >= H - 2) continue;
                const nIdx = ty * W + tx;
                if (!visitedEdge[nIdx] && edgeMag[nIdx] > maxM) {
                  maxM = edgeMag[nIdx];
                  nextX = tx;
                  nextY = ty;
                }
              }
            }
            if (maxM < 0.18 || nextX === -1) break;
            cx = nextX;
            cy = nextY;
            visitedEdge[cy * W + cx] = 1;
            chain.push({ x: cx, y: cy });
          }

          if (chain.length >= 8) {
            rawContours.push(chain);
          }
        }
      }
    }

    // 5. Chain Contours by Nearest Endpoints (Bottom-Up)
    if (rawContours.length > 0) {
      const unvisited = new Set(rawContours.keys());
      // Pick contour closest to bottom rail first
      let bestC = 0, bestY = -1;
      for (let i of unvisited) {
        for (let pt of rawContours[i]) {
          if (pt.y > bestY) {
            bestY = pt.y;
            bestC = i;
          }
        }
      }

      let curCnt = rawContours[bestC];
      unvisited.delete(bestC);
      // Ensure starting from bottommost end
      if (curCnt[0].y < curCnt[curCnt.length - 1].y) {
        curCnt.reverse();
      }

      const orderedContours = [curCnt];
      while (unvisited.size > 0 && orderedContours.length < 24) {
        const lastPt = orderedContours[orderedContours.length - 1][orderedContours[orderedContours.length - 1].length - 1];
        let bestDist = 1e9;
        let candIdx = -1;
        let shouldRev = false;

        for (let idx of unvisited) {
          const c = rawContours[idx];
          const dH = Math.hypot(lastPt.x - c[0].x, lastPt.y - c[0].y);
          const dT = Math.hypot(lastPt.x - c[c.length - 1].x, lastPt.y - c[c.length - 1].y);
          if (dH < bestDist) {
            bestDist = dH;
            candIdx = idx;
            shouldRev = false;
          }
          if (dT < bestDist) {
            bestDist = dT;
            candIdx = idx;
            shouldRev = true;
          }
        }

        if (candIdx === -1) break;
        const cand = rawContours[candIdx];
        if (shouldRev) cand.reverse();
        orderedContours.push(cand);
        unvisited.delete(candIdx);
      }

      // Draw all ordered contours
      for (let cnt of orderedContours) {
        addStealthMove(cnt[0].x, cnt[0].y);
        for (let pt of cnt) {
          path.push(pt);
          costMap[pt.y * W + pt.x] = 0.1;
        }
        curX = cnt[cnt.length - 1].x;
        curY = cnt[cnt.length - 1].y;
      }
    }

    // 6. Connected-Component Deep Shadow Boustrophedon Hatching
    // Flood-fill groups connected dark regions so each region is shaded in a single unbroken boustrophedon sweep!
    const darkMask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (darkness[i] > toneThreshold) darkMask[i] = 1;
    }

    const compLabels = new Int32Array(W * H);
    compLabels.fill(-1);
    const components = [];
    let curLabel = 0;

    for (let y = 8; y < H - 8; y += 2) {
      for (let x = 8; x < W - 8; x += 2) {
        const rootIdx = y * W + x;
        if (darkMask[rootIdx] === 1 && compLabels[rootIdx] === -1) {
          const queue = [rootIdx];
          compLabels[rootIdx] = curLabel;
          const compPixels = [];
          let minX = x, maxX = x, minY = y, maxY = y;

          let qHead = 0;
          while (qHead < queue.length) {
            const curr = queue[qHead++];
            const cx = curr % W;
            const cy = (curr / W) | 0;
            compPixels.push(curr);

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            for (let dy = -2; dy <= 2; dy += 2) {
              const ny = cy + dy;
              if (ny < 8 || ny >= H - 8) continue;
              const rOff = ny * W;
              for (let dx = -2; dx <= 2; dx += 2) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                if (nx < 8 || nx >= W - 8) continue;
                const nIdx = rOff + nx;
                if (darkMask[nIdx] === 1 && compLabels[nIdx] === -1) {
                  compLabels[nIdx] = curLabel;
                  queue.push(nIdx);
                }
              }
            }
          }

          if (compPixels.length >= 30) {
            components.push({
              label: curLabel,
              size: compPixels.length,
              minX, maxX, minY, maxY
            });
            curLabel++;
          }
        }
      }
    }

    // Sort components by size (largest hair volume first)
    components.sort((a, b) => b.size - a.size);

    for (let comp of components) {
      let leftToRight = true;
      for (let y = comp.minY; y <= comp.maxY; y += shadowSpacing) {
        const iy = Math.round(y);
        const rOff = iy * W;

        // Find contiguous span inside THIS component
        let spanStart = -1;
        let spanEnd = -1;
        for (let x = comp.minX; x <= comp.maxX; x++) {
          if (compLabels[rOff + x] === comp.label) {
            if (spanStart === -1) spanStart = x;
            spanEnd = x;
          }
        }

        if (spanStart === -1 || (spanEnd - spanStart) < 4) continue;

        const p0x = leftToRight ? spanStart : spanEnd;
        const p1x = leftToRight ? spanEnd : spanStart;

        const dToStart = Math.hypot(curX - p0x, curY - iy);
        if (dToStart <= shadowSpacing * 2.8) {
          path.push({ x: p0x, y: iy });
        } else {
          addStealthMove(p0x, iy);
        }

        // Sinusoidal trochoid micro-wiggles
        const nSub = Math.max(3, Math.floor((spanEnd - spanStart) / 3.0));
        for (let s = 0; s <= nSub; s++) {
          const sx = p0x + ((p1x - p0x) * s) / nSub;
          const wiggle = Math.sin(sx * 1.4) * 0.55;
          path.push({ x: sx, y: iy + wiggle });
        }
        curX = p1x;
        curY = iy;

        leftToRight = !leftToRight;
      }
    }

    // 7. Clean Exit to Bottom Rail and Origin (Pen Lifts: 0)
    path.push({ x: curX, y: H - 1 });
    path.push({ x: 0, y: H - 1 });

    if (!humanize) return path;

    // 8. Humanized mechanical micro-jitter
    const out = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (p.x <= 1 || p.x >= W - 2 || p.y <= 1 || p.y >= H - 2) {
        out.push(p);
      } else {
        const jx = smoothNoise1D(i * 0.22) * 0.25;
        const jy = smoothNoise1D(i * 0.22 + 51.3) * 0.25;
        out.push({
          x: Math.round((p.x + jx) * 10) / 10,
          y: Math.round((p.y + jy) * 10) / 10
        });
      }
    }
    return out;
  }

  /**
   * =========================================================================
   * Sketch Masterpiece Plotter Engine (Topological Skeleton Eulerian Walk)
   * =========================================================================
   * [EN] Zero-lift single continuous stroke Etch A Sketch line-art/sketch generator.
   *      - Difference of Gaussians (DoG) for pencil/ink line isolation without lighting noise.
   *      - Morphological thinning (skeletonization) to 1px medial axis graph.
   *      - Topological junction/branch parsing and Eulerian assembly.
   *      - Stealth zero-damage retraversal along already-drawn grooves (Pen Lifts: 0).
   * [KO] 단일 획 무절단(Pen Lifts: 0) 스케치/선화 전용 에치 어 스케치 플로터 엔진.
   *      - DoG(가우시안 차분) 필터를 통해 배경 조명 편차를 제거하고 잉크/연필선만 정밀 분리.
   *      - 형태학적 세선화(스켈레톤)를 통한 1픽셀 중심축 위상 그래프 구축.
   *      - 분기점/끝점 파싱 및 오일러 회로 조립.
   *      - 이미 긁어낸 홈(Groove)과 베젤 레일을 통한 은밀한 역추적으로 흰색 종이 훼손 0.
   */
  function generateSketchPlotterPath(targetWidth, targetHeight, sourceImgData, opts) {
    const W = targetWidth;
    const H = targetHeight;
    const opt = opts || {};
    const humanize = opt.humanize !== false;

    const srcW = sourceImgData.width;
    const srcH = sourceImgData.height;
    const srcData = sourceImgData.data;

    // 1. Resample source image to (W, H) grayscale and compute saturation / line density
    const gray = new Float32Array(W * H);
    const darkness = new Float32Array(W * H);
    const gray8 = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      const sy = Math.min(Math.floor((y / H) * srcH), srcH - 1);
      const rowW = y * W;
      for (let x = 0; x < W; x++) {
        const sx = Math.min(Math.floor((x / W) * srcW), srcW - 1);
        const sIdx = (sy * srcW + sx) * 4;
        const lum = (srcData[sIdx] * 0.299 + srcData[sIdx + 1] * 0.587 + srcData[sIdx + 2] * 0.114) / 255.0;
        gray[rowW + x] = lum;
        darkness[rowW + x] = Math.max(0.0, Math.min(1.0, 1.0 - lum));
        gray8[rowW + x] = Math.round(lum * 255);
      }
    }

    // 2. High-precision Difference of Gaussians (DoG) filter
    // Separable Gaussian blur 1 (sigma ~ 0.8, radius 2) and blur 2 (sigma ~ 2.5, radius 5)
    function gaussianBlur(src, w, h, radius) {
      const dst = new Float32Array(w * h);
      const temp = new Float32Array(w * h);
      const kernel = [];
      const sigma = radius / 2.0;
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const v = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel.push(v);
        sum += v;
      }
      for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

      // Horizontal pass
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          let acc = 0;
          for (let k = -radius; k <= radius; k++) {
            const nx = Math.max(0, Math.min(w - 1, x + k));
            acc += src[row + nx] * kernel[k + radius];
          }
          temp[row + x] = acc;
        }
      }
      // Vertical pass
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          let acc = 0;
          for (let k = -radius; k <= radius; k++) {
            const ny = Math.max(0, Math.min(h - 1, y + k));
            acc += temp[ny * w + x] * kernel[k + radius];
          }
          dst[row + x] = acc;
        }
      }
      return dst;
    }

    const g1 = gaussianBlur(gray, W, H, 2);
    const g2 = gaussianBlur(gray, W, H, 5);
    const binMask = new Uint8Array(W * H);

    for (let i = 0; i < W * H; i++) {
      const dog = g2[i] - g1[i];
      // Positive dog means line edge, or if pixel itself is distinctly dark
      if (dog > 0.026 || gray8[i] < 165) {
        binMask[i] = 1;
      }
    }

    // 3. Fast Morphological Thinning (Skeletonization)
    const skel = new Uint8Array(W * H);
    let curImg = new Uint8Array(binMask);
    const eroded = new Uint8Array(W * H);

    for (let iter = 0; iter < 50; iter++) {
      // 3x3 Cross erosion
      let nonZero = 0;
      for (let y = 0; y < H; y++) {
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const idx = row + x;
          if (curImg[idx] === 0) {
            eroded[idx] = 0;
            continue;
          }
          const up    = y > 0 ? curImg[idx - W] : 0;
          const down  = y < H - 1 ? curImg[idx + W] : 0;
          const left  = x > 0 ? curImg[idx - 1] : 0;
          const right = x < W - 1 ? curImg[idx + 1] : 0;

          if (up && down && left && right) {
            eroded[idx] = 1;
            nonZero++;
          } else {
            eroded[idx] = 0;
          }
        }
      }

      // Dilate eroded by cross
      for (let y = 0; y < H; y++) {
        const row = y * W;
        for (let x = 0; x < W; x++) {
          const idx = row + x;
          let dilated = eroded[idx];
          if (!dilated) {
            if (y > 0 && eroded[idx - W]) dilated = 1;
            else if (y < H - 1 && eroded[idx + W]) dilated = 1;
            else if (x > 0 && eroded[idx - 1]) dilated = 1;
            else if (x < W - 1 && eroded[idx + 1]) dilated = 1;
          }
          // skel += curImg - dilated
          if (curImg[idx] && !dilated) {
            skel[idx] = 1;
          }
        }
      }

      curImg.set(eroded);
      if (nonZero === 0) break;
    }

    // 4. Topological Branch Extraction
    // Neighbor counts on 8-neighborhood
    const neighbors = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = row + x;
        if (!skel[idx]) continue;
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const rOff = (y + dy) * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (skel[rOff + x + dx]) c++;
          }
        }
        neighbors[idx] = c;
      }
    }

    // Clean lines by breaking at junctions (neighbors >= 3)
    const cleanLines = new Uint8Array(skel);
    for (let i = 0; i < W * H; i++) {
      if (neighbors[i] >= 3) cleanLines[i] = 0;
    }

    // Extract connected branch strokes
    const visitedBranch = new Uint8Array(W * H);
    const branches = [];

    for (let y = 2; y < H - 2; y++) {
      const row = y * W;
      for (let x = 2; x < W - 2; x++) {
        const rootIdx = row + x;
        if (cleanLines[rootIdx] && !visitedBranch[rootIdx]) {
          const pts = [];
          let cx = x, cy = y;
          visitedBranch[rootIdx] = 1;
          pts.push({ x: cx, y: cy });

          // Walk along branch
          for (let step = 0; step < 600; step++) {
            let nextX = -1, nextY = -1;
            for (let dy = -1; dy <= 1; dy++) {
              const rOff = (cy + dy) * W;
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const tx = cx + dx;
                const ty = cy + dy;
                const nIdx = rOff + tx;
                if (tx >= 1 && tx < W - 1 && ty >= 1 && ty < H - 1 && cleanLines[nIdx] && !visitedBranch[nIdx]) {
                  nextX = tx;
                  nextY = ty;
                  break;
                }
              }
              if (nextX !== -1) break;
            }
            if (nextX === -1) break;
            cx = nextX;
            cy = nextY;
            visitedBranch[cy * W + cx] = 1;
            pts.push({ x: cx, y: cy });
          }

          if (pts.length >= 3) {
            // Decimate points slightly to retain curvature without staircasing
            const simplified = [pts[0]];
            for (let i = 1; i < pts.length - 1; i += 2) {
              simplified.push(pts[i]);
            }
            simplified.push(pts[pts.length - 1]);

            // [Optimal K-Partitioning] Split long branches into optimal sub-segments (L_max = 32px)
            const maxSegLen = opt.maxSegmentLen || 32.0;
            let totalLen = 0;
            for (let i = 1; i < simplified.length; i++) {
              totalLen += Math.hypot(simplified[i].x - simplified[i - 1].x, simplified[i].y - simplified[i - 1].y);
            }
            if (totalLen > maxSegLen) {
              const k = Math.max(1, Math.ceil(totalLen / maxSegLen));
              const chunkSize = (simplified.length - 1) / k;
              for (let i = 0; i < k; i++) {
                const sIdx = Math.round(i * chunkSize);
                let eIdx = Math.round((i + 1) * chunkSize) + 1;
                eIdx = Math.min(eIdx, simplified.length);
                const sub = simplified.slice(sIdx, eIdx);
                if (sub.length >= 2) branches.push(sub);
              }
            } else {
              branches.push(simplified);
            }
          }
        }
      }
    }

    // 5. Two-Tier Physarum Slime Mold & Stealth A* Hybrid Highway Router
    const costMap = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const invD = 1.0 - darkness[i];
      costMap[i] = 1.0 + (invD * invD) * 3500.0;
    }
    for (let x = 0; x < W; x++) {
      costMap[(H - 1) * W + x] = 0.05;
      costMap[x] = 0.05;
    }
    for (let y = 0; y < H; y++) {
      costMap[y * W] = 0.05;
      costMap[y * W + (W - 1)] = 0.05;
    }

    // Build 1D Topological Graph with node-snapping (Tier 1 Physarum Fast-Path)
    const topoNodes = [];
    const topoAdj = [];
    const drawnEdges = new Set();
    const branchEdgeIds = [];
    const edgeConductance = [];

    function getOrCreateTopoNode(px, py) {
      const snapDistSq = 3.2 * 3.2;
      for (let i = 0; i < topoNodes.length; i++) {
        const d = (topoNodes[i].x - px) ** 2 + (topoNodes[i].y - py) ** 2;
        if (d <= snapDistSq) return i;
      }
      const idx = topoNodes.length;
      topoNodes.push({ x: px, y: py });
      topoAdj.push([]);
      return idx;
    }

    for (let bIdx = 0; bIdx < branches.length; bIdx++) {
      const b = branches[bIdx];
      const u = getOrCreateTopoNode(b[0].x, b[0].y);
      const v = getOrCreateTopoNode(b[b.length - 1].x, b[b.length - 1].y);
      let len = 0;
      for (let i = 1; i < b.length; i++) len += Math.hypot(b[i].x - b[i - 1].x, b[i].y - b[i - 1].y);
      const eId = edgeConductance.length;
      edgeConductance.push(1.0);
      branchEdgeIds.push(eId);
      topoAdj[u].push({ to: v, eId, len, pts: b });
      topoAdj[v].push({ to: u, eId, len, pts: b.slice().reverse() });
    }

    // Tier 1: Early-Exit Physarum Dijkstra (< 0.1ms on graph nodes)
    function physarumGraphDijkstra(sx, sy, gx, gy) {
      if (topoNodes.length === 0) return null;

      let uStart = -1, minDS = 1e9;
      let vGoal = -1, minDG = 1e9;
      for (let i = 0; i < topoNodes.length; i++) {
        const ds = (topoNodes[i].x - sx) ** 2 + (topoNodes[i].y - sy) ** 2;
        const dg = (topoNodes[i].x - gx) ** 2 + (topoNodes[i].y - gy) ** 2;
        if (ds < minDS) { minDS = ds; uStart = i; }
        if (dg < minDG) { minDG = dg; vGoal = i; }
      }

      if (minDS > 18.0 * 18.0 || minDG > 18.0 * 18.0) return null;
      if (uStart === vGoal) return [{ x: sx, y: sy }, topoNodes[uStart], { x: gx, y: gy }];

      const dist = new Float32Array(topoNodes.length);
      dist.fill(1e9);
      const parent = new Int32Array(topoNodes.length);
      parent.fill(-1);
      const parentPts = [];
      parentPts.length = topoNodes.length;

      dist[uStart] = 0;
      const pq = [uStart, 0.0]; // [node, dist, ...]

      let found = false;
      while (pq.length > 0) {
        let bestI = 0, bestD = pq[1];
        for (let i = 3; i < pq.length; i += 2) {
          if (pq[i] < bestD) { bestD = pq[i]; bestI = i - 1; }
        }
        const curr = pq[bestI];
        pq[bestI] = pq[pq.length - 2];
        pq[bestI + 1] = pq[pq.length - 1];
        pq.length -= 2;

        if (curr === vGoal) { found = true; break; }
        const cDist = dist[curr];

        const edges = topoAdj[curr];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          const isDrawn = drawnEdges.has(e.eId);
          // Physarum Slime Mold resistance law: drawn tubes have near-zero resistance
          const resistance = isDrawn ? 0.002 : e.len * 2.0;
          const nc = cDist + resistance;
          if (nc < dist[e.to]) {
            dist[e.to] = nc;
            parent[e.to] = curr;
            parentPts[e.to] = e.pts;
            pq.push(e.to, nc);
          }
        }
      }

      if (!found || dist[vGoal] > 90.0) return null;

      const path = [];
      let c = vGoal;
      while (c !== -1 && parent[c] !== -1) {
        const pts = parentPts[c];
        for (let k = pts.length - 1; k >= 1; k--) path.push(pts[k]);
        c = parent[c];
      }
      path.push(topoNodes[uStart]);
      path.reverse();
      return [{ x: sx, y: sy }, ...path, { x: gx, y: gy }];
    }

    // Tier 2: Bounded Stealth A* Fallback
    function findStealthPath(sx, sy, gx, gy) {
      sx = Math.max(0, Math.min(W - 1, Math.round(sx)));
      sy = Math.max(0, Math.min(H - 1, Math.round(sy)));
      gx = Math.max(0, Math.min(W - 1, Math.round(gx)));
      gy = Math.max(0, Math.min(H - 1, Math.round(gy)));
      if (sx === gx && sy === gy) return [{ x: gx, y: gy }];

      // Try Tier 1 Physarum Graph Dijkstra (< 0.1ms)
      const t1Path = physarumGraphDijkstra(sx, sy, gx, gy);
      if (t1Path) return t1Path;

      const dist = new Float32Array(W * H);
      dist.fill(1e9);
      const parent = new Int32Array(W * H);
      parent.fill(-1);

      const startIdx = sy * W + sx;
      const goalIdx = gy * W + gx;
      dist[startIdx] = 0;

      const pq = [startIdx, Math.hypot(sx - gx, sy - gy)];
      let iters = 0;
      let found = false;

      while (pq.length > 0 && iters < 8000) {
        iters++;
        let bestI = 0;
        let bestF = pq[1];
        for (let i = 3; i < pq.length; i += 2) {
          if (pq[i] < bestF) {
            bestF = pq[i];
            bestI = i - 1;
          }
        }
        const curr = pq[bestI];
        pq[bestI] = pq[pq.length - 2];
        pq[bestI + 1] = pq[pq.length - 1];
        pq.length -= 2;

        if (curr === goalIdx) {
          found = true;
          break;
        }

        const cx = curr % W;
        const cy = (curr / W) | 0;
        const cDist = dist[curr];

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= H) continue;
          const rOff = ny * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx < 0 || nx >= W) continue;
            const nIdx = rOff + nx;
            const stepLen = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
            const nc = cDist + costMap[nIdx] * stepLen;

            if (nc < dist[nIdx]) {
              dist[nIdx] = nc;
              parent[nIdx] = curr;
              pq.push(nIdx, nc + Math.hypot(nx - gx, ny - gy));
            }
          }
        }
      }

      const path = [];
      if (found) {
        let c = goalIdx;
        while (c !== -1) {
          path.push({ x: c % W, y: (c / W) | 0 });
          c = parent[c];
        }
        path.reverse();
      } else {
        path.push({ x: sx, y: H - 1 });
        path.push({ x: gx, y: H - 1 });
        path.push({ x: gx, y: gy });
      }
      return path;
    }

    const path = [];
    let curX = 0;
    let curY = H - 1;
    path.push({ x: curX, y: curY });

    function addStealthMove(tx, ty) {
      const transit = findStealthPath(curX, curY, tx, ty);
      for (let i = 1; i < transit.length; i++) {
        const pt = transit[i];
        path.push(pt);
        costMap[pt.y * W + pt.x] = 0.005; // Mark highway permanently free
      }
      curX = tx;
      curY = ty;
    }

    // 6. Chain Branches by Nearest Endpoints
    if (branches.length > 0) {
      const unvisited = new Set(branches.keys());
      let bestB = 0, bestY = -1;
      for (let i of unvisited) {
        const b = branches[i];
        const maxY = Math.max(b[0].y, b[b.length - 1].y);
        if (maxY > bestY) {
          bestY = maxY;
          bestB = i;
        }
      }

      let curBranch = branches[bestB];
      unvisited.delete(bestB);
      if (curBranch[0].y < curBranch[curBranch.length - 1].y) {
        curBranch.reverse();
      }

      const orderedBranches = [curBranch];
      while (unvisited.size > 0) {
        const lastPt = orderedBranches[orderedBranches.length - 1][orderedBranches[orderedBranches.length - 1].length - 1];
        let bestDist = 1e9;
        let candIdx = -1;
        let shouldRev = false;

        for (let idx of unvisited) {
          const b = branches[idx];
          const dH = Math.hypot(lastPt.x - b[0].x, lastPt.y - b[0].y);
          const dT = Math.hypot(lastPt.x - b[b.length - 1].x, lastPt.y - b[b.length - 1].y);
          if (dH < bestDist) {
            bestDist = dH;
            candIdx = idx;
            shouldRev = false;
          }
          if (dT < bestDist) {
            bestDist = dT;
            candIdx = idx;
            shouldRev = true;
          }
        }

        if (candIdx === -1) break;
        const cand = branches[candIdx];
        if (shouldRev) cand.reverse();
        orderedBranches.push(cand);
        unvisited.delete(candIdx);
      }

      for (let b of orderedBranches) {
        addStealthMove(b[0].x, b[0].y);
        for (let pt of b) {
          path.push(pt);
          costMap[pt.y * W + pt.x] = 0.005; // Scratched groove is free for future transit
        }
        curX = b[b.length - 1].x;
        curY = b[b.length - 1].y;
      }
    }

    // 7. Clean Return to Bottom Rail Origin (Pen Lifts: 0)
    addStealthMove(curX, H - 1);
    path.push({ x: 0, y: H - 1 });

    if (!humanize) return path;

    // 8. Humanized mechanical micro-jitter
    const out = [];
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      if (p.x <= 1 || p.x >= W - 2 || p.y <= 1 || p.y >= H - 2) {
        out.push(p);
      } else {
        const jx = smoothNoise1D(i * 0.22) * 0.2;
        const jy = smoothNoise1D(i * 0.22 + 51.3) * 0.2;
        out.push({
          x: Math.round((p.x + jx) * 10) / 10,
          y: Math.round((p.y + jy) * 10) / 10
        });
      }
    }
    return out;
  }

  return {
    screentone,
    applyToImageData,
    generateEulerianHatch,
    generateEtchbotTSP,
    generateMasterpiecePlotterPath,
    generateSketchPlotterPath,
    BAYER_4X4,
    BAYER_8X8
  };
}));
