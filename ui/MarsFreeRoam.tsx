"use client";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ElysiumWorldBridge } from "../game/elysiumWorld";



import {createArrivalPlayback} from '../game/starshipArrival';
import type {View} from "./MarsWorld";
import {isFullscreen,isStandalone,supportsFullscreen,requestGameFullscreen} from "./mobileDevice";
import {useDeviceMode,useTouchPortrait} from "./useDeviceMode";
import { RotateToLandscapeGate } from "./RotateToLandscapeGate";
import TarukhMainMenu from "./TarukhMainMenu";
import ConnectionBoundary from './ConnectionBoundary';
import "./world.css";
import "./mars.css";
import "./mobileCockpit.css";
import "./freeRoam.css";
import "./outpost.css";

const MarsWorld=lazy(()=>import('./MarsWorld'));
const MarsAtlas=lazy(()=>import('./MarsAtlas'));
const PerseveranceInspection=lazy(()=>import('./PerseveranceInspection'));
const StarshipArrival=lazy(()=>import('./StarshipArrival'));
const ExplorationMinimap=lazy(()=>import('./ExplorationMinimap'));
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

export default function MarsFreeRoam(props:{story?:StoryPresentation} = {}) {
  return <ConnectionBoundary><MarsFreeRoamContent {...props}/></ConnectionBoundary>;
}

function MarsFreeRoamContent({story}:{story?:StoryPresentation}) {
  const arrivalPlayback=useMemo(()=>createArrivalPlayback(),[]);
  const storyRef = useRef(story);
  useEffect(() => {storyRef.current = story;},[story]);
  const [storyRequested,setStoryRequested] = useState(false);
  const [storyLaunchIsNew,setStoryLaunchIsNew] = useState(false);
  const [hasStorySave,setHasStorySave] = useState(false);
  const [streamed, setStreamed] = useState(false);
  const detectedMode = useDeviceMode();
  const [manualMode, setManualMode] = useState<'pc'|'mobile' | null>(null);
  const mode = manualMode ?? detectedMode ?? 'pc';
  const blocked=useTouchPortrait();
  const [fullscreen,setFullscreen]=useState(isFullscreen);
  const [installDismissed,setInstallDismissed]=useState(false);
  const [loading,setLoading]=useState({progress:0,stage:"Preparing the expedition"});
  const loadingProgress=useCallback((progress:number,stage:string)=>setLoading({progress,stage}),[]);
  const [sceneReady, setSceneReady] = useState(false);
  const [arrived, setArrived] = useState(false);
  const ready = useCallback(() => {setSceneReady(true);if(storyRef.current?.arrival==='none'){setArrived(true);storyRef.current.onArrivalComplete?.();}},[]);
  const finishArrival = useCallback(() => {setArrived(true);storyRef.current?.onArrivalComplete?.();},[]);
  const [started, setStarted] = useState(Boolean(story));
  const [menu, setMenu] = useState(false);
  const openMenu = useCallback(() => setMenu(true), []);
  const closeMenu = useCallback(() => {
    setMenu(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.sv-world')?.focus({ preventScroll: true }));
  }, []);
  const returnToMainMenu = useCallback(() => {
    setMenu(false);
    if (storyRef.current) storyRef.current.onExit();
    else setStarted(false);
  }, []);
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
  const panel = failed || inspect || atlas;
  const modal = menu || panel;
  const storyReady = story ? sceneReady && story.arrival !== 'earth' : arrived;
  const showArrival = story ? story.arrival === 'earth' : !arrived;

  useEffect(() => { if (!story) setHasStorySave(hasStorySaveCandidate()); }, [story]);
  useEffect(()=>{
    let previous=isFullscreen();
    const changed=()=>{
      const active=isFullscreen();setFullscreen(active);
      if(previous&&!active&&started){document.exitPointerLock?.();setMenu(true);}
      previous=active;
    };
    document.addEventListener('fullscreenchange',changed);
    document.addEventListener('webkitfullscreenchange',changed);
    document.addEventListener('MSFullscreenChange',changed);
    return ()=>{
      document.removeEventListener('fullscreenchange',changed);
      document.removeEventListener('webkitfullscreenchange',changed);
      document.removeEventListener('MSFullscreenChange',changed);
    };
  },[started]);
  useEffect(()=>{
    if(!started||modal||story?.modalOpen||!storyReady)return;
    const pause=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();document.exitPointerLock?.();setMenu(true);}
    };
    document.addEventListener('keydown',pause);
    return ()=>document.removeEventListener('keydown',pause);
  },[started,modal,story?.modalOpen,storyReady]);
  const enterFullscreen=()=>{if(mode)void requestGameFullscreen(mode).then(setFullscreen);};
  const startExploring=()=>{enterFullscreen();setView(null);setSceneReady(false);setArrived(false);setStarted(true);};
  const installHint=started&&mode==='mobile'&&!installDismissed&&typeof navigator!=='undefined'
    &&/iPhone|iPad|iPod/.test(navigator.userAgent)&&!isStandalone()&&!supportsFullscreen()
    &&(()=>{try{return localStorage.getItem('tarukh-install-hint')!=='dismissed';}catch{return true;}})();
  const dismissInstall=()=>{setInstallDismissed(true);try{localStorage.setItem('tarukh-install-hint','dismissed');}catch{/* Storage is optional. */}};
  const fullscreenAvailable=typeof document!=='undefined'&&supportsFullscreen()&&!isStandalone();
  useEffect(()=>{
    if(started||storyRequested||!mode)return;
    const start=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.repeat||(event.key!=='Enter'&&event.key!==' '))return;
      if(event.target instanceof HTMLElement&&event.target.closest('button,a,input,select,textarea'))return;
      event.preventDefault();
      void requestGameFullscreen(mode).then(setFullscreen);
      setStarted(true);
    };
    document.addEventListener('keydown',start);
    return ()=>document.removeEventListener('keydown',start);
  },[started,storyRequested,mode]);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    document.exitPointerLock?.();
    const focusFirst=()=>{
      const first=dialog.current?.querySelector<HTMLButtonElement>('button');
      if(!first)return false;
      first.focus();return true;
    };
    const pendingFocus=new MutationObserver(()=>{if(focusFirst())pendingFocus.disconnect();});
    if(!focusFirst()&&dialog.current)pendingFocus.observe(dialog.current,{childList:true,subtree:true});
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
    return () => { pendingFocus.disconnect();document.removeEventListener("keydown", keys); requestAnimationFrame(()=>{
      if(previous?.isConnected)previous.focus();
      else document.querySelector<HTMLElement>(atlas?'.roam-atlas-open, .roam-header button':'.sv-world')?.focus();
    }); };
  }, [panel, failed, atlas]);

  if(!mode)return <main className="roam-launch" aria-busy="true"><section><h1>TARUKH</h1><p>Getting ready…</p></section></main>;

  const launchStory = (startNew: boolean) => {
    enterFullscreen();
    setStoryLaunchIsNew(startNew); setStoryRequested(true);
  };
  const exitStory = () => {
    setStoryRequested(false); setStoryLaunchIsNew(false);
    setHasStorySave(hasStorySaveCandidate());
  };

  if (storyRequested && !story) return <Suspense fallback={<main className="roam-launch"><p>Opening Elysium briefing…</p></main>}><ElysiumStory controlMode={mode} launchNew={storyLaunchIsNew} onExit={exitStory}/></Suspense>;

  if (!started) return <TarukhMainMenu
    mode={mode}
    onModeChange={setManualMode}
    hasStorySave={hasStorySave}
    onStartExplorer={startExploring}
    onResumeStory={() => launchStory(false)}
    onNewStory={() => launchStory(true)}
  />;

  const roverDistance = view?.roverX === undefined || view.roverZ === undefined ? null : Math.round(Math.hypot(view.x - view.roverX, view.z - view.roverZ));
  return <main className="sv-root mars-root roam-root" data-controls={mode} data-phase={story?'story':'explore'}>
    <Suspense fallback={<div className="roam-scene-loading" role="status">Preparing Mars…</div>}><MarsWorld key={attempt} story={story?.world} arrivalPlayback={arrivalPlayback} coveredByArrival={!sceneReady || showArrival} enabled={storyReady && !modal && !story?.modalOpen && !story?.world.ending && !blocked} onReady={ready} onTerrainMode={setStreamed}
      showTouchControls={mode === "mobile"} autoDetectTouch={false} onLoadingProgress={loadingProgress}
      initialQuality={lowGraphics ? "performance" : "auto"} onInspect={inspectRover} onOpenMap={openAtlas} onView={receiveView} onUnavailable={unavailable}
      onRestart={handleRestart} menuOpen={menu && !panel && !blocked && !story?.modalOpen}
      onOpenMenu={openMenu} onCloseMenu={closeMenu} onMainMenu={returnToMainMenu}
      onMenuFullscreen={fullscreenAvailable && !fullscreen ? enterFullscreen : undefined} /></Suspense>
    {showArrival && !failed && <Suspense fallback={<div className="roam-scene-loading" role="status">Preparing the flight…</div>}><StarshipArrival key={`arrival-${attempt}`} ready={sceneReady} onComplete={finishArrival} performance={lowGraphics} playback={arrivalPlayback} suspended={blocked||menu} loading={loading} /></Suspense>}
    <RotateToLandscapeGate blocked={blocked}/>
    <header className="roam-header" data-ui-zone="header"><b>TARUKH <span>· {story?'ELYSIUM OUTPOST':'FREE EXPLORATION'}</span></b>{view?.cockpitView&&<button aria-keyshortcuts="KeyM" onClick={openAtlas}>Atlas (M)</button>}<div className="roam-header-actions">{fullscreenAvailable&&!fullscreen&&storyReady&&<button className="roam-fullscreen-return" aria-label="Return to fullscreen" onClick={enterFullscreen}>Fullscreen</button>}<button disabled={!storyReady || story?.modalOpen} onClick={() => setMenu(true)}>Pause</button></div></header>
    {!modal && <aside className="roam-info">{streamed ? "Mars MOLA region" : "Mars surface"} · {view?.lightPhase ?? "Day"} · {view?.roverDriving ? "Driving crew rover" : roverDistance !== null ? `Crew rover · ${roverDistance} m` : "Free exploration"}</aside>}
    {!modal && storyReady && view && !view.cockpitView && <Suspense fallback={null}><ExplorationMinimap view={view} selected={landmark} onOpenAtlas={()=>setAtlas(true)} /></Suspense>}
    {!modal && story?.overlay}
    {installHint&&!blocked&&!modal&&storyReady&&<aside className="roam-install-hint" role="status"><p>For a full screen on iPhone, tap Share, then Add to Home Screen.</p><button onClick={dismissInstall}>Got it</button></aside>}
    {panel && <div className="mars-dialog-backdrop"><section ref={dialog} className="mars-dialog roam-dialog" role="dialog" aria-modal="true" aria-labelledby="roam-dialog-title">
      {failed ? <><h2 id="roam-dialog-title">The 3D world couldn’t start</h2><p>Retry, or use lighter graphics for this browser.</p>
        <button onClick={() => { setSceneReady(false); setArrived(false); setFailed(false); setAttempt(value => value + 1); }}>Retry</button>
        <button onClick={() => { setLowGraphics(true); setSceneReady(false); setArrived(false); setFailed(false); setAttempt(value => value + 1); }}>Retry with Performance graphics</button></>
      : atlas && view ? <Suspense fallback={<p role="status">Opening your field map…</p>}><MarsAtlas x={view.x} z={view.z} selected={landmark} onSelect={setLandmark} onClose={()=>setAtlas(false)} storyTarget={view.storyTarget} storyRoute={story?.world.routePoints}/></Suspense>
      : inspect === 'perseverance' ? <Suspense fallback={<p role="status">Opening rover details…</p>}><PerseveranceInspection onClose={()=>setInspect(null)}/></Suspense>
      : <><h2 id="roam-dialog-title">Curiosity rover</h2><p>This autonomous rover explores the terrain and pauses to scan rocks. Its movements and measurements are simulated.</p><p>Status: {view?.curiosityPhase ?? "exploring"}</p><button onClick={() => setInspect(null)}>Continue exploring</button></>}
    </section></div>}
  </main>;
}
