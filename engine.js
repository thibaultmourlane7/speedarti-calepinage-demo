(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalpiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.2.0';
  const EPS = 0.0001;
  const STATUSES = Object.freeze({
    OK: 'OK',
    WARNING: 'AVERTISSEMENT',
    VALIDATE: 'A_VALIDER',
    BLOCKING: 'BLOQUANT'
  });

  const SUPPORTED_MATERIALS = Object.freeze([
    'parquet', 'stratified', 'tile', 'pvc_plank', 'pvc_tile', 'terrace_tile', 'terrace_plank'
  ]);
  const SUPPORTED_PATTERNS = Object.freeze(['straight', 'half', 'third']);
  const SUPPORTED_ORIENTATIONS = Object.freeze(['lengthwise', 'widthwise']);
  const SUPPORTED_SHAPES = Object.freeze(['rectangle', 'l_shape', 'u_shape', 't_shape', 'free_orthogonal']);
  const SUPPORTED_ROTATIONS = Object.freeze([0, 90, 180, 270]);

  function control(tag, status, message, details) {
    return { tag, status, message, details: details || null };
  }

  function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
  }

  function isNonNegativeFinite(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function clonePoints(points) {
    return (Array.isArray(points) ? points : []).map(p => ({ xMm: Number(p.xMm), yMm: Number(p.yMm) }));
  }

  function normalizeInput(raw) {
    const shapeDimensions = raw && raw.shapeDimensions && typeof raw.shapeDimensions === 'object'
      ? { ...raw.shapeDimensions }
      : {};
    return {
      materialType: String(raw.materialType || ''),
      materialLengthMm: Number(raw.materialLengthMm),
      materialWidthMm: Number(raw.materialWidthMm),
      jointWidthMm: Number(raw.jointWidthMm ?? 0),
      roomLengthMm: Number(raw.roomLengthMm),
      roomWidthMm: Number(raw.roomWidthMm),
      roomShape: String(raw.roomShape || 'rectangle'),
      shapeRotationDeg: Number(raw.shapeRotationDeg ?? 0),
      shapeDimensions,
      roomOutlinePoints: clonePoints(raw.roomOutlinePoints),
      orientation: String(raw.orientation || 'lengthwise'),
      pattern: String(raw.pattern || 'straight'),
      edgeMode: String(raw.edgeMode || 'balanced'),
      minimumEdgeWidthMm: Number(raw.minimumEdgeWidthMm ?? 80),
      minimumReusableLengthMm: Number(raw.minimumReusableLengthMm ?? 300),
      minimumReusableWidthMm: Number(raw.minimumReusableWidthMm ?? 80)
    };
  }

  function pointsEqual(a, b) {
    return Math.abs(a.xMm - b.xMm) <= EPS && Math.abs(a.yMm - b.yMm) <= EPS;
  }

  function stripDuplicateClosingPoint(points) {
    const out = clonePoints(points);
    if (out.length > 1 && pointsEqual(out[0], out[out.length - 1])) out.pop();
    return out;
  }

  function polygonAreaSigned(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      sum += a.xMm * b.yMm - b.xMm * a.yMm;
    }
    return sum / 2;
  }

  function polygonArea(points) {
    return Math.abs(polygonAreaSigned(points));
  }

  function polygonBounds(points) {
    const xs = points.map(p => p.xMm);
    const ys = points.map(p => p.yMm);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return {
      minXmm: minX,
      minYmm: minY,
      maxXmm: maxX,
      maxYmm: maxY,
      widthMm: maxX - minX,
      heightMm: maxY - minY
    };
  }

  function normalizeOrigin(points) {
    const bounds = polygonBounds(points);
    return points.map(p => ({ xMm: p.xMm - bounds.minXmm, yMm: p.yMm - bounds.minYmm }));
  }

  function rotatePoints(points, deg) {
    let turns = ((deg % 360) + 360) % 360 / 90;
    let out = clonePoints(points);
    while (turns > 0) {
      out = out.map(p => ({ xMm: -p.yMm, yMm: p.xMm }));
      turns -= 1;
    }
    return normalizeOrigin(out);
  }

  function isAxisAlignedEdge(a, b) {
    const sameX = Math.abs(a.xMm - b.xMm) <= EPS;
    const sameY = Math.abs(a.yMm - b.yMm) <= EPS;
    return (sameX || sameY) && !pointsEqual(a, b);
  }

  function isOrthogonalPolygon(points) {
    if (points.length < 4) return false;
    for (let i = 0; i < points.length; i += 1) {
      if (!isAxisAlignedEdge(points[i], points[(i + 1) % points.length])) return false;
    }
    return true;
  }

  function between(v, a, b) {
    return v + EPS >= Math.min(a, b) && v - EPS <= Math.max(a, b);
  }

  function axisSegmentsIntersect(a1, a2, b1, b2) {
    const aH = Math.abs(a1.yMm - a2.yMm) <= EPS;
    const bH = Math.abs(b1.yMm - b2.yMm) <= EPS;
    if (aH && bH) {
      if (Math.abs(a1.yMm - b1.yMm) > EPS) return false;
      const left = Math.max(Math.min(a1.xMm, a2.xMm), Math.min(b1.xMm, b2.xMm));
      const right = Math.min(Math.max(a1.xMm, a2.xMm), Math.max(b1.xMm, b2.xMm));
      return left <= right + EPS;
    }
    if (!aH && !bH) {
      if (Math.abs(a1.xMm - b1.xMm) > EPS) return false;
      const top = Math.max(Math.min(a1.yMm, a2.yMm), Math.min(b1.yMm, b2.yMm));
      const bottom = Math.min(Math.max(a1.yMm, a2.yMm), Math.max(b1.yMm, b2.yMm));
      return top <= bottom + EPS;
    }
    const h1 = aH ? a1 : b1;
    const h2 = aH ? a2 : b2;
    const v1 = aH ? b1 : a1;
    const v2 = aH ? b2 : a2;
    return between(v1.xMm, h1.xMm, h2.xMm) && between(h1.yMm, v1.yMm, v2.yMm);
  }

  function hasSelfIntersection(points) {
    const n = points.length;
    for (let i = 0; i < n; i += 1) {
      const a1 = points[i];
      const a2 = points[(i + 1) % n];
      for (let j = i + 1; j < n; j += 1) {
        const adjacent = j === i || j === (i + 1) % n || (i === 0 && j === n - 1);
        if (adjacent) continue;
        const b1 = points[j];
        const b2 = points[(j + 1) % n];
        if (axisSegmentsIntersect(a1, a2, b1, b2)) return true;
      }
    }
    return false;
  }

  function finitePoints(points) {
    return points.every(p => Number.isFinite(p.xMm) && Number.isFinite(p.yMm));
  }

  function buildRectangle(w, h) {
    return [
      { xMm: 0, yMm: 0 },
      { xMm: w, yMm: 0 },
      { xMm: w, yMm: h },
      { xMm: 0, yMm: h }
    ];
  }

  function buildLShape(w, h, cutW, cutH) {
    return [
      { xMm: 0, yMm: 0 },
      { xMm: w - cutW, yMm: 0 },
      { xMm: w - cutW, yMm: cutH },
      { xMm: w, yMm: cutH },
      { xMm: w, yMm: h },
      { xMm: 0, yMm: h }
    ];
  }

  function buildUShape(w, h, openingW, openingDepth, openingOffset) {
    return [
      { xMm: 0, yMm: 0 },
      { xMm: openingOffset, yMm: 0 },
      { xMm: openingOffset, yMm: openingDepth },
      { xMm: openingOffset + openingW, yMm: openingDepth },
      { xMm: openingOffset + openingW, yMm: 0 },
      { xMm: w, yMm: 0 },
      { xMm: w, yMm: h },
      { xMm: 0, yMm: h }
    ];
  }

  function buildTShape(w, h, barThickness, stemW, stemOffset) {
    return [
      { xMm: 0, yMm: 0 },
      { xMm: w, yMm: 0 },
      { xMm: w, yMm: barThickness },
      { xMm: stemOffset + stemW, yMm: barThickness },
      { xMm: stemOffset + stemW, yMm: h },
      { xMm: stemOffset, yMm: h },
      { xMm: stemOffset, yMm: barThickness },
      { xMm: 0, yMm: barThickness }
    ];
  }

  function buildRoomGeometry(rawInput) {
    const input = normalizeInput(rawInput || {});
    const controls = [];
    const shape = input.roomShape;

    controls.push(SUPPORTED_SHAPES.includes(shape)
      ? control('CALPI-004', STATUSES.OK, `Forme ${shape} prise en charge.`)
      : control('CALPI-004', STATUSES.BLOCKING, 'Forme de pièce inconnue.'));

    controls.push(SUPPORTED_ROTATIONS.includes(input.shapeRotationDeg)
      ? control('CALPI-018', STATUSES.OK, `Rotation ${input.shapeRotationDeg}° valide.`)
      : control('CALPI-018', STATUSES.BLOCKING, 'La rotation doit être 0°, 90°, 180° ou 270°.'));

    if (controls.some(c => c.status === STATUSES.BLOCKING)) {
      return { ok: false, points: [], controls, areaMm2: 0, bounds: null };
    }

    let points = [];
    let dimsOk = true;

    if (shape === 'rectangle') {
      dimsOk = isPositiveFinite(input.roomLengthMm) && isPositiveFinite(input.roomWidthMm);
      points = dimsOk ? buildRectangle(input.roomLengthMm, input.roomWidthMm) : [];
    } else if (shape === 'l_shape') {
      const cutW = Number(input.shapeDimensions.cutoutWidthMm);
      const cutH = Number(input.shapeDimensions.cutoutHeightMm);
      dimsOk = isPositiveFinite(input.roomLengthMm) && isPositiveFinite(input.roomWidthMm)
        && isPositiveFinite(cutW) && isPositiveFinite(cutH)
        && cutW < input.roomLengthMm - EPS && cutH < input.roomWidthMm - EPS;
      points = dimsOk ? buildLShape(input.roomLengthMm, input.roomWidthMm, cutW, cutH) : [];
    } else if (shape === 'u_shape') {
      const openingW = Number(input.shapeDimensions.openingWidthMm);
      const openingDepth = Number(input.shapeDimensions.openingDepthMm);
      const openingOffset = Number(input.shapeDimensions.openingOffsetMm);
      dimsOk = isPositiveFinite(input.roomLengthMm) && isPositiveFinite(input.roomWidthMm)
        && isPositiveFinite(openingW) && isPositiveFinite(openingDepth) && isNonNegativeFinite(openingOffset)
        && openingDepth < input.roomWidthMm - EPS
        && openingOffset > EPS
        && openingOffset + openingW < input.roomLengthMm - EPS;
      points = dimsOk ? buildUShape(input.roomLengthMm, input.roomWidthMm, openingW, openingDepth, openingOffset) : [];
    } else if (shape === 't_shape') {
      const barThickness = Number(input.shapeDimensions.barThicknessMm);
      const stemW = Number(input.shapeDimensions.stemWidthMm);
      const stemOffset = Number(input.shapeDimensions.stemOffsetMm);
      dimsOk = isPositiveFinite(input.roomLengthMm) && isPositiveFinite(input.roomWidthMm)
        && isPositiveFinite(barThickness) && isPositiveFinite(stemW) && isNonNegativeFinite(stemOffset)
        && barThickness < input.roomWidthMm - EPS
        && stemOffset > EPS
        && stemOffset + stemW < input.roomLengthMm - EPS;
      points = dimsOk ? buildTShape(input.roomLengthMm, input.roomWidthMm, barThickness, stemW, stemOffset) : [];
    } else if (shape === 'free_orthogonal') {
      points = stripDuplicateClosingPoint(input.roomOutlinePoints);
      dimsOk = points.length >= 4 && finitePoints(points);
      controls.push(points.length >= 4
        ? control('CALPI-019', STATUSES.OK, `${points.length} points de contour définis.`)
        : control('CALPI-019', STATUSES.BLOCKING, 'La forme libre nécessite au moins 4 points.'));
    }

    controls.push(dimsOk
      ? control('CALPI-006', STATUSES.OK, 'Dimensions spécifiques de la forme complètes.')
      : control('CALPI-006', STATUSES.BLOCKING, 'Dimensions de forme incomplètes ou incohérentes.'));

    if (!dimsOk) return { ok: false, points: [], controls, areaMm2: 0, bounds: null };

    if (shape === 'free_orthogonal') {
      controls.push(control('CALPI-007', STATUSES.OK, 'Contour fermé automatiquement entre le dernier et le premier point.'));
      controls.push(!hasSelfIntersection(points)
        ? control('CALPI-008', STATUSES.OK, 'Contour sans auto-croisement.')
        : control('CALPI-008', STATUSES.BLOCKING, 'Le contour libre se croise lui-même.'));
      controls.push(isOrthogonalPolygon(points)
        ? control('CALPI-009', STATUSES.OK, 'Tous les segments sont horizontaux ou verticaux.')
        : control('CALPI-009', STATUSES.BLOCKING, 'La forme libre doit être orthogonale : segments horizontaux ou verticaux uniquement.'));
    } else {
      controls.push(control('CALPI-007', STATUSES.OK, 'Contour guidé fermé.'));
      controls.push(control('CALPI-008', STATUSES.OK, 'Contour guidé sans auto-croisement.'));
      controls.push(control('CALPI-009', STATUSES.OK, 'Contour guidé orthogonal.'));
    }

    if (controls.some(c => c.status === STATUSES.BLOCKING)) {
      return { ok: false, points, controls, areaMm2: 0, bounds: points.length ? polygonBounds(points) : null };
    }

    points = rotatePoints(normalizeOrigin(points), input.shapeRotationDeg);
    const areaMm2 = polygonArea(points);
    const bounds = polygonBounds(points);
    const areaOk = areaMm2 > EPS && bounds.widthMm > EPS && bounds.heightMm > EPS;

    controls.push(areaOk
      ? control('CALPI-015', STATUSES.OK, 'Polygone de pièce généré exactement.')
      : control('CALPI-015', STATUSES.BLOCKING, 'Impossible de générer une géométrie exploitable.'));
    controls.push(areaOk
      ? control('CALPI-016', STATUSES.OK, 'Surface de la pièce calculée exactement.', { roomAreaMm2: areaMm2 })
      : control('CALPI-016', STATUSES.BLOCKING, 'Surface de pièce invalide.'));

    return { ok: areaOk, points, controls, areaMm2, bounds };
  }

  function validateInput(input) {
    const controls = [];
    const geometry = buildRoomGeometry(input);
    controls.push(...geometry.controls);

    controls.push(geometry.ok
      ? control('CALPI-001', STATUSES.OK, 'Géométrie de pièce exploitable.', { widthMm: geometry.bounds.widthMm, heightMm: geometry.bounds.heightMm })
      : control('CALPI-001', STATUSES.BLOCKING, 'La géométrie de la pièce doit être valide avant calcul.'));

    controls.push(isPositiveFinite(input.materialLengthMm) && isPositiveFinite(input.materialWidthMm)
      ? control('CALPI-002', STATUSES.OK, 'Dimensions matériau valides.')
      : control('CALPI-002', STATUSES.BLOCKING, 'Les dimensions du matériau doivent être strictement positives.'));

    controls.push(isNonNegativeFinite(input.jointWidthMm)
      ? control('CALPI-003', STATUSES.OK, 'Largeur de joint valide.')
      : control('CALPI-003', STATUSES.BLOCKING, 'La largeur de joint doit être positive ou nulle.'));

    controls.push(SUPPORTED_ORIENTATIONS.includes(input.orientation)
      ? control('CALPI-005', STATUSES.OK, 'Orientation valide.')
      : control('CALPI-005', STATUSES.BLOCKING, 'Orientation inconnue.'));

    controls.push(SUPPORTED_PATTERNS.includes(input.pattern)
      ? control('CALPI-020', STATUSES.OK, 'Motif de pose pris en charge.')
      : control('CALPI-020', STATUSES.BLOCKING, 'Motif de pose non pris en charge par cette version.'));

    controls.push(isPositiveFinite(input.minimumReusableLengthMm) && isPositiveFinite(input.minimumReusableWidthMm)
      ? control('CALPI-030', STATUSES.OK, 'Seuils de réutilisation valides.')
      : control('CALPI-030', STATUSES.BLOCKING, 'Les seuils de réutilisation doivent être strictement positifs.'));

    return controls;
  }

  function hasBlocking(controls) {
    return controls.some(c => c.status === STATUSES.BLOCKING);
  }

  function toLayoutPoint(p, orientation) {
    return orientation === 'lengthwise'
      ? { uMm: p.xMm, vMm: p.yMm }
      : { uMm: p.yMm, vMm: p.xMm };
  }

  function layoutPolygonFor(points, orientation) {
    return points.map(p => toLayoutPoint(p, orientation));
  }

  function layoutBounds(points) {
    const us = points.map(p => p.uMm);
    const vs = points.map(p => p.vMm);
    const minU = Math.min(...us);
    const minV = Math.min(...vs);
    const maxU = Math.max(...us);
    const maxV = Math.max(...vs);
    return { minUmm: minU, minVmm: minV, maxUmm: maxU, maxVmm: maxV, runLengthMm: maxU - minU, fieldWidthMm: maxV - minV };
  }

  function axesFor(input, geometry) {
    const lp = layoutPolygonFor(geometry.points, input.orientation);
    const b = layoutBounds(lp);
    return { runLengthMm: b.runLengthMm, fieldWidthMm: b.fieldWidthMm };
  }

  function calculateRows(fieldWidthMm, materialWidthMm, jointWidthMm, edgeMode, minimumEdgeWidthMm) {
    const pitch = materialWidthMm + jointWidthMm;
    const rowCount = Math.max(1, Math.ceil((fieldWidthMm + jointWidthMm) / pitch));
    const naturalLast = fieldWidthMm - (rowCount - 1) * pitch;
    let first = materialWidthMm;
    let last = naturalLast;
    let balanced = false;

    if (edgeMode === 'balanced' && rowCount > 1 && naturalLast < minimumEdgeWidthMm) {
      const combined = materialWidthMm + naturalLast;
      first = combined / 2;
      last = combined / 2;
      balanced = true;
    }

    const widths = [];
    for (let row = 0; row < rowCount; row += 1) {
      if (row === 0) widths.push(first);
      else if (row === rowCount - 1) widths.push(last);
      else widths.push(materialWidthMm);
    }

    return { rowCount, firstRowWidthMm: first, lastRowWidthMm: last, balanced, rowWidthsMm: widths };
  }

  function starterLengthFor(pattern, rowIndex, materialLengthMm) {
    if (pattern === 'straight') return materialLengthMm;
    if (pattern === 'half') return rowIndex % 2 === 0 ? materialLengthMm : materialLengthMm / 2;
    if (pattern === 'third') {
      const cycle = rowIndex % 3;
      if (cycle === 0) return materialLengthMm;
      if (cycle === 1) return (materialLengthMm * 2) / 3;
      return materialLengthMm / 3;
    }
    return materialLengthMm;
  }

  function buildTargets(runLengthMm, materialLengthMm, jointWidthMm, starterLengthMm) {
    const targets = [];
    let remaining = runLengthMm;
    let first = true;
    while (remaining > EPS) {
      const desired = first ? Math.min(starterLengthMm, materialLengthMm) : materialLengthMm;
      const pieceLength = Math.min(desired, remaining);
      targets.push(pieceLength);
      remaining -= pieceLength;
      if (remaining > EPS) {
        remaining -= jointWidthMm;
        if (remaining < -EPS) {
          targets[targets.length - 1] = Math.max(0, targets[targets.length - 1] + remaining);
          remaining = 0;
        }
      }
      first = false;
    }
    return targets.filter(v => v > EPS);
  }

  function buildGridCells(runLengthMm, materialLengthMm, jointWidthMm, starterLengthMm) {
    const targets = buildTargets(runLengthMm, materialLengthMm, jointWidthMm, starterLengthMm);
    const cells = [];
    let u = 0;
    targets.forEach((lengthMm, index) => {
      cells.push({ index, startMm: u, endMm: u + lengthMm, lengthMm });
      u += lengthMm + (index < targets.length - 1 ? jointWidthMm : 0);
    });
    return cells;
  }

  function scanlineIntervals(layoutPoints, vMm) {
    const crossings = [];
    for (let i = 0; i < layoutPoints.length; i += 1) {
      const a = layoutPoints[i];
      const b = layoutPoints[(i + 1) % layoutPoints.length];
      if (Math.abs(a.uMm - b.uMm) > EPS) continue;
      const low = Math.min(a.vMm, b.vMm);
      const high = Math.max(a.vMm, b.vMm);
      if (vMm >= low - EPS && vMm < high - EPS) crossings.push(a.uMm);
    }
    crossings.sort((a, b) => a - b);
    const intervals = [];
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      if (crossings[i + 1] - crossings[i] > EPS) intervals.push([crossings[i], crossings[i + 1]]);
    }
    return intervals;
  }

  function intervalsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (Math.abs(a[i][0] - b[i][0]) > EPS || Math.abs(a[i][1] - b[i][1]) > EPS) return false;
    }
    return true;
  }

  function splitRowIntoBands(layoutPoints, startV, endV) {
    const cuts = [startV, endV];
    layoutPoints.forEach(p => {
      if (p.vMm > startV + EPS && p.vMm < endV - EPS) cuts.push(p.vMm);
    });
    cuts.sort((a, b) => a - b);
    const unique = cuts.filter((v, i) => i === 0 || Math.abs(v - cuts[i - 1]) > EPS);
    const bands = [];
    for (let i = 0; i < unique.length - 1; i += 1) {
      const a = unique[i];
      const b = unique[i + 1];
      if (b - a <= EPS) continue;
      const intervals = scanlineIntervals(layoutPoints, (a + b) / 2);
      if (!intervals.length) continue;
      const prev = bands[bands.length - 1];
      if (prev && Math.abs(prev.endVmm - a) <= EPS && intervalsEqual(prev.intervals, intervals)) {
        prev.endVmm = b;
        prev.widthMm = prev.endVmm - prev.startVmm;
      } else {
        bands.push({ startVmm: a, endVmm: b, widthMm: b - a, intervals });
      }
    }
    return bands;
  }

  function createPlanner(input) {
    let offcutSeq = 0;
    let elementSeq = 0;
    let pieceSeq = 0;
    let cutCount = 0;
    let newElementsOpened = 0;
    let reusedOffcutCount = 0;
    let lostAreaMm2 = 0;
    const offcuts = [];
    const pool = [];
    const consumedOffcutIds = new Set();

    function nextOffcutId() { offcutSeq += 1; return `C${offcutSeq}`; }
    function nextElementId() { elementSeq += 1; return `E${elementSeq}`; }
    function nextPieceId() { pieceSeq += 1; return `P${pieceSeq}`; }

    function registerLostArea(areaMm2) {
      if (areaMm2 > 0) lostAreaMm2 += areaMm2;
    }

    function addOffcut(lengthMm, widthMm, origin, parentOffcutId) {
      if (lengthMm <= EPS || widthMm <= EPS) return null;
      const reusable = lengthMm >= input.minimumReusableLengthMm && widthMm >= input.minimumReusableWidthMm;
      const item = {
        id: nextOffcutId(), lengthMm, widthMm, origin,
        parentOffcutId: parentOffcutId || null,
        status: reusable ? 'available' : 'lost',
        usedAt: null
      };
      offcuts.push(item);
      if (reusable) pool.push(item);
      else registerLostArea(lengthMm * widthMm);
      return item;
    }

    function selectOffcut(targetLengthMm, targetWidthMm) {
      const candidates = pool.filter(o => o.status === 'available' && o.lengthMm + EPS >= targetLengthMm && o.widthMm + EPS >= targetWidthMm);
      candidates.sort((a, b) => {
        const wasteA = (a.lengthMm * a.widthMm) - (targetLengthMm * targetWidthMm);
        const wasteB = (b.lengthMm * b.widthMm) - (targetLengthMm * targetWidthMm);
        if (Math.abs(wasteA - wasteB) > EPS) return wasteA - wasteB;
        return a.lengthMm - b.lengthMm;
      });
      return candidates[0] || null;
    }

    function consumeSource(source, targetLengthMm, targetWidthMm, placement) {
      const sourceLengthMm = source.lengthMm;
      const sourceWidthMm = source.widthMm;
      const isOffcut = source.type === 'offcut';
      const sourceId = source.id;

      if (isOffcut) {
        if (consumedOffcutIds.has(sourceId)) throw new Error(`Double usage interdit pour ${sourceId}`);
        consumedOffcutIds.add(sourceId);
        reusedOffcutCount += 1;
        const poolItem = pool.find(o => o.id === sourceId);
        if (poolItem) poolItem.status = 'used';
        const history = offcuts.find(o => o.id === sourceId);
        if (history) {
          history.status = 'used';
          history.usedAt = placement;
        }
      } else {
        newElementsOpened += 1;
      }

      const lengthRemainder = sourceLengthMm - targetLengthMm;
      const widthRemainder = sourceWidthMm - targetWidthMm;
      const wasLengthCut = lengthRemainder > EPS;
      const wasWidthCut = widthRemainder > EPS;
      if (wasLengthCut) cutCount += 1;
      if (wasWidthCut) cutCount += 1;

      if (wasWidthCut) registerLostArea(targetLengthMm * widthRemainder);

      let produced = null;
      if (wasLengthCut) {
        produced = addOffcut(
          lengthRemainder,
          sourceWidthMm,
          { sourceId, rowIndex: placement.rowIndex, pieceIndex: placement.pieceIndex },
          isOffcut ? sourceId : null
        );
      }

      return {
        pieceId: nextPieceId(),
        sourceType: isOffcut ? 'offcut' : 'new',
        sourceId,
        lengthMm: targetLengthMm,
        widthMm: targetWidthMm,
        lengthCut: wasLengthCut,
        widthCut: wasWidthCut,
        producedOffcutId: produced ? produced.id : null,
        rowIndex: placement.rowIndex,
        pieceIndex: placement.pieceIndex,
        bandIndex: placement.bandIndex
      };
    }

    function allocate(targetLengthMm, targetWidthMm, placement) {
      const candidate = selectOffcut(targetLengthMm, targetWidthMm);
      if (candidate) {
        return consumeSource({ type: 'offcut', id: candidate.id, lengthMm: candidate.lengthMm, widthMm: candidate.widthMm }, targetLengthMm, targetWidthMm, placement);
      }
      return consumeSource({ type: 'new', id: nextElementId(), lengthMm: input.materialLengthMm, widthMm: input.materialWidthMm }, targetLengthMm, targetWidthMm, placement);
    }

    return {
      allocate,
      snapshot() {
        return {
          offcuts: offcuts.map(o => ({ ...o })),
          availableOffcuts: pool.filter(o => o.status === 'available').map(o => ({ ...o })),
          newElementsOpened,
          reusedOffcutCount,
          cutCount,
          lostAreaMm2,
          consumedOffcutIds: Array.from(consumedOffcutIds)
        };
      }
    };
  }

  function roomRectForPiece(piece, orientation) {
    if (orientation === 'lengthwise') {
      return {
        roomXmm: piece.xMm,
        roomYmm: piece.yMm,
        roomWidthMm: piece.lengthMm,
        roomHeightMm: piece.widthMm
      };
    }
    return {
      roomXmm: piece.yMm,
      roomYmm: piece.xMm,
      roomWidthMm: piece.widthMm,
      roomHeightMm: piece.lengthMm
    };
  }

  function calculate(rawInput) {
    const input = normalizeInput(rawInput || {});
    const geometry = buildRoomGeometry(input);
    const controls = validateInput(input);
    if (hasBlocking(controls)) {
      controls.push(control('CALPI-041', STATUSES.BLOCKING, 'Sortie finale interdite tant qu’un contrôle bloquant subsiste.'));
      return { engineVersion: VERSION, status: STATUSES.BLOCKING, input, controls, roomPolygon: geometry.points || [], rows: [], poseSequence: [] };
    }

    const layoutPolygon = layoutPolygonFor(geometry.points, input.orientation);
    const lb = layoutBounds(layoutPolygon);
    const axes = { runLengthMm: lb.runLengthMm, fieldWidthMm: lb.fieldWidthMm };
    const rowCalc = calculateRows(axes.fieldWidthMm, input.materialWidthMm, input.jointWidthMm, input.edgeMode, input.minimumEdgeWidthMm);
    controls.push(control('CALPI-010', STATUSES.OK, `${rowCalc.rowCount} rangée(s) de grille calculée(s).`));
    controls.push(rowCalc.lastRowWidthMm > 0
      ? control('CALPI-011', STATUSES.OK, 'Dernière rive géométriquement valide.')
      : control('CALPI-011', STATUSES.BLOCKING, 'Dernière rive invalide.'));

    if (rowCalc.balanced) controls.push(control('CALPI-013', STATUSES.OK, 'Première et dernière rive équilibrées automatiquement.'));
    else controls.push(control('CALPI-013', STATUSES.OK, 'Aucun équilibrage automatique appliqué.'));

    const edgeMin = Math.min(rowCalc.firstRowWidthMm, rowCalc.lastRowWidthMm);
    controls.push(edgeMin + EPS >= input.minimumEdgeWidthMm
      ? control('CALPI-014', STATUSES.OK, 'Largeur minimale de rive respectée.', { minimumObservedMm: edgeMin })
      : control('CALPI-014', input.edgeMode === 'balanced' ? STATUSES.WARNING : STATUSES.VALIDATE, 'Une rive reste inférieure au minimum demandé.', { minimumObservedMm: edgeMin, requestedMm: input.minimumEdgeWidthMm }));

    if (hasBlocking(controls)) {
      controls.push(control('CALPI-041', STATUSES.BLOCKING, 'Sortie finale interdite.'));
      return { engineVersion: VERSION, status: STATUSES.BLOCKING, input, controls, roomPolygon: geometry.points, rows: [], poseSequence: [] };
    }

    const planner = createPlanner(input);
    const rows = [];
    const poseSequence = [];
    let yMm = 0;
    let materialCoveredAreaMm2 = 0;
    let geometrySplitBandCount = 0;

    for (let rowIndex = 0; rowIndex < rowCalc.rowCount; rowIndex += 1) {
      const rowWidthMm = rowCalc.rowWidthsMm[rowIndex];
      const rowStartV = yMm;
      const rowEndV = yMm + rowWidthMm;
      const starterLengthMm = starterLengthFor(input.pattern, rowIndex, input.materialLengthMm);
      const gridCells = buildGridCells(axes.runLengthMm, input.materialLengthMm, input.jointWidthMm, starterLengthMm);
      const bands = splitRowIntoBands(layoutPolygon, rowStartV, rowEndV);
      const pieces = [];

      bands.forEach((band, bandIndex) => {
        if (band.widthMm < rowWidthMm - EPS) geometrySplitBandCount += 1;
        let pieceIndexInBand = 0;
        band.intervals.forEach(interval => {
          const intervalStart = interval[0];
          const intervalEnd = interval[1];
          gridCells.forEach(cell => {
            const start = Math.max(intervalStart, cell.startMm);
            const end = Math.min(intervalEnd, cell.endMm);
            const lengthMm = end - start;
            if (lengthMm <= EPS) return;
            const piece = planner.allocate(lengthMm, band.widthMm, { rowIndex, pieceIndex: pieceIndexInBand, bandIndex });
            piece.xMm = start;
            piece.yMm = band.startVmm;
            piece.gridCellIndex = cell.index;
            piece.intervalStartMm = intervalStart;
            piece.intervalEndMm = intervalEnd;
            Object.assign(piece, roomRectForPiece(piece, input.orientation));
            pieces.push(piece);
            materialCoveredAreaMm2 += piece.lengthMm * piece.widthMm;
            poseSequence.push({
              step: poseSequence.length + 1,
              row: rowIndex + 1,
              band: bandIndex + 1,
              piece: pieceIndexInBand + 1,
              pieceId: piece.pieceId,
              action: piece.sourceType === 'offcut' ? `Réutiliser ${piece.sourceId}` : `Ouvrir ${piece.sourceId}`,
              lengthMm: piece.lengthMm,
              widthMm: piece.widthMm,
              producedOffcutId: piece.producedOffcutId
            });
            pieceIndexInBand += 1;
          });
        });
      });

      rows.push({
        rowIndex,
        rowNumber: rowIndex + 1,
        widthMm: rowWidthMm,
        yMm,
        starterLengthMm,
        bands,
        pieces
      });
      yMm += rowWidthMm + (rowIndex < rowCalc.rowCount - 1 ? input.jointWidthMm : 0);
    }

    const stats = planner.snapshot();
    controls.push(control('CALPI-017', STATUSES.OK, 'Zone de pose découpée en bandes orthogonales exactes.', { geometrySplitBandCount }));
    if (geometrySplitBandCount > 0) {
      controls.push(control('CALPI-036', STATUSES.WARNING, 'La géométrie est exacte, mais les bandes créées aux décrochements sont optimisées comme fragments rectangulaires. Les chutes issues de découpes en encoche ne sont pas encore optimisées en 2D.', { geometrySplitBandCount }));
    } else {
      controls.push(control('CALPI-036', STATUSES.OK, 'Aucune découpe géométrique complexe nécessitant une optimisation 2D supplémentaire.'));
    }
    controls.push(control('CALPI-021', STATUSES.OK, 'Décalages de départ générés selon le motif choisi.'));
    controls.push(control('CALPI-022', STATUSES.OK, 'Ordre de pose généré.'));
    controls.push(control('CALPI-031', STATUSES.OK, 'Le stock de chutes est interrogé avant chaque ouverture d’un élément neuf.'));
    controls.push(control('CALPI-032', STATUSES.OK, 'Traçabilité origine → réemploi enregistrée.'));
    controls.push(control('CALPI-033', STATUSES.OK, 'Contrôle anti-double-usage actif.'));
    controls.push(control('CALPI-034', STATUSES.OK, 'Les reliquats de réemploi sont reclassés automatiquement.'));
    controls.push(control('CALPI-035', STATUSES.OK, 'Matière perdue identifiée par le moteur.'));
    controls.push(control('CALPI-040', STATUSES.OK, 'Résultat CALPI complet généré.'));

    const worst = controls.some(c => c.status === STATUSES.VALIDATE) ? STATUSES.VALIDATE
      : controls.some(c => c.status === STATUSES.WARNING) ? STATUSES.WARNING
      : STATUSES.OK;

    return {
      engineVersion: VERSION,
      status: worst,
      input,
      controls,
      roomPolygon: geometry.points,
      roomBounds: geometry.bounds,
      roomAreaMm2: geometry.areaMm2,
      axes,
      firstRowWidthMm: rowCalc.firstRowWidthMm,
      lastRowWidthMm: rowCalc.lastRowWidthMm,
      balancedEdges: rowCalc.balanced,
      rowCount: rowCalc.rowCount,
      rows,
      poseSequence,
      offcuts: stats.offcuts,
      availableOffcuts: stats.availableOffcuts,
      newElementsOpened: stats.newElementsOpened,
      reusedOffcutCount: stats.reusedOffcutCount,
      cutCount: stats.cutCount,
      lostAreaMm2: stats.lostAreaMm2,
      installedAreaMm2: geometry.areaMm2,
      materialCoveredAreaMm2,
      geometrySplitBandCount
    };
  }

  return {
    VERSION,
    STATUSES,
    SUPPORTED_MATERIALS,
    SUPPORTED_PATTERNS,
    SUPPORTED_ORIENTATIONS,
    SUPPORTED_SHAPES,
    SUPPORTED_ROTATIONS,
    normalizeInput,
    validateInput,
    buildRoomGeometry,
    calculateRows,
    starterLengthFor,
    buildTargets,
    scanlineIntervals,
    calculate
  };
});
