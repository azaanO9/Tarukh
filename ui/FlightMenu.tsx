"use client";

import { Camera, ChevronRight, Gauge, House, Maximize2, Mouse, Play, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { PerformanceMeterMode } from "../game/performanceMeter";
import "./flightMenu.css";

const stations = [
  { id: "resume", label: "Resume", icon: Play },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "graphics", label: "Graphics", icon: Gauge },
  { id: "exit", label: "Main menu", icon: House },
] as const;

type Station = typeof stations[number]["id"];

const presets = [
  { id: "auto", label: "Auto", detail: "Adjusts to your device" },
  { id: "performance", label: "Performance", detail: "Lighter rendering" },
  { id: "high", label: "High", detail: "More surface detail" },
  { id: "ultra", label: "Ultra", detail: "Maximum detail" },
] as const;

const meters = [
  { id: "off", label: "Off" },
  { id: "fps", label: "FPS only" },
  { id: "detailed", label: "Detailed" },
] as const;

const dialDirections: Record<string, number | undefined> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

interface FlightMenuProps {
  mobile: boolean;
  story: boolean;
  thirdPerson: boolean;
  sensitivity: number;
  quality: string;
  autoLabel: string;
  autoReport: string;
  performanceMeter: PerformanceMeterMode;
  onCamera: (thirdPerson: boolean) => void;
  onSensitivity: (sensitivity: number) => void;
  onQuality: (quality: string) => void;
  onPerformanceMeter: (meter: PerformanceMeterMode) => void;
  onResume: () => void;
  onCaptureMouse: () => void;
  onFullscreen?: () => void;
  onMainMenu: () => void;
}

export default function FlightMenu(props: FlightMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dial = useRef<HTMLElement>(null);
  const [section, setSection] = useState<Station>("resume");
  const [preview, setPreview] = useState<Station | null>(null);
  const highlighted = preview ?? section;
  const currentStation = stations.find(station => station.id === highlighted)!;
  const Indicator = currentStation.icon;
  const camera = props.thirdPerson ? "Third person" : "First person";
  const graphics = props.quality === "auto" ? `Auto · ${props.autoLabel}` : presets.find(preset => preset.id === props.quality)?.label;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    closeButton.current?.focus();
    return () => element.close();
  }, []);

  function selectStation(id: Station) {
    if (id === "resume") props.onResume();
    else setSection(id);
  }

  function handleDialKeys(event: KeyboardEvent<HTMLElement>) {
    const next = dialDirections[event.key];
    if (next === undefined) return;
    event.preventDefault();
    dial.current?.querySelectorAll("button")[next]?.focus();
  }

  function resumeMouseLook() {
    // Release the native modal before asking the browser to capture the mouse.
    dialog.current?.close();
    props.onResume();
    props.onCaptureMouse();
  }

  return (
    <dialog className="flight-menu" ref={dialog} aria-labelledby="flight-menu-title" data-ui-zone="flight-menu"
      onCancel={event => { event.preventDefault(); props.onResume(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>("button, input");
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className="flight-menu-header">
        <div><p>TARUKH / {props.story ? "Elysium Outpost" : "Free Exploration"}</p><h2 id="flight-menu-title">Flight console</h2></div>
        <button ref={closeButton} className="flight-menu-close" type="button" aria-label="Close flight console" onClick={props.onResume}><X size={20} aria-hidden="true" /></button>
      </header>

      <div className="flight-menu-body">
        <nav ref={dial} className="flight-menu-dial" aria-label="Flight console sections" data-highlight={highlighted} onKeyDown={handleDialKeys}>
          <div className="flight-menu-ring" aria-hidden="true" />
          <div className="flight-menu-hub" aria-hidden="true"><Indicator size={25} /><span>{currentStation.label}</span></div>
          <div className="flight-menu-sectors">{stations.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="flight-menu-sector" data-sector={id}
              aria-pressed={id === "resume" ? undefined : section === id}
              onPointerEnter={event => { if (event.pointerType === "mouse") setPreview(id); }}
              onPointerLeave={() => setPreview(null)} onFocus={() => setPreview(id)} onBlur={() => setPreview(null)}
              onClick={() => selectStation(id)}>
              <span className="flight-menu-sector-label"><Icon size={21} aria-hidden="true" /><span>{label}</span></span>
            </button>
          ))}</div>
        </nav>

        <section className="flight-menu-panel" aria-labelledby="flight-panel-title" key={section}>
          {section === "resume" && <>
            <h3 id="flight-panel-title">Expedition paused</h3>
            <dl className="flight-menu-readouts">
              <div><dt>Camera</dt><dd>{camera}</dd></div>
              <div><dt>Graphics</dt><dd>{graphics}</dd></div>
            </dl>
            <p className="flight-menu-note">{props.mobile
              ? "Move with the left stick. Swipe to look; tap an action when it appears. Open Atlas to find your way."
              : "WASD move · Space jump · V camera · F rover · Caps Lock map. Drag to look if mouse capture is unavailable."}</p>
            <button className="flight-menu-primary" type="button" onClick={props.onResume}><Play size={18} aria-hidden="true" /> Resume game <ChevronRight className="flight-menu-trailing" size={18} aria-hidden="true" /></button>
            {props.onFullscreen && <button className="flight-menu-action" type="button" onClick={props.onFullscreen}><Maximize2 size={18} aria-hidden="true" /> Return to fullscreen</button>}
          </>}

          {section === "camera" && <>
            <h3 id="flight-panel-title">Camera</h3>
            <fieldset className="flight-menu-options">
              <legend>View {props.mobile ? null : <kbd>V</kbd>}</legend>
              <div className="flight-menu-segments">
                <button type="button" aria-pressed={props.thirdPerson} onClick={() => props.onCamera(true)}>Third person</button>
                <button type="button" aria-pressed={!props.thirdPerson} onClick={() => props.onCamera(false)}>First person</button>
              </div>
            </fieldset>
            <label className="flight-menu-slider">
              <span>{props.mobile ? "Look sensitivity" : "Mouse sensitivity"} <output>{props.sensitivity.toFixed(1)}×</output></span>
              <input aria-label="Look sensitivity" type="range" min="0.3" max="2.5" step="0.1" value={props.sensitivity} onChange={event => props.onSensitivity(Number(event.target.value))} />
            </label>
            {!props.mobile && <button className="flight-menu-action" type="button" onClick={resumeMouseLook}><Mouse size={18} aria-hidden="true" /> Resume mouse look</button>}
          </>}

          {section === "graphics" && <>
            <h3 id="flight-panel-title">Graphics</h3>
            <fieldset className="flight-menu-options">
              <legend>Quality preset</legend>
              <div className="flight-menu-presets">
                {presets.map(preset => <button key={preset.id} type="button" aria-pressed={props.quality === preset.id} onClick={() => props.onQuality(preset.id)}>
                  <strong>{preset.label}</strong><span>{preset.id === "auto" && props.autoReport ? props.autoLabel : preset.detail}</span>
                </button>)}
              </div>
            </fieldset>
            {props.quality === "auto" && props.autoReport && <p className="flight-menu-note">{props.autoReport.startsWith("Checking") ? "Auto checks performance while you explore." : `Auto check: ${props.autoReport}`}</p>}
            <fieldset className="flight-menu-options">
              <legend>FPS meter</legend>
              <div className="flight-menu-segments">
                {meters.map(meter => <button key={meter.id} type="button" aria-pressed={props.performanceMeter === meter.id} onClick={() => props.onPerformanceMeter(meter.id)}>{meter.label}</button>)}
              </div>
            </fieldset>
          </>}

          {section === "exit" && <>
            <h3 id="flight-panel-title">Return to main menu?</h3>
            <p className="flight-menu-note">{props.story ? "Resume from your latest saved Story progress next time." : "Free Exploration starts a new session when you come back."}</p>
            <button className="flight-menu-depart" type="button" onClick={props.onMainMenu}><House size={18} aria-hidden="true" /> Return to main menu</button>
            <button className="flight-menu-action" type="button" onClick={props.onResume}>Keep playing</button>
          </>}
        </section>
      </div>
      {!props.mobile && <footer className="flight-menu-footer"><span><kbd>Tab</kbd> Navigate</span><span><kbd>Enter</kbd> Select</span><span><kbd>Esc</kbd> Resume</span></footer>}
    </dialog>
  );
}
