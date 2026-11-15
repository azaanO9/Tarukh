import {trainingDefinition} from '../game/trainingActivities.ts';

/** Test input fixtures; these do not run in the app. */
export function solvedTraining(activityId,choice){
  const d=trainingDefinition(activityId);
  const proof={placements:{...d.placements},rotations:d.rotations.map(t=>t.target),values:Object.fromEntries(d.controls.map(c=>[c.id,c.target??c.initial])),steps:d.sequence.map(s=>s.id)};
  if(d.choices.length)proof.choice=choice??d.choices[0].id;
  if(activityId==='grid-plan')Object.assign(proof.values,{essentials:3,...({fast:{rover:3,crops:1,reserve:1},balanced:{rover:2,crops:2,reserve:1},greenhouse:{rover:0,crops:4,reserve:1},reserve:{rover:0,crops:0,reserve:5}}[proof.choice])});
  if(activityId==='water-plan')proof.values.output=['conservative','standard','aggressive'].indexOf(proof.choice);
  if(activityId==='oxygen-plan')proof.values.power=['minimum','standard','high'].indexOf(proof.choice);
  if(activityId==='air-plan')proof.values.regenerate=['scheduled','now'].indexOf(proof.choice);
  if(activityId==='plant-plan')Object.assign(proof.values,{light:16,water:60});
  if(activityId==='shield-plan')proof.values.layers=['structure','partial','full'].indexOf(proof.choice);
  if(activityId==='backup-plan')proof.placements={[proof.choice]:'backup'};
  if(activityId==='fault-heater')Object.assign(proof.values,{essentials:3,heater:proof.choice==='cut-crops'?1:0,crops:proof.choice==='cut-heater'?1:0});
  if(activityId==='fault-scrubber')proof.values.response=['regenerate','reduce-ventilation'].indexOf(proof.choice);
  if(activityId==='route-plan')proof.steps=[...d.routes.find(r=>r.id===proof.choice).steps];
  return {type:'complete-training',activityId,proof};
}
