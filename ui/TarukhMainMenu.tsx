"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { redValleyShots } from "../content/redValley";
import { assetUrl } from "../lib/assetUrl";
import RedValleyBackdrop from "./RedValleyBackdrop";
import "./tarukhMainMenu.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const prefersPlayback = () => !window.matchMedia(motionQuery).matches;
const serverPlayback = () => false;

type LaunchMode = "pc" | "mobile";
type Panel = "settings" | "about" | null;

interface TarukhMainMenuProps {
  mode: LaunchMode;
  onModeChange: (mode: LaunchMode) => void;
  hasStorySave: boolean;
  onStartExplorer: () => void;
  onResumeStory: () => void;
  onNewStory: () => void;
}

export default function TarukhMainMenu({
  mode,
  onModeChange,
  hasStorySave,
  onStartExplorer,
  onResumeStory,
  onNewStory,
}: TarukhMainMenuProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [activeFrame, setActiveFrame] = useState(0);
  const [playbackOverride, setPlaybackOverride] = useState<boolean | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const subscribeToMotion = useCallback((notify: () => void) => {
    const preference = window.matchMedia(motionQuery);
    const change = () => { setPlaybackOverride(null); notify(); };
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  const autoplay = useSyncExternalStore(subscribeToMotion, prefersPlayback, serverPlayback);
  const playing = playbackOverride ?? autoplay;
  const stepFrame = useCallback((step: number) => {
    setActiveFrame(current => (current + step + redValleyShots.length) % redValleyShots.length);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(() => stepFrame(1), 9000);
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

  const selectedScene = redValleyShots[activeFrame];

  return (
    <main className="tarukh-home" data-playing={playing}>
      <div className="tarukh-home-backdrop" aria-hidden="true">
        <RedValleyBackdrop shot={activeFrame} playing={playing} />
        <div className="tarukh-home-shade" />
        <div className="tarukh-home-dust" />
      </div>

      <header className="tarukh-home-header">
        <div className="tarukh-home-brand">
          <span className="tarukh-home-logo-window">
            <img src={assetUrl("team/tarukh-blue-arc-logo.png")} alt="TARUKH" />
          </span>
          <span className="tarukh-home-divider" />
          <span className="tarukh-home-brand-label">Surface operations</span>
        </div>
        <div className="tarukh-home-status">
          <span><i aria-hidden="true" />Habitat link stable</span>
          <span className="tarukh-home-delay">Earth delay · 12m 41s</span>
        </div>
      </header>

      <section className="tarukh-home-copy" aria-labelledby="tarukh-home-title">
        <p className="tarukh-home-kicker">Mars field program <span>·</span> Sol 018</p>
        <h1 id="tarukh-home-title">A world<span>unwritten.</span></h1>
        <p className="tarukh-home-description">
          Dust on the horizon. A signal under the basalt. Continue the expedition, or choose your own path across Elysium.
        </p>
      </section>

      <div className="tarukh-home-scene-label" aria-live="polite">
        <span>Surface archive · frame {String(activeFrame + 1).padStart(2, "0")} / 03</span>
        <strong>{selectedScene.name}</strong>
        <small>{selectedScene.caption}</small>
      </div>

      <div className="tarukh-home-slideshow" role="group" aria-label="Background slideshow controls">
        <button type="button" aria-label="Previous scene" onClick={() => stepFrame(-1)}>‹</button>
        <div className="tarukh-home-pips">
          {redValleyShots.map((scene, index) => (
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

      <nav className="tarukh-home-menu" aria-label="Main menu">
        <button className="tarukh-home-option is-primary" type="button" onClick={onStartExplorer}>
          <span className="tarukh-home-option-number">01</span>
          <span className="tarukh-home-option-copy"><strong>Start Free Explorer</strong><small>Open terrain</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="tarukh-home-option" type="button" disabled={!hasStorySave} onClick={onResumeStory}>
          <span className="tarukh-home-option-number">02</span>
          <span className="tarukh-home-option-copy"><strong>Resume Story</strong><small>{hasStorySave ? "Saved expedition" : "No saved expedition"}</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={onNewStory}>
          <span className="tarukh-home-option-number">03</span>
          <span className="tarukh-home-option-copy"><strong>New Story</strong><small>Begin transmission</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={() => setPanel("settings")}>
          <span className="tarukh-home-option-number">04</span>
          <span className="tarukh-home-option-copy"><strong>Settings</strong><small>Controls & display</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true">↗</span>
        </button>
        <button className="tarukh-home-option" type="button" onClick={() => setPanel("about")}>
          <span className="tarukh-home-option-number">05</span>
          <span className="tarukh-home-option-copy"><strong>About</strong><small>The mission</small></span>
          <span className="tarukh-home-option-arrow" aria-hidden="true">↗</span>
        </button>
      </nav>

      <footer className="tarukh-home-footer">
        <div><b>TAB</b> navigate <b>ENTER</b> select <b>ESC</b> close panel</div>
        <span>TARUKH FIELD SYSTEM <i>·</i> FLIGHT BUILD 0.9.18</span>
      </footer>

      <dialog
        ref={dialog}
        className="tarukh-home-dialog"
        aria-labelledby="tarukh-home-dialog-title"
        onClose={() => setPanel(null)}
        onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}
      >
        <div className="tarukh-home-dialog-inner">
          <p className="tarukh-home-dialog-kicker">{panel === "settings" ? "Control room" : "Surface operations / 2037"}</p>
          <h2 id="tarukh-home-dialog-title">{panel === "settings" ? "Settings" : "About TARUKH"}</h2>
          {panel === "settings" ? (
            <>
              <p className="tarukh-home-dialog-text">Choose the input layout for this session. You can also pause the scene reel with the controls above the menu.</p>
              <div className="tarukh-home-setting">
                <span>Input layout</span>
                <div className="tarukh-home-segmented">
                  <button type="button" aria-pressed={mode === "pc"} onClick={() => onModeChange("pc")}>PC</button>
                  <button type="button" aria-pressed={mode === "mobile"} onClick={() => onModeChange("mobile")}>Mobile</button>
                </div>
              </div>
              <p className="tarukh-home-dialog-note">PC: WASD, mouse look and keyboard shortcuts. Mobile: landscape controls, movement stick and touch actions.</p>
            </>
          ) : (
            <>
              <p className="tarukh-home-dialog-text">TARUKH is a crewed field mission across the Elysium region of Mars. Explore measured terrain, follow the outpost story, and use the field atlas to plan your traverse.</p>
              <p className="tarukh-home-dialog-note">Terrain elevation is based on NASA MOLA data. Named features use the IAU/USGS Gazetteer. Travel scale and mission events are simplified for play; NASA does not endorse TARUKH.</p>
            </>
          )}
          <button className="tarukh-home-return" type="button" onClick={() => dialog.current?.close()}>Return to surface</button>
        </div>
      </dialog>
    </main>
  );
}
