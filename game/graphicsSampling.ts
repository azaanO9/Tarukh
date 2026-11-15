/** Cheap indoor frames must not raise the quality budget used outdoors. */
export const OUTDOOR_GRAPHICS_SETTLE_MS = 1000;

export function createGraphicsSamplingGate() {
  return {interior:false, eligible:true, settleUntil:0};
}

/** Called after the indoor rendering state (including its exit grace) updates. */
export function updateGraphicsSamplingGate(state:ReturnType<typeof createGraphicsSamplingGate>,interior:boolean,now:number) {
  if(state.interior&&!interior)state.settleUntil=now+OUTDOOR_GRAPHICS_SETTLE_MS;
  state.interior=interior;
  state.eligible=!interior&&Number.isFinite(now)&&now>=state.settleUntil;
  return state.eligible;
}
