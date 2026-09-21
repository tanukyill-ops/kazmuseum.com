import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, LocateFixed, Maximize, Scan, Navigation, Box, ArrowUpRight } from 'lucide-react';
import type { MuseumObject, Lang } from '../types';
import { categories, categoryColors, words } from '../i18n';
import { publicPath } from '../publicPath';

const bounds:L.LatLngBoundsExpression = [[40.4, 46.4], [55.5, 87.4]];
setWorkerUrl(workerUrl);
function fitCountry(m:L.Map,animate=false){const mobile=window.innerWidth<768;m.fitBounds(bounds,{paddingTopLeft:mobile?[42,75]:[45,100],paddingBottomRight:mobile?[18,25]:[35,115],animate})}
const symbols = {
  mausoleum:'<path d="M5 20h14V10H5v10ZM8 10a4 4 0 0 1 8 0M12 2v3M10 20v-5h4v5M3 20h18"/>',
  archaeology:'<path d="M4 21V9h5v12M15 21V9h5v12M3 9l9-6 9 6H3ZM2 21h20M12 12v9"/>',
  architecture:'<path d="M9 21 10 9m4 0 1 12M8 21h8M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM8 13h8"/>',
  nature:'<path d="m2 20 7-14 5 8 3-5 5 11H2ZM6 12l3 2 3-2"/>',
};
export default function MuseumMap({objects, selected, hovered, lang, onSelect, userLocation, route, locationRequest, resetKey, compass, on3D, catalogueOpen}: {
  objects:MuseumObject[]; selected:MuseumObject|null; hovered:string|null; lang:Lang;
  onSelect:(o:MuseumObject)=>void; userLocation:[number,number]|null; route:MuseumObject[];
  locationRequest:()=>void; resetKey:number; compass:boolean; on3D:()=>void; catalogueOpen:boolean;
}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null), group=useRef<L.MarkerClusterGroup|null>(null);
  const markers=useRef<Map<string,L.Marker>>(new Map());
  const selectRef=useRef(onSelect); selectRef.current=onSelect;
  const [tileFailed,setTileFailed]=useState(false);
  const t=words[lang];
  useEffect(()=>{
    if(!host.current)return;
    const m=L.map(host.current,{zoomControl:false,attributionControl:true,minZoom:2.5,maxZoom:18,worldCopyJump:true,zoomSnap:.25});fitCountry(m);map.current=m;
    let vector:ReturnType<typeof maplibreGL>|undefined;
    try{
      vector=maplibreGL({style:publicPath('/data/map-style.json'),interactive:false}).addTo(m);
      m.attributionControl.addAttribution('<a href="https://openfreemap.org">OpenFreeMap</a> · <a href="https://openmaptiles.org">OpenMapTiles</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
      vector.getMaplibreMap().on('error',()=>setTileFailed(true));
      vector.getMaplibreMap().on('idle',()=>setTileFailed(false));
    }catch{setTileFailed(true)}
    L.control.scale({position:'bottomleft',imperial:false}).addTo(m);
    group.current=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:46,spiderfyOnMaxZoom:true,zoomToBoundsOnClick:true,disableClusteringAtZoom:14,iconCreateFunction:(cluster)=>L.divIcon({html:`<span>${cluster.getChildCount()}</span>`,className:'museum-cluster',iconSize:[43,43]})});
    m.addLayer(group.current);
    const abort=new AbortController();
    fetch(publicPath('/data/kazakhstan.geojson'),{signal:abort.signal}).then(r=>r.json()).then(geo=>{
      if(!map.current)return;
      L.geoJSON(geo,{style:{color:'#9aab7e',weight:1.5,dashArray:'5 6',fillColor:'#e6eace',fillOpacity:.25},interactive:false}).addTo(m).bringToBack();
    }).catch(()=>{});
    const ro=new ResizeObserver(()=>m.invalidateSize());ro.observe(host.current);
    return()=>{abort.abort();ro.disconnect();m.remove();map.current=null;group.current=null;};
  },[]);
  useEffect(()=>{
    const g=group.current;if(!g)return;g.clearLayers();markers.current.clear();
    objects.forEach(o=>{
      const icon=L.divIcon({html:`<span class="marker-pin" style="--pin-color:${categoryColors[o.category]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${symbols[o.category]}</svg></span>`,className:`museum-marker ${selected?.id===o.id?'is-selected':''}`,iconSize:[44,50],iconAnchor:[22,47]});
      const el=document.createElement('span');el.textContent=o.title[lang];
      const marker=L.marker(o.coordinates,{icon,title:o.title[lang],alt:o.title[lang]}).bindTooltip(el,{direction:'top',offset:[0,-42],className:'museum-tooltip'}).on('click',()=>selectRef.current(o));
      g.addLayer(marker);markers.current.set(o.id,marker);
    });
  },[objects,lang,selected?.id]);
  useEffect(()=>{
    host.current?.querySelectorAll('.is-hovered').forEach(el=>el.classList.remove('is-hovered'));
    markers.current.forEach((marker,id)=>{const visible=group.current?.getVisibleParent(marker);if(id===hovered){visible?.getElement()?.classList.add('is-hovered');marker.openTooltip()}else marker.closeTooltip();});
  },[hovered]);
  useEffect(()=>{
    const handle=setTimeout(()=>{const m=map.current;if(!m||!selected)return;m.invalidateSize();const z=Math.max(m.getZoom(),8);const point=m.project(selected.coordinates,z);point.y+=window.innerWidth<768?150:80;m.flyTo(m.unproject(point,z),z,{duration:.7});},100);return()=>clearTimeout(handle);
  },[selected?.id]);
  useEffect(()=>{if(map.current)fitCountry(map.current,true)},[resetKey]);
  useEffect(()=>{const handle=setTimeout(()=>{if(map.current){map.current.invalidateSize();if(!selected)fitCountry(map.current,true)}},300);return()=>clearTimeout(handle)},[catalogueOpen]);
  useEffect(()=>{
    const m=map.current;if(!m||!userLocation)return;
    const point=L.circleMarker(userLocation,{radius:8,color:'#fff',weight:3,fillColor:'#269ac4',fillOpacity:1}).addTo(m);
    m.flyTo(userLocation,8);return()=>{point.remove()};
  },[userLocation]);
  useEffect(()=>{
    const m=map.current;if(!m||route.length<2)return;
    const line=L.polyline(route.map(o=>o.coordinates),{color:'#287a6a',weight:3,dashArray:'8 9',opacity:.8}).addTo(m);
    return()=>{line.remove()};
  },[route]);
  useEffect(()=>{
    const m=map.current;if(!m)return;
    const labels=L.layerGroup().addTo(m);
    const cities:[number,number,string,string,string][]=[
      [51.15,71.44,'Астана','Астана','Astana'],[43.22,76.85,'Алматы','Алматы','Almaty'],[43.30,68.25,'Түркістан','Туркестан','Turkistan'],[42.89,71.37,'Тараз','Тараз','Taraz'],[43.65,51.19,'Ақтау','Актау','Aktau'],[50.28,57.17,'Ақтөбе','Актобе','Aktobe'],[49.8,73.1,'Қарағанды','Караганда','Karaganda'],[50.42,80.25,'Семей','Семей','Semey'],[52.29,76.96,'Павлодар','Павлодар','Pavlodar'],[45.0,65.5,'Қызылорда','Кызылорда','Kyzylorda'],[47.1,51.9,'Атырау','Атырау','Atyrau']];
    const idx=lang==='kk'?2:lang==='ru'?3:4;
    cities.forEach(c=>L.marker([c[0],c[1]],{interactive:false,icon:L.divIcon({className:'city-label',html:`<i></i>${c[idx]}`,iconSize:[90,20],iconAnchor:[-9,-9]})}).addTo(labels));
    L.marker([48.5,66],{interactive:false,icon:L.divIcon({className:'country-label',html:lang==='kk'?'Қ А З А Қ С Т А Н':lang==='ru'?'К А З А Х С Т А Н':'K A Z A K H S T A N',iconSize:[260,30]})}).addTo(labels);
    return()=>{labels.remove()};
  },[lang]);
  const full=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});};
  return <section className="map-stage" aria-label={t.mapTitle}>
    <div ref={host} className="map-canvas" data-testid="museum-map" />
    <div className="map-heading"><span className="eyebrow"><i/>{t.discover}</span><h1>{t.mapTitle}<span>.</span></h1><p>{t.mapSub}</p></div>
    <div className="map-control-stack">
      <button title={t.home} aria-label={t.home} onClick={()=>{if(map.current)fitCountry(map.current,true)}}><Scan size={20}/></button>
      <span className="control-divider"/>
      <button title={t.zoomIn} aria-label={t.zoomIn} onClick={()=>map.current?.zoomIn()}><Plus size={21}/></button>
      <button title={t.zoomOut} aria-label={t.zoomOut} onClick={()=>map.current?.zoomOut()}><Minus size={21}/></button>
      <span className="control-divider"/>
      <button title={t.location} aria-label={t.location} onClick={locationRequest}><LocateFixed size={19}/></button>
      <button title={t.fullscreen} aria-label={t.fullscreen} onClick={full}><Maximize size={18}/></button>
    </div>
    {compass&&<div className="map-compass" title={t.north}><span>N</span><Navigation size={23}/></div>}
    {!selected&&<div className="map-promo"><div className="promo-cube"><Box size={28}/></div><div><span className="eyebrow">360° · 3D · VR</span><h3>{t.heroTitle}</h3><p>{t.heroText}</p></div><button onClick={on3D} aria-label={t.explore}><ArrowUpRight size={23}/></button></div>}
    <div className="map-legend">{Object.entries(categories).map(([key,v])=><span key={key}><i style={{background:categoryColors[key as keyof typeof categoryColors]}}/>{v[lang]}</span>)}</div>
    {tileFailed&&<span className="map-offline">{lang==='kk'?'Карта фоны жүктелмеді. Нысандар қолжетімді.':lang==='ru'?'Фон карты недоступен. Объекты работают.':'Map background unavailable. Landmarks remain accessible.'}</span>}
  </section>
}
