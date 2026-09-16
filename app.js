(function(){
'use strict';
const E=window.CalpiEngine;
const F=window.CalpiFormats;
const app=document.getElementById('app');

const families=F.listFamilies();
const shapes=[
  ['rectangle','Rectangle','2 dimensions'],
  ['l_shape','L','Décroché rectangulaire'],
  ['u_shape','U','Ouverture intérieure'],
  ['t_shape','T','Barre + pied'],
  ['free_orthogonal','Forme libre','Contour orthogonal exact']
];
const patterns=[
  ['straight','Pose droite','Joints répétitifs'],
  ['half','Décalée 1/2','Cycle strict sur 2 rangées'],
  ['third','Décalée 1/3','Cycle strict sur 3 rangées']
];
const steps=['Matériau','Pose','Forme','Dimensions','Options','Résultat'];
const initialFamily=families[0], initialPreset=initialFamily.presets[0];

const state={
  step:0,
  tab:'plan',
  materialFamilyId:initialFamily.id,
  formatMode:'preset',
  selectedFormatId:initialPreset.id,
  input:{
    materialType:initialFamily.engineMaterialType,
    materialLengthMm:initialPreset.lengthMm,
    materialWidthMm:initialPreset.widthMm,
    jointWidthMm:0,
    roomLengthMm:5000,
    roomWidthMm:4000,
    roomShape:'rectangle',
    shapeRotationDeg:0,
    shapeDimensions:{},
    roomOutlinePoints:[],
    orientation:'lengthwise',
    pattern:'straight',
    edgeMode:'balanced',
    minimumEdgeWidthMm:80,
    minimumReusableLengthMm:300,
    minimumReusableWidthMm:80,
    allowOffcutRotation:false
  },
  result:null
};

function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmt(v){return Math.round(Number(v)*10)/10;}
function currentFamily(){return F.getFamily(state.materialFamilyId);}
function invalidate(){state.result=null;}
function set(k,v){state.input[k]=v;invalidate();render();}
function num(k,v){const n=Number(v);state.input[k]=Number.isFinite(n)?n:0;invalidate();}
function shapeNum(k,v){const n=Number(v);state.input.shapeDimensions[k]=Number.isFinite(n)?n:0;invalidate();}

function selectFamily(id){
  const family=F.getFamily(id); if(!family)return;
  const first=family.presets[0];
  state.materialFamilyId=family.id;
  state.formatMode='preset';
  state.selectedFormatId=first.id;
  state.input.materialType=family.engineMaterialType;
  state.input.materialLengthMm=first.lengthMm;
  state.input.materialWidthMm=first.widthMm;
  state.input.allowOffcutRotation=['tile','pvc_tile','terrace_tile'].includes(family.engineMaterialType);
  invalidate(); render();
}
function selectPreset(id){const p=F.getPreset(state.materialFamilyId,id);if(!p)return;state.formatMode='preset';state.selectedFormatId=p.id;state.input.materialLengthMm=p.lengthMm;state.input.materialWidthMm=p.widthMm;invalidate();render();}
function selectManual(){state.formatMode='manual';state.selectedFormatId=null;invalidate();render();}

function defaultShapeDimensions(shape){
  if(shape==='l_shape')return {cutoutWidthMm:2000,cutoutHeightMm:1500};
  if(shape==='u_shape')return {openingWidthMm:2000,openingDepthMm:1500,openingOffsetMm:1500};
  if(shape==='t_shape')return {barThicknessMm:1200,stemWidthMm:1800,stemOffsetMm:1600};
  return {};
}
function selectShape(shape){
  state.input.roomShape=shape;
  state.input.shapeRotationDeg=0;
  state.input.shapeDimensions=defaultShapeDimensions(shape);
  if(shape==='free_orthogonal'){
    state.input.roomOutlinePoints=[
      {xMm:0,yMm:0},{xMm:state.input.roomLengthMm,yMm:0},
      {xMm:state.input.roomLengthMm,yMm:state.input.roomWidthMm},{xMm:0,yMm:state.input.roomWidthMm}
    ];
  } else state.input.roomOutlinePoints=[];
  invalidate();render();
}

function freeTemplate(type){
  const w=state.input.roomLengthMm||5000,h=state.input.roomWidthMm||4000;
  if(type==='rectangle') state.input.roomOutlinePoints=[{xMm:0,yMm:0},{xMm:w,yMm:0},{xMm:w,yMm:h},{xMm:0,yMm:h}];
  if(type==='l') state.input.roomOutlinePoints=[{xMm:0,yMm:0},{xMm:w-2000,yMm:0},{xMm:w-2000,yMm:1500},{xMm:w,yMm:1500},{xMm:w,yMm:h},{xMm:0,yMm:h}];
  if(type==='u') state.input.roomOutlinePoints=[{xMm:0,yMm:0},{xMm:1500,yMm:0},{xMm:1500,yMm:1500},{xMm:3500,yMm:1500},{xMm:3500,yMm:0},{xMm:w,yMm:0},{xMm:w,yMm:h},{xMm:0,yMm:h}];
  if(type==='t') state.input.roomOutlinePoints=[{xMm:0,yMm:0},{xMm:w,yMm:0},{xMm:w,yMm:1200},{xMm:3400,yMm:1200},{xMm:3400,yMm:h},{xMm:1600,yMm:h},{xMm:1600,yMm:1200},{xMm:0,yMm:1200}];
  invalidate();render();
}
function addFreePoint(){
  const pts=state.input.roomOutlinePoints;
  const last=pts[pts.length-1]||{xMm:0,yMm:0};
  pts.push({xMm:last.xMm,yMm:last.yMm+500});
  invalidate();render();
}
function deleteFreePoint(index){state.input.roomOutlinePoints.splice(index,1);invalidate();render();}
function updateFreePoint(index,axis,value){const n=Number(value);state.input.roomOutlinePoints[index][axis]=Number.isFinite(n)?n:0;invalidate();}

function header(){return `<div class="shell"><header class="topbar"><div class="brand"><span class="brand-mark">S</span><span class="brand-copy"><strong>SpeedArti — CALPI</strong><small>Module métier · Démo V${E.VERSION}</small></span></div><span class="pill">Aucune donnée production</span></header><section class="card hero"><h1>Calepinage de sol</h1><p>Préparer la pose, les coupes et le réemploi des chutes. Aucun prix n'est calculé dans CALPI.</p></section><div class="progress">${steps.map((s,i)=>`<span class="${i===state.step?'active':''}">${i+1}. ${s}</span>`).join('')}</div>`;}
function actions(nextOk=true){return `<div class="actions"><button class="btn secondary" id="back" ${state.step===0?'disabled':''}>← Retour</button><button class="btn primary" id="next" ${nextOk?'':'disabled'}>${state.step===steps.length-1?'Recalculer':'Continuer →'}</button></div>`;}

function pageMaterial(){return `<section class="card panel"><h2>Quel matériau allez-vous poser ?</h2><p>Chaque famille dispose de 5 formats rapides plus une saisie manuelle.</p><div class="grid">${families.map(f=>`<button class="choice ${state.materialFamilyId===f.id?'selected':''}" data-family="${f.id}"><strong>${esc(f.label)}</strong><small>${esc(f.description)}</small></button>`).join('')}</div>${actions()}</section>`;}
function pagePattern(){return `<section class="card panel"><h2>Quel type de pose ?</h2><p>Les cycles 1/2 et 1/3 sont verrouillés par tests métier.</p><div class="grid">${patterns.map(([id,n,d])=>`<button class="choice ${state.input.pattern===id?'selected':''}" data-pattern="${id}"><strong>${n}</strong><small>${d}</small></button>`).join('')}<button class="choice disabled"><strong>Diagonale</strong><small>Phase suivante</small></button><button class="choice disabled"><strong>Chevron</strong><small>Phase suivante</small></button></div>${actions()}</section>`;}
function pageShape(){return `<section class="card panel"><h2>Quelle est la forme de la pièce ?</h2><p>Chaque forme active un calcul géométrique exact. Aucune approximation rectangle n'est utilisée.</p><div class="grid shape-grid">${shapes.map(([id,n,d])=>`<button class="choice ${state.input.roomShape===id?'selected':''}" data-shape="${id}"><strong>${n}</strong><small>${d}</small></button>`).join('')}<button class="choice disabled"><strong>Importer un plan</strong><small>Phase suivante</small></button></div>${actions()}</section>`;}

function rotationCards(){return `<div class="rotation-row">${[0,90,180,270].map(v=>`<button class="mini-choice ${state.input.shapeRotationDeg===v?'selected':''}" data-rotation="${v}">${v}°</button>`).join('')}</div>`;}
function baseRoomFields(){return `<div class="form-grid"><div class="field"><label>Largeur / axe X extérieur (mm)</label><input data-num="roomLengthMm" type="number" min="1" value="${state.input.roomLengthMm}"></div><div class="field"><label>Hauteur / axe Y extérieur (mm)</label><input data-num="roomWidthMm" type="number" min="1" value="${state.input.roomWidthMm}"></div></div>`;}

function shapeSpecificFields(){
  const s=state.input.roomShape,d=state.input.shapeDimensions;
  if(s==='rectangle') return `${baseRoomFields()}<h4>Rotation de la pièce</h4>${rotationCards()}`;
  if(s==='l_shape') return `${baseRoomFields()}<div class="form-grid shape-fields"><div class="field"><label>Largeur du décroché (mm)</label><input data-shape-num="cutoutWidthMm" type="number" min="1" value="${d.cutoutWidthMm||0}"></div><div class="field"><label>Hauteur du décroché (mm)</label><input data-shape-num="cutoutHeightMm" type="number" min="1" value="${d.cutoutHeightMm||0}"></div></div><h4>Orientation du L</h4>${rotationCards()}`;
  if(s==='u_shape') return `${baseRoomFields()}<div class="form-grid shape-fields"><div class="field"><label>Largeur de l'ouverture (mm)</label><input data-shape-num="openingWidthMm" type="number" min="1" value="${d.openingWidthMm||0}"></div><div class="field"><label>Profondeur de l'ouverture (mm)</label><input data-shape-num="openingDepthMm" type="number" min="1" value="${d.openingDepthMm||0}"></div><div class="field"><label>Décalage de l'ouverture depuis la gauche (mm)</label><input data-shape-num="openingOffsetMm" type="number" min="0" value="${d.openingOffsetMm||0}"></div></div><h4>Orientation du U</h4>${rotationCards()}`;
  if(s==='t_shape') return `${baseRoomFields()}<div class="form-grid shape-fields"><div class="field"><label>Épaisseur de la barre du T (mm)</label><input data-shape-num="barThicknessMm" type="number" min="1" value="${d.barThicknessMm||0}"></div><div class="field"><label>Largeur du pied du T (mm)</label><input data-shape-num="stemWidthMm" type="number" min="1" value="${d.stemWidthMm||0}"></div><div class="field"><label>Décalage du pied depuis la gauche (mm)</label><input data-shape-num="stemOffsetMm" type="number" min="0" value="${d.stemOffsetMm||0}"></div></div><h4>Orientation du T</h4>${rotationCards()}`;
  return freeEditor();
}

function freeEditor(){
  const pts=state.input.roomOutlinePoints;
  return `<div class="free-editor"><div class="free-toolbar"><div><strong>Contour libre orthogonal</strong><small>Les points sont reliés dans l'ordre. Le dernier point revient automatiquement au premier.</small></div><div class="free-actions"><button class="mini-choice" data-template="rectangle">Base rectangle</button><button class="mini-choice" data-template="l">Base L</button><button class="mini-choice" data-template="u">Base U</button><button class="mini-choice" data-template="t">Base T</button></div></div><div class="point-table">${pts.map((p,i)=>`<div class="point-row"><strong>P${i+1}</strong><label>X mm<input type="number" data-point-x="${i}" value="${p.xMm}"></label><label>Y mm<input type="number" data-point-y="${i}" value="${p.yMm}"></label><button class="point-delete" data-point-delete="${i}" ${pts.length<=4?'disabled':''}>×</button></div>`).join('')}</div><button class="btn secondary small-btn" id="add-point">+ Ajouter un point</button><p class="helper">Pour rester calculable, chaque segment doit être horizontal ou vertical. Les coordonnées sont exactes en millimètres.</p><h4>Rotation du contour</h4>${rotationCards()}</div>`;
}

function geometryPreview(){
  const g=E.buildRoomGeometry(E.normalizeInput(state.input));
  const blockers=g.controls.filter(c=>c.status==='BLOQUANT');
  if(!g.points||!g.points.length){return `<div class="shape-preview invalid"><strong>Géométrie incomplète</strong>${blockers.map(c=>`<span>${esc(c.tag)} · ${esc(c.message)}</span>`).join('')}</div>`;}
  const b=g.bounds||{widthMm:1,heightMm:1};
  const pad=40,vw=620,vh=Math.max(300,Math.min(480,620*(b.heightMm/Math.max(1,b.widthMm))));
  const sx=(vw-pad*2)/Math.max(1,b.widthMm), sy=(vh-pad*2)/Math.max(1,b.heightMm), s=Math.min(sx,sy);
  const pts=g.points.map(p=>`${pad+p.xMm*s},${pad+p.yMm*s}`).join(' ');
  return `<div class="shape-preview ${g.ok?'':'invalid'}"><div class="preview-head"><strong>Aperçu exact</strong><span>${g.ok?`${fmt(g.areaMm2/1000000)} m²`:'À corriger'}</span></div><svg viewBox="0 0 ${vw} ${vh}"><polygon points="${pts}" fill="#e8f1ff" stroke="#2563eb" stroke-width="3"/>${g.points.map((p,i)=>`<g><circle cx="${pad+p.xMm*s}" cy="${pad+p.yMm*s}" r="6" fill="#10213a"/><text x="${pad+p.xMm*s+9}" y="${pad+p.yMm*s-9}" font-size="12" fill="#10213a">P${i+1}</text></g>`).join('')}</svg>${blockers.length?`<div class="geometry-errors">${blockers.map(c=>`<div><strong>${esc(c.tag)}</strong> ${esc(c.message)}</div>`).join('')}</div>`:''}</div>`;
}

function pageDimensions(){
  const family=currentFamily();
  const cards=family.presets.map((p,i)=>`<button class="choice format-choice ${state.formatMode==='preset'&&state.selectedFormatId===p.id?'selected':''}" data-format="${p.id}"><strong>${p.lengthMm} × ${p.widthMm} mm</strong><small>Format ${i+1}</small></button>`).join('');
  const manual=`<button class="choice format-choice ${state.formatMode==='manual'?'selected':''}" data-format-manual="1"><strong>✏️ Dimensions manuelles</strong><small>Dimensions exactes du produit</small></button>`;
  const materialFields=state.formatMode==='manual'?`<div class="manual-box"><h3>Dimensions exactes du produit</h3><div class="form-grid"><div class="field"><label>Longueur élément (mm)</label><input data-num="materialLengthMm" type="number" min="1" value="${state.input.materialLengthMm}"></div><div class="field"><label>Largeur élément (mm)</label><input data-num="materialWidthMm" type="number" min="1" value="${state.input.materialWidthMm}"></div></div></div>`:`<div class="selected-format"><strong>Format sélectionné :</strong> ${state.input.materialLengthMm} × ${state.input.materialWidthMm} mm</div>`;
  const g=E.buildRoomGeometry(E.normalizeInput(state.input));
  const nextOk=g.ok&&state.input.materialLengthMm>0&&state.input.materialWidthMm>0;
  return `<section class="card panel"><h2>Dimensions et géométrie</h2><p>La géométrie doit être exacte avant de poursuivre vers le calcul.</p><div class="geometry-layout"><div><h3>${shapes.find(x=>x[0]===state.input.roomShape)?.[1]||'Forme'}</h3>${shapeSpecificFields()}</div>${geometryPreview()}</div><div class="section-divider"></div><h3>${esc(family.label)} — format du produit</h3><p class="helper">Choisissez un des 5 formats rapides ou passez en dimensions manuelles.</p><div class="grid format-grid">${cards}${manual}</div>${materialFields}<div class="form-grid joint-row"><div class="field"><label>Joint / espace entre éléments (mm)</label><input data-num="jointWidthMm" type="number" min="0" value="${state.input.jointWidthMm}"></div></div>${actions(nextOk)}</section>`;
}

function pageOptions(){return `<section class="card panel"><h2>Règles de pose et de réemploi</h2><p>Ces paramètres modifient directement le moteur.</p><h3>Sens de pose</h3><div class="grid"><button class="choice ${state.input.orientation==='lengthwise'?'selected':''}" data-orientation="lengthwise"><strong>Dans l'axe X</strong><small>Rangées parallèles à l'axe horizontal de la pièce</small></button><button class="choice ${state.input.orientation==='widthwise'?'selected':''}" data-orientation="widthwise"><strong>Dans l'axe Y</strong><small>Rangées parallèles à l'axe vertical de la pièce</small></button></div><h3>Rives</h3><div class="grid"><button class="choice ${state.input.edgeMode==='balanced'?'selected':''}" data-edge="balanced"><strong>Équilibrer</strong><small>Répartit une petite dernière rive entre début et fin</small></button><button class="choice ${state.input.edgeMode==='as_is'?'selected':''}" data-edge="as_is"><strong>Départ entier</strong><small>Conserve la première rive pleine</small></button></div><h3>Optimisation 2D des chutes</h3><div class="grid"><button class="choice ${state.input.allowOffcutRotation?'selected':''}" data-offcut-rotation="true"><strong>Autoriser rotation 90°</strong><small>CALPI peut tourner une chute si la pièce tient mieux dans son contour réel.</small></button><button class="choice ${!state.input.allowOffcutRotation?'selected':''}" data-offcut-rotation="false"><strong>Conserver le sens</strong><small>La chute reste dans son orientation d'origine. Recommandé pour les lames directionnelles.</small></button></div><div class="notice info-notice">Le moteur stocke maintenant les chutes complexes sous forme de régions 2D exactes. Une chute en L peut donc être réutilisée sans être assimilée à son rectangle englobant.</div><div class="form-grid" style="margin-top:14px"><div class="field"><label>Rive minimale (mm)</label><input data-num="minimumEdgeWidthMm" type="number" min="1" value="${state.input.minimumEdgeWidthMm}"></div><div class="field"><label>Chute mini réutilisable — longueur (mm)</label><input data-num="minimumReusableLengthMm" type="number" min="1" value="${state.input.minimumReusableLengthMm}"></div><div class="field"><label>Chute mini réutilisable — largeur (mm)</label><input data-num="minimumReusableWidthMm" type="number" min="1" value="${state.input.minimumReusableWidthMm}"></div></div>${actions()}</section>`;}

function planSvg(r){
  if(!r.roomPolygon||!r.roomPolygon.length)return '<div class="notice">Aucun plan : calcul bloqué.</div>';
  const b=r.roomBounds,pad=30,vw=900,vh=Math.max(380,Math.min(760,900*b.heightMm/Math.max(1,b.widthMm)));
  const sx=(vw-pad*2)/b.widthMm,sy=(vh-pad*2)/b.heightMm,s=Math.min(sx,sy);
  const poly=r.roomPolygon.map(p=>`${pad+p.xMm*s},${pad+p.yMm*s}`).join(' ');
  let shapes='';
  r.rows.forEach(row=>row.pieces.forEach(p=>{
    const fill=p.sourceType==='offcut'?'#bbf7d0':'#dbeafe';
    const cells=(p.roomCells&&p.roomCells.length)?p.roomCells:[{roomXmm:p.roomXmm,roomYmm:p.roomYmm,roomWidthMm:p.roomWidthMm,roomHeightMm:p.roomHeightMm}];
    cells.forEach(c=>{
      const x=pad+c.roomXmm*s,y=pad+c.roomYmm*s,w=Math.max(1,c.roomWidthMm*s),h=Math.max(1,c.roomHeightMm*s);
      shapes+=`<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${fill}" stroke="#6483a8" stroke-width=".7"/><title>${esc(p.pieceId)} · ${p.shapeType==='orthogonal'?'pièce avec encoche · ':''}${esc(p.sourceType==='offcut'?'réemploi '+p.sourceId:'neuf '+p.sourceId)}${p.sourceRotationDeg===90?' · chute tournée 90°':''}</title></g>`;
    });
  }));
  return `<svg class="plan-svg" viewBox="0 0 ${vw} ${vh}" role="img"><polygon points="${poly}" fill="#f8fbff" stroke="#10213a" stroke-width="3"/>${shapes}<polygon points="${poly}" fill="none" stroke="#10213a" stroke-width="3"/></svg>`;
}
function resultBody(r){
  if(state.tab==='plan')return `<div class="plan-wrap">${planSvg(r)}</div>`;
  if(state.tab==='sequence')return `<div class="sequence-list">${r.poseSequence.map(s=>`<div class="sequence"><strong>Étape ${s.step} · Rang ${s.row}</strong><br>${esc(s.action)} → pièce ${s.shapeType==='orthogonal'?'avec encoche':'rectangulaire'} ${fmt(s.lengthMm)} × ${fmt(s.widthMm)} mm${s.producedOffcutIds&&s.producedOffcutIds.length?` · conserver ${s.producedOffcutIds.join(', ')}`:''}</div>`).join('')}</div>`;
  if(state.tab==='offcuts')return `<div class="offcut-list">${r.offcuts&&r.offcuts.length?r.offcuts.map(o=>`<div class="offcut"><strong>${o.id}</strong> <span class="shape-badge ${o.shapeType==='orthogonal'?'complex':''}">${o.shapeType==='orthogonal'?'forme 2D':'rectangle'}</span><br>${fmt(o.lengthMm)} × ${fmt(o.widthMm)} mm englobant · ${(o.areaMm2/1000000).toFixed(3)} m² réel · ${o.status}${o.usedAt?` → réemploi rang ${o.usedAt.rowIndex+1}`:''}<br><small>${o.cells?o.cells.length:1} zone(s) rectangulaire(s) composent le contour exact</small></div>`).join(''):'Aucune chute.'}</div>`;
  return `<div class="control-list">${r.controls.map(c=>`<div class="control status-${c.status}"><strong>${c.tag} · ${c.status}</strong><br>${esc(c.message)}</div>`).join('')}</div>`;
}
function pageResult(){if(!state.result)state.result=E.calculate(state.input);const r=state.result,f=currentFamily();return `<section class="card panel"><h2>Résultat CALPI</h2><p>${esc(f.label)} · ${state.input.materialLengthMm} × ${state.input.materialWidthMm} mm · Moteur V${r.engineVersion} · statut global : <strong>${r.status}</strong></p>${r.status==='BLOQUANT'?'<div class="notice">Le moteur bloque volontairement la sortie finale : corrige les entrées signalées dans Contrôles.</div>':''}<div class="result-grid"><div><div class="tabs"><button class="tab ${state.tab==='plan'?'active':''}" data-tab="plan">Plan de pose</button><button class="tab ${state.tab==='sequence'?'active':''}" data-tab="sequence">Ordre de pose</button><button class="tab ${state.tab==='offcuts'?'active':''}" data-tab="offcuts">Stock de chutes 2D</button><button class="tab ${state.tab==='controls'?'active':''}" data-tab="controls">Contrôles</button></div>${resultBody(r)}</div><aside><div class="stats"><div class="stat"><strong>${r.roomAreaMm2?fmt(r.roomAreaMm2/1000000):0}</strong><span>surface pièce m²</span></div><div class="stat"><strong>${r.newElementsOpened||0}</strong><span>éléments neufs ouverts</span></div><div class="stat"><strong>${r.reusedOffcutCount||0}</strong><span>chutes réutilisées</span></div><div class="stat"><strong>${r.twoDReuseCount||0}</strong><span>réemplois 2D complexes</span></div><div class="stat"><strong>${r.complexOffcutsCreated||0}</strong><span>chutes 2D créées</span></div><div class="stat"><strong>${r.rotatedOffcutReuseCount||0}</strong><span>réemplois tournés 90°</span></div><div class="stat"><strong>${r.complexInstalledPieceCount||0}</strong><span>pièces avec encoche</span></div><div class="stat"><strong>${r.cutCount||0}</strong><span>segments de contour suivis</span></div></div><div class="notice success-notice"><strong>Optimisation 2D active.</strong><br>Les chutes irrégulières conservent leur géométrie exacte. CALPI vérifie qu'une future pièce tient réellement dans la matière disponible avant de la réutiliser.</div></aside></div>${actions()}</section>`;}

function body(){return [pageMaterial,pagePattern,pageShape,pageDimensions,pageOptions,pageResult][state.step]();}
function bind(){
  document.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>selectFamily(b.dataset.family));
  document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>selectPreset(b.dataset.format));
  document.querySelectorAll('[data-format-manual]').forEach(b=>b.onclick=()=>selectManual());
  document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>set('pattern',b.dataset.pattern));
  document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>selectShape(b.dataset.shape));
  document.querySelectorAll('[data-rotation]').forEach(b=>b.onclick=()=>set('shapeRotationDeg',Number(b.dataset.rotation)));
  document.querySelectorAll('[data-orientation]').forEach(b=>b.onclick=()=>set('orientation',b.dataset.orientation));
  document.querySelectorAll('[data-edge]').forEach(b=>b.onclick=()=>set('edgeMode',b.dataset.edge));
  document.querySelectorAll('[data-offcut-rotation]').forEach(b=>b.onclick=()=>set('allowOffcutRotation',b.dataset.offcutRotation==='true'));
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();});
  document.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>freeTemplate(b.dataset.template));
  document.querySelectorAll('[data-num]').forEach(i=>{i.onchange=()=>{num(i.dataset.num,i.value);render();};});
  document.querySelectorAll('[data-shape-num]').forEach(i=>{i.onchange=()=>{shapeNum(i.dataset.shapeNum,i.value);render();};});
  document.querySelectorAll('[data-point-x]').forEach(i=>{i.onchange=()=>{updateFreePoint(Number(i.dataset.pointX),'xMm',i.value);render();};});
  document.querySelectorAll('[data-point-y]').forEach(i=>{i.onchange=()=>{updateFreePoint(Number(i.dataset.pointY),'yMm',i.value);render();};});
  document.querySelectorAll('[data-point-delete]').forEach(b=>b.onclick=()=>deleteFreePoint(Number(b.dataset.pointDelete)));
  const add=document.getElementById('add-point');if(add)add.onclick=addFreePoint;
  const back=document.getElementById('back'),next=document.getElementById('next');
  if(back)back.onclick=()=>{if(state.step>0){state.step--;render();}};
  if(next)next.onclick=()=>{document.querySelectorAll('[data-num]').forEach(i=>num(i.dataset.num,i.value));document.querySelectorAll('[data-shape-num]').forEach(i=>shapeNum(i.dataset.shapeNum,i.value));if(state.step<steps.length-1)state.step++;else state.result=E.calculate(state.input);render();};
}
function render(){app.innerHTML=header()+body()+`<footer class="footer">SpeedArti CALPI · Démonstration autonome · moteur métier séparé de l'interface</footer></div>`;bind();}
render();
})();
