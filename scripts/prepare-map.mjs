import {readFile,writeFile} from 'node:fs/promises';
const style=JSON.parse(await readFile('public/data/map-style.json','utf8'));
style.name='Qazaqstan Heritage';
style.layers=style.layers.filter(l=>l.type!=='symbol');
for(const layer of style.layers){
  if(layer.type==='background')layer.paint['background-color']='#edf0e2';
  if(layer.type==='fill'&&layer.id.includes('water'))layer.paint['fill-color']='#c7d8cf';
  else if(layer.type==='fill'&&/park|wood|landcover|landuse/.test(layer.id))layer.paint['fill-color']='#dce4cd';
  if(layer.type==='line'&&/boundary/.test(layer.id))layer.paint['line-color']='#b0b59e';
}
await writeFile('public/data/map-style.json',JSON.stringify(style));
console.log(`Prepared ${style.layers.length} OSM map layers; labels supplied by localized museum UI.`);
