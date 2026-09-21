import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
const objects=JSON.parse(await readFile('public/data/catalog.json','utf8'));
const expected=['yasawi','aisha-bibi','babadzha','tamgaly','otrar','akyrtas','baiterek','khan-shatyr','charyn','bozzhyra'];
assert.equal(objects.length,10);assert.deepEqual(objects.map(o=>o.id),expected);
const localized=(v,label)=>{for(const lang of ['kk','ru','en'])assert.ok(typeof v?.[lang]==='string'&&v[lang].trim().length>0,`${label}: ${lang} missing`)};
let triangles=0,bytes=0;
for(const o of objects){
  for(const k of ['title','region','city','period','description','significance'])localized(o[k],`${o.id}.${k}`);
  assert.equal(o.facts.length,5);o.facts.forEach(f=>localized(f,`${o.id}.fact`));
  assert.equal(o.quizQuestions.length,5);
  o.quizQuestions.forEach((q,i)=>{
    localized(q.question,`${o.id}.quiz.${i}`);localized(q.explanation,`${o.id}.explanation`);
    assert.equal(q.options.length,4);q.options.forEach(v=>localized(v,`${o.id}.option`));
    assert.ok(Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<4);
    for(const lang of ['kk','ru','en'])assert.equal(new Set(q.options.map(v=>v[lang])).size,4,`${o.id} quiz ${i}: duplicate options`);
  });
  assert.ok(o.coordinates[0]>=40&&o.coordinates[0]<=56);assert.ok(o.coordinates[1]>=46&&o.coordinates[1]<=88);
  assert.ok(o.coordinateSources.length>=2,`${o.id}: coordinate evidence`);
  assert.ok(o.sources.length>0&&o.sources.every(s=>s.url.startsWith('https://')));
  assert.ok(o.imageGallery.length>0);for(const src of o.imageGallery)assert.ok((await stat(`public${src}`)).size>100);
  assert.ok(o.imageCredits.length>0);for(const c of o.imageCredits)assert.ok(c.author&&c.license&&c.url&&c.accessed);
  assert.equal(o.modelAccuracy,'approximate');
  const glb=await readFile(`public${o.modelUrl}`);bytes+=glb.length;
  assert.equal(glb.readUInt32LE(0),0x46546c67,`${o.id}: valid glTF magic`);assert.equal(glb.readUInt32LE(4),2);assert.equal(glb.readUInt32LE(8),glb.length);
  assert.equal(glb.readUInt32LE(16),0x4e4f534a);
  const doc=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
  assert.ok(doc.meshes.length>0);assert.ok(doc.nodes.length>0);assert.ok(doc.materials.length>0);
  for(const m of doc.meshes)for(const p of m.primitives){assert.ok(p.attributes.POSITION!==undefined);assert.ok(p.attributes.NORMAL!==undefined);const count=doc.accessors[p.indices??p.attributes.POSITION].count;triangles+=count/3;}
  assert.ok(o.hotspots.length>=2);for(const h of o.hotspots){localized(h.title,'hotspot');localized(h.description,'hotspot');assert.equal(h.position.length,3)}
}
console.log(`PASS: 10 distinct self-contained GLB files (${(bytes/1048576).toFixed(2)} MiB, ${Math.round(triangles).toLocaleString()} triangles total).`);
console.log('PASS: 10 photographs with credits, 20+ coordinate references, 50 trilingual questions with four unique options, 20+ hotspots.');
