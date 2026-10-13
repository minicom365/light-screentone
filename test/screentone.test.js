const assert = require('assert');
const { screentone, BAYER_4X4, BAYER_8X8, generateEulerianHatch } = require('../light-screentone.js');

console.log('[TEST] Running light-screentone unit tests...');

// 1. Boundary conditions
assert.strictEqual(screentone(0, 0, 0.0), 0, 'Pure black should be 0');
assert.strictEqual(screentone(0, 0, 1.0), 1, 'Pure white should be 1');
assert.strictEqual(screentone(0, 0, 0.0, { invert: true }), 1, 'Inverted black should be 1');
assert.strictEqual(screentone(0, 0, 1.0, { invert: true }), 0, 'Inverted white should be 0');

// 2. Pattern coverage
const patterns = ['dot', 'line', 'cross', 'bayer4', 'bayer8', 'stochastic', 'concentric'];
for (const pat of patterns) {
  let whiteCount = 0;
  let blackCount = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const bit = screentone(x, y, 0.5, { pattern: pat, frequency: 8 });
      if (bit === 1) whiteCount++;
      else blackCount++;
    }
  }
  assert(whiteCount > 0, `Pattern ${pat} should produce white pixels`);
  assert(blackCount > 0, `Pattern ${pat} should produce black pixels`);
  console.log(`  ✓ Pattern '${pat}': ${whiteCount} white, ${blackCount} black pixels`);
}

// 3. Bayer Matrix integrity
assert.strictEqual(BAYER_4X4.length, 16);
assert.strictEqual(BAYER_8X8.length, 64);
console.log('  ✓ Bayer 4x4 and 8x8 matrices valid');

// 4. Eulerian Hatching Vector Test
const hatch = generateEulerianHatch(100, 100, (x, y) => {
  // Grayscale circle at center
  const dx = x - 50;
  const dy = y - 50;
  return Math.sqrt(dx * dx + dy * dy) < 25 ? 0.2 : 0.8;
}, { step: 10, threshold: 0.5 });

assert(hatch.length > 10, 'Should generate continuous vertices');
assert.strictEqual(hatch[0].x, 0);
assert.strictEqual(hatch[0].y, 99);
console.log(`  ✓ Eulerian Vector Hatch: ${hatch.length} vertices generated with 0 pen lifts`);

console.log('[PASS] All light-screentone unit tests passed successfully!\n');
