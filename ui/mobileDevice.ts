import {resolveDeviceMode,type DeviceMode} from '../game/deviceMode.ts';

/** Kept for callers needing the original phone-only predicate. */
export function isMobilePortraitPhone(width:number,height:number,coarsePointer:boolean):boolean {
  return coarsePointer&&width>0&&height>width&&Math.min(width,height)<=600;
}

export function readDeviceMode():DeviceMode {
  if(typeof window==='undefined')return 'pc';
  const media=(query:string)=>window.matchMedia?.(query).matches??false;
  const nav=navigator as Navigator&{userAgentData?:{mobile?:boolean}};
  return resolveDeviceMode({coarse:media('(pointer: coarse)'),fine:media('(pointer: fine)'),
    noHover:media('(hover: none)'),touchPoints:nav.maxTouchPoints??0,
    width:window.screen?.width||window.innerWidth,height:window.screen?.height||window.innerHeight,
    mobileHint:nav.userAgentData?.mobile,userAgent:nav.userAgent,platform:nav.platform,
    override:new URLSearchParams(window.location.search).get('device')});
}
export function isCoarsePointerDevice():boolean {return readDeviceMode()==='mobile';}

type FullscreenDocument=Document&{webkitFullscreenElement?:Element;msFullscreenElement?:Element};
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void;msRequestFullscreen?:()=>Promise<void>|void};
export function isFullscreen():boolean {
  if(typeof document==='undefined')return false;
  const doc=document as FullscreenDocument;
  return Boolean(doc.fullscreenElement||doc.webkitFullscreenElement||doc.msFullscreenElement);
}
export function supportsFullscreen():boolean {
  if(typeof document==='undefined')return false;
  const element=document.documentElement as FullscreenElement;
  return Boolean(element.requestFullscreen||element.webkitRequestFullscreen||element.msRequestFullscreen);
}
export function isStandalone():boolean {
  return typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches
    ||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
}

/** Call directly from a user gesture; rejection never prevents starting the game. */
export async function requestGameFullscreen(mode:DeviceMode):Promise<boolean> {
  if(typeof document==='undefined')return false;
  if(!isFullscreen()&&!isStandalone()){
    const element=document.documentElement as FullscreenElement;
    const request=element.requestFullscreen||element.webkitRequestFullscreen||element.msRequestFullscreen;
    try{await request?.call(element);}catch{/* Browser or user declined. */}
  }
  if(mode==='mobile'){
    const orientation=window.screen?.orientation as ScreenOrientation&{lock?:(mode:string)=>Promise<void>};
    try{await orientation?.lock?.('landscape');}catch{/* Manual rotation remains available. */}
  }
  return isFullscreen()||isStandalone();
}
export async function tryEnterLandscape():Promise<void>{await requestGameFullscreen('mobile');}

export function subscribeDeviceChanges(notify:()=>void):()=>void {
  const media=['(pointer: coarse)','(pointer: fine)','(hover: none)','(display-mode: standalone)'].map(query=>window.matchMedia(query));
  for(const match of media)match.addEventListener?.('change',notify);
  window.addEventListener('resize',notify);
  window.addEventListener('orientationchange',notify);
  window.visualViewport?.addEventListener('resize',notify);
  return ()=>{
    for(const match of media)match.removeEventListener?.('change',notify);
    window.removeEventListener('resize',notify);
    window.removeEventListener('orientationchange',notify);
    window.visualViewport?.removeEventListener('resize',notify);
  };
}
