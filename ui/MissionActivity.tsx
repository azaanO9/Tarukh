"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import {
  SOLAR_BRUSH, WIRE_TERMINALS, brushSegment, connectWire, createBrushCoverage,
  validateActivityProof, wireRepairComplete,
  type ActivityProof, type ActivityTaskId, type BrushPoint, type WireRepairProof,
} from '../game/missionActivities';
import './missionActivity.css';

export interface MissionActivityProps {
  kind: 'wire-repair' | 'panel-cleaning';
  taskId: ActivityTaskId;
  onComplete: (proof: ActivityProof) => void;
  onCancel: () => void;
}

const symbols = { square: '■', circle: '●', triangle: '▲', diamond: '◆' };
const socketOrder = ['C', 'A', 'D', 'B'];
type BoardLayout = { width: number; height: number; ports: Record<string, BrushPoint> };

function WiringActivity({ taskId, onComplete, onCancel }: MissionActivityProps) {
  const [proof, setProof] = useState<WireRepairProof>({ kind: 'wire-repair', isolated: false, connections: [] });
  const proofRef = useRef(proof);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('First, isolate the power. Then match each wire to its letter and symbol.');
  const [preview, setPreview] = useState<{ from: string; x: number; y: number } | null>(null);
  const [layout, setLayout] = useState<BoardLayout>({ width: 640, height: 352, ports: {} });
  const [submitted, setSubmitted] = useState(false);
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; from: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const finish = useRef<HTMLButtonElement>(null);
  const complete = wireRepairComplete(proof);

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const ports: Record<string, BrushPoint> = {};
      element.querySelectorAll<HTMLElement>('[data-wire-port]').forEach(port => {
        const rect = port.getBoundingClientRect();
        ports[port.dataset.wirePort!] = { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
      });
      setLayout({ width: bounds.width, height: bounds.height, ports });
    };
    const frame = requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  function chooseSource(id: string) {
    if (!proofRef.current.isolated) { setMessage('Isolate the power before touching the connectors.'); return; }
    if (proofRef.current.connections.some(link => link.from === id)) return;
    setSelected(id);
    setMessage(`Wire ${id} selected. Find socket ${id} with the same symbol.`);
  }

  function connect(from: string, to: string) {
    if (from !== to) {
      setMessage(`That is socket ${to}. Wire ${from} needs socket ${from}; match the letter and symbol. Nothing was changed.`);
      return;
    }
    const next = connectWire(proofRef.current, from, to);
    if (next === proofRef.current) return;
    proofRef.current = next;
    setProof(next);
    setSelected(null);
    const done = wireRepairComplete(next);
    setMessage(done ? 'All four circuits match. Finish repair to reconnect the shared supply.' : `Wire ${from} connected. Choose another wire.`);
    requestAnimationFrame(() => {
      if (done) finish.current?.focus();
      else board.current?.querySelector<HTMLButtonElement>('[data-wire-source]:not(:disabled)')?.focus();
    });
  }

  function releaseDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    if (!cancelled) {
      const socket = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-wire-target]');
      if (socket && board.current?.contains(socket)) {
        connect(active.from, socket.dataset.wireTarget!);
        suppressClick.current = true;
      } else if (active.moved) {
        setMessage(`Wire ${active.from} is still selected. Drop on its matching socket, or click the socket.`);
        suppressClick.current = true;
      }
    }
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function reset() {
    const fresh: WireRepairProof = { kind: 'wire-repair', isolated: false, connections: [] };
    proofRef.current = fresh;
    setProof(fresh);
    setSelected(null);
    setPreview(null);
    drag.current = null;
    suppressClick.current = false;
    setSubmitted(false);
    setMessage('Board reset. Isolate the power, then reconnect the four matching circuits.');
  }

  const wirePath = (a: BrushPoint, b: BrushPoint) => `M ${a.x} ${a.y} C ${a.x + (b.x - a.x) * .45} ${a.y}, ${b.x - (b.x - a.x) * .45} ${b.y}, ${b.x} ${b.y}`;

  return <section className="mission-activity ma-wiring" data-mission-activity="wire-repair">
    <div className="ma-heading"><span className="ma-kicker">CLUSTER C · CONNECTOR BAY</span><h3>Restore the circuit</h3><p>Drag a wire to its matching socket, or click a wire and then a socket. Keyboard: Tab to a button, then Enter.</p></div>
    <button className="ma-isolator" role="switch" aria-checked={proof.isolated} aria-label="Isolate the power" disabled={submitted} onClick={() => {
      const next = { ...proofRef.current, isolated: !proofRef.current.isolated };
      proofRef.current = next; setProof(next); setSelected(null);
      setMessage(next.isolated ? 'Power isolated. The board is ready: match A, B, C and D.' : 'Power restored. Isolate it again before continuing the repair.');
    }}><span className="ma-switch-track" aria-hidden="true"><i /></span><span><strong>{proof.isolated ? 'Power isolated' : '1 · Isolate the power'}</strong><small>{proof.isolated ? 'Safe to match the simulated connectors' : 'Switch the training circuit off before wiring'}</small></span></button>
    <div className="ma-board-labels" aria-hidden="true"><span>2 · SUPPLY WIRES</span><span>MATCHING SOCKETS</span></div>
    <div ref={board} className="ma-wire-board" onPointerMove={event => {
      const active = drag.current;
      if (!active || active.id !== event.pointerId) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 7) active.moved = true;
      setPreview({ from: active.from, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }} onPointerUp={event => releaseDrag(event)} onPointerCancel={event => releaseDrag(event, true)} onLostPointerCapture={() => { drag.current = null; setPreview(null); }}>
      <svg className="ma-wires" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
        {proof.connections.map(link => {
          const a = layout.ports[`source-${link.from}`], b = layout.ports[`target-${link.to}`];
          if (!a || !b) return null;
          const color = WIRE_TERMINALS.find(terminal => terminal.id === link.from)!.color;
          return <g key={link.from}><path d={wirePath(a, b)} stroke="#060c13" strokeWidth="12" /><path d={wirePath(a, b)} stroke={color} strokeWidth="6" /><path d={wirePath(a, b)} stroke="#fff" strokeWidth="1" opacity=".5" /></g>;
        })}
        {preview && layout.ports[`source-${preview.from}`] && <path d={wirePath(layout.ports[`source-${preview.from}`], preview)} stroke="#fff" strokeWidth="3" strokeDasharray="7 6" />}
      </svg>
      <div className="ma-wire-column">{WIRE_TERMINALS.map(terminal => {
        const connected = proof.connections.some(link => link.from === terminal.id);
        return <button key={terminal.id} data-wire-source={terminal.id} aria-label={`Source ${terminal.id} · ${terminal.label}`} aria-pressed={selected === terminal.id} className="ma-terminal ma-source" style={{ '--wire-color': terminal.color } as CSSProperties} disabled={!proof.isolated || connected || submitted} onPointerDown={event => {
          if (event.button !== 0 || !proofRef.current.isolated) return;
          chooseSource(terminal.id);
          drag.current = { id: event.pointerId, from: terminal.id, x: event.clientX, y: event.clientY, moved: false };
          board.current?.setPointerCapture(event.pointerId);
        }} onClick={event => { if (suppressClick.current && event.detail > 0) { suppressClick.current = false; return; } suppressClick.current = false; chooseSource(terminal.id); }}>
          <span className="ma-terminal-symbol" aria-hidden="true">{symbols[terminal.shape]}</span><span><b>{terminal.id}</b><small>{terminal.label}</small></span><span className="ma-port" data-wire-port={`source-${terminal.id}`} aria-hidden="true">{connected ? '✓' : ''}</span>
        </button>;
      })}</div>
      <div className="ma-wire-column">{socketOrder.map(id => {
        const terminal = WIRE_TERMINALS.find(item => item.id === id)!;
        const connected = proof.connections.some(link => link.to === id);
        return <button key={id} data-wire-target={id} className="ma-terminal ma-target" aria-label={`Socket ${id} · ${terminal.label}`} style={{ '--wire-color': terminal.color } as CSSProperties} disabled={!proof.isolated || connected || submitted} onClick={() => {
          if (selected) connect(selected, id); else setMessage('Choose a supply wire on the left first.');
        }}><span className="ma-port" data-wire-port={`target-${id}`} aria-hidden="true">{connected ? '✓' : ''}</span><span className="ma-terminal-symbol" aria-hidden="true">{symbols[terminal.shape]}</span><span><b>{id}</b><small>{terminal.label}</small></span></button>;
      })}</div>
    </div>
    <div className="ma-progress"><span>{proof.connections.length} / 4 circuits connected</span><progress aria-label="Connected circuits" value={proof.connections.length} max={4} /></div>
    <p className="ma-feedback" role="status">{message}</p>
    <p className="ma-science">A complete circuit needs the right connections. This simplified training board is not a guide to repairing real electrical equipment.</p>
    <div className="ma-actions"><button ref={finish} className="ely-primary" disabled={!complete || submitted} onClick={() => {
      if (submitted || !validateActivityProof(taskId, proofRef.current)) return;
      setSubmitted(true); onComplete(proofRef.current);
    }}>Finish repair</button><button onClick={reset}>Reset activity</button><button onClick={onCancel}>Close · keep the mission unchanged</button></div>
  </section>;
}

const PANEL_WIDTH = 960;
const PANEL_HEIGHT = 480;
type PanelPaint = { base: HTMLCanvasElement; dust: HTMLCanvasElement; context: CanvasRenderingContext2D };

function paintPanel(base: HTMLCanvasElement, dust: HTMLCanvasElement) {
  const ctx = base.getContext('2d')!, dirt = dust.getContext('2d')!;
  const glass = ctx.createLinearGradient(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  glass.addColorStop(0, '#103e62'); glass.addColorStop(.52, '#10243f'); glass.addColorStop(1, '#225377');
  ctx.fillStyle = glass; ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  for (let row = 0; row < 4; row++) for (let column = 0; column < 8; column++) {
    const x = column * 120 + 5, y = row * 120 + 5;
    ctx.strokeStyle = '#7294b8'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 110, 110);
    ctx.strokeStyle = '#406381'; ctx.lineWidth = 1;
    for (let line = 1; line < 8; line++) { ctx.beginPath(); ctx.moveTo(x + line * 14, y); ctx.lineTo(x + line * 14, y + 110); ctx.stroke(); }
    ctx.fillStyle = '#a1bfd080'; ctx.fillRect(x, y + 32, 110, 2); ctx.fillRect(x, y + 76, 110, 2);
  }
  const reflection = ctx.createLinearGradient(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  reflection.addColorStop(0, '#d9f6ff24'); reflection.addColorStop(.45, '#d9f6ff04'); reflection.addColorStop(.7, '#d9f6ff18'); reflection.addColorStop(1, '#d9f6ff00');
  ctx.fillStyle = reflection; ctx.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  dirt.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  const sand = dirt.createLinearGradient(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  sand.addColorStop(0, '#b67749'); sand.addColorStop(.5, '#96603f'); sand.addColorStop(1, '#cb9860');
  dirt.fillStyle = sand; dirt.fillRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT);
  let seed = 18713;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let grain = 0; grain < 9000; grain++) {
    dirt.fillStyle = grain % 2 ? '#f4c98930' : '#38241a20';
    const x = random() * PANEL_WIDTH, y = random() * PANEL_HEIGHT, size = 1 + random() * 3;
    dirt.fillRect(x, y, size, size);
  }
  dirt.strokeStyle = '#efd1a215'; dirt.lineWidth = 3;
  for (let y = -80; y < PANEL_HEIGHT + 80; y += 34) { dirt.beginPath(); dirt.moveTo(0, y); dirt.bezierCurveTo(300, y + 65, 660, y - 60, PANEL_WIDTH, y + 25); dirt.stroke(); }
}

function CleaningActivity({ taskId, onComplete, onCancel }: MissionActivityProps) {
  const [coverage, setCoverage] = useState(createBrushCoverage);
  const coverageRef = useRef(coverage);
  const [cursor, setCursor] = useState<BrushPoint>({ x: .5, y: .5 });
  const cursorRef = useRef<BrushPoint>({ x: .5, y: .5 });
  const [message, setMessage] = useState('Sweep the dust away. Clean at least 85% of the panel and reach every quarter.');
  const [submitted, setSubmitted] = useState(false);
  const [canvasAvailable, setCanvasAvailable] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const paint = useRef<PanelPaint | null>(null);
  const strokes = useRef<BrushPoint[][]>([]);
  const pointCount = useRef(0);
  const activeStroke = useRef<number | null>(null);
  const previous = useRef<BrushPoint | null>(null);
  const pointer = useRef<number | null>(null);
  const keyboardBrush = useRef(false);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) { const frame = requestAnimationFrame(() => setCanvasAvailable(false)); return () => cancelAnimationFrame(frame); }
    const base = document.createElement('canvas'), dust = document.createElement('canvas');
    base.width = dust.width = PANEL_WIDTH; base.height = dust.height = PANEL_HEIGHT;
    paintPanel(base, dust);
    paint.current = { base, dust, context };
    context.drawImage(base, 0, 0); context.drawImage(dust, 0, 0);
    return () => { paint.current = null; base.width = dust.width = 0; };
  }, []);

  function endStroke() { previous.current = null; activeStroke.current = null; }

  function erase(point: BrushPoint) {
    const from = previous.current ?? point;
    if (previous.current && Math.hypot(from.x - point.x, from.y - point.y) < .001) return;
    const next = brushSegment(coverageRef.current, from, point);
    if (pointCount.current >= SOLAR_BRUSH.maxPoints || (activeStroke.current === null && strokes.current.length >= SOLAR_BRUSH.maxStrokes)) {
      setMessage('The brush needs a fresh start. Reset this activity to keep cleaning; your mission progress is safe.'); return;
    }
    previous.current = point;
    if (activeStroke.current === null) {
      if (next === coverageRef.current) return;
      const newStroke = from.x === point.x && from.y === point.y ? [point] : [from, point];
      if (pointCount.current + newStroke.length > SOLAR_BRUSH.maxPoints) return;
      activeStroke.current = strokes.current.length; strokes.current.push(newStroke); pointCount.current += newStroke.length;
    } else { strokes.current[activeStroke.current].push(point); pointCount.current++; }
    coverageRef.current = next; setCoverage(next);
    const drawing = paint.current;
    if (drawing) {
      const dirt = drawing.dust.getContext('2d')!;
      dirt.globalCompositeOperation = 'destination-out'; dirt.strokeStyle = '#000'; dirt.fillStyle = '#000'; dirt.globalAlpha = 1;
      dirt.lineCap = 'round'; dirt.lineWidth = SOLAR_BRUSH.radius * PANEL_HEIGHT * 2;
      dirt.beginPath(); dirt.moveTo(from.x * PANEL_WIDTH, from.y * PANEL_HEIGHT); dirt.lineTo(point.x * PANEL_WIDTH, point.y * PANEL_HEIGHT); dirt.stroke();
      dirt.beginPath(); dirt.arc(point.x * PANEL_WIDTH, point.y * PANEL_HEIGHT, SOLAR_BRUSH.radius * PANEL_HEIGHT, 0, Math.PI * 2); dirt.fill();
      dirt.globalCompositeOperation = 'source-over';
      drawing.context.clearRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT); drawing.context.drawImage(drawing.base, 0, 0); drawing.context.drawImage(drawing.dust, 0, 0);
    }
    if (next.complete) setMessage('The panel is clean enough in every quarter. Finish cleaning to record the maintenance.');
    else if (next.ratio >= SOLAR_BRUSH.requiredCoverage) setMessage('Good coverage. Give the less-clean quarters another sweep to finish evenly.');
  }

  function moveBrush(x: number, y: number, brushing = false) {
    const point = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    cursorRef.current = point; setCursor(point);
    if (brushing) erase(point);
  }

  function pointerPoint(event: PointerEvent<HTMLDivElement>): BrushPoint | null {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width, y = (event.clientY - bounds.top) / bounds.height;
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
  }

  function stopPointer(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null; endStroke();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function brushHere() { endStroke(); erase(cursorRef.current); endStroke(); }

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault(); event.stopPropagation();
      if (!keyboardBrush.current) endStroke();
      moveBrush(cursorRef.current.x + direction[0] / SOLAR_BRUSH.columns, cursorRef.current.y + direction[1] / SOLAR_BRUSH.rows, keyboardBrush.current);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (!keyboardBrush.current) { endStroke(); keyboardBrush.current = true; erase(cursorRef.current); }
    }
  }

  function reset() {
    const fresh = createBrushCoverage(); coverageRef.current = fresh; setCoverage(fresh);
    strokes.current = []; pointCount.current = 0; pointer.current = null; keyboardBrush.current = false; endStroke();
    setSubmitted(false); moveBrush(.5, .5);
    const drawing = paint.current;
    if (drawing) { paintPanel(drawing.base, drawing.dust); drawing.context.drawImage(drawing.base, 0, 0); drawing.context.drawImage(drawing.dust, 0, 0); }
    setMessage('Fresh panel. Sweep all four quarters; there is no timer.');
  }

  const percent = Math.floor(coverage.ratio * 100);
  return <section className="mission-activity ma-cleaning" data-mission-activity="panel-cleaning" data-cleaned-percent={percent}>
    <div className="ma-heading"><span className="ma-kicker">SOLAR ARRAY · SURFACE MAINTENANCE</span><h3>Let the sunlight through</h3><p>Drag the brush across the dusty glass. Clean at least {SOLAR_BRUSH.requiredCoverage * 100}% overall and {SOLAR_BRUSH.requiredQuadrantCoverage * 100}% of each quarter.</p></div>
    <p id="ma-brush-help" className="ma-keyboard-help">Keyboard: focus the panel, move with arrow keys, and press Space or Enter to brush. Hold Space while using arrows for a continuous sweep.</p>
    <div className="ma-panel-frame"><div ref={surface} className="ma-brush-surface" role="application" aria-label="Solar panel cleaning surface" aria-describedby="ma-brush-help ma-clean-progress" tabIndex={0} onKeyDown={keys} onKeyUp={event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); keyboardBrush.current = false; endStroke(); }
    }} onBlur={() => { keyboardBrush.current = false; endStroke(); }} onPointerDown={event => {
      if (event.button !== 0 || pointer.current !== null || submitted) return;
      event.preventDefault(); event.currentTarget.focus(); keyboardBrush.current = false; endStroke();
      pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointerPoint(event); if (point) moveBrush(point.x, point.y, true);
    }} onPointerMove={event => {
      const point = pointerPoint(event);
      if (!point) { if (pointer.current === event.pointerId) endStroke(); return; }
      if (pointer.current !== null && pointer.current !== event.pointerId) return;
      moveBrush(point.x, point.y, pointer.current === event.pointerId);
    }} onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={() => { pointer.current = null; endStroke(); }}>
      <canvas ref={canvas} width={PANEL_WIDTH} height={PANEL_HEIGHT} aria-hidden="true" />
      {!canvasAvailable && <div className="ma-panel-fallback" aria-hidden="true">{coverage.cells.map((clean, index) => <i key={index} data-clean={clean} />)}</div>}
      <span className="ma-brush-cursor" aria-hidden="true" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, width: `${SOLAR_BRUSH.radius / SOLAR_BRUSH.aspectRatio * 200}%`, height: `${SOLAR_BRUSH.radius * 200}%` }}>✦</span>
      <span className="ma-panel-corner" aria-hidden="true">ARRAY C / GLASS SURFACE</span>
    </div></div>
    <div className="ma-clean-readout" id="ma-clean-progress"><div className="ma-progress"><strong>{percent}% clean</strong><progress aria-label="Clean panel area" value={coverage.cleaned} max={coverage.total} /></div><div className="ma-quadrants" aria-label="Coverage by quarter">{coverage.quadrants.map((value, index) => <span key={index} data-ready={value >= SOLAR_BRUSH.requiredQuadrantCoverage}>{['Upper left', 'Upper right', 'Lower left', 'Lower right'][index]} <b>{Math.floor(value * 100)}% {value >= SOLAR_BRUSH.requiredQuadrantCoverage ? '✓' : ''}</b></span>)}</div></div>
    <div className="ma-brush-controls" role="group" aria-label="Brush controls">
      <button aria-label="Move brush left" onClick={() => { endStroke(); moveBrush(cursorRef.current.x - 1 / SOLAR_BRUSH.columns, cursorRef.current.y); }}>←</button>
      <button aria-label="Move brush up" onClick={() => { endStroke(); moveBrush(cursorRef.current.x, cursorRef.current.y - 1 / SOLAR_BRUSH.rows); }}>↑</button>
      <button onClick={brushHere}>Brush here</button>
      <button aria-label="Move brush down" onClick={() => { endStroke(); moveBrush(cursorRef.current.x, cursorRef.current.y + 1 / SOLAR_BRUSH.rows); }}>↓</button>
      <button aria-label="Move brush right" onClick={() => { endStroke(); moveBrush(cursorRef.current.x + 1 / SOLAR_BRUSH.columns, cursorRef.current.y); }}>→</button>
    </div>
    <p className="ma-feedback" role="status">{message}</p>
    <p className="ma-science">Dust blocks sunlight from reaching solar cells. NASA’s InSight used wind-blown sand to help clear dust; this hand brush is a fictional training tool. Brushing the same clean spot again does not earn extra coverage. <a href="https://www.jpl.nasa.gov/news/nasas-insight-mars-lander-gets-a-power-boost/" target="_blank" rel="noreferrer">NASA/JPL · How InSight cleared dust ↗</a></p>
    <div className="ma-actions"><button className="ely-primary" disabled={!coverage.complete || submitted} onClick={() => {
      const proof: ActivityProof = { kind: 'panel-cleaning', strokes: strokes.current.map(stroke => stroke.map(point => ({ ...point }))) };
      if (submitted || !validateActivityProof(taskId, proof)) return;
      setSubmitted(true); onComplete(proof);
    }}>Finish cleaning</button><button onClick={reset}>Reset activity</button><button onClick={onCancel}>Close · keep the mission unchanged</button></div>
  </section>;
}

/** Render inside the existing mission dialog; the caller owns its focus trap and close action. */
export default function MissionActivity(props: MissionActivityProps) {
  return props.kind === 'wire-repair' ? <WiringActivity key={props.taskId} {...props} /> : <CleaningActivity key={props.taskId} {...props} />;
}
