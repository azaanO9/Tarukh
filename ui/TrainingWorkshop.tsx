"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import {
  createTrainingProof, evaluateTraining, trainingDefinition,
  type TrainingDefinition, type TrainingId, type TrainingProof,
} from '../game/trainingActivities';
import { REGION_WORLD_BOUNDS } from '../game/marsRegion';
import { assetUrl } from '../lib/assetUrl';
import './trainingWorkshop.css';

export interface TrainingWorkshopProps {
  activityId: TrainingId;
  allowedChoices?: string[];
  onComplete: (proof: TrainingProof) => void;
  onCancel: () => void;
}

type Item = TrainingDefinition['items'][number];
type Control = TrainingDefinition['controls'][number];
type UpdateProof = (change: (previous: TrainingProof) => TrainingProof) => void;

/** Small original illustrations make the material itself readable, without loading assets. */
function HardwareIcon({ id, label }: { id: string; label: string }) {
  const rock = /rock|sample/i.test(id);
  return <svg className="tw-hardware-icon" viewBox="0 0 100 84" role="img" aria-label={label}>
    <ellipse cx="50" cy="73" rx="35" ry="5" fill="#0005" />
    {rock ? <>
      <path d="M17 61 23 34 43 17 72 23 85 49 76 68 40 72Z" fill={id.endsWith('2') ? '#bd976a' : id.endsWith('3') ? '#647a83' : '#a56e52'} stroke="#e8b98a" strokeWidth="2" />
      <path d="m23 34 26 9 23-20M49 43l-9 29m9-29 36 6" stroke="#ffffff20" strokeWidth="3" fill="none" />
      {id.endsWith('2') && Array.from({ length: 22 }, (_, i) => <circle key={i} cx={30 + (i * 17) % 40} cy={33 + (i * 13) % 28} r={1.5 + i % 2} fill={i % 2 ? '#ead3ae' : '#78614a'} />)}
      {id.endsWith('3') && [[38, 40], [60, 35], [65, 56], [36, 58], [51, 49]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="5" ry="4" fill="#253b43" stroke="#8da1a7" />)}
    </> : /water/i.test(id) ? <>
      <rect x="29" y="20" width="43" height="48" rx="9" fill="#9ec8cf" stroke="#e0f4f1" strokeWidth="2" /><rect x="36" y="10" width="29" height="14" rx="3" fill="#7f94a1" />
      <path d="M50 32c-5 8-10 12-10 18a10 10 0 0 0 20 0c0-6-5-10-10-18Z" fill="#167b9d" />
    </> : /seed|food|plant/i.test(id) ? <>
      <path d="M26 24h48l5 43H21Z" fill="#c8ad78" stroke="#f2dfb6" strokeWidth="2" /><path d="M25 24h50l-5-11H30Z" fill="#e2d0a9" />
      <path d="M50 60V38m0 13C31 52 30 35 34 34c11 0 15 8 16 17Zm0-7c1-13 9-18 19-16 1 13-10 18-19 16Z" fill="#496b49" stroke="#6f9360" strokeWidth="2" />
    </> : /tool/i.test(id) ? <>
      <rect x="18" y="29" width="65" height="39" rx="6" fill="#db9456" stroke="#f6c38b" strokeWidth="2" /><path d="M38 30V19h26v11" stroke="#9aaab2" strokeWidth="7" fill="none" /><path d="m35 58 21-18m3 1 5 6m-29 7 4 5" stroke="#314353" strokeWidth="7" />
    </> : /plug|socket/i.test(id) ? <>
      <path d="M50 65v16" stroke="#8b9daa" strokeWidth="8" /><rect x="25" y="21" width="50" height="42" rx="8" fill="#416879" stroke="#a0d6e3" strokeWidth="3" /><path d="M37 21V9m26 12V9" stroke="#e6d5a7" strokeWidth="7" /><circle cx="50" cy="42" r="11" fill="#102735" />
    </> : /packet/i.test(id) ? <>
      <rect x="19" y="17" width="64" height="51" rx="5" fill="#284f66" stroke="#7fc8de" strokeWidth="2" /><path d="M29 30h44M29 40h30M29 50h39" stroke="#9de3e6" strokeWidth="4" />
    </> : <>
      <rect x="25" y="20" width="50" height="47" rx="7" fill="#668790" stroke="#b9d4d7" strokeWidth="2" /><path d="M36 20V12h28v8" fill="none" stroke="#d4ba88" strokeWidth="5" /><path d="m54 28-15 23h13l-5 13 17-24H52Z" fill="#f5c06c" />
    </>}
  </svg>;
}

function SupplyItem({ item, selected, onSelect, onDrag }: {
  item: Item; selected: boolean; onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  onDrag: (event: PointerEvent<HTMLButtonElement>, item: Item) => void;
}) {
  return <button className="tw-item" data-selected={selected} data-training-item={item.id} aria-pressed={selected}
    onPointerDown={event => onDrag(event, item)} onClick={onSelect}>
    <HardwareIcon id={item.id} label={item.label} /><strong>{item.label}</strong>
    {item.symbol && <span className="tw-item-symbol" aria-hidden="true">{item.symbol}</span>}
  </button>;
}

function PlacementBoard({ definition, proof, update, tell }: {
  definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof; tell: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ pointer: number; item: string } | null>(null);
  const suppressClick = useRef(false);
  const placements = proof.placements ?? {};

  function place(itemId: string, targetId: string) {
    const item = definition.items.find(entry => entry.id === itemId)!;
    const target = definition.targets.find(entry => entry.id === targetId)!;
    update(previous => ({ ...previous, placements: { ...previous.placements, [itemId]: targetId } }));
    const correct = definition.placements[itemId] === targetId;
    tell(correct ? `${item.label} fitted in ${target.label}.` : `${item.label} is in ${target.label}. Compare the labels; you can move it again.`);
    setSelected(null);
  }

  function select(itemId: string, detail: number) {
    if (suppressClick.current && detail > 0) { suppressClick.current = false; return; }
    suppressClick.current = false;
    setSelected(itemId);
    tell(`Selected ${definition.items.find(item => item.id === itemId)!.label}. Choose a destination.`);
  }

  function stop(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const active = dragging.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (!cancel) {
      const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-training-target]');
      if (destination && board.current?.contains(destination)) {
        place(active.item, destination.dataset.trainingTarget!); suppressClick.current = true;
      }
    }
    dragging.current = null; setDragLabel(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const mode = definition.id === 'plan-submit' ? 'stamps' : definition.id === 'shelter-power' ? 'connectors' : /sample/.test(definition.id) ? 'samples' : 'cargo';
  return <div className="tw-placement" data-board-style={mode} ref={board} onPointerUp={event => stop(event)} onPointerCancel={event => stop(event, true)}
    onLostPointerCapture={() => { dragging.current = null; setDragLabel(null); }}>
    <p className="tw-control-help">Drag an item, or select it and then select its destination. Tab and Enter work too.</p>
    <div className="tw-item-tray" aria-label="Available equipment">{[...definition.items].reverse().map(item =>
      <div key={item.id} className="tw-item-holder" data-placed={Boolean(placements[item.id])}>
        <SupplyItem item={item} selected={selected === item.id} onSelect={event => select(item.id, event.detail)} onDrag={(event, entry) => {
          if (event.button !== 0) return;
          setSelected(entry.id); setDragLabel(entry.label);
          dragging.current = { pointer: event.pointerId, item: entry.id };
          board.current?.setPointerCapture(event.pointerId);
        }} />
        {placements[item.id] && <small>Placed · select to move</small>}
      </div>
    )}</div>
    <div className="tw-storage-rack" aria-label="Equipment destinations">{definition.targets.map((target, index) => {
      const contents = definition.items.filter(item => placements[item.id] === target.id);
      return <button key={target.id} className="tw-storage-slot" data-training-target={target.id}
        aria-label={`Place selected item in ${target.label}`} data-filled={contents.length > 0}
        onClick={() => selected ? place(selected, target.id) : tell('Select an item from the tray first.')}>
        <span className="tw-slot-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><strong>{target.label}</strong>
        <span className="tw-slot-cavity">{contents.length ? contents.map(item => <span key={item.id} className="tw-stored-item"><HardwareIcon id={item.id} label={item.label} /><span>{item.label}</span></span>) : <span className="tw-empty-slot">{mode === 'stamps' ? 'Fit system stamp' : mode === 'connectors' ? 'Socket ready' : 'Ready for an item'}</span>}</span>
      </button>;
    })}</div>
    {dragLabel && <p className="tw-drag-label" role="status">Moving {dragLabel} · release over a destination</p>}
  </div>;
}

function RotaryControl({ control, value, onChange, variant }: {
  control: Control; value: number; onChange: (value: number) => void; variant: string;
}) {
  const pointer = useRef<number | null>(null);
  const angle = -135 + (value - control.min) / Math.max(1, control.max - control.min) * 270;
  const targetAngle = control.target === undefined ? null : -135 + (control.target - control.min) / (control.max - control.min) * 270;
  const xy = (degrees: number, radius: number) => ({ x: 100 + Math.cos((degrees - 90) * Math.PI / 180) * radius, y: 100 + Math.sin((degrees - 90) * Math.PI / 180) * radius });
  const end = xy(angle, 60);
  function turn(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    let degrees = Math.atan2(event.clientY - bounds.top - bounds.height / 2, event.clientX - bounds.left - bounds.width / 2) * 180 / Math.PI + 90;
    if (degrees > 180) degrees -= 360;
    const raw = control.min + (Math.max(-135, Math.min(135, degrees)) + 135) / 270 * (control.max - control.min);
    onChange(Math.max(control.min, Math.min(control.max, control.min + Math.round((raw - control.min) / control.step) * control.step)));
  }
  return <section className="tw-dial-control" data-dial-style={variant}>
    <h4>{control.label}</h4>
    <div className="tw-dial" onPointerDown={event => { if (event.button !== 0) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); turn(event); }}
      onPointerMove={event => { if (pointer.current === event.pointerId) turn(event); }} onPointerUp={event => { pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="89" fill="#122735" stroke="#69818c" strokeWidth="5" /><circle cx="100" cy="100" r="76" fill="#0b1b25" stroke="#b0c2c2" strokeWidth="1" />
        {Array.from({ length: 13 }, (_, index) => { const tick = -135 + index * 22.5, a = xy(tick, 68), b = xy(tick, index % 3 === 0 ? 57 : 62); return <path key={index} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#cbdadd" strokeWidth={index % 3 === 0 ? 3 : 1} />; })}
        {targetAngle !== null && (() => { const a = xy(targetAngle, 80), b = xy(targetAngle, 63); return <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#9ee3ed" strokeWidth="7" />; })()}
        <path d={`M100 100L${end.x} ${end.y}`} stroke="#ffc479" strokeWidth="5" strokeLinecap="round" /><circle cx="100" cy="100" r="12" fill="#f0c58d" stroke="#172a36" strokeWidth="4" />
        <rect x="65" y="129" width="70" height="34" rx="4" fill="#d8e5cc" /><text x="100" y="153" textAnchor="middle" fill="#243528" fontSize="25" fontFamily="monospace">{value}</text>
      </svg>
    </div>
    {control.target !== undefined && <p className="tw-reference">Marked reference: <strong>{control.target}{control.unit ?? (variant === 'antenna' ? '°' : '')}</strong> {value === control.target && '✓ Matched'}</p>}
    <label className="tw-range"><span>{control.label}: {value}{control.unit ?? ''}</span><input type="range" aria-label={control.label} min={control.min} max={control.max} step={control.step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>
    <div className="tw-adjust-buttons"><button aria-label={`Decrease ${control.label}`} disabled={value <= control.min} onClick={() => onChange(value - control.step)}>−</button><span>Turn or use the slider</span><button aria-label={`Increase ${control.label}`} disabled={value >= control.max} onClick={() => onChange(value + control.step)}>+</button></div>
  </section>;
}

function RotationBoard({ definition, proof, update }: { definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof }) {
  const cable = definition.id === 'solar-trace';
  const air = definition.id === 'ventilation-check';
  const correct = definition.rotations.filter((tile, index) => proof.rotations?.[index] === tile.target).length;
  return <section className="tw-rotation-section" data-pipe-type={cable ? 'cable' : air ? 'air' : 'water'}>
    <p className="tw-control-help">Turn each piece to join its ends to the pale connector guides.</p>
    <div className="tw-flow-readout"><span className="tw-flow-symbol" aria-hidden="true">{cable ? 'ϟ' : air ? '↻' : '◉'}</span><span><strong>{correct === definition.rotations.length ? (cable ? 'Loose connector found' : 'Closed loop connected') : 'Path interrupted'}</strong><small>{correct} / {definition.rotations.length} joints aligned · {air ? 'Cabin air stays inside this loop' : cable ? 'Array → cable → connector' : 'Cabin tank → treatment → pump → return'}</small></span></div>
    <div className="tw-pipe-board">{definition.rotations.map((tile, index) => {
      const rotation = proof.rotations?.[index] ?? tile.initial;
      const aligned = rotation === tile.target;
      const ideal = [90, 180, 0, 270][index];
      const actual = ideal + (rotation - tile.target) * 90;
      return <button key={tile.id} className="tw-pipe-tile" data-training-tile={index} data-aligned={aligned} aria-label={`Turn ${tile.label} tile`} onClick={() => update(previous => ({ ...previous, rotations: definition.rotations.map((entry, i) => i === index ? ((previous.rotations?.[i] ?? entry.initial) + 1) % 4 : (previous.rotations?.[i] ?? entry.initial)) }))}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="1" y="1" width="118" height="118" rx="6" fill="#132d3b" stroke="#455f6c" strokeWidth="1" />
          <g transform={`rotate(${ideal} 60 60)`}><path d="M60 0V40Q60 60 80 60H120" fill="none" stroke="#e0f5f3" strokeWidth="5" strokeDasharray="5 4" opacity=".65" /><path d="M48 0h24M120 48v24" stroke="#b9d6d1" strokeWidth="6" /></g>
          <g transform={`rotate(${actual} 60 60)`}><path d="M60 0V40Q60 60 80 60H120" fill="none" stroke="#071720" strokeWidth="24" /><path d="M60 0V40Q60 60 80 60H120" fill="none" stroke={cable ? '#dba06e' : air ? '#b0b7c3' : '#51adc5'} strokeWidth={cable ? 11 : 17} /><path d="M60 0V40Q60 60 80 60H120" fill="none" stroke={aligned ? '#d5fff1' : '#ffffff4d'} strokeWidth="3" /><path d="M48 18h24M102 48v24" stroke="#3d5660" strokeWidth="7" /></g>
          <circle cx="20" cy="20" r="12" fill="#18313d" stroke="#809ea5" /><text x="20" y="25" textAnchor="middle" fontSize="14" fill="#ecf3ed">{index + 1}</text>
        </svg>
      </button>;
    })}</div><div className="tw-pipe-legend">{definition.rotations.map((tile, index) => <p key={tile.id}><strong>{index + 1}. {tile.label}</strong><span>{proof.rotations?.[index] === tile.target ? (cable && index === definition.rotations.length - 1 ? '✓ Fault location traced' : '✓ Ends joined') : '↻ Turn this piece'}</span></p>)}</div>
  </section>;
}

function SequenceBoard({ definition, proof, update, tell }: { definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof; tell: (message: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: string; pointer: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const steps = proof.steps ?? [];
  const radio = definition.id === 'review-ack';
  function fit(id: string, index: number) {
    update(previous => {
      const next = definition.sequence.map((_, i) => previous.steps?.[i] === id ? '' : previous.steps?.[i] ?? '');
      next[index] = id; return { ...previous, steps: next };
    });
    setSelected(null); tell(`Step ${index + 1} fitted. Follow the numbered labels to rebuild the ${radio ? 'message' : 'procedure'}.`);
  }
  return <div className="tw-sequence" ref={root} onPointerUp={event => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-step-slot]');
    if (target && root.current?.contains(target)) fit(active.id, Number(target.dataset.stepSlot));
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
    <h4>{radio ? 'Rebuild the delayed transmission' : 'Put the procedure in order'}</h4>
    <p className="tw-control-help">Drag a card into a slot, or select the card and then its slot.</p>
    <div className="tw-packet-tray">{[...definition.sequence].reverse().map(item => <button key={item.id} className="tw-packet" data-sequence-item={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} onPointerDown={event => {
      if (event.button !== 0) return; setSelected(item.id); drag.current = { id: item.id, pointer: event.pointerId }; root.current?.setPointerCapture(event.pointerId);
    }}><span aria-hidden="true">{radio ? '▤' : '▰'}</span>{item.label}</button>)}</div>
    <div className="tw-sequence-slots">{definition.sequence.map((item, index) => <button key={item.id} data-step-slot={index} className="tw-step-slot" data-ready={steps[index] === item.id} aria-label={`Procedure slot ${index + 1}`} onClick={() => selected ? fit(selected, index) : tell('Select a card first.')}><span>{index + 1}</span><strong>{definition.sequence.find(entry => entry.id === steps[index])?.label ?? 'Place a card here'}</strong>{steps[index] === item.id && <b aria-hidden="true">✓</b>}</button>)}</div>
  </div>;
}

function SensorWindows({ definition, proof, update }: { definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof }) {
  const drag = useRef<{ id: string; pointer: number; x: number; y: number } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState<{ id: string; x: number; y: number } | null>(null);
  const removed = proof.steps ?? [];
  function clear(id: string) {
    update(previous => ({ ...previous, steps: definition.sequence.filter(item => item.id === id || previous.steps?.includes(item.id)).map(item => item.id) }));
    requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('.tw-dust-cover') ?? panel.current?.closest('.training-workshop')?.querySelector<HTMLElement>('.tw-dial-control input'))?.focus());
  }
  return <section ref={panel} className="tw-sensor-unit"><div className="tw-sensor-badge">FIELD SENSOR · WINDOW CHECK</div><div className="tw-sensor-windows">{definition.sequence.map((item, index) => <div className="tw-sensor-window" key={item.id}><svg viewBox="0 0 120 100" aria-hidden="true"><rect x="6" y="5" width="108" height="90" rx="10" fill="#122e3f" stroke="#839aa7" strokeWidth="4" /><circle cx="60" cy="50" r="25" fill="#164d65" stroke="#6eb7c7" strokeWidth="3" /><circle cx="60" cy="50" r="12" fill="#8fd4de" /><path d="M60 13v15m0 44v15M23 50h15m44 0h15" stroke="#deebde" strokeWidth="2" /></svg>
      {!removed.includes(item.id) ? <button className="tw-dust-cover" aria-label={item.label} style={offset?.id === item.id ? { transform: `translate(${offset.x}px,${offset.y}px)` } : undefined} onClick={() => clear(item.id)} onPointerDown={event => { if (event.button !== 0) return; drag.current = { id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const active = drag.current; if (active?.pointer === event.pointerId) setOffset({ id: active.id, x: event.clientX - active.x, y: event.clientY - active.y }); }} onPointerUp={event => { const active = drag.current; if (active && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 18) clear(item.id); drag.current = null; setOffset(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; setOffset(null); }}><span>Lift {index + 1}</span><b aria-hidden="true">↗</b></button> : <span className="tw-window-ready">✓ Window clear</span>}
    </div>)}</div><p>Pull a cover away, or tap it to lift it. Then aim the antenna.</p></section>;
}

function GaugeChecks({ definition, proof, update }: { definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof }) {
  const panel = useRef<HTMLDivElement>(null);
  const ready = definition.rotations.every((tile, index) => proof.rotations?.[index] === tile.target);
  return <div ref={panel} className="tw-gauge-comparison">{definition.sequence.map((item, index) => {
    const read = proof.steps?.includes(item.id), value = index ? 62 : 40;
    return <button key={item.id} data-gauge-check={index} disabled={!ready || Boolean(read) || (index === 1 && !proof.steps?.includes(definition.sequence[0].id))} className="tw-inspection-gauge" onClick={() => {
      update(previous => ({ ...previous, steps: [...previous.steps ?? [], item.id] }));
      requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('.tw-inspection-gauge:not(:disabled)') ?? panel.current?.closest('.training-workshop')?.querySelector<HTMLElement>('.tw-actions .ely-primary'))?.focus());
    }}>
      <svg viewBox="0 0 160 130" aria-hidden="true"><rect x="4" y="4" width="152" height="122" rx="13" fill="#284554" stroke="#8ca5af" strokeWidth="3" /><path d="M30 88a50 50 0 0 1 100 0" stroke="#bcd6d3" strokeWidth="8" fill="none" /><path d={`M80 88l${index ? 22 : -17} -43`} stroke="#efbb76" strokeWidth="4" /><circle cx="80" cy="88" r="7" fill="#c8dfd7" /><text x="80" y="115" textAnchor="middle" fontSize="24" fill="#def2e9">{read ? value : '—'}</text></svg>
      <strong>{index ? 'Checked reference' : 'Installed sensor'}</strong><small>{read ? `${value} · reading recorded` : ready ? 'Lift cover · read gauge' : 'Connect the loop first'}</small>
    </button>;
  })}</div>;
}

function SampleSeals({ definition, proof, update }: { definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof }) {
  const panel = useRef<HTMLDivElement>(null);
  const packed = Object.entries(definition.placements).every(([id, target]) => proof.placements?.[id] === target);
  return <div ref={panel} className="tw-sample-seals" aria-label="Seal the sample boxes">{definition.sequence.map((step, index) => {
    const sealed = proof.steps?.includes(step.id);
    return <button key={step.id} data-sample-seal={index} disabled={!packed || Boolean(sealed) || (proof.steps?.length ?? 0) !== index} data-sealed={sealed} onClick={() => {
      update(previous => ({ ...previous, steps: [...previous.steps ?? [], step.id] }));
      requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('button:not(:disabled)') ?? panel.current?.closest('.training-workshop')?.querySelector<HTMLElement>('.tw-actions .ely-primary'))?.focus());
    }}><span aria-hidden="true">{sealed ? '▣' : '▱'}</span><strong>{step.label}</strong><small>{sealed ? '✓ Label secured' : packed ? 'Close the labelled latch' : 'Pack the samples first'}</small></button>;
  })}</div>;
}

function RouteBoard({ definition, proof, update, tell, allowedChoices }: {
  definition: TrainingDefinition; proof: TrainingProof; update: UpdateProof; tell: (message: string) => void; allowedChoices?: string[];
}) {
  const route = definition.routes.find(item => item.id === proof.choice);
  const steps = proof.steps ?? [];
  const pointer = useRef<number | null>(null);
  const liveSteps = useRef(steps);
  const board = useRef<HTMLDivElement>(null);
  const bounds = REGION_WORLD_BOUNDS;
  function add(id: string) {
    if (!route || (allowedChoices && !allowedChoices.includes(route.id))) { tell('Charge the rover before preparing this route.'); return; }
    const latest = liveSteps.current;
    if (latest.at(-1) === id) return;
    const expected = route.steps[latest.length];
    if (id !== expected) { tell(expected ? `Follow the marked route to ${definition.nodes.find(node => node.id === expected)?.label}.` : 'Route traced. Apply the plan when you are ready.'); return; }
    liveSteps.current = [...latest, id];
    update(previous => ({ ...previous, steps: liveSteps.current }));
    tell(liveSteps.current.length === route.steps.length ? 'Garage to sensor connected. Your rover can follow this plan.' : `${definition.nodes.find(node => node.id === id)!.label} reached on the plan.`);
  }
  const nodePoint = (id: string) => definition.nodes.find(node => node.id === id)!;
  const line = (ids: string[]) => ids.map(id => { const point = nodePoint(id); return `${point.x * 485 - 145},${point.y * 520 - 160}`; }).join(' ');
  return <section className="tw-route-workbench"><div className="tw-route-options" role="group" aria-label="Choose a rover route">{definition.choices.map(choice => <button key={choice.id} aria-pressed={proof.choice === choice.id} disabled={Boolean(allowedChoices && !allowedChoices.includes(choice.id))} onClick={() => { liveSteps.current = []; update(previous => ({ ...previous, choice: choice.id, steps: [] })); tell('Start at the garage, then join the numbered waypoints.'); }}><strong>{choice.label}</strong>{allowedChoices && !allowedChoices.includes(choice.id) && <small>Charge the rover first</small>}</button>)}</div>
    <p className="tw-control-help">Tap the numbered map pins in order, or drag through them. Buttons below provide the same controls.</p>
    <div className="tw-route-plot" ref={board} onPointerDown={event => { if (event.button !== 0) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); const node = (event.target as HTMLElement).closest<HTMLElement>('[data-route-node]'); if (node) add(node.dataset.routeNode!); }} onPointerMove={event => { if (pointer.current !== event.pointerId) return; const node = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-route-node]'); if (node && board.current?.contains(node)) add(node.dataset.routeNode!); }} onPointerUp={event => { pointer.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { pointer.current = null; }} onLostPointerCapture={() => { pointer.current = null; }}>
      <svg viewBox="-145 -160 485 520" aria-hidden="true"><image href={assetUrl('art/mars-mola-overview.webp')} x={bounds.west} y={bounds.north} width={bounds.east - bounds.west} height={bounds.south - bounds.north} preserveAspectRatio="none" /><rect x="-145" y="-160" width="485" height="520" fill="#00152255" />{route && <polyline points={line(route.steps)} fill="none" stroke="#f1ca8e" strokeWidth="5" strokeDasharray="9 9" />}<polyline points={line(steps)} fill="none" stroke="#93f0e7" strokeWidth="7" /><text x="-120" y="-125" fill="#fff" fontSize="22">N ↑</text></svg>
      {route?.steps.map((id, index) => { const node = nodePoint(id); return <button key={id} data-route-node={id} aria-label={`Waypoint ${index + 1}: ${node.label}`} data-visited={steps.includes(id)} style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }} onClick={() => add(id)}>{steps.includes(id) ? '✓' : index + 1}</button>; })}
    </div>
    <div className="tw-route-waypoints">{route?.steps.map((id, index) => <button key={id} onClick={() => add(id)}>{index + 1}. {nodePoint(id).label} {steps.includes(id) && '✓'}</button>)}</div>
    <button disabled={!steps.length} onClick={() => { liveSteps.current = steps.slice(0, -1); update(previous => ({ ...previous, steps: liveSteps.current })); }}>Undo last waypoint</button>
    <p className="tw-science">NASA MOLA measured elevation underneath; these local routes and shortened travel distances are fictional game planning. The live map and rover show simulated LiDAR.</p>
  </section>;
}

function WorkshopSession({ activityId, allowedChoices, onComplete, onCancel }: TrainingWorkshopProps) {
  const definition = trainingDefinition(activityId);
  const [proof, setProof] = useState(() => createTrainingProof(activityId));
  const proofRef = useRef(proof);
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const status = evaluateTraining(activityId, proof);
  const choiceAllowed = !allowedChoices || !status.choice || allowedChoices.includes(status.choice);
  const update: UpdateProof = change => { const next = change(proofRef.current); proofRef.current = next; setProof(next); setNotice(''); };
  const setControl = (id: string, value: number) => update(previous => ({ ...previous, values: { ...previous.values, [id]: value } }));
  const sensor = activityId === 'sensor-restore', radio = activityId === 'review-ack', taps = activityId === 'fault-water';
  const specificSequence = sensor || activityId === 'water-compare' || activityId === 'sample-collect';
  const reset = () => { const fresh = createTrainingProof(activityId); proofRef.current = fresh; setProof(fresh); setResetKey(value => value + 1); setSubmitted(false); setNotice('Workbench reset. Take your time; the mission is unchanged.'); };

  return <section className="training-workshop" data-training-activity={activityId} data-training-complete={status.complete}>
    <header className="tw-header"><span>ELYSIUM · HANDS-ON WORKBENCH</span><h3>{definition.title}</h3><p>{definition.instruction}</p></header>
    <div className="tw-instrument-bay" key={resetKey}>
      {definition.items.length > 0 && definition.targets.length > 0 && <PlacementBoard definition={definition} proof={proof} update={update} tell={setNotice} />}
      {definition.rotations.length > 0 && <RotationBoard definition={definition} proof={proof} update={update} />}
      {activityId === 'water-compare' && <GaugeChecks definition={definition} proof={proof} update={update} />}
      {activityId === 'sample-collect' && <SampleSeals definition={definition} proof={proof} update={update} />}
      {sensor && <SensorWindows definition={definition} proof={proof} update={update} />}
      {radio && <div className="tw-radio-display"><span>EARTH → MARS · DELAYED TRANSMISSION</span><svg viewBox="0 0 480 80" aria-hidden="true"><path d={Array.from({ length: 100 }, (_, i) => `${i ? 'L' : 'M'}${i * 4.8} ${40 + Math.sin(i * .65) * (3 + 27 * Math.max(0, 1 - Math.abs((proof.values?.radio ?? 10) - 42) / 50))}`).join(' ')} fill="none" stroke="#a7e8e4" strokeWidth="2" /></svg><p>{proof.values?.radio === 42 ? '✓ Channel aligned · assemble the message packets' : 'Turn toward the marked channel to strengthen the signal'}</p></div>}
      {taps && <div className="tw-water-manifold"><span>REPAIRED PUMP</span><div><p>◉ Cabin supply <b>{proof.values?.cabin ?? 0}/3</b></p><p>❧ Plant branch <b>{proof.values?.crops ?? 0}/3</b></p></div><p>Less water to crops leaves more for cabin needs while recovery catches up.</p></div>}
      {definition.controls.length > 0 && <div className="tw-controls">{definition.controls.map(control => <RotaryControl key={control.id} control={control} value={proof.values?.[control.id] ?? control.initial} onChange={value => setControl(control.id, value)} variant={sensor ? 'antenna' : radio ? 'radio' : taps ? 'valve' : 'calibration'} />)}</div>}
      {definition.sequence.length > 0 && !specificSequence && <SequenceBoard definition={definition} proof={proof} update={update} tell={setNotice} />}
      {definition.kind === 'route' && <RouteBoard definition={definition} proof={proof} update={update} tell={setNotice} allowedChoices={allowedChoices} />}
    </div>
    <div className="tw-progress"><progress aria-label="Workbench progress" value={status.progress} max={1} /><strong>{Math.round(status.progress * 100)}%</strong></div>
    <p className="tw-feedback" role="status">{notice || (!choiceAllowed ? 'Charge the rover before applying this route.' : status.feedback)}</p>
    <p className="tw-science">A simplified training model. No timer: explore the controls, reset, or close without changing your mission.</p>
    <footer className="tw-actions"><button className="ely-primary" disabled={!status.complete || !choiceAllowed || submitted} onClick={() => {
      const result = evaluateTraining(activityId, proofRef.current);
      if (submitted || !result.complete || (allowedChoices && result.choice && !allowedChoices.includes(result.choice))) return;
      setSubmitted(true); onComplete(structuredClone(proofRef.current));
    }}>Apply completed work</button><button onClick={reset}>Reset workbench</button><button onClick={onCancel}>Close · keep mission unchanged</button></footer>
  </section>;
}

export default function TrainingWorkshop(props: TrainingWorkshopProps) {
  return <WorkshopSession key={props.activityId} {...props} />;
}
