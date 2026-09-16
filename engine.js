(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalpiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.3.0';
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
      minimumReusableWidthMm: Number(raw.minimumReusableWidthMm ?? 80),
      allowOffcutRotation: Boolean(raw.allowOffcutRotation ?? false)
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

  function cleanCell(cell) {
    return {
      xMm: Number(cell.xMm), yMm: Number(cell.yMm),
      widthMm: Number(cell.widthMm), heightMm: Number(cell.heightMm)
    };
  }

  function cellArea(cell) {
    return Math.max(0, cell.widthMm) * Math.max(0, cell.heightMm);
  }

  function cellsArea(cells) {
    return cells.reduce((sum, cell) => sum + cellArea(cell), 0);
  }

  function cellsBounds(cells) {
    if (!cells.length) return { minXmm: 0, minYmm: 0, maxXmm: 0, maxYmm: 0, widthMm: 0, heightMm: 0 };
    const minXmm = Math.min(...cells.map(c => c.xMm));
    const minYmm = Math.min(...cells.map(c => c.yMm));
    const maxXmm = Math.max(...cells.map(c => c.xMm + c.widthMm));
    const maxYmm = Math.max(...cells.map(c => c.yMm + c.heightMm));
    return { minXmm, minYmm, maxXmm, maxYmm, widthMm: maxXmm - minXmm, heightMm: maxYmm - minYmm };
  }

  function normalizeCells(cells) {
    const valid = cells.map(cleanCell).filter(c => c.widthMm > EPS && c.heightMm > EPS);
    if (!valid.length) return [];
    const b = cellsBounds(valid);
    return valid.map(c => ({ xMm: c.xMm - b.minXmm, yMm: c.yMm - b.minYmm, widthMm: c.widthMm, heightMm: c.heightMm }));
  }

  function mergeCells(rawCells) {
    let cells = normalizeCells(rawCells);
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < cells.length; i += 1) {
        for (let j = i + 1; j < cells.length; j += 1) {
          const a = cells[i], b = cells[j];
          const sameY = Math.abs(a.yMm - b.yMm) <= EPS && Math.abs(a.heightMm - b.heightMm) <= EPS;
          const touchX = Math.abs((a.xMm + a.widthMm) - b.xMm) <= EPS || Math.abs((b.xMm + b.widthMm) - a.xMm) <= EPS;
          if (sameY && touchX) {
            const x1 = Math.min(a.xMm, b.xMm), x2 = Math.max(a.xMm + a.widthMm, b.xMm + b.widthMm);
            cells.splice(j, 1); cells[i] = { xMm: x1, yMm: a.yMm, widthMm: x2 - x1, heightMm: a.heightMm };
            changed = true; break outer;
          }
          const sameX = Math.abs(a.xMm - b.xMm) <= EPS && Math.abs(a.widthMm - b.widthMm) <= EPS;
          const touchY = Math.abs((a.yMm + a.heightMm) - b.yMm) <= EPS || Math.abs((b.yMm + b.heightMm) - a.yMm) <= EPS;
          if (sameX && touchY) {
            const y1 = Math.min(a.yMm, b.yMm), y2 = Math.max(a.yMm + a.heightMm, b.yMm + b.heightMm);
            cells.splice(j, 1); cells[i] = { xMm: a.xMm, yMm: y1, widthMm: a.widthMm, heightMm: y2 - y1 };
            changed = true; break outer;
          }
        }
      }
    }
    return normalizeCells(cells);
  }

  function rectIntersection(a, b) {
    const x1 = Math.max(a.xMm, b.xMm), y1 = Math.max(a.yMm, b.yMm);
    const x2 = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm);
    const y2 = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm);
    if (x2 - x1 <= EPS || y2 - y1 <= EPS) return null;
    return { xMm: x1, yMm: y1, widthMm: x2 - x1, heightMm: y2 - y1 };
  }

  function subtractRectFromCell(cell, cut) {
    const i = rectIntersection(cell, cut);
    if (!i) return [cleanCell(cell)];
    const out = [];
    const cx2 = cell.xMm + cell.widthMm, cy2 = cell.yMm + cell.heightMm;
    const ix2 = i.xMm + i.widthMm, iy2 = i.yMm + i.heightMm;
    if (i.xMm - cell.xMm > EPS) out.push({ xMm: cell.xMm, yMm: cell.yMm, widthMm: i.xMm - cell.xMm, heightMm: cell.heightMm });
    if (cx2 - ix2 > EPS) out.push({ xMm: ix2, yMm: cell.yMm, widthMm: cx2 - ix2, heightMm: cell.heightMm });
    if (i.yMm - cell.yMm > EPS) out.push({ xMm: i.xMm, yMm: cell.yMm, widthMm: i.widthMm, heightMm: i.yMm - cell.yMm });
    if (cy2 - iy2 > EPS) out.push({ xMm: i.xMm, yMm: iy2, widthMm: i.widthMm, heightMm: cy2 - iy2 });
    return out;
  }

  function subtractShapeFromCells(sourceCells, cutCells) {
    let cells = sourceCells.map(cleanCell);
    cutCells.forEach(cut => {
      const next = [];
      cells.forEach(cell => next.push(...subtractRectFromCell(cell, cut)));
      cells = next;
    });
    return mergeCells(cells);
  }

  function overlapArea(sourceCells, targetCells) {
    let area = 0;
    sourceCells.forEach(s => targetCells.forEach(t => {
      const i = rectIntersection(s, t);
      if (i) area += cellArea(i);
    }));
    return area;
  }

  function translateCells(cells, dx, dy) {
    return cells.map(c => ({ xMm: c.xMm + dx, yMm: c.yMm + dy, widthMm: c.widthMm, heightMm: c.heightMm }));
  }

  function rotateCells90(cells) {
    const b = cellsBounds(cells);
    const rotated = cells.map(c => ({
      xMm: b.heightMm - (c.yMm + c.heightMm),
      yMm: c.xMm,
      widthMm: c.heightMm,
      heightMm: c.widthMm
    }));
    return mergeCells(rotated);
  }

  function cellsShareEdge(a, b) {
    const verticalTouch = (Math.abs((a.xMm + a.widthMm) - b.xMm) <= EPS || Math.abs((b.xMm + b.widthMm) - a.xMm) <= EPS)
      && Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm) - Math.max(a.yMm, b.yMm) > EPS;
    const horizontalTouch = (Math.abs((a.yMm + a.heightMm) - b.yMm) <= EPS || Math.abs((b.yMm + b.heightMm) - a.yMm) <= EPS)
      && Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm) - Math.max(a.xMm, b.xMm) > EPS;
    return verticalTouch || horizontalTouch;
  }

  function groupConnectedCells(rawCells) {
    const cells = mergeCells(rawCells);
    const groups = [];
    const seen = new Set();
    for (let i = 0; i < cells.length; i += 1) {
      if (seen.has(i)) continue;
      const queue = [i], group = []; seen.add(i);
      while (queue.length) {
        const idx = queue.shift(); group.push(cells[idx]);
        for (let j = 0; j < cells.length; j += 1) {
          if (!seen.has(j) && cellsShareEdge(cells[idx], cells[j])) { seen.add(j); queue.push(j); }
        }
      }
      groups.push(mergeCells(group));
    }
    return groups;
  }

  function keyNum(v) { return Math.round(v * 1000000) / 1000000; }
  function pointKey(x, y) { return `${keyNum(x)},${keyNum(y)}`; }

  function simplifyContour(points) {
    if (points.length < 3) return points;
    const out = [];
    for (let i = 0; i < points.length; i += 1) {
      const prev = points[(i - 1 + points.length) % points.length];
      const cur = points[i];
      const next = points[(i + 1) % points.length];
      const collinear = (Math.abs(prev.xMm - cur.xMm) <= EPS && Math.abs(cur.xMm - next.xMm) <= EPS)
        || (Math.abs(prev.yMm - cur.yMm) <= EPS && Math.abs(cur.yMm - next.yMm) <= EPS);
      if (!collinear) out.push(cur);
    }
    return out;
  }

  function cellsToContours(rawCells) {
    const cells = mergeCells(rawCells);
    if (!cells.length) return [];
    const xs = Array.from(new Set(cells.flatMap(c => [keyNum(c.xMm), keyNum(c.xMm + c.widthMm)]))).sort((a,b)=>a-b);
    const ys = Array.from(new Set(cells.flatMap(c => [keyNum(c.yMm), keyNum(c.yMm + c.heightMm)]))).sort((a,b)=>a-b);
    const occupied = new Set();
    for (let i = 0; i < xs.length - 1; i += 1) for (let j = 0; j < ys.length - 1; j += 1) {
      const mx = (xs[i] + xs[i+1]) / 2, my = (ys[j] + ys[j+1]) / 2;
      if (cells.some(c => mx > c.xMm - EPS && mx < c.xMm + c.widthMm + EPS && my > c.yMm - EPS && my < c.yMm + c.heightMm + EPS)) occupied.add(`${i}:${j}`);
    }
    const edges = [];
    const add = (x1,y1,x2,y2) => edges.push({a:{xMm:x1,yMm:y1},b:{xMm:x2,yMm:y2}});
    for (let i = 0; i < xs.length - 1; i += 1) for (let j = 0; j < ys.length - 1; j += 1) {
      if (!occupied.has(`${i}:${j}`)) continue;
      if (!occupied.has(`${i}:${j-1}`)) add(xs[i],ys[j],xs[i+1],ys[j]);
      if (!occupied.has(`${i+1}:${j}`)) add(xs[i+1],ys[j],xs[i+1],ys[j+1]);
      if (!occupied.has(`${i}:${j+1}`)) add(xs[i+1],ys[j+1],xs[i],ys[j+1]);
      if (!occupied.has(`${i-1}:${j}`)) add(xs[i],ys[j+1],xs[i],ys[j]);
    }
    const byStart = new Map();
    edges.forEach((e,idx) => { const k=pointKey(e.a.xMm,e.a.yMm); if(!byStart.has(k))byStart.set(k,[]); byStart.get(k).push(idx); });
    const used = new Set(), loops=[];
    for (let startIdx=0; startIdx<edges.length; startIdx+=1) {
      if (used.has(startIdx)) continue;
      const loop=[]; let idx=startIdx; let guard=0;
      while (!used.has(idx) && guard < edges.length + 5) {
        guard += 1; const e=edges[idx]; used.add(idx); loop.push(e.a);
        const nextKey=pointKey(e.b.xMm,e.b.yMm);
        const candidates=(byStart.get(nextKey)||[]).filter(n=>!used.has(n));
        if (!candidates.length) { if (pointKey(e.b.xMm,e.b.yMm)!==pointKey(loop[0].xMm,loop[0].yMm)) loop.push(e.b); break; }
        idx=candidates[0];
      }
      if (loop.length >= 4) loops.push(simplifyContour(loop));
    }
    return loops;
  }

  function canPlaceShape(sourceCells, targetCells) {
    return Math.abs(overlapArea(sourceCells, targetCells) - cellsArea(targetCells)) <= Math.max(EPS, cellsArea(targetCells) * 1e-9);
  }

  function candidateTranslations(sourceCells, targetCells) {
    const sx = sourceCells.flatMap(c => [c.xMm, c.xMm + c.widthMm]);
    const sy = sourceCells.flatMap(c => [c.yMm, c.yMm + c.heightMm]);
    const tx = targetCells.flatMap(c => [c.xMm, c.xMm + c.widthMm]);
    const ty = targetCells.flatMap(c => [c.yMm, c.yMm + c.heightMm]);
    const dxs = Array.from(new Set(sx.flatMap(s => tx.map(t => keyNum(s - t)))));
    const dys = Array.from(new Set(sy.flatMap(s => ty.map(t => keyNum(s - t)))));
    const out=[];
    dxs.forEach(dx=>dys.forEach(dy=>out.push({dx,dy})));
    return out;
  }

  function canFitMinimum(cells, minLengthMm, minWidthMm, allowRotation) {
    const tests = [{w:minLengthMm,h:minWidthMm,rot:0}];
    if (allowRotation && Math.abs(minLengthMm-minWidthMm)>EPS) tests.push({w:minWidthMm,h:minLengthMm,rot:90});
    for (const t of tests) {
      const target=[{xMm:0,yMm:0,widthMm:t.w,heightMm:t.h}];
      const trans=candidateTranslations(cells,target);
      if (trans.some(p=>canPlaceShape(cells,translateCells(target,p.dx,p.dy)))) return true;
    }
    return false;
  }

  function analyzeRemainder(remainingCells, input) {
    const components = groupConnectedCells(remainingCells);
    let lostAreaMm2 = 0;
    let reusableAreaMm2 = 0;
    components.forEach(comp => {
      const area = cellsArea(comp);
      if (canFitMinimum(comp, input.minimumReusableLengthMm, input.minimumReusableWidthMm, input.allowOffcutRotation)) reusableAreaMm2 += area;
      else lostAreaMm2 += area;
    });
    return { components, lostAreaMm2, reusableAreaMm2 };
  }

  function findBestPlacement(sourceCellsRaw, targetCellsRaw, input, allowRotation) {
    const sourceCells = mergeCells(sourceCellsRaw);
    const baseTarget = mergeCells(targetCellsRaw);
    const variants=[{cells:baseTarget,rotationDeg:0}];
    if (allowRotation) variants.push({cells:rotateCells90(baseTarget),rotationDeg:90});
    let best=null;
    variants.forEach(variant => {
      candidateTranslations(sourceCells,variant.cells).forEach(pos => {
        const placed=translateCells(variant.cells,pos.dx,pos.dy);
        if (!canPlaceShape(sourceCells,placed)) return;
        const remaining=subtractShapeFromCells(sourceCells,placed);
        const analysis=analyzeRemainder(remaining,input);
        const candidate={placedTargetCells:placed,remainingCells:remaining,remainderComponents:analysis.components,lostAreaMm2:analysis.lostAreaMm2,reusableAreaMm2:analysis.reusableAreaMm2,rotationDeg:variant.rotationDeg,dx:pos.dx,dy:pos.dy,sourceAreaMm2:cellsArea(sourceCells),targetAreaMm2:cellsArea(variant.cells)};
        if (!best) { best=candidate; return; }
        const a=[candidate.lostAreaMm2, candidate.remainderComponents.length, candidate.sourceAreaMm2-candidate.targetAreaMm2, candidate.rotationDeg===0?0:1, candidate.dy, candidate.dx];
        const b=[best.lostAreaMm2, best.remainderComponents.length, best.sourceAreaMm2-best.targetAreaMm2, best.rotationDeg===0?0:1, best.dy, best.dx];
        for(let i=0;i<a.length;i+=1){ if(a[i]<b[i]-EPS){best=candidate;break;} if(a[i]>b[i]+EPS)break; }
      });
    });
    return best;
  }

  function createPlanner(input) {
    let offcutSeq=0, elementSeq=0, pieceSeq=0, cutCount=0, newElementsOpened=0, reusedOffcutCount=0, lostAreaMm2=0;
    let complexOffcutsCreated=0, twoDReuseCount=0, rotatedOffcutReuseCount=0;
    const offcuts=[], pool=[], consumedOffcutIds=new Set();

    function nextOffcutId(){offcutSeq+=1;return `C${offcutSeq}`;}
    function nextElementId(){elementSeq+=1;return `E${elementSeq}`;}
    function nextPieceId(){pieceSeq+=1;return `P${pieceSeq}`;}
    function registerLostArea(area){if(area>EPS)lostAreaMm2+=area;}

    function addOffcutRegion(regionCells, origin, parentOffcutId) {
      const cells=mergeCells(regionCells); if(!cells.length)return null;
      const areaMm2=cellsArea(cells), b=cellsBounds(cells);
      const reusable=canFitMinimum(cells,input.minimumReusableLengthMm,input.minimumReusableWidthMm,input.allowOffcutRotation);
      const contours=cellsToContours(cells);
      const shapeType=cells.length===1?'rectangle':'orthogonal';
      if(shapeType==='orthogonal')complexOffcutsCreated+=1;
      const item={id:nextOffcutId(),lengthMm:b.widthMm,widthMm:b.heightMm,areaMm2,shapeType,cells,contours,contourPoints:contours[0]||[],origin,parentOffcutId:parentOffcutId||null,status:reusable?'available':'lost',usedAt:null};
      offcuts.push(item); if(reusable)pool.push(item); else registerLostArea(areaMm2); return item;
    }

    function selectOffcut(targetCells) {
      const candidates=[];
      pool.filter(o=>o.status==='available').forEach(item=>{
        const placement=findBestPlacement(item.cells,targetCells,input,input.allowOffcutRotation);
        if(placement)candidates.push({item,placement});
      });
      candidates.sort((a,b)=>{
        const av=[a.placement.lostAreaMm2,a.item.areaMm2-a.placement.targetAreaMm2,a.placement.remainderComponents.length,a.placement.rotationDeg===0?0:1];
        const bv=[b.placement.lostAreaMm2,b.item.areaMm2-b.placement.targetAreaMm2,b.placement.remainderComponents.length,b.placement.rotationDeg===0?0:1];
        for(let i=0;i<av.length;i+=1){if(Math.abs(av[i]-bv[i])>EPS)return av[i]-bv[i];}return 0;
      });
      return candidates[0]||null;
    }

    function consume(source, placement, targetCells, meta) {
      const isOffcut=source.type==='offcut', sourceId=source.id;
      if(isOffcut){
        if(consumedOffcutIds.has(sourceId))throw new Error(`Double usage interdit pour ${sourceId}`);
        consumedOffcutIds.add(sourceId); reusedOffcutCount+=1;
        const history=offcuts.find(o=>o.id===sourceId); if(history){history.status='used';history.usedAt=meta;}
        if(source.shapeType==='orthogonal'||targetCells.length>1)twoDReuseCount+=1;
        if(placement.rotationDeg===90)rotatedOffcutReuseCount+=1;
      } else newElementsOpened+=1;

      const targetContours=cellsToContours(placement.placedTargetCells);
      cutCount += targetContours.reduce((sum,loop)=>sum+loop.length,0);
      const produced=[];
      placement.remainderComponents.forEach(comp=>{
        const item=addOffcutRegion(comp,{sourceId,rowIndex:meta.rowIndex,pieceIndex:meta.pieceIndex,gridCellIndex:meta.gridCellIndex},isOffcut?sourceId:null);
        if(item)produced.push(item.id);
      });
      const targetBounds=cellsBounds(targetCells);
      return {pieceId:nextPieceId(),sourceType:isOffcut?'offcut':'new',sourceId,lengthMm:targetBounds.widthMm,widthMm:targetBounds.heightMm,shapeType:targetCells.length===1?'rectangle':'orthogonal',shapeCells:mergeCells(targetCells),shapeContours:cellsToContours(targetCells),sourcePlacementCells:placement.placedTargetCells,sourceRotationDeg:placement.rotationDeg,producedOffcutIds:produced,producedOffcutId:produced[0]||null,rowIndex:meta.rowIndex,pieceIndex:meta.pieceIndex,gridCellIndex:meta.gridCellIndex};
    }

    function allocateShape(targetCellsRaw, meta) {
      const targetCells=mergeCells(targetCellsRaw);
      const candidate=selectOffcut(targetCells);
      if(candidate)return consume({type:'offcut',id:candidate.item.id,cells:candidate.item.cells,shapeType:candidate.item.shapeType},candidate.placement,targetCells,meta);
      const sourceCells=[{xMm:0,yMm:0,widthMm:input.materialLengthMm,heightMm:input.materialWidthMm}];
      const placement=findBestPlacement(sourceCells,targetCells,input,false);
      if(!placement)throw new Error(`La pièce ${meta.rowIndex+1}/${meta.gridCellIndex+1} ne rentre pas dans un élément neuf ${input.materialLengthMm}×${input.materialWidthMm} mm.`);
      return consume({type:'new',id:nextElementId(),cells:sourceCells,shapeType:'rectangle'},placement,targetCells,meta);
    }

    return {
      allocateShape,
      snapshot() {
        return {
          offcuts: offcuts.map(o => ({
            ...o,
            cells: o.cells.map(c => ({ ...c })),
            contours: o.contours.map(loop => loop.map(p => ({ ...p })))
          })),
          availableOffcuts: pool.filter(o => o.status === 'available').map(o => ({
            ...o,
            cells: o.cells.map(c => ({ ...c }))
          })),
          newElementsOpened,
          reusedOffcutCount,
          cutCount,
          lostAreaMm2,
          consumedOffcutIds: Array.from(consumedOffcutIds),
          complexOffcutsCreated,
          twoDReuseCount,
          rotatedOffcutReuseCount
        };
      }
    };
  }

  function layoutCellToRoomCell(cell, orientation) {
    if (orientation === 'lengthwise') return { roomXmm: cell.xMm, roomYmm: cell.yMm, roomWidthMm: cell.widthMm, roomHeightMm: cell.heightMm };
    return { roomXmm: cell.yMm, roomYmm: cell.xMm, roomWidthMm: cell.heightMm, roomHeightMm: cell.widthMm };
  }

  function calculate(rawInput) {
    const input=normalizeInput(rawInput||{}), geometry=buildRoomGeometry(input), controls=validateInput(input);
    if(hasBlocking(controls)){controls.push(control('CALPI-041',STATUSES.BLOCKING,'Sortie finale interdite tant qu’un contrôle bloquant subsiste.'));return {engineVersion:VERSION,status:STATUSES.BLOCKING,input,controls,roomPolygon:geometry.points||[],rows:[],poseSequence:[]};}

    const layoutPolygon=layoutPolygonFor(geometry.points,input.orientation), lb=layoutBounds(layoutPolygon);
    const axes={runLengthMm:lb.runLengthMm,fieldWidthMm:lb.fieldWidthMm};
    const rowCalc=calculateRows(axes.fieldWidthMm,input.materialWidthMm,input.jointWidthMm,input.edgeMode,input.minimumEdgeWidthMm);
    controls.push(control('CALPI-010',STATUSES.OK,`${rowCalc.rowCount} rangée(s) de grille calculée(s).`));
    controls.push(rowCalc.lastRowWidthMm>0?control('CALPI-011',STATUSES.OK,'Dernière rive géométriquement valide.'):control('CALPI-011',STATUSES.BLOCKING,'Dernière rive invalide.'));
    controls.push(control('CALPI-013',STATUSES.OK,rowCalc.balanced?'Première et dernière rive équilibrées automatiquement.':'Aucun équilibrage automatique appliqué.'));
    const edgeMin=Math.min(rowCalc.firstRowWidthMm,rowCalc.lastRowWidthMm);
    controls.push(edgeMin+EPS>=input.minimumEdgeWidthMm?control('CALPI-014',STATUSES.OK,'Largeur minimale de rive respectée.',{minimumObservedMm:edgeMin}):control('CALPI-014',input.edgeMode==='balanced'?STATUSES.WARNING:STATUSES.VALIDATE,'Une rive reste inférieure au minimum demandé.',{minimumObservedMm:edgeMin,requestedMm:input.minimumEdgeWidthMm}));
    if(hasBlocking(controls)){controls.push(control('CALPI-041',STATUSES.BLOCKING,'Sortie finale interdite.'));return {engineVersion:VERSION,status:STATUSES.BLOCKING,input,controls,roomPolygon:geometry.points,rows:[],poseSequence:[]};}

    const planner=createPlanner(input), rows=[], poseSequence=[];
    let yMm=0, materialCoveredAreaMm2=0, geometrySplitBandCount=0, complexInstalledPieceCount=0;
    try {
      for(let rowIndex=0;rowIndex<rowCalc.rowCount;rowIndex+=1){
        const rowWidthMm=rowCalc.rowWidthsMm[rowIndex], rowStartV=yMm, rowEndV=yMm+rowWidthMm;
        const starterLengthMm=starterLengthFor(input.pattern,rowIndex,input.materialLengthMm);
        const gridCells=buildGridCells(axes.runLengthMm,input.materialLengthMm,input.jointWidthMm,starterLengthMm);
        const bands=splitRowIntoBands(layoutPolygon,rowStartV,rowEndV), fragmentsByGrid=new Map();
        bands.forEach((band,bandIndex)=>{
          if(band.widthMm<rowWidthMm-EPS)geometrySplitBandCount+=1;
          band.intervals.forEach(interval=>gridCells.forEach(cell=>{
            const start=Math.max(interval[0],cell.startMm), end=Math.min(interval[1],cell.endMm), length=end-start;
            if(length<=EPS)return;
            const fragment={xMm:start,yMm:band.startVmm,widthMm:length,heightMm:band.widthMm,bandIndex};
            if(!fragmentsByGrid.has(cell.index))fragmentsByGrid.set(cell.index,[]);
            fragmentsByGrid.get(cell.index).push(fragment);
          }));
        });
        const pieces=[]; let pieceIndex=0;
        Array.from(fragmentsByGrid.keys()).sort((a,b)=>a-b).forEach(gridCellIndex=>{
          const fragments=fragmentsByGrid.get(gridCellIndex).map(f=>({xMm:f.xMm,yMm:f.yMm,widthMm:f.widthMm,heightMm:f.heightMm}));
          const components=groupConnectedCells(fragments);
          components.forEach(componentAbs=>{
            const absBounds=cellsBounds(componentAbs), targetCells=normalizeCells(componentAbs);
            const piece=planner.allocateShape(targetCells,{rowIndex,pieceIndex,gridCellIndex});
            piece.xMm=absBounds.minXmm; piece.yMm=absBounds.minYmm;
            piece.layoutCells=componentAbs.map(c=>({...c}));
            piece.roomCells=componentAbs.map(c=>layoutCellToRoomCell(c,input.orientation));
            piece.roomContours=[];
            if(piece.shapeType==='orthogonal')complexInstalledPieceCount+=1;
            pieces.push(piece); materialCoveredAreaMm2+=cellsArea(componentAbs);
            const producedText=piece.producedOffcutIds.length?` · conserver ${piece.producedOffcutIds.join(', ')}`:'';
            poseSequence.push({step:poseSequence.length+1,row:rowIndex+1,piece:pieceIndex+1,pieceId:piece.pieceId,gridCellIndex,action:piece.sourceType==='offcut'?`Réutiliser ${piece.sourceId}${piece.sourceRotationDeg===90?' tourné à 90°':''}`:`Ouvrir ${piece.sourceId}`,lengthMm:piece.lengthMm,widthMm:piece.widthMm,shapeType:piece.shapeType,sourceRotationDeg:piece.sourceRotationDeg,producedOffcutId:piece.producedOffcutId,producedOffcutIds:piece.producedOffcutIds,note:producedText});
            pieceIndex+=1;
          });
        });
        rows.push({rowIndex,rowNumber:rowIndex+1,widthMm:rowWidthMm,yMm,starterLengthMm,bands,pieces});
        yMm+=rowWidthMm+(rowIndex<rowCalc.rowCount-1?input.jointWidthMm:0);
      }
    } catch(err) {
      controls.push(control('CALPI-023',STATUSES.BLOCKING,'Une pièce géométrique ne peut pas être découpée dans le format matériau sélectionné.',{error:String(err.message||err)}));
      controls.push(control('CALPI-041',STATUSES.BLOCKING,'Sortie finale interdite.'));
      return {engineVersion:VERSION,status:STATUSES.BLOCKING,input,controls,roomPolygon:geometry.points,roomBounds:geometry.bounds,roomAreaMm2:geometry.areaMm2,rows:[],poseSequence:[]};
    }

    const stats=planner.snapshot();
    controls.push(control('CALPI-017',STATUSES.OK,'Zone de pose découpée en cellules orthogonales exactes.',{geometrySplitBandCount,complexInstalledPieceCount}));
    controls.push(control('CALPI-036',STATUSES.OK,'Optimisation 2D active : les chutes complexes sont conservées sous forme de régions orthogonales exactes et testées avant ouverture d’un élément neuf.',{complexOffcutsCreated:stats.complexOffcutsCreated,twoDReuseCount:stats.twoDReuseCount}));
    controls.push(control('CALPI-037',STATUSES.OK,'Contour réel et aire exacte de chaque chute 2D enregistrés.'));
    controls.push(control('CALPI-038',STATUSES.OK,input.allowOffcutRotation?'Rotation 90° des chutes autorisée et testée.':'Rotation 90° des chutes interdite par le réglage utilisateur.',{rotatedOffcutReuseCount:stats.rotatedOffcutReuseCount}));
    controls.push(control('CALPI-039',STATUSES.OK,'Les reliquats 2D sont scindés en composantes physiques distinctes et reclassés individuellement.'));
    controls.push(control('CALPI-021',STATUSES.OK,'Décalages de départ générés selon le motif choisi.'));
    controls.push(control('CALPI-022',STATUSES.OK,'Ordre de pose généré.'));
    controls.push(control('CALPI-031',STATUSES.OK,'Le stock de chutes 2D est interrogé avant chaque ouverture d’un élément neuf.'));
    controls.push(control('CALPI-032',STATUSES.OK,'Traçabilité origine → réemploi enregistrée.'));
    controls.push(control('CALPI-033',STATUSES.OK,'Contrôle anti-double-usage actif.'));
    controls.push(control('CALPI-034',STATUSES.OK,'Les reliquats de réemploi sont recalculés géométriquement et reclassés automatiquement.'));
    controls.push(control('CALPI-035',STATUSES.OK,'Matière perdue identifiée par aire géométrique exacte.'));
    controls.push(control('CALPI-040',STATUSES.OK,'Résultat CALPI complet généré.'));
    const worst=controls.some(c=>c.status===STATUSES.VALIDATE)?STATUSES.VALIDATE:controls.some(c=>c.status===STATUSES.WARNING)?STATUSES.WARNING:STATUSES.OK;
    return {engineVersion:VERSION,status:worst,input,controls,roomPolygon:geometry.points,roomBounds:geometry.bounds,roomAreaMm2:geometry.areaMm2,axes,firstRowWidthMm:rowCalc.firstRowWidthMm,lastRowWidthMm:rowCalc.lastRowWidthMm,balancedEdges:rowCalc.balanced,rowCount:rowCalc.rowCount,rows,poseSequence,offcuts:stats.offcuts,availableOffcuts:stats.availableOffcuts,newElementsOpened:stats.newElementsOpened,reusedOffcutCount:stats.reusedOffcutCount,cutCount:stats.cutCount,lostAreaMm2:stats.lostAreaMm2,installedAreaMm2:geometry.areaMm2,materialCoveredAreaMm2,geometrySplitBandCount,complexInstalledPieceCount,complexOffcutsCreated:stats.complexOffcutsCreated,twoDReuseCount:stats.twoDReuseCount,rotatedOffcutReuseCount:stats.rotatedOffcutReuseCount};
  }

  return {
    VERSION,STATUSES,SUPPORTED_MATERIALS,SUPPORTED_PATTERNS,SUPPORTED_ORIENTATIONS,SUPPORTED_SHAPES,SUPPORTED_ROTATIONS,
    normalizeInput,validateInput,buildRoomGeometry,calculateRows,starterLengthFor,buildTargets,scanlineIntervals,calculate,
    __test:{mergeCells,cellsArea,cellsBounds,normalizeCells,subtractShapeFromCells,groupConnectedCells,cellsToContours,findBestPlacement,rotateCells90,canPlaceShape}
  };

});
