import {PERSEVERANCE_LANDING} from '../content/marsLandingSites';

/** Landmark data is fetched only when the explorer inspects this rover. */
export default function PerseveranceInspection({onClose}:{onClose:()=>void}) {
  return <>
    <h2 id="roam-dialog-title">Perseverance · Jezero crater</h2>
    <p>You found {PERSEVERANCE_LANDING.site}, where Perseverance landed on {PERSEVERANCE_LANDING.date}.</p>
    <p>Landing coordinates: {PERSEVERANCE_LANDING.latitude}° N, {PERSEVERANCE_LANDING.longitude}° E. This original model marks its historical landing position, not its current location. Distances are compressed for exploration.</p>
    <p><a href={PERSEVERANCE_LANDING.source} target="_blank" rel="noreferrer">NASA landing-coordinate source ↗</a></p>
    <button onClick={onClose}>Continue exploring</button>
  </>;
}
