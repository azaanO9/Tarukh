export type DeviceMode = 'pc' | 'mobile';
export interface DeviceSignals {
  coarse:boolean; fine:boolean; noHover:boolean; touchPoints:number;
  width:number; height:number; mobileHint?:boolean; userAgent:string; platform:string;
  override?:string|null;
}

/** The primary pointer wins, including on touch laptops and docked tablets. */
export function resolveDeviceMode(signals:DeviceSignals):DeviceMode {
  if(signals.override==='mobile'||signals.override==='pc')return signals.override;
  if(signals.fine)return 'pc';
  if(signals.coarse)return 'mobile';
  const touch=signals.touchPoints>0;
  const tablet=/iPad/i.test(signals.userAgent)||(signals.platform==='MacIntel'&&signals.touchPoints>1);
  const mobileAgent=/Android|iPhone|iPod|Mobile/i.test(signals.userAgent);
  const compact=Math.min(signals.width,signals.height)>0&&Math.min(signals.width,signals.height)<=1024;
  return touch&&(signals.noHover||tablet||signals.mobileHint||(mobileAgent&&compact))?'mobile':'pc';
}

export function isTouchPortrait(width:number,height:number,mode:DeviceMode):boolean {
  return mode==='mobile'&&width>0&&height>width;
}
