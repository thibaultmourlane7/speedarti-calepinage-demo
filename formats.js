(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalpiFormats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.1.2';
  const FAMILIES = Object.freeze([
    {id:'parquet_massif',engineMaterialType:'parquet',label:'Parquet massif',description:'Lames bois massif',presets:[
      {id:'massif-400x90',lengthMm:400,widthMm:90},{id:'massif-500x90',lengthMm:500,widthMm:90},{id:'massif-600x120',lengthMm:600,widthMm:120},{id:'massif-1000x140',lengthMm:1000,widthMm:140},{id:'massif-2000x180',lengthMm:2000,widthMm:180}]},
    {id:'parquet_engineered',engineMaterialType:'parquet',label:'Parquet contrecollé',description:'Lames multicouches',presets:[
      {id:'contrecolle-1092x130',lengthMm:1092,widthMm:130},{id:'contrecolle-1180x140',lengthMm:1180,widthMm:140},{id:'contrecolle-1900x190',lengthMm:1900,widthMm:190},{id:'contrecolle-2200x180',lengthMm:2200,widthMm:180},{id:'contrecolle-2200x220',lengthMm:2200,widthMm:220}]},
    {id:'stratified',engineMaterialType:'stratified',label:'Stratifié',description:'Lames clipsables',presets:[
      {id:'strat-1285x192',lengthMm:1285,widthMm:192},{id:'strat-1292x193',lengthMm:1292,widthMm:193},{id:'strat-1380x193',lengthMm:1380,widthMm:193},{id:'strat-1380x244',lengthMm:1380,widthMm:244},{id:'strat-2200x243',lengthMm:2200,widthMm:243}]},
    {id:'tile',engineMaterialType:'tile',label:'Carrelage',description:'Carreaux avec joints',presets:[
      {id:'tile-300x300',lengthMm:300,widthMm:300},{id:'tile-450x450',lengthMm:450,widthMm:450},{id:'tile-600x600',lengthMm:600,widthMm:600},{id:'tile-600x300',lengthMm:600,widthMm:300},{id:'tile-1200x200',lengthMm:1200,widthMm:200}]},
    {id:'pvc_plank',engineMaterialType:'pvc_plank',label:'Lame PVC',description:'Clipsable ou collée',presets:[
      {id:'pvc-lame-1220x180',lengthMm:1220,widthMm:180},{id:'pvc-lame-1220x230',lengthMm:1220,widthMm:230},{id:'pvc-lame-1250x180',lengthMm:1250,widthMm:180},{id:'pvc-lame-1520x230',lengthMm:1520,widthMm:230},{id:'pvc-lame-1800x230',lengthMm:1800,widthMm:230}]},
    {id:'pvc_tile',engineMaterialType:'pvc_tile',label:'Dalle PVC',description:'Format dalle',presets:[
      {id:'pvc-dalle-305x305',lengthMm:305,widthMm:305},{id:'pvc-dalle-457x457',lengthMm:457,widthMm:457},{id:'pvc-dalle-610x305',lengthMm:610,widthMm:305},{id:'pvc-dalle-610x610',lengthMm:610,widthMm:610},{id:'pvc-dalle-914x457',lengthMm:914,widthMm:457}]},
    {id:'terrace_tile',engineMaterialType:'terrace_tile',label:'Dalle terrasse',description:'Dalles extérieures',presets:[
      {id:'terrasse-dalle-300x300',lengthMm:300,widthMm:300},{id:'terrasse-dalle-400x400',lengthMm:400,widthMm:400},{id:'terrasse-dalle-500x500',lengthMm:500,widthMm:500},{id:'terrasse-dalle-600x600',lengthMm:600,widthMm:600},{id:'terrasse-dalle-1000x500',lengthMm:1000,widthMm:500}]},
    {id:'terrace_plank',engineMaterialType:'terrace_plank',label:'Lame terrasse',description:'Bois ou composite',presets:[
      {id:'terrasse-lame-2000x120',lengthMm:2000,widthMm:120},{id:'terrasse-lame-2400x145',lengthMm:2400,widthMm:145},{id:'terrasse-lame-3000x145',lengthMm:3000,widthMm:145},{id:'terrasse-lame-3600x145',lengthMm:3600,widthMm:145},{id:'terrasse-lame-4000x145',lengthMm:4000,widthMm:145}]}
  ]);
  function listFamilies(){return FAMILIES.map(f=>({...f,presets:f.presets.map(p=>({...p}))}));}
  function getFamily(id){const f=FAMILIES.find(x=>x.id===id);return f?{...f,presets:f.presets.map(p=>({...p}))}:null;}
  function getPreset(familyId,presetId){const f=FAMILIES.find(x=>x.id===familyId);if(!f)return null;const p=f.presets.find(x=>x.id===presetId);return p?{...p}:null;}
  return {VERSION,listFamilies,getFamily,getPreset};
});
