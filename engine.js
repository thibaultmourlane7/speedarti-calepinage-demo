(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalpiEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1.0';
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

  function control(tag, status, message, details) {
    return { tag, status, message, details: details || null };
  }

  function isPositiveFinite(value) {
    return Number.isFinite(value) && value > 0;
  }

  function isNonNegativeFinite(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function normalizeInput(raw) {
    return {
      materialType: String(raw.materialType || ''),
      materialLengthMm: Number(raw.materialLengthMm),
      materialWidthMm: Number(raw.materialWidthMm),
      jointWidthMm: Number(raw.jointWidthMm ?? 0),
      roomLengthMm: Number(raw.roomLengthMm),
      roomWidthMm: Number(raw.roomWidthMm),
      roomShape: String(raw.roomShape || 'rectangle'),
      orientation: String(raw.orientation || 'lengthwise'),
      pattern: String(raw.pattern || 'straight'),
      edgeMode: String(raw.edgeMode || 'balanced'),
      minimumEdgeWidthMm: Number(raw.minimumEdgeWidthMm ?? 80),
      minimumReusableLengthMm: Number(raw.minimumReusableLengthMm ?? 300),
      minimumReusableWidthMm: Number(raw.minimumReusableWidthMm ?? 80)
    };
  }

  function validateInput(input) {
    const controls = [];
    controls.push(isPositiveFinite(input.roomLengthMm) && isPositiveFinite(input.roomWidthMm)
      ? control('CALPI-001', STATUSES.OK, 'Dimensions de pièce valides.')
      : control('CALPI-001', STATUSES.BLOCKING, 'Les dimensions de la pièce doivent être strictement positives.'));

    controls.push(isPositiveFinite(input.materialLengthMm) && isPositiveFinite(input.materialWidthMm)
      ? control('CALPI-002', STATUSES.OK, 'Dimensions matériau valides.')
      : control('CALPI-002', STATUSES.BLOCKING, 'Les dimensions du matériau doivent être strictement positives.'));

    controls.push(isNonNegativeFinite(input.jointWidthMm)
      ? control('CALPI-003', STATUSES.OK, 'Largeur de joint valide.')
      : control('CALPI-003', STATUSES.BLOCKING, 'La largeur de joint doit être positive ou nulle.'));

    controls.push(input.roomShape === 'rectangle'
      ? control('CALPI-004', STATUSES.OK, 'Forme rectangle prise en charge.')
      : control('CALPI-004', STATUSES.BLOCKING, 'Cette version ne calcule pas encore cette forme. Aucune approximation rectangle ne sera utilisée.'));

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

  function axesFor(input) {
    if (input.orientation === 'lengthwise') {
      return { runLengthMm: input.roomLengthMm, fieldWidthMm: input.roomWidthMm };
    }
    return { runLengthMm: input.roomWidthMm, fieldWidthMm: input.roomLengthMm };
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
    while (remaining > 0.0001) {
      const desired = first ? Math.min(starterLengthMm, materialLengthMm) : materialLengthMm;
      const pieceLength = Math.min(desired, remaining);
      targets.push(pieceLength);
      remaining -= pieceLength;
      if (remaining > 0.0001) {
        remaining -= jointWidthMm;
        if (remaining < -0.0001) {
          targets[targets.length - 1] = Math.max(0, targets[targets.length - 1] + remaining);
          remaining = 0;
        }
      }
      first = false;
    }
    return targets.filter(v => v > 0.0001);
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
      if (lengthMm <= 0 || widthMm <= 0) return null;
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
      const candidates = pool.filter(o => o.status === 'available' && o.lengthMm + 0.0001 >= targetLengthMm && o.widthMm + 0.0001 >= targetWidthMm);
      candidates.sort((a, b) => {
        const wasteA = (a.lengthMm * a.widthMm) - (targetLengthMm * targetWidthMm);
        const wasteB = (b.lengthMm * b.widthMm) - (targetLengthMm * targetWidthMm);
        if (Math.abs(wasteA - wasteB) > 0.0001) return wasteA - wasteB;
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
      const wasLengthCut = lengthRemainder > 0.0001;
      const wasWidthCut = widthRemainder > 0.0001;
      if (wasLengthCut) cutCount += 1;
      if (wasWidthCut) cutCount += 1;

      // Une bande longitudinale issue d'une rive est classée perdue en V0.1.
      // Elle est comptée exactement mais n'entre pas encore dans le pool 2D de réemploi.
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
        pieceIndex: placement.pieceIndex
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

  function calculate(rawInput) {
    const input = normalizeInput(rawInput || {});
    const controls = validateInput(input);
    if (hasBlocking(controls)) {
      controls.push(control('CALPI-041', STATUSES.BLOCKING, 'Sortie finale interdite tant qu’un contrôle bloquant subsiste.'));
      return { engineVersion: VERSION, status: STATUSES.BLOCKING, input, controls, rows: [], poseSequence: [] };
    }

    const axes = axesFor(input);
    const rowCalc = calculateRows(axes.fieldWidthMm, input.materialWidthMm, input.jointWidthMm, input.edgeMode, input.minimumEdgeWidthMm);
    controls.push(control('CALPI-010', STATUSES.OK, `${rowCalc.rowCount} rangée(s) calculée(s).`));
    controls.push(rowCalc.lastRowWidthMm > 0
      ? control('CALPI-011', STATUSES.OK, 'Dernière rive géométriquement valide.')
      : control('CALPI-011', STATUSES.BLOCKING, 'Dernière rive invalide.'));

    if (rowCalc.balanced) controls.push(control('CALPI-013', STATUSES.OK, 'Première et dernière rive équilibrées automatiquement.'));
    else controls.push(control('CALPI-013', STATUSES.OK, 'Aucun équilibrage automatique appliqué.'));

    const edgeMin = Math.min(rowCalc.firstRowWidthMm, rowCalc.lastRowWidthMm);
    controls.push(edgeMin + 0.0001 >= input.minimumEdgeWidthMm
      ? control('CALPI-014', STATUSES.OK, 'Largeur minimale de rive respectée.', { minimumObservedMm: edgeMin })
      : control('CALPI-014', input.edgeMode === 'balanced' ? STATUSES.WARNING : STATUSES.VALIDATE, 'Une rive reste inférieure au minimum demandé.', { minimumObservedMm: edgeMin, requestedMm: input.minimumEdgeWidthMm }));

    if (hasBlocking(controls)) {
      controls.push(control('CALPI-041', STATUSES.BLOCKING, 'Sortie finale interdite.'));
      return { engineVersion: VERSION, status: STATUSES.BLOCKING, input, controls, rows: [], poseSequence: [] };
    }

    const planner = createPlanner(input);
    const rows = [];
    const poseSequence = [];
    let yMm = 0;

    for (let rowIndex = 0; rowIndex < rowCalc.rowCount; rowIndex += 1) {
      const rowWidthMm = rowCalc.rowWidthsMm[rowIndex];
      const starterLengthMm = starterLengthFor(input.pattern, rowIndex, input.materialLengthMm);
      const targets = buildTargets(axes.runLengthMm, input.materialLengthMm, input.jointWidthMm, starterLengthMm);
      const pieces = [];
      let xMm = 0;

      targets.forEach((targetLengthMm, pieceIndex) => {
        const piece = planner.allocate(targetLengthMm, rowWidthMm, { rowIndex, pieceIndex });
        piece.xMm = xMm;
        piece.yMm = yMm;
        pieces.push(piece);
        poseSequence.push({
          step: poseSequence.length + 1,
          row: rowIndex + 1,
          piece: pieceIndex + 1,
          pieceId: piece.pieceId,
          action: piece.sourceType === 'offcut' ? `Réutiliser ${piece.sourceId}` : `Ouvrir ${piece.sourceId}`,
          lengthMm: piece.lengthMm,
          widthMm: piece.widthMm,
          producedOffcutId: piece.producedOffcutId
        });
        xMm += targetLengthMm + (pieceIndex < targets.length - 1 ? input.jointWidthMm : 0);
      });

      rows.push({ rowIndex, rowNumber: rowIndex + 1, widthMm: rowWidthMm, yMm, starterLengthMm, pieces });
      yMm += rowWidthMm + (rowIndex < rowCalc.rowCount - 1 ? input.jointWidthMm : 0);
    }

    const stats = planner.snapshot();
    controls.push(control('CALPI-021', STATUSES.OK, 'Décalages de départ générés selon le motif choisi.'));
    controls.push(control('CALPI-022', STATUSES.OK, 'Ordre de pose généré.'));
    controls.push(control('CALPI-031', STATUSES.OK, 'Le stock de chutes est interrogé avant chaque ouverture d’un élément neuf.'));
    controls.push(control('CALPI-032', STATUSES.OK, 'Traçabilité origine → réemploi enregistrée.'));
    controls.push(control('CALPI-033', STATUSES.OK, 'Contrôle anti-double-usage actif.'));
    controls.push(control('CALPI-034', STATUSES.OK, 'Les reliquats de réemploi sont reclassés automatiquement.'));
    controls.push(control('CALPI-035', STATUSES.OK, 'Matière perdue identifiée par le moteur.'));
    controls.push(control('CALPI-040', STATUSES.OK, 'Résultat CALPI complet généré.'));

    const installedAreaMm2 = input.roomLengthMm * input.roomWidthMm;
    const worst = controls.some(c => c.status === STATUSES.VALIDATE) ? STATUSES.VALIDATE
      : controls.some(c => c.status === STATUSES.WARNING) ? STATUSES.WARNING
      : STATUSES.OK;

    return {
      engineVersion: VERSION,
      status: worst,
      input,
      controls,
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
      installedAreaMm2
    };
  }

  return {
    VERSION,
    STATUSES,
    SUPPORTED_MATERIALS,
    SUPPORTED_PATTERNS,
    SUPPORTED_ORIENTATIONS,
    normalizeInput,
    validateInput,
    calculateRows,
    starterLengthFor,
    buildTargets,
    calculate
  };
});
