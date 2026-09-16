const assert = require('assert');
const Engine = require('./engine.js');
const Formats = require('./formats.js');

function base(overrides = {}) {
  return {
    materialType: 'parquet',
    materialLengthMm: 1380,
    materialWidthMm: 190,
    jointWidthMm: 0,
    roomLengthMm: 5000,
    roomWidthMm: 4000,
    roomShape: 'rectangle',
    shapeRotationDeg: 0,
    shapeDimensions: {},
    roomOutlinePoints: [],
    orientation: 'lengthwise',
    pattern: 'straight',
    edgeMode: 'balanced',
    minimumEdgeWidthMm: 80,
    minimumReusableLengthMm: 300,
    minimumReusableWidthMm: 80,
    ...overrides
  };
}

const families = Formats.listFamilies();
assert.strictEqual(families.length, 8);
families.forEach(f => assert.strictEqual(f.presets.length, 5));

let r = Engine.calculate(base());
assert.notStrictEqual(r.status, 'BLOQUANT');
assert.strictEqual(r.roomAreaMm2, 20_000_000);
assert.ok(r.rows.length > 0);
assert.ok(r.controls.some(c => c.tag === 'CALPI-040'));

// 1/2 : exactement 2 positions
r = Engine.calculate(base({ pattern: 'half' }));
assert.deepStrictEqual(r.rows.slice(0, 6).map(x => Math.round(x.starterLengthMm)), [1380, 690, 1380, 690, 1380, 690]);
assert.strictEqual(new Set(r.rows.slice(0, 6).map(x => Math.round(x.starterLengthMm))).size, 2);

// 1/3 : exactement 3 positions
r = Engine.calculate(base({ pattern: 'third' }));
assert.deepStrictEqual(r.rows.slice(0, 6).map(x => Math.round(x.starterLengthMm)), [1380, 920, 460, 1380, 920, 460]);
assert.strictEqual(new Set(r.rows.slice(0, 6).map(x => Math.round(x.starterLengthMm))).size, 3);

// L exact : 5000x4000 - 2000x1500 = 17 m²
r = Engine.calculate(base({
  roomShape: 'l_shape',
  shapeDimensions: { cutoutWidthMm: 2000, cutoutHeightMm: 1500 }
}));
assert.notStrictEqual(r.status, 'BLOQUANT');
assert.strictEqual(r.roomAreaMm2, 17_000_000);
assert.strictEqual(Math.round(r.materialCoveredAreaMm2), 17_000_000);
assert.ok(r.roomPolygon.length === 6);
assert.ok(r.controls.some(c => c.tag === 'CALPI-015' && c.status === 'OK'));

// L rotation 90 conserve la surface et inverse la boîte englobante
const gL90 = Engine.buildRoomGeometry(Engine.normalizeInput(base({
  roomShape: 'l_shape',
  shapeRotationDeg: 90,
  shapeDimensions: { cutoutWidthMm: 2000, cutoutHeightMm: 1500 }
})));
assert.strictEqual(gL90.areaMm2, 17_000_000);
assert.strictEqual(gL90.bounds.widthMm, 4000);
assert.strictEqual(gL90.bounds.heightMm, 5000);

// U exact : 20m² - 2m x 1.5m = 17m²
r = Engine.calculate(base({
  roomShape: 'u_shape',
  shapeDimensions: { openingWidthMm: 2000, openingDepthMm: 1500, openingOffsetMm: 1500 }
}));
assert.notStrictEqual(r.status, 'BLOQUANT');
assert.strictEqual(r.roomAreaMm2, 17_000_000);
assert.strictEqual(Math.round(r.materialCoveredAreaMm2), 17_000_000);
assert.ok(r.roomPolygon.length === 8);

// U invalide : ouverture touche le bord -> BLOQUANT
r = Engine.calculate(base({
  roomShape: 'u_shape',
  shapeDimensions: { openingWidthMm: 2000, openingDepthMm: 1500, openingOffsetMm: 0 }
}));
assert.strictEqual(r.status, 'BLOQUANT');
assert.ok(r.controls.some(c => c.tag === 'CALPI-006' && c.status === 'BLOQUANT'));

// T exact : barre 5x1.2 + pied 1.8x2.8 = 11.04 m²
r = Engine.calculate(base({
  roomShape: 't_shape',
  shapeDimensions: { barThicknessMm: 1200, stemWidthMm: 1800, stemOffsetMm: 1600 }
}));
assert.notStrictEqual(r.status, 'BLOQUANT');
assert.strictEqual(r.roomAreaMm2, 11_040_000);
assert.strictEqual(Math.round(r.materialCoveredAreaMm2), 11_040_000);
assert.ok(r.roomPolygon.length === 8);

// Forme libre orthogonale = même L exact
const freeL = [
  { xMm: 0, yMm: 0 },
  { xMm: 3000, yMm: 0 },
  { xMm: 3000, yMm: 1500 },
  { xMm: 5000, yMm: 1500 },
  { xMm: 5000, yMm: 4000 },
  { xMm: 0, yMm: 4000 }
];
r = Engine.calculate(base({ roomShape: 'free_orthogonal', roomOutlinePoints: freeL }));
assert.notStrictEqual(r.status, 'BLOQUANT');
assert.strictEqual(r.roomAreaMm2, 17_000_000);
assert.strictEqual(Math.round(r.materialCoveredAreaMm2), 17_000_000);
assert.ok(r.controls.some(c => c.tag === 'CALPI-009' && c.status === 'OK'));

// Forme libre diagonale -> BLOQUANT
r = Engine.calculate(base({ roomShape: 'free_orthogonal', roomOutlinePoints: [
  { xMm: 0, yMm: 0 }, { xMm: 5000, yMm: 0 }, { xMm: 4000, yMm: 4000 }, { xMm: 0, yMm: 4000 }
] }));
assert.strictEqual(r.status, 'BLOQUANT');
assert.ok(r.controls.some(c => c.tag === 'CALPI-009' && c.status === 'BLOQUANT'));

// Forme libre auto-croisée orthogonale -> BLOQUANT
r = Engine.calculate(base({ roomShape: 'free_orthogonal', roomOutlinePoints: [
  { xMm: 0, yMm: 0 },
  { xMm: 4000, yMm: 0 },
  { xMm: 4000, yMm: 3000 },
  { xMm: 1000, yMm: 3000 },
  { xMm: 1000, yMm: 1000 },
  { xMm: 5000, yMm: 1000 },
  { xMm: 5000, yMm: 4000 },
  { xMm: 0, yMm: 4000 }
] }));
assert.strictEqual(r.status, 'BLOQUANT');
assert.ok(r.controls.some(c => c.tag === 'CALPI-008' && c.status === 'BLOQUANT'));

// Moins de 4 points -> BLOQUANT
r = Engine.calculate(base({ roomShape: 'free_orthogonal', roomOutlinePoints: [
  { xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }
] }));
assert.strictEqual(r.status, 'BLOQUANT');
assert.ok(r.controls.some(c => c.tag === 'CALPI-019' && c.status === 'BLOQUANT'));

// Orientation largeur sur rectangle
r = Engine.calculate(base({ orientation: 'widthwise' }));
assert.strictEqual(r.axes.runLengthMm, 4000);
assert.strictEqual(r.axes.fieldWidthMm, 5000);

// Anti-double usage
const used = r.offcuts.filter(o => o.status === 'used').map(o => o.id);
assert.strictEqual(new Set(used).size, used.length);

console.log('CALPI tests V0.2.0: OK');
