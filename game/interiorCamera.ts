/** Remember the outdoor view; a short exit grace avoids doorway flicker. */
export function createInteriorCamera() {
  return {inside:false, outsideSeconds:0, restoreThird:true};
}

export function updateInteriorCamera(state:ReturnType<typeof createInteriorCamera>,inside:boolean,third:boolean,dt:number) {
  if(inside){
    state.outsideSeconds=0;
    if(!state.inside){state.inside=true;state.restoreThird=third;return false;}
  }else if(state.inside){
    state.outsideSeconds+=Math.max(0,dt);
    if(state.outsideSeconds>=.25){state.inside=false;return state.restoreThird;}
  }
  return third;
}

/** Mutable, allocation-free camera blend: 0 is eye view, 1 is chase view. */
export function createCameraBlend(third:boolean) {
  const value=Number(third);
  return {value,from:value,target:value,elapsed:.55};
}

export function updateCameraBlend(state:ReturnType<typeof createCameraBlend>,third:boolean,dt:number,reducedMotion:boolean) {
  const target=Number(third);
  if(target!==state.target){state.from=state.value;state.target=target;state.elapsed=0;}
  state.elapsed=reducedMotion?.55:Math.min(.55,state.elapsed+Math.max(0,dt));
  const t=state.elapsed/.55,ease=t*t*(3-2*t);
  state.value=state.from+(state.target-state.from)*ease;
  return state.value;
}
