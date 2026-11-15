"use client";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ElysiumWorldBridge } from "../game/elysiumWorld";
import ExplorationMinimap from "./ExplorationMinimap";
import MarsAtlas from "./MarsAtlas";
import {PERSEVERANCE_LANDING} from '../content/marsLandingSites';
import StarshipArrival from "./StarshipArrival";
import {createArrivalPlayback} from '../game/starshipArrival';
import MarsWorld, { type View } from "./MarsWorld";
import { isCoarsePointerDevice, tryEnterLandscape } from "./mobileDevice";
import { RotateToLandscapeGate } from "./RotateToLandscapeGate";
import TarukhMainMenu from "./TarukhMainMenu";
import "./world.css";
import "./mars.css";
import "./mobileCockpit.css";
import "./freeRoam.css";
import "./outpost.css";

const ElysiumStory = lazy(() => import('./ElysiumStory'));
function hasStorySaveCandidate() {
  try {
    const raw = window.localStorage.getItem("tarukh.elysium.v1");
    if (!raw || raw.length > 50000) return false;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return false;
    const record = saved as Record<string, unknown>;
    return record.version === 1
      && ["briefing", "active", "ready"].includes(String(record.phase))
      && Number.isInteger(record.sol)
      && Number.isInteger(record.seed)
      && Boolean(record.resources && typeof record.resources === "object");
  } catch {
    return false;
  }
}
export interface StoryPresentation {
  controlMode:'pc'|'mobile'; modalOpen:boolean; overlay:ReactNode;
  world:ElysiumWorldBridge; onView:(view:View)=>void; onInspect?:(id:string)=>void;
  onExit:()=>void; arrival:'earth'|'none'; onArrivalComplete?:()=>void;
}

export default function MarsFreeRoam({story}:{story?:StoryPresentation} = {}) {
  const arrivalPlayback=useMemo(()=>createArrivalPlayback(),[]);
  const storyRef = useRef(story);
  useEffect(() => {storyRef.current = story;},[story]);
  const [storyRequested,setStoryRequested] = useState(false);
  const [storyLaunchIsNew,setStoryLaunchIsNew] = useState(false);
  const [hasStorySave,setHasStorySave] = useState(false);
  const [streamed, setStreamed] = useState(false);
  const [mode, setMode] = useState<"pc" | "mobile">(story?.controlMode ?? "pc");
  const [sceneReady, setSceneReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const ready = useCallback(() => {setSceneReady(true);if(storyRef.current?.arrival==='none'){setArrived(true);storyRef.current.onArrivalComplete?.();}},[]);
  const finishArrival = useCallback(() => {setArrived(true);storyRef.current?.onArrivalComplete?.();},[]);
  const changeTouchControls = useCallback((active:boolean)=>setMode(active?'mobile':'pc'),[]);
  const [started, setStarted] = useState(Boolean(story));
  const [menu, setMenu] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lowGraphics, setLowGraphics] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [inspect, setInspect] = useState<'curiosity'|'perseverance'|null>(null);
  const [atlas,setAtlas]=useState(false);
  const openAtlas=useCallback(()=>setAtlas(true),[]);
  const [landmark,setLandmark]=useState('elysium');
  const dialog = useRef<HTMLElement>(null);
  const unavailable = useCallback(() => setFailed(true), []);
  const inspectRover = useCallback((id: string) => { if (storyRef.current?.onInspect) storyRef.current.onInspect(id); else if (id === "curiosity" || id === "perseverance") setInspect(id); },[]);
  const receiveView = useCallback((next:View) => {setView(next);storyRef.current?.onView(next);},[]);
  const handleRestart = useCallback(() => {
    setSceneReady(false);
    setArrived(false);
    setAttempt(value => value + 1);
  }, []);
  const modal = menu || failed || inspect || atlas;
  const storyReady = story ? sceneReady && story.arrival !== 'earth' : arrived;
  const showArrival = story ? story.arrival === 'earth' : !arrived;

  useEffect(() => { if (!storyRef.current && isCoarsePointerDevice()) setMode("mobile"); }, []);
  useEffect(() => { if (!story) setHasStorySave(hasStorySaveCandidate()); }, [story]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    document.exitPointerLock?.();
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keys = (event: KeyboardEvent) => {
      const isMapKey = (event.code === "KeyM" || event.key.toLowerCase() === "m" || event.code === "CapsLock");
      if (isMapKey && atlas && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey) {
        // Do not let the same key bubble to the newly resumed world's opener.
        event.preventDefault(); event.stopPropagation(); setAtlas(false); return;
      }
      if (event.key === "Escape" && !failed) { setMenu(false); setInspect(null); setAtlas(false); }
      if (event.key !== "Tab") return;
      const buttons = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keys);
    return () => { document.removeEventListener("keydown", keys); requestAnimationFrame(()=>{
      if(previous?.isConnected)previous.focus();
      else document.querySelector<HTMLElement>(atlas?'.roam-atlas-open, .roam-header button':'.sv-world')?.focus();
    }); };
  }, [modal, failed, atlas]);

  const startExplorer = () => {
    if (mode === "mobile") void tryEnterLandscape();
    setView(null); setSceneReady(false); setArrived(false); setStarted(true);
  };
  const launchStory = (startNew: boolean) => {
    if (mode === "mobile") void tryEnterLandscape();
    setStoryLaunchIsNew(startNew); setStoryRequested(true);
  };
  const exitStory = () => {
    setStoryRequested(false); setStoryLaunchIsNew(false);
    setHasStorySave(hasStorySaveCandidate());
  };

  if (storyRequested && !story) return <Suspense fallback={<main className="roam-launch"><p>Opening Elysium briefing…</p></main>}><ElysiumStory controlMode={mode} launchNew={storyLaunchIsNew} onExit={exitStory}/></Suspense>;

  if (!started) return <TarukhMainMenu
    mode={mode}
    onModeChange={setMode}
    hasStorySave={hasStorySave}
    onStartExplorer={startExplorer}
    onResumeStory={() => launchStory(false)}
    onNewStory={() => launchStory(true)}
  />;

  const roverDistance = view?.roverX === undefined || view.roverZ === undefined ? null : Math.round(Math.hypot(view.x - view.roverX, view.z - view.roverZ));
  return <main className="sv-root mars-root roam-root" data-controls={mode} data-phase={story?'story':'explore'}>
    <MarsWorld key={attempt} story={story?.world} arrivalPlayback={arrivalPlayback} coveredByArrival={!sceneReady || showArrival} enabled={storyReady && !modal && !story?.modalOpen && !story?.world.ending && !blocked} onReady={ready} onTerrainMode={setStreamed}
      showTouchControls={mode === "mobile"} autoDetectTouch={false} onTouchControlsChange={changeTouchControls}
      initialQuality={lowGraphics ? "performance" : "auto"} onInspect={inspectRover} onOpenMap={openAtlas} onView={receiveView} onUnavailable={unavailable}
      onRestart={handleRestart} />
    {showArrival && !failed && <StarshipArrival key={`arrival-${attempt}`} ready={sceneReady} onComplete={finishArrival} performance={lowGraphics} playback={arrivalPlayback} />}
    {!modal && !story?.modalOpen && storyReady && <RotateToLandscapeGate onBlockedChange={setBlocked} />}
    <header className="roam-header"><b>TARUKH <span>· {story?'ELYSIUM OUTPOST':'FREE EXPLORATION'}</span></b>{view?.cockpitView&&<button aria-keyshortcuts="KeyM" onClick={openAtlas}>Map (M)</button>}<button disabled={!storyReady || story?.modalOpen} onClick={() => setMenu(true)}>Pause</button></header>
    {!modal && <aside className="roam-info">{streamed ? "Mars MOLA region" : "Mars surface"} · {view?.lightPhase ?? "Day"} · {view?.roverDriving ? "Driving crew rover" : roverDistance !== null ? `Crew rover · ${roverDistance} m` : "Free exploration"}</aside>}
    {!modal && storyReady && view && !view.cockpitView && <ExplorationMinimap view={view} selected={landmark} onOpenAtlas={()=>setAtlas(true)} />}
    {!modal && story?.overlay}
    {modal && <div className="mars-dialog-backdrop"><section ref={dialog} className="mars-dialog roam-dialog" role="dialog" aria-modal="true" aria-labelledby="roam-dialog-title">
      {failed ? <><h2 id="roam-dialog-title">The 3D world couldn’t start</h2><p>Retry, or use lighter graphics for this browser.</p>
        <button onClick={() => { setSceneReady(false); setArrived(false); setFailed(false); setAttempt(value => value + 1); }}>Retry</button>
        <button onClick={() => { setLowGraphics(true); setSceneReady(false); setArrived(false); setFailed(false); setAttempt(value => value + 1); }}>Retry with Performance graphics</button></>
      : atlas && view ? <MarsAtlas x={view.x} z={view.z} selected={landmark} onSelect={setLandmark} onClose={()=>setAtlas(false)} view={view} storyTarget={view.storyTarget} storyRoute={story?.world.routePoints}/>
      : inspect === 'perseverance' ? <><h2 id="roam-dialog-title">Perseverance · Jezero crater</h2><p>You found {PERSEVERANCE_LANDING.site}, where Perseverance landed on {PERSEVERANCE_LANDING.date}.</p><p>Landing coordinates: {PERSEVERANCE_LANDING.latitude}° N, {PERSEVERANCE_LANDING.longitude}° E. This original model marks its historical landing position, not its current location. Distances are compressed for exploration.</p><p><a href={PERSEVERANCE_LANDING.source} target="_blank" rel="noreferrer">NASA landing-coordinate source ↗</a></p><button onClick={() => setInspect(null)}>Continue exploring</button></>
      : inspect ? <><h2 id="roam-dialog-title">Curiosity rover</h2><p>This autonomous rover explores the terrain and pauses to scan rocks. Its movements and measurements are simulated.</p><p>Status: {view?.curiosityPhase ?? "exploring"}</p><button onClick={() => setInspect(null)}>Continue exploring</button></>
      : <><h2 id="roam-dialog-title">Exploration paused</h2><button onClick={() => setMenu(false)}>Resume exploring</button><p>WASD move · Space jump · V camera · F enter/exit rover · M map. Drag to look if mouse capture is unavailable.</p><button onClick={() => { setMenu(false); if(story)story.onExit();else setStarted(false); }}>Back to controls setup</button></>}
    </section></div>}
  </main>;
}
