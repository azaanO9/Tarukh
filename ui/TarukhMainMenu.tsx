"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Activity, BookOpen, Info, Monitor, Rocket, RotateCcw, Satellite, SlidersHorizontal, Smartphone, UserRound } from "lucide-react";
import { mainMenuScenes } from "../content/mainMenuScenes";
import { assetUrl } from "../lib/assetUrl";
import FieldExpeditionBackdrop from "./FieldExpeditionBackdrop";
import LivingWorldsBackdrop from "./LivingWorldsBackdrop";
import RedValleyBackdrop from "./RedValleyBackdrop";
import "./tarukhMainMenu.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const slideshowInterval = 7500;
const prefersPlayback = () => !window.matchMedia(motionQuery).matches;
const serverPlayback = () => false;

type LaunchMode = "pc" | "mobile";
type Panel = "settings" | "about" | null;

interface TarukhMainMenuProps {
  mode: LaunchMode;
  hasStorySave: boolean;
  onStartExplorer: () => void;
  onResumeStory: () => void;
  onNewStory: () => void;
  onFullscreen?: () => void;
  fullscreen?: boolean;
}

export default function TarukhMainMenu({
  mode,
  hasStorySave,
  onStartExplorer,
  onResumeStory,
  onNewStory,
  onFullscreen,
  fullscreen = false,
}: TarukhMainMenuProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [panel, setPanel] = useState<Panel>(null);
  const [activeFrame, setActiveFrame] = useState(0);
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const menuDock = useRef<HTMLElement>(null);
  const dockFrame = useRef<number | null>(null);

  const subscribeToMotion = useCallback((notify: () => void) => {
    const preference = window.matchMedia(motionQuery);
    const change = () => { setPlaybackOverride(null); notify(); };
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  const autoplay = useSyncExternalStore(subscribeToMotion, prefersPlayback, serverPlayback);
  const playing = playbackOverride ?? autoplay;
  const stepFrame = useCallback((step: number) => {
    setActiveFrame(current => (current + step + mainMenuScenes.length) % mainMenuScenes.length);
  }, []);

  const resetDock = useCallback(() => {
    if (dockFrame.current !== null) window.cancelAnimationFrame(dockFrame.current);
    dockFrame.current = null;
    menuDock.current?.style.setProperty("--dock-glow-x", "50%");
    menuDock.current?.querySelectorAll<HTMLElement>(".tarukh-home-option")
      .forEach(option => {
        option.style.setProperty("--dock-grow", "1");
        option.style.setProperty("--dock-rise", "0px");
        option.style.setProperty("--dock-depth", "0px");
        option.style.setProperty("--dock-scale", "1");
        option.style.setProperty("--dock-icon-depth", "0px");
        option.style.setProperty("--dock-icon-scale", "1");
        option.style.setProperty("--dock-arrow-depth", "0px");
      });
  }, []);

  const moveDock = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia(motionQuery).matches) return;
    const dock = menuDock.current;
    if (!dock || dockFrame.current !== null) return;
    const options = [...dock.querySelectorAll<HTMLButtonElement>(".tarukh-home-option")];
    const bounds = dock.getBoundingClientRect();
    const pointerX = event.clientX;
    const hoveredOption = event.target instanceof Element
      ? event.target.closest<HTMLElement>(".tarukh-home-option")
      : null;
    dockFrame.current = window.requestAnimationFrame(() => {
      dockFrame.current = null;
      dock.style.setProperty("--dock-glow-x", `${(pointerX - bounds.left) / bounds.width * 100}%`);
      for (const option of options) {
        const center = option.offsetLeft + option.offsetWidth / 2;
        const distance = Math.abs(pointerX - bounds.left - center);
        const proximity = Math.max(0, 1 - distance / Math.max(110, option.offsetWidth * 1.7));
        const focus = option.disabled ? 0 : Math.max(proximity * proximity, hoveredOption === option ? 1 : 0);
        option.style.setProperty("--dock-grow", (1 + 2.45 * focus).toFixed(3));
        option.style.setProperty("--dock-rise", `${-4 * focus}px`);
        option.style.setProperty("--dock-depth", `${13 * focus}px`);
        option.style.setProperty("--dock-scale", (1 + .025 * focus).toFixed(4));
        option.style.setProperty("--dock-icon-depth", `${12 * focus}px`);
        option.style.setProperty("--dock-icon-scale", (1 + .16 * focus).toFixed(4));
        option.style.setProperty("--dock-arrow-depth", `${7 * focus}px`);
      }
    });
  }, []);

  useEffect(() => {
    if (!playing) return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(() => stepFrame(1), slideshowInterval);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [playing, activeFrame, stepFrame]);

  useEffect(() => {
    const element = dialog.current;
    if (!panel || !element) return;
    if (!element.open) element.showModal();
    window.requestAnimationFrame(() => element.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      if (element.open) element.close();
    };
  }, [panel]);

  const selectedScene = mainMenuScenes[activeFrame];

  return (
    <main className="tarukh-home" data-playing={playing} data-controls={mode}>
      <div className="tarukh-home-backdrop" aria-hidden="true">
        <RedValleyBackdrop
          shot={selectedScene.kind === "red-valley" ? selectedScene.sourceShot : 0}
          playing={playing && selectedScene.kind === "red-valley"}
        />
        {selectedScene.kind === "living-worlds" && <LivingWorldsBackdrop playing={playing} />}
        {selectedScene.kind === "field-expedition" && <FieldExpeditionBackdrop playing={playing} />}
        <div className="tarukh-home-shade" />
        <div className="tarukh-home-dust" />
      </div>

      <header className="tarukh-home-header">
        <div className="tarukh-home-brand">
          <span className="tarukh-home-logo-window">
            <img src={assetUrl("team/tarukh-blue-arc-logo.webp")} alt="TARUKH" loading="eager" decoding="async" fetchPriority="high" draggable={false} />
          </span>
          <span className="tarukh-home-divider" />
          <span className="tarukh-home-brand-label">Surface operations</span>
        </div>
        <div className="tarukh-home-status">
          {mounted && onFullscreen && !fullscreen && (
            <button
              className="tarukh-home-fullscreen-btn"
              type="button"
              aria-label="Enter fullscreen"
              onClick={onFullscreen}
            >
              Fullscreen ⛶
            </button>
          )}
          <span><i aria-hidden="true" />Habitat link stable</span>
          <span className="tarukh-home-delay">Earth delay · 12m 41s</span>
        </div>
      </header>

      <section className="tarukh-home-copy" aria-labelledby="tarukh-home-title">
        <p className="tarukh-home-kicker">Mars field program <span>·</span> Sol 018</p>
        <h1 id="tarukh-home-title">The Mars{" "}<span>Explorer</span></h1>
        <p className="tarukh-home-description">
          Dust on the horizon. A signal under the basalt. Continue the expedition, or choose your own path across Elysium.
        </p>
      </section>

      <div className="tarukh-home-scene-label" aria-live="polite">
        <span>Surface archive · frame {String(activeFrame + 1).padStart(2, "0")} / {String(mainMenuScenes.length).padStart(2, "0")}</span>
        <strong>{selectedScene.name}</strong>
        <small>{selectedScene.caption}</small>
      </div>

      <div className="tarukh-home-slideshow" role="group" aria-label="Background slideshow controls">
        <button type="button" aria-label="Previous scene" onClick={() => stepFrame(-1)}>‹</button>
        <div className="tarukh-home-pips">
          {mainMenuScenes.map((scene, index) => (
            <button
              type="button"
              key={scene.name}
              className={index === activeFrame ? "is-active" : ""}
              aria-label={"Show " + scene.name}
              aria-current={index === activeFrame ? "true" : undefined}
              onClick={() => setActiveFrame(index)}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={playing ? "Pause background slideshow" : "Play background slideshow"}
          aria-pressed={playing}
          onClick={() => setPlaybackOverride(!playing)}
        >{playing ? "Ⅱ" : "▶"}</button>
        <button type="button" aria-label="Next scene" onClick={() => stepFrame(1)}>›</button>
      </div>

      <nav ref={menuDock} className="tarukh-home-menu" aria-label="Main menu" onPointerMove={moveDock} onPointerLeave={resetDock}>
        <button className="tarukh-home-option is-primary" type="button" onClick={onStartExplorer} aria-label="Start Free Explorer, open terrain">
          <span className="tarukh-home-option-number">01</span>
          <span className="tarukh-home-option-icon"><Rocket aria-hidden="true" /></span>
          <span className="tarukh-home-option-copy"><strong>Start Free Explorer</strong><small>Open terrain</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true"><ArrowIcon /></span>
        </button>
        <button className="tarukh-home-option" type="button" disabled={!hasStorySave} onClick={onResumeStory} aria-label={`Resume Story, ${hasStorySave ? "saved expedition" : "no saved expedition"}`}>
          <span className="tarukh-home-option-number">02</span>
          <span className="tarukh-home-option-icon"><RotateCcw aria-hidden="true" /></span>
          <span className="tarukh-home-option-copy"><strong>Resume Story</strong><small>{hasStorySave ? "Saved expedition" : "No saved expedition"}</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true"><ArrowIcon /></span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={onNewStory} aria-label="New Story, begin transmission">
          <span className="tarukh-home-option-number">03</span>
          <span className="tarukh-home-option-icon"><BookOpen aria-hidden="true" /></span>
          <span className="tarukh-home-option-copy"><strong>New Story</strong><small>Begin transmission</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true"><ArrowIcon /></span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={() => setPanel("settings")} aria-label="Settings, controls and display">
          <span className="tarukh-home-option-number">04</span>
          <span className="tarukh-home-option-icon"><SlidersHorizontal aria-hidden="true" /></span>
          <span className="tarukh-home-option-copy"><strong>Settings</strong><small>Controls & display</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true"><ArrowIcon /></span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={() => setPanel("about")} aria-label="About the mission">
          <span className="tarukh-home-option-number">05</span>
          <span className="tarukh-home-option-icon"><Info aria-hidden="true" /></span>
          <span className="tarukh-home-option-copy"><strong>About</strong><small>The mission</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true"><ArrowIcon /></span>
        </button>
      </nav>

      <footer className="tarukh-home-footer">
        <div className="tarukh-home-footer-controls"><b>TAB</b> navigate <b>ENTER</b> select <b>ESC</b> close panel</div>
        <div className="tarukh-home-footer-meta">
          <span className="tarukh-home-footer-credit">Created by · Musaib Yaseen · Azaan Khan · Salim Rashid Bhat</span>
          <span className="tarukh-home-footer-build">TARUKH FIELD SYSTEM <i>·</i> FLIGHT BUILD 0.9.18</span>
        </div>
      </footer>

      <dialog
        ref={dialog}
        className="tarukh-home-dialog"
        data-panel={panel}
        aria-labelledby="tarukh-home-dialog-title"
        onClose={() => setPanel(null)}
        onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <div className="tarukh-home-dialog-inner">
          <header className="tarukh-home-dialog-head">
            <span className="tarukh-home-dialog-mark" aria-hidden="true">{panel === "settings" ? <SlidersHorizontal /> : <Satellite />}</span>
            <span className="tarukh-home-dialog-ident"><span>TARUKH <i>·</i> SURFACE OPERATIONS</span><span className="tarukh-home-dialog-live"><i />MISSION LINK ACTIVE</span></span>
            <button className="tarukh-home-dialog-close" type="button" aria-label="Close panel" onClick={() => dialog.current?.close()}>×</button>
          </header>
          <p className="tarukh-home-dialog-kicker">{panel === "settings" ? "Control room / preferences" : "Field dossier / Elysium region"}</p>
          <h2 id="tarukh-home-dialog-title">{panel === "settings" ? "Settings" : "About TARUKH"}</h2>
          {panel === "settings" ? (
            <>
              <p className="tarukh-home-dialog-text">Controls adapt automatically to your device. Camera and graphics settings are available from Pause while exploring.</p>
              <div className="tarukh-home-settings-layout">
                <div className="tarukh-home-setting">
                  <div className="tarukh-home-setting-heading"><span>INPUT LAYOUT</span><small>AUTOMATIC</small></div>
                  <div className="tarukh-home-layouts">
                    <div className="tarukh-home-layout" role="status">
                      {mode === 'mobile' ? <Smartphone aria-hidden="true" /> : <Monitor aria-hidden="true" />}
                      <span><strong>{mode === 'mobile' ? 'Touch controls' : 'Keyboard & mouse'}</strong><small>{mode === 'mobile' ? 'Landscape exploration' : 'Desktop controls'}</small></span>
                    </div>
                  </div>
                </div>
                <div className="tarukh-home-control-guide" aria-label={mode === "pc" ? "Desktop controls" : "Mobile controls"}>
                  <span>{mode === "pc" ? "DESKTOP CONTROLS" : "MOBILE CONTROLS"}</span>
                  {mode === "pc" ? <><p><b>W A S D</b><span>Move around</span></p><p><b>SHIFT</b><span>Sprint</span></p><p><b>DRAG</b><span>Look around</span></p><p><b>V</b><span>Change camera</span></p></> : <><p><b>LANDSCAPE</b><span>Rotate your device</span></p><p><b>JOYSTICK</b><span>Walk and steer</span></p><p><b>SWIPE</b><span>Look around</span></p><p><b>ACTION</b><span>Interact and drive</span></p></>}
                </div>
              </div>
              <p className="tarukh-home-dialog-note"><Activity aria-hidden="true" /> Touch mode starts in landscape with swipe look and a movement stick.</p>
            </>
          ) : (
            <>
              <div className="tarukh-home-about-hero">
                <span className="tarukh-home-about-mark"><Satellite aria-hidden="true" /></span>
                <div><p className="tarukh-home-dialog-intro">The Mars Explorer</p><p className="tarukh-home-dialog-text">TARUKH is a crewed field mission across the Elysium region of Mars. Explore measured terrain, follow Kaelen’s outpost story, and plan your traverse with the field atlas.</p></div>
                <span className="tarukh-home-about-stamp">CREWED<br />MISSION</span>
              </div>
              <div className="tarukh-home-about-grid">
                <article><UserRound aria-hidden="true" /><span>CREATED BY</span><strong>Musaib Yaseen</strong></article>
                <article><UserRound aria-hidden="true" /><span>CREATED BY</span><strong>Azaan Khan</strong></article>
                <article><UserRound aria-hidden="true" /><span>CREATED BY</span><strong>Salim Rashid Bhat</strong></article>
              </div>
              <p className="tarukh-home-dialog-note">Travel scale and mission events are simplified for play. TARUKH is an independent project. NASA does not endorse it.</p>
            </>
          )}
          <button className="tarukh-home-return" type="button" onClick={() => dialog.current?.close()}><span>Return to surface</span><ArrowIcon /></button>
        </div>
      </dialog>
    </main>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
