"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {MARS_LANDMARKS,MARS_TREK_URL} from '../content/marsLandmarks';
import {MARS_REGION,REGION_WORLD_BOUNDS as B,worldToMars,isSurveyedRegion} from '../game/marsRegion';
import {atlasBounds,atlasPoint,type AtlasBounds,type AtlasView} from '../game/marsAtlas';
import {moveAtlas,ATLAS_DRAG_THRESHOLD} from '../game/atlasGestures';
import {PLAYABLE_BOUNDS} from '../game/explorationBounds';
import {assetUrl} from '../lib/assetUrl';

/** Reuse the terrain's local NASA overview; no live tiles or second renderer. */
export default function MarsAtlas({x,z,selected,onSelect,onClose,storyTarget,storyRoute}:{x:number;z:number;selected:string;onSelect:(id:string)=>void;onClose:()=>void;storyTarget?:{label:string;x:number;z:number};storyRoute?:readonly {x:number;z:number}[]}){
 const [mapView,setMapView]=useState<AtlasView>('region');
 const [viewport,setViewport]=useState<AtlasBounds|null>(null);
 const [detail,setDetail]=useState<string|null>(null);
 const pointers=useRef(new Map<number,{x:number;y:number}>());
 const gesture=useRef({x:0,y:0,distance:0,startX:0,startY:0,moved:false,lastTap:0});
 const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const bounds=viewport??atlasBounds(mapView,x,z),width=bounds.east-bounds.west,height=bounds.south-bounds.north;
 const boundsRef=useRef(bounds);
 useEffect(()=>{boundsRef.current=bounds;},[bounds]);
 const clearHold=()=>{if(holdTimer.current!==null){clearTimeout(holdTimer.current);holdTimer.current=null;}};
 useEffect(()=>()=>{if(holdTimer.current!==null)clearTimeout(holdTimer.current);},[]);
 const chooseView=(view:AtlasView)=>{setMapView(view);setViewport(null);setDetail(null);};
 const selectAt=(clientX:number,clientY:number,element:HTMLElement,showDetail:boolean)=>{
  const rect=element.getBoundingClientRect(),b=boundsRef.current;
  let nearest:typeof MARS_LANDMARKS[number]|undefined,best=34;
  for(const landmark of MARS_LANDMARKS){
   const point=atlasPoint(landmark.x,landmark.z,b);
   const distance=Math.hypot(clientX-rect.left-point.left*rect.width/100,clientY-rect.top-point.top*rect.height/100);
   if(point.visible&&distance<best){best=distance;nearest=landmark;}
  }
  if(nearest){onSelect(nearest.id);if(showDetail){setDetail(nearest.id);navigator.vibrate?.(12);}}
 };
 const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.button!==0)return;
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);
  pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  clearHold();
  const points=[...pointers.current.values()],a=points[0],b=points[1];
  gesture.current={...gesture.current,x:b?(a.x+b.x)/2:a.x,y:b?(a.y+b.y)/2:a.y,distance:b?Math.hypot(a.x-b.x,a.y-b.y):0,startX:a.x,startY:a.y,moved:points.length>1};
  if(points.length===1){const target=event.currentTarget,cx=event.clientX,cy=event.clientY;holdTimer.current=setTimeout(()=>{gesture.current.moved=true;selectAt(cx,cy,target,true);},550);}
 };
 const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(!pointers.current.has(event.pointerId))return;
  event.preventDefault();pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const points=[...pointers.current.values()],a=points[0],b=points[1],g=gesture.current;
  const cx=b?(a.x+b.x)/2:a.x,cy=b?(a.y+b.y)/2:a.y,distance=b?Math.hypot(a.x-b.x,a.y-b.y):0;
  if(!g.moved&&Math.hypot(cx-g.startX,cy-g.startY)<ATLAS_DRAG_THRESHOLD)return;
  clearHold();g.moved=true;
  const rect=event.currentTarget.getBoundingClientRect(),current=boundsRef.current;
  const next=moveAtlas(current,B,-(cx-g.x)/rect.width*(current.east-current.west),-(cy-g.y)/rect.height*(current.south-current.north),b&&g.distance>0?distance/g.distance:1,(cx-rect.left)/rect.width,(cy-rect.top)/rect.height);
  boundsRef.current=next;setViewport(next);g.x=cx;g.y=cy;g.distance=distance;
 };
 const pointerEnd=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;clearHold();
  if(event.type==='pointerup'&&!g.moved&&performance.now()-g.lastTap>250){selectAt(event.clientX,event.clientY,event.currentTarget,false);g.lastTap=performance.now();}
  pointers.current.delete(event.pointerId);
  if(pointers.current.size){const remaining=[...pointers.current.values()][0];g.x=remaining.x;g.y=remaining.y;g.distance=0;g.moved=true;}
 };
 const selectedDetail=MARS_LANDMARKS.find(p=>p.id===detail);
 const you=atlasPoint(x,z,bounds),coordinates=worldToMars(x,z);
 const objective=storyTarget?atlasPoint(storyTarget.x,storyTarget.z,bounds):null;
 const scaleMetres=mapView==='region'?500:200;
 return <>
  <h2 id="roam-dialog-title">Your Mars Trek field map</h2>
  <button onClick={onClose}>Continue exploring</button>
  <p className="roam-atlas-source">NASA MOLA elevation · {MARS_REGION.scaleLabel}</p>
  <div className="roam-atlas-views" role="group" aria-label="Map view">
   <button aria-pressed={mapView==='region'} onClick={()=>chooseView('region')}>Full Mars Trek region</button>
   <button aria-pressed={mapView==='nearby'} onClick={()=>chooseView('nearby')}>Nearby view</button>
  </div>
  <div className="roam-atlas-zoom" role="group" aria-label="Map zoom">
   <button aria-label="Zoom in" onClick={()=>setViewport(moveAtlas(bounds,B,0,0,1.5))}>＋</button>
   <button aria-label="Zoom out" onClick={()=>setViewport(moveAtlas(bounds,B,0,0,1/1.5))}>−</button>
   <span>Drag to pan · Pinch to zoom · Tap a marker · Hold for details</span>
  </div>
  <div className="roam-atlas-layout">
   <div>
    <div className="roam-atlas-plot" data-view={mapView} style={{aspectRatio:width/height}} tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onContextMenu={event=>event.preventDefault()} onKeyDown={event=>{const step=width*.1;const directions:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};const delta=directions[event.key];if(delta){event.preventDefault();setViewport(moveAtlas(bounds,B,...delta));}else if(event.key==='+'||event.key==='-'){event.preventDefault();setViewport(moveAtlas(bounds,B,0,0,event.key==='+'?1.5:1/1.5));}}} role="region" aria-label={`North-up NASA MOLA elevation map. ${mapView==='region'?'Full region from your Mars Trek link.':'Nearby terrain centred on the explorer.'} Choose a landmark from the list to highlight its position.`}>
     <svg viewBox={`${bounds.west} ${bounds.north} ${width} ${height}`} aria-hidden="true">
      <image href={assetUrl('art/mars-mola-overview.webp')} x={B.west} y={B.north} width={B.east-B.west} height={B.south-B.north} preserveAspectRatio="none"/>
      <rect x={PLAYABLE_BOUNDS.west} y={PLAYABLE_BOUNDS.north} width={PLAYABLE_BOUNDS.east-PLAYABLE_BOUNDS.west} height={PLAYABLE_BOUNDS.south-PLAYABLE_BOUNDS.north} fill="none" stroke="#e5f7ff" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke"/>
      {storyRoute&&<polyline points={storyRoute.map(point=>`${point.x},${point.z}`).join(' ')} fill="none" stroke="#ffcf77" strokeWidth="3" strokeDasharray="8 4" vectorEffect="non-scaling-stroke"/>}
     </svg>
     <span className="roam-atlas-north">N ↑</span>
     {MARS_LANDMARKS.map(p=>{
      const point=atlasPoint(p.x,p.z,bounds);
      return point.visible&&<span key={p.id} className="roam-atlas-pin" data-selected={selected===p.id} style={{left:`${point.left}%`,top:`${point.top}%`}} aria-hidden="true">
       {mapView==='nearby'||selected===p.id?p.number:''}{selected===p.id&&<b>{p.name}</b>}
      </span>;
     })}
     {you.visible&&<span className="roam-atlas-you" style={{left:`${you.left}%`,top:`${you.top}%`}} aria-hidden="true">You</span>}
     {objective?.visible&&storyTarget&&<span className="roam-atlas-pin" data-selected="true" style={{left:`${objective.left}%`,top:`${objective.top}%`}} aria-hidden="true">!<b>{storyTarget.label}</b></span>}
     <span className="roam-atlas-scale"><i style={{width:`${scaleMetres/width*100}%`}}/>{scaleMetres} game m ≈ {(scaleMetres*MARS_REGION.realKmPerGameMetre).toLocaleString('en-US')} km on Mars</span>
    </div>
    {selectedDetail&&<aside className="roam-atlas-detail" role="status"><b>{selectedDetail.name}</b><p>{selectedDetail.description}</p><button onClick={()=>setDetail(null)}>Close details</button></aside>}
    <p className="roam-atlas-extent">{mapView==='region'?`${MARS_REGION.west.toFixed(2)}°–${MARS_REGION.east.toFixed(2)}° E · ${MARS_REGION.south.toFixed(2)}° to ${MARS_REGION.north.toFixed(2)}° latitude`:'Nearby view follows your position. Mountain barriers mark the edge of the playable region.'}</p>
   </div>
   <ol className="roam-atlas-list">{MARS_LANDMARKS.map(p=><li key={p.id}>
    <button aria-pressed={selected===p.id} onClick={()=>onSelect(p.id)}>{p.number}. {p.name}<span>{Math.round(Math.hypot(p.x-x,p.z-z))} game m · {p.kind}</span></button>
    {selected===p.id&&<p>{p.description} <a href={p.source} target="_blank" rel="noreferrer">{p.sourceLabel} ↗</a></p>}
   </li>)}</ol>
  </div>
  <p>{isSurveyedRegion(x,z)?`${Math.abs(coordinates.latitude).toFixed(2)}° ${coordinates.latitude<0?'S':'N'} · ${coordinates.longitude.toFixed(2)}° E`:'Edge of the surveyed region'}. Select a landmark to highlight its bearing on your minimap.</p>
  {storyTarget&&<p>Story destination: {storyTarget.label} · {Math.round(Math.hypot(storyTarget.x-x,storyTarget.z-z))} game m. The ! marker identifies your station; the dashed gold line shows your chosen fictional expedition route.</p>}
  <p>The dashed line marks the playable mountain boundary. The ground, this map and the rover map share the same NASA elevation crop. This shaded-relief map shows measured heights, not satellite photography. Journeys are shortened and relief exaggerated; close-up rocks, sand, the landing site and the impassable perimeter mountains are artistic additions.</p>
  <p className="roam-atlas-keys">Keyboard: arrows pan · +/− zoom · Caps Lock or Esc closes the map.</p>
  <a href={MARS_TREK_URL} target="_blank" rel="noreferrer">Open your original region in NASA Mars Trek ↗</a>
 </>;
}
