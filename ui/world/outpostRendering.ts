/** Hold the inexpensive indoor path across brief doorway-boundary fluctuations. */
export function createOutpostRendering() {
  return {active:false, outsideSeconds:0};
}

export function updateOutpostRendering(state:ReturnType<typeof createOutpostRendering>,inside:boolean,dt:number) {
  const previous=state.active;
  if(inside){state.active=true;state.outsideSeconds=0;}
  else if(state.active&&Number.isFinite(dt)&&dt>0){
    state.outsideSeconds+=Math.min(dt,.1);
    if(state.outsideSeconds>=.25){state.active=false;state.outsideSeconds=0;}
  }
  return previous!==state.active;
}
