import {ART_WIDTH,ART_HEIGHT,ASSEMBLY_SECONDS,PERSPECTIVE,LAYERS,clamp,assemblyProgress,compensateDepth} from './scene-data.js';

let sceneSerial=0;

/** Original-art cutouts on GPU-composited 3D planes. No game state or globals. */
export class DepthScene extends EventTarget {
  /** @param {HTMLElement} container @param {{assetBase?: URL, intensity?: number, autoplay?: boolean}} [options] */
  constructor(container, {assetBase, intensity=.72, autoplay=true}={}) {
    super();
    if(!(container instanceof HTMLElement))throw new TypeError('DepthScene requires a container element.');
    this.container=container;this.intensity=clamp(intensity,0,1);this.running=autoplay;
    this.disposed=false;this.elapsed=0;this.exploded=false;this.spread=0;this.frame=0;
    this.pointerX=0;this.pointerY=0;this.targetX=0;this.targetY=0;this.lastTime=0;
    this.motionMedia=matchMedia('(prefers-reduced-motion: reduce)');this.reducedMotion=this.motionMedia.matches;
    this.abort=new AbortController();this.uid=`depth-${++sceneSerial}`;
    this.root=document.createElement('div');this.root.className='depth-viewport';
    this.root.dataset.ready='false';this.root.setAttribute('role','img');
    this.root.setAttribute('aria-label','Layered alien landscape with a ringed planet, orange sandstone cliffs and violet plants.');
    this.world=document.createElement('div');this.world.className='depth-world';
    this.root.append(this.world);
    const imageBase=assetBase??new URL(import.meta.url.replace(/[^/]+$/,'assets/'));
    this.images={artwork:new URL('artwork.webp',imageBase).href,'clean-plate':new URL('clean-plate.webp',imageBase).href};
    this.planes=LAYERS.map((layer,index)=>{
      const el=document.createElement('div');el.className='depth-layer';el.dataset.layer=layer.id;
      const clipId=`${this.uid}-${layer.id}`;
      const shapes=layer.shapes??(layer.path?`<path clip-rule="evenodd" d="${layer.path}"/>`:'');
      const mist=layer.id==='planet'?`<linearGradient id="${clipId}-mist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset=".36" stop-color="white"/><stop offset=".47" stop-color="white" stop-opacity="0"/></linearGradient><mask id="${clipId}-haze"><rect width="${ART_WIDTH}" height="${ART_HEIGHT}" fill="url(#${clipId}-mist)"/></mask>`:'';
      const clip=shapes?`<defs><clipPath id="${clipId}">${shapes}</clipPath>${mist}</defs>`:'';
      // URLs come from URL objects, never untrusted markup.
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox',`0 0 ${ART_WIDTH} ${ART_HEIGHT}`);svg.setAttribute('preserveAspectRatio','none');
      svg.setAttribute('aria-hidden','true');svg.innerHTML=clip;
      const picture=document.createElementNS('http://www.w3.org/2000/svg','image');
      picture.setAttribute('href',this.images[layer.source]);picture.setAttribute('width',ART_WIDTH);picture.setAttribute('height',ART_HEIGHT);
      picture.setAttribute('preserveAspectRatio','none');if(shapes)picture.setAttribute('clip-path',`url(#${clipId})`);
      if(layer.id==='planet')picture.setAttribute('mask',`url(#${clipId}-haze)`);
      svg.append(picture);el.append(svg);
      const edge=document.createElement('div');edge.className='depth-layer-edge';el.append(edge);
      const label=document.createElement('span');label.className='depth-layer-label';label.textContent=`${String(index+1).padStart(2,'0')} / ${layer.name}`;el.append(label);
      this.world.append(el);return {el,edge,label,visible:true,layer};
    });
    this.canvas=document.createElement('canvas');this.canvas.className='depth-motes';this.canvas.setAttribute('aria-hidden','true');this.context=this.canvas.getContext('2d');
    this.root.append(this.canvas);
    const shade=document.createElement('div');shade.className='depth-shade';this.root.append(shade);
    const loading=document.createElement('div');loading.className='depth-loading';loading.textContent='PREPARING YOUR WORLD';this.root.append(loading);this.loading=loading;
    container.append(this.root);
    this.particles=Array.from({length:22},(_,i)=>({x:((i*173.7+47)%997)/997,y:((i*317.3+21)%991)/991,r:.7+(i%3)*.4,phase:i*1.618,speed:.7+(i%5)*.17}));
    this.resize=()=>{
      const rect=this.root.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
      // Cover the viewport without squeezing the source artwork on phones.
      const artWidth=Math.max(rect.width,rect.height*ART_WIDTH/ART_HEIGHT),artHeight=artWidth*ART_HEIGHT/ART_WIDTH;
      this.scale=artWidth/ART_WIDTH;
      this.world.style.width=`${artWidth}px`;this.world.style.height=`${artHeight}px`;
      this.world.style.left=`${(rect.width-artWidth)/2}px`;this.world.style.top=`${(rect.height-artHeight)/2}px`;
      this.root.style.perspective=`${PERSPECTIVE*this.scale}px`;
      const ratio=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.round(rect.width*ratio);this.canvas.height=Math.round(rect.height*ratio);
      this.context?.setTransform(ratio,0,0,ratio,0,0);this.render();
    };
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(this.root);
    const signal=this.abort.signal;
    this.root.addEventListener('pointermove',event=>{
      if(this.reducedMotion||(!this.running&&!this.exploded))return;
      const r=this.root.getBoundingClientRect();this.targetX=clamp((event.clientX-r.left)/r.width*2-1,-1,1);this.targetY=clamp((event.clientY-r.top)/r.height*2-1,-1,1);
      this.schedule();
    },{signal,passive:true});
    this.root.addEventListener('pointerleave',()=>{this.targetX=0;this.targetY=0;this.schedule();},{signal});
    this.motionMedia.addEventListener('change',event=>this.setReducedMotion(event.matches),{signal});
    document.addEventListener('visibilitychange',()=>{
      this.lastTime=0;
      if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else this.schedule();
    },{signal});
    this.tick=this.tick.bind(this);this.resize();
    this.ready=Promise.all(Object.values(this.images).map(src=>new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>img.decode().then(resolve,reject);img.onerror=()=>reject(new Error('Unable to load the local scene artwork.'));img.src=src;
    }))).then(()=>{
      if(this.disposed)return;
      this.root.dataset.ready='true';this.loaded=true;this.lastTime=0;
      if(this.reducedMotion||!autoplay)this.elapsed=ASSEMBLY_SECONDS;
      this.render();this.schedule();this.emit('ready');
    }).catch(error=>{
      if(this.disposed)return;this.root.dataset.error='true';this.loading.textContent='The artwork could not load. Please refresh or serve this folder with npm start.';this.emit('error',{message:error.message});throw error;
    });
  }
  emit(type,detail={}) { this.dispatchEvent(new CustomEvent(type,{detail})); }
  schedule() { if(!this.frame&&!this.disposed&&this.loaded&&!document.hidden)this.frame=requestAnimationFrame(this.tick); }
  tick(now) {
    this.frame=0;if(this.disposed)return;
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.05):0;this.lastTime=now;
    if(this.running&&!this.reducedMotion)this.elapsed+=dt;
    const smooth=1-Math.exp(-dt*5),targetSpread=this.exploded?1:0;
    this.pointerX+=(this.targetX-this.pointerX)*smooth;this.pointerY+=(this.targetY-this.pointerY)*smooth;
    this.spread=this.reducedMotion?targetSpread:this.spread+(targetSpread-this.spread)*(1-Math.exp(-dt*3.7));
    if(Math.abs(this.spread-targetSpread)<.0002)this.spread=targetSpread;
    this.render();
    if(this.running&&!this.reducedMotion||this.spread!==targetSpread)this.schedule();
    else this.lastTime=0;
  }
  render() {
    if(!this.width)return;
    const s=this.scale,t=this.elapsed,k=this.reducedMotion?0:this.intensity,e=this.spread;
    const px=this.pointerX*k,py=this.pointerY*k;
    const breathing=Math.sin(t*.17)*.22*k;
    const dolly=1.04+Math.sin(t*.14)*.012*k;
    this.world.style.transform=`translate3d(${px*-3*s+e*20*s}px,${py*-2*s}px,0) rotateX(${(-py*2.2+breathing)*(1-e)+e*8}deg) rotateY(${(px*3.5+Math.sin(t*.13)*.65*k)*(1-e)-e*28}deg) scale(${dolly-e*.475})`;
    for(let i=0;i<this.planes.length;i++){
      const {el,layer,edge,label,visible}=this.planes[i];
      if(!visible)continue;
      const a=this.reducedMotion?1:assemblyProgress(t,i),remaining=1-a;
      const depth=layer.depth+e*(i-4.5)*48;
      const swayX=Math.sin(t*.21+i*.73)*(3+i*1.35)*k*a;
      const swayY=Math.sin(t*.27+i*.87)*(i===2?9:2+i*.55)*k*a;
      const x=(layer.enter[0]*remaining+swayX+px*i*1.65+e*(i-4.5)*16)*s;
      const y=(layer.enter[1]*remaining+swayY+py*i*1.1-e*(i-4.5)*5)*s;
      const z=(depth+layer.enter[2]*remaining)*s;
      const compensation=compensateDepth(layer.depth);
      const rotation=(i%2?1:-1)*remaining*3+Math.sin(t*.19+i)*.045*k*a;
      el.style.transform=`translate3d(${x}px,${y}px,${z}px) rotateZ(${rotation}deg) scale(${compensation*(1+remaining*.035)})`;
      el.style.opacity=String(i===0?1:clamp(a*1.45,0,1));
      edge.style.opacity=String(e*.65);label.style.opacity=String(e);
    }
    this.drawMotes(t,k,e);
    this.root.dataset.phase=t<ASSEMBLY_SECONDS&&!this.reducedMotion?'assembling':'floating';
    this.root.dataset.reducedMotion=String(this.reducedMotion);
    if(this.loaded)this.emit('frame',{progress:clamp(t/ASSEMBLY_SECONDS,0,1),running:this.running,reducedMotion:this.reducedMotion});
  }
  drawMotes(time,motion,spread) {
    const c=this.context;if(!c)return;c.clearRect(0,0,this.width,this.height);if(spread>.1)return;
    for(const p of this.particles){
      const drift=motion?time*p.speed*.009:0;
      const x=((p.x+drift)%1)*this.width+Math.sin(time*.18+p.phase)*7*motion;
      const y=(.4+p.y*.58)*this.height-Math.sin(time*.24+p.phase)*10*motion;
      c.globalAlpha=.11+Math.sin(p.phase+time*.3)*.05*motion;c.fillStyle=p.y>.3?'#ffe5a2':'#c2fff4';
      c.beginPath();c.arc(x,y,p.r*this.scale*1.6,0,Math.PI*2);c.fill();
    }c.globalAlpha=1;
  }
  pause() {this.running=false;cancelAnimationFrame(this.frame);this.frame=0;this.lastTime=0;this.emit('state',{running:false});}
  play() {this.running=true;this.lastTime=0;this.schedule();this.emit('state',{running:true});}
  replay() {this.elapsed=this.reducedMotion?ASSEMBLY_SECONDS:0;this.exploded=false;this.targetX=this.targetY=0;this.play();this.render();}
  setIntensity(value) {if(!Number.isFinite(value))return;this.intensity=clamp(value,0,1);this.render();}
  setExploded(value) {this.exploded=Boolean(value);if(this.reducedMotion){this.spread=this.exploded?1:0;this.render();}else this.schedule();}
  setLayerVisible(id,visible) {const plane=this.planes.find(p=>p.layer.id===id);if(!plane)return;plane.visible=Boolean(visible);plane.el.style.display=plane.visible?'':'none';this.render();}
  setReducedMotion(value) {this.reducedMotion=Boolean(value);this.elapsed=Math.max(this.elapsed,ASSEMBLY_SECONDS);this.targetX=this.targetY=this.pointerX=this.pointerY=0;this.render();this.schedule();this.emit('motion',{reducedMotion:this.reducedMotion});}
  destroy() {if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.abort.abort();this.resizeObserver.disconnect();this.root.remove();this.planes.length=0;this.particles.length=0;this.canvas.width=this.canvas.height=0;}
}
