const assert = require('assert');
const Engine = require('./engine.js');
const Formats = require('./formats.js');
function base(overrides={}){return {materialType:'parquet',materialLengthMm:1380,materialWidthMm:190,jointWidthMm:0,roomLengthMm:5000,roomWidthMm:4000,roomShape:'rectangle',orientation:'lengthwise',pattern:'straight',edgeMode:'balanced',minimumEdgeWidthMm:80,minimumReusableLengthMm:300,minimumReusableWidthMm:80,...overrides};}
const families=Formats.listFamilies();
assert.strictEqual(families.length,8);
families.forEach(f=>{assert.strictEqual(f.presets.length,5,`${f.id} doit avoir 5 formats`);const ids=new Set();f.presets.forEach(p=>{assert.ok(p.lengthMm>0&&p.widthMm>0);assert.ok(!ids.has(p.id));ids.add(p.id);});});
assert.strictEqual(Formats.getFamily('parquet_massif').engineMaterialType,'parquet');
assert.strictEqual(Formats.getFamily('parquet_engineered').engineMaterialType,'parquet');
let r=Engine.calculate(base());assert.notStrictEqual(r.status,'BLOQUANT');assert.ok(r.rows.length>0);assert.ok(r.poseSequence.length>0);assert.ok(r.controls.some(c=>c.tag==='CALPI-040'));
r=Engine.calculate(base({pattern:'half'}));const h=r.rows.slice(0,6).map(x=>Math.round(x.starterLengthMm));assert.deepStrictEqual(h,[1380,690,1380,690,1380,690]);assert.strictEqual(new Set(h).size,2);
r=Engine.calculate(base({pattern:'third'}));const t=r.rows.slice(0,6).map(x=>Math.round(x.starterLengthMm));assert.deepStrictEqual(t,[1380,920,460,1380,920,460]);assert.strictEqual(new Set(t).size,3);
r=Engine.calculate(base({roomWidthMm:3900,edgeMode:'balanced',minimumEdgeWidthMm:100}));assert.ok(r.firstRowWidthMm>0&&r.lastRowWidthMm>0);
r=Engine.calculate(base({roomLengthMm:0}));assert.strictEqual(r.status,'BLOQUANT');
r=Engine.calculate(base({roomShape:'L'}));assert.strictEqual(r.status,'BLOQUANT');
r=Engine.calculate(base({orientation:'widthwise'}));assert.strictEqual(r.axes.runLengthMm,4000);assert.strictEqual(r.axes.fieldWidthMm,5000);const used=r.offcuts.filter(o=>o.status==='used').map(o=>o.id);assert.strictEqual(new Set(used).size,used.length);
console.log('CALPI tests V0.1.2: OK');
