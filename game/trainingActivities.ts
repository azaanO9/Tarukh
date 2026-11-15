/** Station workbenches use bounded, local evidence; no timers or network calls. */
export const TRAINING_IDS = ['cargo-read','solar-trace','grid-plan','water-compare','water-calibrate','water-plan','oxygen-plan','air-plan','plant-plan','forecast-review','route-plan','sensor-restore','sample-collect','sample-analyse','archive-review','ventilation-check','shelter-power','shield-plan','plan-submit','review-ack','backup-plan','fault-heater','fault-scrubber','fault-pump','fault-water'] as const;
export type TrainingId = typeof TRAINING_IDS[number];
export type TrainingProof = { placements?:Record<string,string>; rotations?:number[]; values?:Record<string,number>; steps?:string[]; choice?:string };
type Item = {id:string;label:string;symbol?:string;detail?:string};
type Control = {id:string;label:string;min:number;max:number;step:number;initial:number;target?:number;unit?:string};
export type TrainingDefinition = {
  id:TrainingId; mission:'m1'|'m2'|'m3'|'m4'|'m5'|'m6'|'m7'; site:string;
  screen:'workshop'|'life'; title:string; instruction:string; kind:'sort'|'rotate'|'route'|'balance'|'sequence';
  items:Item[]; targets:Item[]; placements:Record<string,string>; controls:Control[];
  rotations:{id:string;label:string;initial:number;target:number}[];
  sequence:Item[]; choices:Item[]; nodes:{id:string;label:string;x:number;y:number}[];
  routes:{id:string;label:string;steps:string[]}[];
};
const item=(id:string,label:string,symbol?:string):Item=>({id,label,symbol});
const control=(id:string,label:string,max:number,initial=0,target?:number):Control=>({id,label,min:0,max,step:1,initial,target});
const tiles=(labels:string[],targets:number[])=>labels.map((label,i)=>({id:`tile-${i}`,label,initial:(targets[i]+1)%4,target:targets[i]}));
type DefinitionInput = Pick<TrainingDefinition,'mission'|'site'|'screen'|'title'|'instruction'|'kind'> & Partial<TrainingDefinition>;
const define=(id:TrainingId,input:DefinitionInput):TrainingDefinition=>({id,items:[],targets:[],placements:{},controls:[],rotations:[],sequence:[],choices:[],nodes:[],routes:[],...input});
const options=(pairs:[string,string][])=>pairs.map(([id,label])=>item(id,label));
const routeNode=(id:string,label:string,x:number,z:number)=>({id,label,x:(x+145)/485,y:(z+160)/520});

export const TRAINING_ACTIVITIES:Record<TrainingId,TrainingDefinition> = {
  'cargo-read':define('cargo-read',{mission:'m1',site:'command',screen:'workshop',kind:'sort',title:'Unpack the outpost',instruction:'Move each supply into its matching locker.',
    items:[item('water','Water bottle','◉'),item('food','Food pack','▣'),item('tools','Tool kit','⚒'),item('seeds','Seed bag','❧')],targets:options([['water-locker','Water'],['food-locker','Food'],['tool-locker','Tools'],['seed-locker','Plants']]),placements:{water:'water-locker',food:'food-locker',tools:'tool-locker',seeds:'seed-locker'}}),
  'solar-trace':define('solar-trace',{mission:'m2',site:'solar',screen:'workshop',kind:'rotate',title:'Follow the cable',instruction:'Turn the cable tiles until the path reaches the loose connector.',rotations:tiles(['Array','Cable bend','Junction','Loose connector'],[1,2,0,3])}),
  'grid-plan':define('grid-plan',{mission:'m2',site:'command',screen:'life',kind:'balance',title:'Share the sunshine',instruction:'Three cells keep the cabin running. Move the other five between rover, plants and reserve.',
    controls:[control('essentials','Cabin essentials · fixed',3,3,3),control('rover','Rover',5),control('crops','Plants',5),control('reserve','Reserve',5)],choices:options([['fast','Rover first'],['balanced','Share the supply'],['greenhouse','Plants first'],['reserve','Save for later']])}),
  'water-compare':define('water-compare',{mission:'m3',site:'lab',screen:'workshop',kind:'rotate',title:'Get water flowing',instruction:'Join the closed water loop, then inspect both gauges. One reads 40; the checked reference reads 62.',
    rotations:tiles(['Tank','Recovery filter','Pump','Cabin return'],[1,2,3,0]),sequence:[item('read-main','Read main gauge · 40'),item('read-reference','Read checked gauge · 62')]}),
  'water-calibrate':define('water-calibrate',{mission:'m3',site:'lab',screen:'workshop',kind:'balance',title:'Match the checked gauge',instruction:'Turn the dial to the checked reference: 62. This fixes the misleading reading.',controls:[control('calibration','Humidity reference',100,40,62)]}),
  'water-plan':define('water-plan',{mission:'m3',site:'lab',screen:'life',kind:'sort',title:'Build a clean-water path',instruction:'Place the treatment stages in order, then choose how hard the recovery pump should work.',
    items:[item('screen','Screen big particles','▦'),item('filter','Fine filter','≋'),item('disinfect','Disinfection','✧')],targets:options([['stage1','1 · Catch big bits'],['stage2','2 · Fine filtering'],['stage3','3 · Disinfect']]),placements:{screen:'stage1',filter:'stage2',disinfect:'stage3'},controls:[control('output','Pump effort',2)],choices:options([['conservative','Gentle'],['standard','Steady'],['aggressive','High recovery']])}),
  'oxygen-plan':define('oxygen-plan',{mission:'m3',site:'lab',screen:'life',kind:'sort',title:'Make oxygen from water',instruction:'Two water molecules contain two O atoms and four H atoms. Put each kind in its own tank, then set the power.',
    items:[item('o1','O · oxygen','O'),item('o2','O · oxygen','O'),...['h1','h2','h3','h4'].map(id=>item(id,'H · hydrogen','H'))],targets:[item('oxygen','O₂ oxygen tank'),item('hydrogen','H₂ hydrogen tank')],placements:{o1:'oxygen',o2:'oxygen',h1:'hydrogen',h2:'hydrogen',h3:'hydrogen',h4:'hydrogen'},controls:[control('power','Oxygen machine power',2)],choices:options([['minimum','Save power'],['standard','Steady oxygen'],['high','More oxygen']])}),
  'air-plan':define('air-plan',{mission:'m3',site:'lab',screen:'life',kind:'sort',title:'Clean the cabin air',instruction:'Catch carbon dioxide in the filter. Keep oxygen in the cabin. Swap to the ready filter bed.',
    items:[item('co2-a','CO₂','●'),item('co2-b','CO₂','●'),item('o2-a','O₂','○'),item('o2-b','O₂','○')],targets:[item('filter','CO₂ filter'),item('cabin','Cabin air')],placements:{'co2-a':'filter','co2-b':'filter','o2-a':'cabin','o2-b':'cabin'},sequence:[item('bed-a-offline','Lift out the full bed'),item('bed-b-online','Slide in the ready bed')],controls:[control('regenerate','Regenerate used bed now?',1)],choices:options([['scheduled','Schedule regeneration'],['now','Regenerate now']])}),
  'plant-plan':define('plant-plan',{mission:'m4',site:'greenhouse1',screen:'life',kind:'balance',title:'Plant a space garden',instruction:'Plant both seed trays, try water and light, then choose how the base should support the garden.',
    items:[item('seed-a','Lettuce seeds','❧'),item('seed-b','Wheat seeds','♧')],targets:[item('tray-a','Lettuce tray'),item('tray-b','Wheat tray')],placements:{'seed-a':'tray-a','seed-b':'tray-b'},controls:[control('light','Trial light hours',24),control('water','Trial drip setting',100)],sequence:[item('water-test','Try the water drip'),item('light-test','Try the grow light')],choices:options([['comfortable','One steady garden'],['maximum','One intensive garden'],['shared','Share between two gardens'],['minimal','Keep seeds safe; use rations']])}),
  'forecast-review':define('forecast-review',{mission:'m4',site:'greenhouse1',screen:'life',kind:'balance',title:'Help two trial plants',instruction:'Help both plants reach the marked healthy zone. Try the light setting at 16 and water setting at 60. These are trial settings, not a real growing recipe.',
    controls:[control('light-a','Plant A · light',24,22,16),control('water-a','Plant A · water',100,20,60),control('light-b','Plant B · light',24,4,16),control('water-b','Plant B · water',100,90,60)]}),
  'route-plan':define('route-plan',{mission:'m5',site:'garage',screen:'workshop',kind:'route',title:'Trace a rover route',instruction:'Choose a route, then connect its waypoints from garage to sensor. Longer routes need more charge.',
    choices:options([['direct','Direct · 30% charge'],['ridge','Ridge · 50% charge'],['valley','Valley · 80% charge']]),nodes:[routeNode('garage','Garage',26,-13),routeNode('direct-mid','Rock crossing',130,60),routeNode('ridge-a','Ridge climb',80,-120),routeNode('ridge-b','Ridge turn',300,-60),routeNode('valley-a','Valley entrance',-110,40),routeNode('valley-b','Heritage marker',-80,250),routeNode('valley-c','Valley exit',80,310),routeNode('sensor','Sensor',230,180)],
    routes:[{id:'direct',label:'Direct',steps:['garage','direct-mid','sensor']},{id:'ridge',label:'Ridge',steps:['garage','ridge-a','ridge-b','sensor']},{id:'valley',label:'Valley',steps:['garage','valley-a','valley-b','valley-c','sensor']}]}),
  'sensor-restore':define('sensor-restore',{mission:'m5',site:'field-sensor',screen:'workshop',kind:'sequence',title:'Wake the field sensor',instruction:'Clear its three covered windows, then turn the antenna to the marked 75° signal direction.',
    sequence:[item('clear-left','Clear left window'),item('clear-middle','Clear middle window'),item('clear-right','Clear right window')],controls:[control('antenna','Antenna direction',180,0,75)]}),
  'sample-collect':define('sample-collect',{mission:'m5',site:'field-sensor',screen:'workshop',kind:'sort',title:'Collect three samples',instruction:'Put each numbered rock in its matching sample box. Seal them in order to keep their labels.',
    items:[item('rock-1','1 · Smooth rock','●'),item('rock-2','2 · Grainy rock','▧'),item('rock-3','3 · Rock with holes','◌')],targets:options([['slot-1','Box 1'],['slot-2','Box 2'],['slot-3','Box 3']]),placements:{'rock-1':'slot-1','rock-2':'slot-2','rock-3':'slot-3'},sequence:[item('seal-1','Seal box 1'),item('seal-2','Seal box 2'),item('seal-3','Seal box 3')]}),
  'sample-analyse':define('sample-analyse',{mission:'m5',site:'lab',screen:'workshop',kind:'sort',title:'Look closely at the samples',instruction:'Sort by the texture you can see. Appearance alone does not identify a mineral or prove life.',
    items:[item('rock-1','Sample 1 · Smooth','●'),item('rock-2','Sample 2 · Grainy','▧'),item('rock-3','Sample 3 · Holes','◌')],targets:options([['smooth','Smooth'],['grainy','Grainy'],['holes','Holes']]),placements:{'rock-1':'smooth','rock-2':'grainy','rock-3':'holes'}}),
  'archive-review':define('archive-review',{mission:'m6',site:'command',screen:'life',kind:'sequence',title:'Rehearse a shelter drill',instruction:'Arrange the archived warning story. Move both crew tokens behind shelter. This is a rehearsal, not a live emergency.',
    sequence:[item('sun','Solar particles leave the Sun'),item('warning','The warning reaches the crew'),item('shelter','Crew use their shelter')],items:[item('crew-a','Crew A','♟'),item('crew-b','Crew B','♟')],targets:[item('shelter','Behind shelter')],placements:{'crew-a':'shelter','crew-b':'shelter'}}),
  'ventilation-check':define('ventilation-check',{mission:'m6',site:'shelter',screen:'workshop',kind:'rotate',title:'Keep cabin air moving',instruction:'Close the cabin → filter → fan → cabin loop. This recirculates cabin air; it does not pull in Martian air.',rotations:tiles(['Cabin','Filter','Fan','Cabin return'],[0,1,2,3])}),
  'shelter-power':define('shelter-power',{mission:'m6',site:'shelter',screen:'workshop',kind:'sort',title:'Connect shelter backup power',instruction:'Match all four backup plugs by letter and symbol.',
    items:['A','B','C','D'].map((id,i)=>item(`plug-${id}`,`Plug ${id}`,['■','●','▲','◆'][i])),targets:['A','B','C','D'].map(id=>item(`socket-${id}`,`Socket ${id}`)),placements:{'plug-A':'socket-A','plug-B':'socket-B','plug-C':'socket-C','plug-D':'socket-D'}}),
  'shield-plan':define('shield-plan',{mission:'m6',site:'shelter',screen:'life',kind:'balance',title:'Build a shelter shield',instruction:'Try a particle wave with no added blocks and with two layers. Then choose how much extra shielding to build.',
    controls:[control('layers','Added regolith layers',2)],sequence:[item('test-thin','Test 0 added layers'),item('test-thick','Test 2 added layers')],choices:options([['structure','Keep the existing structure'],['partial','Add one layer'],['full','Add two layers']])}),
  'plan-submit':define('plan-submit',{mission:'m7',site:'command',screen:'workshop',kind:'sort',title:'Build your base plan',instruction:'Fit the four system stamps into their matching plan slots.',
    items:[item('power','Power','ϟ'),item('air','Air','○'),item('water','Water','◉'),item('food','Food','❧')],targets:options([['power-slot','Power plan'],['air-slot','Air plan'],['water-slot','Water plan'],['food-slot','Food plan']]),placements:{power:'power-slot',air:'air-slot',water:'water-slot',food:'food-slot'}}),
  'review-ack':define('review-ack',{mission:'m7',site:'command',screen:'workshop',kind:'sequence',title:'Receive Mission Control',instruction:'Tune to the marked channel 42 and rebuild the three delayed message packets in order.',controls:[control('radio','Receiver channel',100,10,42)],sequence:[item('packet-1','1 · Plan received'),item('packet-2','2 · Keep a backup'),item('packet-3','3 · Test the night')]}),
  'backup-plan':define('backup-plan',{mission:'m7',site:'command',screen:'life',kind:'sort',title:'Pack a cloudy-day backup',instruction:'Put one useful backup tool in the plan slot. Each plan helps a different part of the base.',
    items:[item('reserve','Spare battery','▰'),item('dim-crops','Dimmer for plant lights','☼'),item('slow-charge','Slow-charge adapter','ϟ')],targets:[item('backup','Backup slot')],choices:options([['reserve','Use reserves'],['dim-crops','Dim plant lights'],['slow-charge','Slow rover charging']])}),
  'fault-heater':define('fault-heater',{mission:'m7',site:'command',screen:'life',kind:'balance',title:'Share power during the heater fault',instruction:'Keep three cells with cabin essentials. Put the spare cell with the heater or the plants.',controls:[control('essentials','Cabin · fixed',3,3,3),control('heater','Heater',1),control('crops','Plants',1)],choices:options([['cut-heater','Pause extra heating'],['cut-crops','Pause crop lights']])}),
  'fault-scrubber':define('fault-scrubber',{mission:'m7',site:'command',screen:'life',kind:'sort',title:'Help the air filter',instruction:'Clear the CO₂ tokens into the used filter. Then try a fresh bed or lower fan flow and observe what changes.',
    items:[item('co2-1','CO₂','●'),item('co2-2','CO₂','●'),item('co2-3','CO₂','●')],targets:[item('used-bed','Used filter bed')],placements:{'co2-1':'used-bed','co2-2':'used-bed','co2-3':'used-bed'},controls:[control('response','Response · 0 fresh bed / 1 lower fan',1)],choices:options([['regenerate','Regenerate the used filter'],['reduce-ventilation','Try less ventilation']])}),
  'fault-pump':define('fault-pump',{mission:'m7',site:'lab',screen:'workshop',kind:'rotate',title:'Repair the stopped water loop',instruction:'Turn the four pipe joints into a closed cabin-water loop to restart the pump.',rotations:tiles(['Cabin tank','Pump','Recovery','Cabin return'],[2,3,0,1])}),
  'fault-water':define('fault-water',{mission:'m7',site:'command',screen:'workshop',kind:'balance',title:'Protect the cabin water',instruction:'Keep the cabin tap fully open at 3. Turn the plant tap down to 1 while the repaired pump catches up.',controls:[control('cabin','Cabin tap',3,3,3),control('crops','Crop tap',3,3,1)]}),
};

export function isTrainingId(id:unknown):id is TrainingId { return typeof id==='string'&&(TRAINING_IDS as readonly string[]).includes(id); }
export function trainingDefinition(id:TrainingId):TrainingDefinition { return TRAINING_ACTIVITIES[id]; }
export const getTrainingDefinition=trainingDefinition;
export function createTrainingProof(id:TrainingId):TrainingProof {
  const definition=trainingDefinition(id);
  return {placements:{},rotations:definition.rotations.map(tile=>tile.initial),values:Object.fromEntries(definition.controls.map(c=>[c.id,c.initial])),steps:[],...(definition.choices.length?{choice:definition.choices[0].id}:{})};
}

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const short=(v:unknown):v is string=>typeof v==='string'&&v.length<=64;
function boundedProof(value:unknown):value is TrainingProof {
  if(!record(value)||Object.keys(value).some(key=>!['placements','rotations','values','steps','choice'].includes(key)))return false;
  for(const key of ['placements','values'] as const){
    const fields=value[key];if(fields===undefined)continue;
    if(!record(fields)||Object.keys(fields).length>32)return false;
    for(const [id,entry] of Object.entries(fields))if(!short(id)||(key==='placements'?!short(entry):typeof entry!=='number'||!Number.isFinite(entry)||Math.abs(entry)>1000))return false;
  }
  for(const key of ['steps','rotations'] as const){
    const values=value[key];if(values===undefined)continue;
    if(!Array.isArray(values)||values.length>32)return false;
    for(const entry of values)if(key==='steps'?!short(entry):typeof entry!=='number'||!Number.isInteger(entry)||entry<0||entry>3)return false;
  }
  return value.choice===undefined||short(value.choice);
}

export function evaluateTraining(id:unknown,proof:unknown):{complete:boolean;progress:number;feedback:string;choice:string|null} {
  const invalid={complete:false,progress:0,feedback:'Try the workbench controls to build your answer.',choice:null};
  if(!isTrainingId(id)||!boundedProof(proof))return invalid;
  const d=trainingDefinition(id),checks:{okay:boolean;hint:string}[]=[];
  const add=(okay:boolean,hint:string)=>checks.push({okay,hint});
  const placements=proof.placements??{},values=proof.values??{},steps=proof.steps??[],rotations=proof.rotations??[];
  if(proof.choice!==undefined&&!d.choices.some(option=>option.id===proof.choice))return invalid;
  if(Object.keys(placements).some(key=>!d.items.some(item=>item.id===key))||Object.keys(values).some(key=>!d.controls.some(control=>control.id===key)))return invalid;
  if(Object.values(placements).some(value=>!d.targets.some(target=>target.id===value)))return invalid;
  for(const [key,target] of Object.entries(d.placements))add(placements[key]===target,`Place ${d.items.find(item=>item.id===key)?.label??key} in ${d.targets.find(item=>item.id===target)?.label??target}.`);
  add(rotations.length===d.rotations.length,'Use only the tiles on this workbench.');
  d.rotations.forEach((tile,index)=>add(rotations[index]===tile.target,`Turn the ${tile.label.toLowerCase()} tile until its path joins its neighbours.`));
  for(const control of d.controls){
    const value=values[control.id];
    add(typeof value==='number'&&value>=control.min&&value<=control.max&&Math.abs((value-control.min)/control.step-Math.round((value-control.min)/control.step))<1e-8,`Set ${control.label.toLowerCase()} using its control.`);
    if(control.target!==undefined)add(value===control.target,`Match ${control.label.toLowerCase()} to the marked ${control.target}.`);
  }
  let choice:string|null=proof.choice??null;
  if(id==='grid-plan'){
    add(values.rover+values.crops+values.reserve===5,'Share exactly five movable energy cells.');
    choice=values.rover>=3?'fast':values.crops>=3?'greenhouse':values.reserve>=3?'reserve':'balanced';
  }else if(id==='water-plan')choice=['conservative','standard','aggressive'][values.output]??null;
  else if(id==='oxygen-plan')choice=['minimum','standard','high'][values.power]??null;
  else if(id==='air-plan')choice=['scheduled','now'][values.regenerate]??null;
  else if(id==='shield-plan')choice=['structure','partial','full'][values.layers]??null;
  else if(id==='fault-heater'){
    add(values.heater+values.crops===1,'Give the one spare cell to either the heater or the plants.');
    choice=values.heater===1?'cut-crops':'cut-heater';
  }else if(id==='fault-scrubber')choice=['regenerate','reduce-ventilation'][values.response]??null;
  else if(id==='backup-plan'){
    const selected=Object.entries(placements).filter(([,target])=>target==='backup');
    add(selected.length===1,'Put one backup tool in the plan slot.');choice=selected.length===1?selected[0][0]:null;
  }
  const required=id==='route-plan'?d.routes.find(route=>route.id===choice)?.steps??[]:d.sequence.map(item=>item.id);
  add(steps.length===required.length&&required.every((step,index)=>steps[index]===step),'Complete each marked step in order.');
  if(d.choices.length)add(choice!==null&&d.choices.some(item=>item.id===choice),'Choose the operating plan you want to try.');
  else if(proof.choice!==undefined)return invalid;
  if(id==='plant-plan')add((values.light??0)>0&&(values.water??0)>0,'Try some light and water on the test tray before choosing your base plan.');
  const complete=checks.every(check=>check.okay);
  return {complete,progress:checks.filter(check=>check.okay).length/Math.max(1,checks.length),feedback:complete?'Ready to apply. Your base will use this plan.':checks.find(check=>!check.okay)?.hint??invalid.feedback,choice};
}
export function validateTrainingProof(id:unknown,proof:unknown):boolean { return evaluateTraining(id,proof).complete; }
