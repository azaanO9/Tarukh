"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  createTrainingProof, evaluateTraining, trainingDefinition,
  type TrainingDefinition, type TrainingId, type TrainingProof,
} from '../game/trainingActivities';
import './lifeSupportGames.css';

export interface LifeSupportGamesProps {
  activityId: TrainingId;
  allowedChoices?: string[];
  onComplete: (proof: TrainingProof) => void;
  onCancel: () => void;
}

type ChangeProof = (update: (previous: TrainingProof) => TrainingProof) => void;
type BoardProps = { definition: TrainingDefinition; proof: TrainingProof; change: ChangeProof };

const dialPlans: Partial<Record<TrainingId, string>> = {
  'water-plan': 'output', 'oxygen-plan': 'power', 'air-plan': 'regenerate',
  'fault-scrubber': 'response', 'shield-plan': 'layers',
};

function choiceLabel(activityId: TrainingId, id: string, fallback: string) {
  if (activityId === 'air-plan') return id === 'now' ? 'Clean used filter now' : 'Clean used filter later';
  if (activityId === 'fault-scrubber' && id === 'regenerate') return 'Clean used filter';
  return fallback;
}

function WaterToOxygen({ power }: { power: number }) {
  return <figure className="lg-oxygen-machine">
    <svg viewBox="0 0 480 180" aria-hidden="true">
      <path d="M60 23Q8 89 22 111Q60 153 98 111Q112 89 60 23Z" fill="#255967" stroke="#a7e4e8" strokeWidth="3" />
      <g stroke="#f6e8bf" strokeWidth="4"><path d="m62 82-21 20m21-20 22 20" /></g>
      <g fill="#c0edf1" stroke="#203b48" strokeWidth="2"><circle cx="62" cy="81" r="16" /><circle cx="39" cy="104" r="10" /><circle cx="85" cy="104" r="10" /></g>
      <path d="M112 88h63m82 0h50" stroke="#90dce3" strokeWidth={3 + power} opacity={.5 + power * .25} fill="none" />
      <path d="m298 81 10 7-10 7" stroke="#90dce3" strokeWidth="3" fill="none" />
      <rect x="175" y="42" width="82" height="93" rx="14" fill="#384f54" stroke="#d8bd83" strokeWidth="3" />
      <path d="m222 54-25 38h18l-9 28 29-41h-17Z" fill="#f5cb78" />
      {[0, 1, 2].map(i => <rect key={i} x={186 + i * 20} y="143" width="13" height="9" rx="2" fill={i <= power ? '#f5cb78' : '#3f575b'} />)}
      <rect x="319" y="24" width="136" height="112" rx="35" fill="#204c5c" stroke="#a7e4e8" strokeWidth="3" />
      <g fill="#c5f0f2" stroke="#1a4558" strokeWidth="3"><circle cx="367" cy="79" r="25" /><circle cx="403" cy="79" r="25" /></g>
      <g fill="#183b49" fontSize="22" fontWeight="700" textAnchor="middle"><text x="367" y="87">O</text><text x="403" y="87">O</text></g>
      <g fill="#e5e9dc" fontSize="15" textAnchor="middle"><text x="61" y="163">Water</text><text x="216" y="174">Power</text><text x="387" y="163">Breathing oxygen</text></g>
    </svg>
    <figcaption>Water + power → breathing oxygen</figcaption>
  </figure>;
}

function Plant({ light, water, seeded = true }: { light: number; water: number; seeded?: boolean }) {
  const healthy = light >= 12 && light <= 18 && water >= 45 && water <= 70;
  const leafSize = seeded ? Math.max(.28, Math.min(1, Math.min(light / 16, water / 60))) : 0;
  return <svg viewBox="0 0 180 150" className="lg-plant" aria-hidden="true">
    <path d="M28 112h124l-13 32H41Z" fill="#b46a42" stroke="#432e24" strokeWidth="3" />
    <ellipse cx="90" cy="112" rx="61" ry="11" fill="#382b25" />
    {seeded && <g transform={`translate(90 110) scale(${leafSize})`}>
      <path d="M0 0Q-5-35 1-65" fill="none" stroke="#9dc479" strokeWidth="5" />
      <path d="M0-25Q-46-62-41-23Q-21-9 0-25M0-47Q36-78 43-44Q23-23 0-47" fill={healthy ? '#bedc8d' : '#a7b679'} stroke="#304b38" strokeWidth="3" />
    </g>}
    {!seeded && <g fill="#dcad64"><ellipse cx="77" cy="109" rx="4" ry="3" /><ellipse cx="103" cy="114" rx="4" ry="3" /></g>}
    {water > 0 && <path d="M25 31q-9 14 0 17q9-3 0-17Z" fill="#8ee0eb" />}
    {light > 0 && <g stroke="#fbd388" fill="#fbd388"><circle cx="143" cy="26" r="9" /><path d="M143 9v-6m0 46v-6m17-17h6m-46 0h6m5-12-5-5m29 29 5 5" strokeWidth="2" /></g>}
  </svg>;
}

function Cabin({ layers = 0, wave = false }: { layers?: number; wave?: boolean }) {
  return <svg className="lg-shelter-art" viewBox="0 0 460 180" aria-hidden="true">
    <path d="M12 166H448" stroke="#cb916b" strokeWidth="5" />
    <g fill="#b9cbd0" stroke="#516a78" strokeWidth="3"><path d="M245 157v-77q0-48 58-48h60q58 0 58 48v77Z" /><path d="M305 157V93h51v64Z" fill="#193e51" /></g>
    {Array.from({ length: layers }, (_, layer) => <g key={layer} fill={layer ? '#b87b50' : '#d29a67'} stroke="#603d2f" strokeWidth="2">
      {Array.from({ length: 4 }, (_, block) => <rect key={block} x={213 - layer * 27} y={55 + block * 26} width="24" height="24" rx="3" />)}
    </g>)}
    <g fill="#f2d795"><circle cx="329" cy="89" r="9" /><path d="M318 105h22l5 28h-9v20h-6v-20h-5v20h-6v-20h-6Z" /></g>
    {wave && <g stroke="#f9c982" strokeWidth="2" fill="#f9c982">
      {[60, 85, 110, 135].map((y, i) => {
        const wall = layers ? 213 - (layers - 1) * 27 : 242;
        const passes = layers === 0 || (layers === 1 ? i % 2 === 1 : i === 3);
        return <g key={y}><path d={`M23 ${y}H${wall - 4}`} /><circle cx={wall - 4} cy={y} r="3" />
          {passes && <path d={`M${wall + 26} ${y}H399`} opacity={layers === 2 ? .3 : .55} strokeDasharray="7 5" />}
        </g>;
      })}
    </g>}
  </svg>;
}

function TokenBoard({ definition, proof, change }: BoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState('Pick up a piece, then choose where it belongs. You can also drag it.');
  const board = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; item: string; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const placements = proof.placements ?? {};
  const isBackup = definition.id === 'backup-plan';
  const label = (item: TrainingDefinition['items'][number]) => definition.id === 'oxygen-plan' ? item.id.startsWith('o') ? 'Oxygen' : 'Hydrogen' : item.label;

  function place(itemId: string, targetId: string) {
    const item = definition.items.find(candidate => candidate.id === itemId);
    const target = definition.targets.find(candidate => candidate.id === targetId);
    if (!item || !target) return;
    if (!isBackup && definition.placements[itemId] !== targetId) {
      setNotice(`${label(item)} does not belong there. Try another place; nothing is lost.`);
      return;
    }
    change(previous => ({ ...previous, placements: isBackup ? { [itemId]: targetId } : { ...previous.placements, [itemId]: targetId } }));
    setSelected(null);
    setNotice(`${label(item)} placed in ${target.label}.`);
  }

  function release(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    if (!cancel) {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-life-target]');
      if (target && board.current?.contains(target)) {
        place(active.item, target.dataset.lifeTarget!);
        suppressClick.current = true;
      } else if (Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) {
        suppressClick.current = true;
      }
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <div className={`lg-token-board lg-token-board--${definition.id}`} ref={board} onPointerUp={release} onPointerCancel={event => release(event, true)}>
    <div className="lg-parts" aria-label="Pieces to move">
      {definition.items.map((item, index) => <button type="button" key={item.id}
        className={`lg-token ${placements[item.id] ? 'lg-token--placed' : ''}`}
        data-life-item={item.id} aria-pressed={selected === item.id}
        aria-label={`${label(item)}${definition.id === 'oxygen-plan' ? ` ${index + 1}` : ''}${placements[item.id] ? ' · placed' : ''}`}
        onPointerDown={event => {
          if (event.button !== 0) return;
          suppressClick.current = false;
          setSelected(item.id);
          drag.current = { pointer: event.pointerId, item: item.id, x: event.clientX, y: event.clientY };
          board.current?.setPointerCapture(event.pointerId);
        }}
        onClick={event => {
          if (suppressClick.current && event.detail > 0) { suppressClick.current = false; return; }
          suppressClick.current = false;
          setSelected(item.id);
          setNotice(`${label(item)} picked up. Choose a destination.`);
        }}>
        <span className="lg-token-symbol" aria-hidden="true">{item.symbol ?? '◇'}</span>
        <span>{label(item)}</span>{placements[item.id] && <span className="lg-tick" aria-hidden="true">✓</span>}
      </button>)}
    </div>
    <div className="lg-destinations">
      {definition.targets.map(target => <button type="button" key={target.id} data-life-target={target.id}
        className={`lg-destination ${selected ? 'lg-destination--ready' : ''}`}
        onClick={() => selected ? place(selected, target.id) : setNotice('Pick a piece above first, then place it here.')}>
        <strong>{target.label}</strong>
        <span className="lg-target-fill" aria-hidden="true">
          {definition.items.filter(item => placements[item.id] === target.id).map(item => <span key={item.id}>{item.symbol ?? '◆'}</span>)}
          {!Object.values(placements).includes(target.id) && <span className="lg-target-empty">＋</span>}
        </span>
        <span className="lg-target-caption">{selected ? 'Place selected piece' : 'Tap or drop here'}</span>
      </button>)}
    </div>
    <p className="lg-help" role="status">{notice}</p>
  </div>;
}

function Dial({ control, value, onChange, labels }: {
  control: TrainingDefinition['controls'][number]; value: number; onChange: (value: number) => void; labels?: string[];
}) {
  const id = `life-dial-${control.id}`;
  const valueText = labels?.[value] ?? `${value}${control.unit ? ` ${control.unit}` : ''}`;
  return <div className="lg-dial">
    <label htmlFor={id}><strong>{control.label}</strong><output htmlFor={id}>{valueText}</output></label>
    {control.target !== undefined && <span className="lg-target-mark">Marked target: {control.target}</span>}
    <div className="lg-dial-track">
      <button type="button" aria-label={`Decrease ${control.label}`} disabled={value <= control.min} onClick={() => onChange(Math.max(control.min, value - control.step))}>−</button>
      <input id={id} type="range" min={control.min} max={control.max} step={control.step} value={value} aria-valuetext={valueText}
        onChange={event => onChange(Number(event.target.value))} />
      <button type="button" aria-label={`Increase ${control.label}`} disabled={value >= control.max} onClick={() => onChange(Math.min(control.max, value + control.step))}>＋</button>
    </div>
    {labels && <div className="lg-dial-labels">{labels.map((label, index) => <button key={label} type="button" aria-pressed={index === value} onClick={() => onChange(index)}>{label}</button>)}</div>}
  </div>;
}

function EnergyBoard({ definition, proof, change }: BoardProps) {
  const movable = definition.controls.filter(control => control.id !== 'essentials');
  const total = definition.id === 'grid-plan' ? 5 : 1;
  const assigned = movable.reduce((sum, control) => sum + (proof.values?.[control.id] ?? 0), 0);
  const spare = total - assigned;
  function adjust(id: string, delta: number) {
    change(previous => ({ ...previous, values: { ...previous.values, [id]: (previous.values?.[id] ?? 0) + delta } }));
  }
  return <div className="lg-energy-board">
    <div className="lg-energy-supply"><span aria-hidden="true">☀</span><div><strong>Energy to share</strong><p>{spare} of {total} movable cells remain</p></div>
      <div className="lg-cells" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} data-filled={i < spare} />)}</div>
    </div>
    <div className="lg-energy-stations">
      {definition.controls.map(control => {
        const count = proof.values?.[control.id] ?? control.initial;
        const fixed = control.id === 'essentials';
        return <div key={control.id} className="lg-energy-station" data-energy-station={control.id}>
          <span className="lg-hardware-symbol" aria-hidden="true">{{ essentials: '⌂', rover: '▰', crops: '❧', reserve: '▣', heater: '♨' }[control.id]}</span>
          <strong>{control.label}</strong><span>{count} {count === 1 ? 'cell' : 'cells'}</span>
          <div className="lg-cells" aria-hidden="true">{Array.from({ length: fixed ? 3 : total }, (_, i) => <i key={i} data-filled={i < count} />)}</div>
          {fixed ? <span className="lg-fixed">🔒 Always connected</span> : <div className="lg-cell-buttons">
            <button type="button" disabled={!count} aria-label={`Take one cell from ${control.label}`} onClick={() => adjust(control.id, -1)}>−</button>
            <button type="button" disabled={spare <= 0} aria-label={`Give one cell to ${control.label}`} onClick={() => adjust(control.id, 1)}>＋</button>
          </div>}
        </div>;
      })}
    </div>
  </div>;
}

function StepMachine({ definition, proof, change }: BoardProps) {
  const [message, setMessage] = useState('Use the machine in the marked order.');
  const done = proof.steps ?? [];
  const isArchive = definition.id === 'archive-review';
  function step(id: string) {
    const expected = definition.sequence[done.length];
    if (id !== expected?.id) { setMessage('Start at the first empty stage, then work forward.'); return; }
    if (definition.id === 'plant-plan' && (Object.keys(proof.placements ?? {}).length < 2 || (proof.values?.water ?? 0) === 0 || (proof.values?.light ?? 0) === 0)) {
      setMessage('Plant both trays and turn on some water and light before the trial.');
      return;
    }
    change(previous => ({ ...previous, steps: [...(previous.steps ?? []), id] }));
    setMessage(`${expected.label} complete.`);
  }
  return <div className="lg-step-machine">
    {isArchive && <div className="lg-archive-banner"><span aria-hidden="true">☀</span><span>ARCHIVE REHEARSAL · 2017<br />No countdown. Practise a safe response.</span></div>}
    <div className="lg-step-track">
      {(isArchive ? [...definition.sequence].reverse() : definition.sequence).map(item => {
        const index = definition.sequence.findIndex(candidate => candidate.id === item.id);
        return <button key={item.id} type="button" className="lg-machine-step" data-life-step={item.id}
          disabled={done.includes(item.id)} onClick={() => step(item.id)}>
          <span className="lg-step-symbol" aria-hidden="true">{done.includes(item.id) ? '✓' : isArchive ? ['☀', '⌁', '⌂'][index] : definition.id === 'plant-plan' ? ['◉', '☼'][index] : ['▤', '▥'][index]}</span>
          <span>{item.label}</span>
        </button>;
      })}
    </div>
    <div className="lg-sequence-slots" aria-label="Completed sequence">
      {definition.sequence.map((_, index) => <span key={index}>{index + 1}. {definition.sequence.find(item => item.id === done[index])?.label ?? 'Empty stage'}</span>)}
    </div>
    <p className="lg-help" role="status">{message}</p>
  </div>;
}

function ShieldBoard({ definition, proof, change }: BoardProps) {
  const [lastTest, setLastTest] = useState<number | null>(null);
  const [notice, setNotice] = useState('Test the existing structure first: zero added layers.');
  const layers = proof.values?.layers ?? 0;
  const steps = proof.steps ?? [];
  function testWave() {
    setLastTest(layers);
    if (!steps.includes('test-thin') && layers === 0) {
      change(previous => ({ ...previous, steps: ['test-thin'] }));
      setNotice('The structure gives some shelter. Add two layers and test again to compare.');
    } else if (steps.includes('test-thin') && !steps.includes('test-thick') && layers === 2) {
      change(previous => ({ ...previous, steps: ['test-thin', 'test-thick'] }));
      setNotice('Extra material reduces new exposure. Choose the layers your base will build.');
    } else setNotice(steps.includes('test-thick') ? 'Compare the dashed paths: some particles still get through. Choose your final plan when ready.' : !steps.includes('test-thin') ? 'First compare zero added layers. Then test two layers.' : 'Try two added layers to complete the comparison. You can then choose your final plan.');
  }
  return <div className="lg-shield-board">
    <Cabin layers={layers} wave={lastTest === layers} />
    <Dial control={definition.controls[0]} value={layers} labels={['Existing structure', 'One added layer', 'Two added layers']}
      onChange={value => { setLastTest(null); change(previous => ({ ...previous, values: { ...previous.values, layers: value } })); }} />
    <button className="lg-test-button" type="button" onClick={testWave}>Send a test particle wave</button>
    <div className="lg-comparison"><span data-done={steps.includes('test-thin')}>{steps.includes('test-thin') ? '✓' : '○'} Existing structure tested</span><span data-done={steps.includes('test-thick')}>{steps.includes('test-thick') ? '✓' : '○'} Two layers tested</span></div>
    <p className="lg-help" role="status">{notice}</p>
    <p className="lg-science">Illustration only: shielding reduces additional exposure. It cannot remove dose already received.</p>
  </div>;
}

function PlantsBoard({ definition, proof, change, allowedChoices }: BoardProps & { allowedChoices?: string[] }) {
  const isTrial = definition.id === 'forecast-review';
  const values = proof.values ?? {};
  function setValue(id: string, value: number) { change(previous => ({ ...previous, values: { ...previous.values, [id]: value } })); }
  if (isTrial) return <div className="lg-trial-plants">
    {['a', 'b'].map((id, index) => {
      const light = values[`light-${id}`] ?? 0, water = values[`water-${id}`] ?? 0;
      const ready = light === 16 && water === 60;
      return <div className="lg-plant-trial" key={id}><h4>Trial plant {index ? 'B' : 'A'}</h4>
        <Plant light={light} water={water} />
        <p className="lg-plant-status">{ready ? '✓ Target matched' : water < 45 ? 'Needs water' : water > 70 ? 'Too much water' : light < 12 ? 'Needs more light' : light > 18 ? 'Try less light' : 'Nearly there — match the marked target'}</p>
        {definition.controls.filter(control => control.id.endsWith(`-${id}`)).map(control => <Dial key={control.id} control={control} value={values[control.id]} onChange={value => setValue(control.id, value)} />)}
      </div>;
    })}
    <p className="lg-science">A compressed trial model, not an exact growing recipe. Extra light cannot replace missing water.</p>
  </div>;

  const plans: Record<string, { count: number; label: string }> = {
    comfortable: { count: 1, label: 'Steady care · one garden' }, maximum: { count: 1, label: 'More light and water · one garden' },
    shared: { count: 2, label: 'Split care · two gardens' }, minimal: { count: 0, label: 'Store seeds · use existing rations' },
  };
  return <div className="lg-garden-board">
    <TokenBoard definition={definition} proof={proof} change={change} />
    <div className="lg-growing-tray"><Plant light={values.light ?? 0} water={values.water ?? 0} seeded={Object.keys(proof.placements ?? {}).length === 2} /><div>
      {definition.controls.map(control => <Dial key={control.id} control={control} value={values[control.id]} onChange={value => setValue(control.id, value)} />)}
    </div></div>
    <StepMachine definition={definition} proof={proof} change={change} />
    <fieldset className="lg-garden-plans"><legend>Choose a care plan for the real gardens</legend>
      {definition.choices.map(choice => <button type="button" key={choice.id} aria-pressed={proof.choice === choice.id} disabled={allowedChoices !== undefined && !allowedChoices.includes(choice.id)} onClick={() => change(previous => ({ ...previous, choice: choice.id }))}>
        <span aria-hidden="true" className="lg-plan-pots">{plans[choice.id].count ? '❧ '.repeat(plans[choice.id].count) : '▣'}</span><strong>{choice.label}</strong><span>{plans[choice.id].label}</span>
      </button>)}
    </fieldset>
    <p className="lg-science">The picture responds immediately so you can experiment. Real crops need time; this activity does not instantly fill the food store.</p>
  </div>;
}

function LifeSupportBoard({ activityId, allowedChoices, onComplete, onCancel }: LifeSupportGamesProps) {
  const definition = trainingDefinition(activityId);
  const [proof, setProof] = useState<TrainingProof>(() => createTrainingProof(activityId));
  const [resetCount, setResetCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const once = useRef(false);
  const evaluation = evaluateTraining(activityId, proof);
  const unavailable = evaluation.choice !== null && allowedChoices !== undefined && !allowedChoices.includes(evaluation.choice);
  const plan = definition.choices.find(choice => choice.id === evaluation.choice);
  const dialId = dialPlans[activityId];
  const isPlant = activityId === 'plant-plan' || activityId === 'forecast-review';
  const isEnergy = activityId === 'grid-plan' || activityId === 'fault-heater';
  const props: BoardProps = { definition, proof, change: setProof };

  function finish() {
    if (once.current || !evaluation.complete || unavailable) return;
    once.current = true;
    setSubmitted(true);
    onComplete(evaluation.choice ? { ...proof, choice: evaluation.choice } : proof);
  }
  function reset() {
    setProof(createTrainingProof(activityId));
    setResetCount(value => value + 1);
    once.current = false;
    setSubmitted(false);
  }

  return <section className="life-game" data-training-activity={activityId} style={{ '--lg-progress': `${Math.round(evaluation.progress * 100)}%` } as CSSProperties}>
    <header className="lg-heading"><span className="lg-eyebrow">HANDS-ON LAB · {definition.mission.toUpperCase()}</span><h3>{definition.title}</h3><p>{definition.instruction}</p></header>
    <div key={resetCount} className="lg-workbench">
      {isEnergy ? <EnergyBoard {...props} /> : isPlant ? <PlantsBoard {...props} allowedChoices={allowedChoices} /> : activityId === 'shield-plan' ? <ShieldBoard {...props} /> : <>
        {activityId === 'oxygen-plan' && <WaterToOxygen power={proof.values?.power ?? 0} />}
        {activityId === 'archive-review' && <StepMachine {...props} />}
        {definition.items.length > 0 && <TokenBoard {...props} />}
        {activityId === 'archive-review' && <Cabin layers={2} />}
        {activityId === 'water-plan' && <p className="lg-science">Used water goes through several treatment steps before reuse. This is a simplified treatment loop.</p>}
        {activityId === 'oxygen-plan' && <details className="lg-why"><summary>Why does water make oxygen?</summary><p>Water contains oxygen and hydrogen atoms. Electricity separates them into oxygen and hydrogen gases: 2H₂O → O₂ + 2H₂. Cleaning carbon dioxide from cabin air is a separate job.</p></details>}
        {activityId === 'air-plan' && <StepMachine {...props} />}
        {definition.controls.map(control => <Dial key={control.id} control={activityId === 'air-plan' ? { ...control, label: 'When should we clean the used filter?' } : activityId === 'fault-scrubber' ? { ...control, label: 'Filter response' } : control} value={proof.values?.[control.id] ?? control.initial}
          labels={control.id === dialId ? definition.choices.map(choice => choiceLabel(activityId, choice.id, choice.label)) : undefined}
          onChange={value => setProof(previous => ({ ...previous, values: { ...previous.values, [control.id]: value } }))} />)}
        {(activityId === 'fault-scrubber' || activityId === 'air-plan') && <details className="lg-why"><summary>Why clean the used filter?</summary><p>A full filter cannot keep catching carbon dioxide. Cleaning it, called regeneration, prepares it for reuse. Lower fan flow sends less cabin air through the filter.</p></details>}
      </>}
    </div>
    {plan && <div className="lg-selected-plan"><span aria-hidden="true">⚙</span><div><span>Your base plan</span><strong>{choiceLabel(activityId, plan.id, plan.label)}</strong></div></div>}
    <div className="lg-progress" role="progressbar" aria-label="Workbench steps" aria-valuenow={Math.round(evaluation.progress * 100)} aria-valuemin={0} aria-valuemax={100}><span /></div>
    <p className="lg-feedback" role="status">{unavailable ? 'This plan needs more rover charge. Choose another plan, or close the workbench and recharge at the garage.' : evaluation.feedback}</p>
    <footer className="lg-footer">
      <button type="button" className="lg-finish" data-training-finish disabled={!evaluation.complete || unavailable || submitted} onClick={finish}>Apply {definition.choices.length ? 'this plan' : 'completed work'}</button>
      <button type="button" onClick={reset}>Reset workbench</button>
      <button type="button" onClick={onCancel}>Close without applying</button>
    </footer>
  </section>;
}

export default function LifeSupportGames(props: LifeSupportGamesProps) {
  return <LifeSupportBoard key={props.activityId} {...props} />;
}
