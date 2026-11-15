"use client";
import {useState} from 'react';
import {MARS_LANDMARKS,MARS_TREK_URL} from '../content/marsLandmarks';
import {MARS_REGION,REGION_WORLD_BOUNDS as B,worldToMars,isSurveyedRegion} from '../game/marsRegion';
import {atlasBounds,atlasPoint,type AtlasView} from '../game/marsAtlas';
import {PLAYABLE_BOUNDS} from '../game/explorationBounds';
import {assetUrl} from '../lib/assetUrl';

/** Reuse the terrain's local NASA overview; no live tiles or second renderer. */
export default function MarsAtlas({x,z,selected,onSelect,onClose,storyTarget,storyRoute}:{x:number;z:number;selected:string;onSelect:(id:string)=>void;onClose:()=>void;storyTarget?:{label:string;x:number;z:number};storyRoute?:readonly {x:number;z:number}[]}){
 const [mapView,setMapView]=useState<AtlasView>('region');
 const bounds=atlasBounds(mapView,x,z),width=bounds.east-bounds.west,height=bounds.south-bounds.north;
 const you=atlasPoint(x,z,bounds),coordinates=worldToMars(x,z);
 const objective=storyTarget?atlasPoint(storyTarget.x,storyTarget.z,bounds):null;
 const scaleMetres=mapView==='region'?500:200;
 return <>
  <h2 id="roam-dialog-title">Your Mars Trek field map</h2>
  <button onClick={onClose}>Continue exploring</button>
  <p className="roam-atlas-source">NASA MOLA elevation · {MARS_REGION.scaleLabel}</p>
  <div className="roam-atlas-views" role="group" aria-label="Map view">
   <button aria-pressed={mapView==='region'} onClick={()=>setMapView('region')}>Full Mars Trek region</button>
   <button aria-pressed={mapView==='nearby'} onClick={()=>setMapView('nearby')}>Nearby view</button>
  </div>
  <div className="roam-atlas-layout">
   <div>
    <div className="roam-atlas-plot" data-view={mapView} style={{aspectRatio:width/height}} role="img" aria-label={`North-up NASA MOLA elevation map. ${mapView==='region'?'Full region from your Mars Trek link.':'Nearby terrain centred on the explorer.'} Choose a landmark from the list to highlight its position.`}>
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
  <p className="roam-atlas-keys">Caps Lock opens or closes the map · Esc closes it.</p>
  <a href={MARS_TREK_URL} target="_blank" rel="noreferrer">Open your original region in NASA Mars Trek ↗</a>
 </>;
}
