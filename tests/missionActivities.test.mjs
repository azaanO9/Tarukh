import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIRE_TERMINALS, SOLAR_BRUSH, connectWire, wireRepairComplete, validateActivityProof,
  createBrushCoverage, brushSegment, brushCoverage,
} from '../game/missionActivities.ts';

const connected = () => ({kind:'wire-repair',isolated:true,connections:WIRE_TERMINALS.map(({id})=>({from:id,to:id}))});
const swept = () => Array.from({length:11},(_,row)=>[{x:0,y:row/10},{x:1,y:row/10}]);

test('wire repair requires four distinct matched identifiers and isolated power',()=>{
  const complete=connected();
  assert.ok(wireRepairComplete(complete));assert.ok(validateActivityProof('solar-connect',complete));
  const invalid=[null,{}, {...complete,isolated:false},{...complete,isolated:1},
    {...complete,connections:complete.connections.slice(0,3)},
    {...complete,connections:[...complete.connections,{from:'A',to:'A'}]},
    {...complete,connections:[{from:'X',to:'A'},...complete.connections.slice(1)]},
    {...complete,connections:[{from:'A',to:'B'},{from:'B',to:'A'},...complete.connections.slice(2)]},
    {...complete,connections:[{from:'A',to:'A'},{from:'B',to:'A'},...complete.connections.slice(2)]},
    {...complete,connections:[{from:'A',to:'A'},{from:'A',to:'B'},...complete.connections.slice(2)]},
  ];
  for(const proof of invalid)assert.equal(wireRepairComplete(proof),false);
});

test('wire editing rejects powered, unknown and duplicate endpoints without mutating prior evidence',()=>{
  const powered={kind:'wire-repair',isolated:false,connections:[]};
  assert.equal(connectWire(powered,'A','A'),powered);
  const empty={...powered,isolated:true},wrong=connectWire(empty,'A','B');
  assert.deepEqual(empty.connections,[]);assert.deepEqual(wrong.connections,[{from:'A',to:'B'}]);
  assert.equal(connectWire(wrong,'A','A'),wrong);assert.equal(connectWire(wrong,'B','B'),wrong);
  assert.equal(connectWire(wrong,'unknown','D'),wrong);assert.equal(connectWire(wrong,'D','unknown'),wrong);
  assert.equal(wireRepairComplete(wrong),false);
  let state=empty;for(const {id} of WIRE_TERMINALS)state=connectWire(state,id,id);
  assert.ok(wireRepairComplete(state));assert.equal(new Set(WIRE_TERMINALS.map(t=>t.shape)).size,4);
});

test('cleaning measures actual covered area, not elapsed time or repeated points',()=>{
  const repeated=Array.from({length:SOLAR_BRUSH.maxPoints},()=>({x:.5,y:.5}));
  const coverage=brushCoverage([repeated]);
  assert.ok(coverage.ratio<.05);assert.equal(coverage.complete,false);
  assert.equal(validateActivityProof('solar-clean',{kind:'panel-cleaning',strokes:[repeated]}),false);
  const clean=brushCoverage(swept());assert.equal(clean.ratio,1);assert.ok(clean.complete);
  assert.ok(clean.quadrants.every(value=>value===1));
  for(const taskId of ['solar-clean','clear-panels'])assert.ok(validateActivityProof(taskId,{kind:'panel-cleaning',strokes:swept()}));
});

test('brush geometry matches incremental feedback and never joins separate pointer gestures',()=>{
  const strokes=[[{x:.1,y:.1},{x:.8,y:.1}],[{x:.8,y:.9},{x:.2,y:.9}]];
  let current=createBrushCoverage();
  for(const stroke of strokes){
    current=brushSegment(current,stroke[0]);
    for(let i=1;i<stroke.length;i++)current=brushSegment(current,stroke[i-1],stroke[i]);
  }
  assert.deepEqual(current,brushCoverage(strokes));
  assert.equal(current.cells[6*SOLAR_BRUSH.columns+Math.floor(.8*SOLAR_BRUSH.columns)],false);
  const previous=current,copy=[...current.cells];
  current=brushSegment(current,strokes[0][0]);assert.equal(current,previous);assert.deepEqual(previous.cells,copy);
  assert.ok(brushCoverage([[{x:0,y:0},{x:1,y:1}]]).ratio<.3,'one diagonal cannot clean the panel');
});

test('each quadrant must be cleaned and malformed or excessive brush evidence is rejected',()=>{
  const leftOnly=Array.from({length:11},(_,row)=>[{x:0,y:row/10},{x:.45,y:row/10}]);
  const partial=brushCoverage(leftOnly);assert.equal(partial.complete,false);assert.ok(partial.quadrants[1]<.2);
  for(const strokes of [null,{},[[]],[[{x:-.1,y:0}]],[[{x:1.01,y:.5}]],[[{x:0,y:NaN}]],[[{x:Infinity,y:.5}]],
    [[{x:'0',y:.5}]],[Array(3)],Array.from({length:SOLAR_BRUSH.maxStrokes+1},()=>[{x:.5,y:.5}]),
    [Array.from({length:SOLAR_BRUSH.maxPoints+1},()=>({x:.5,y:.5}))]])assert.equal(brushCoverage(strokes),null);
  assert.equal(brushCoverage([]).complete,false);
  assert.equal(validateActivityProof('unknown',connected()),false);
  assert.equal(validateActivityProof('solar-connect',{kind:'panel-cleaning',strokes:swept()}),false);
  assert.equal(validateActivityProof('solar-clean',connected()),false);
  assert.equal(validateActivityProof('solar-clean',{kind:'panel-cleaning',cleaned:100,strokes:[]}),false);
});
