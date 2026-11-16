import * as T from 'three';
import {batchStaticMeshes} from '../world/batchStaticMeshes.ts';
import {createFlightTextures} from './flightTextures.ts';

/** Original coastal spaceport; repeated details share geometry and use instancing. */
export function createEarthDeparture(scene:T.Scene,performance:boolean){
  const coast=new T.Group();coast.name='Coastal spaceport';scene.add(coast);
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures:T.Texture[]=[];
  const images=createFlightTextures();
  const mesh=(geometry:T.BufferGeometry,material:T.Material,parent:T.Object3D=coast)=>{
    geometries.add(geometry);materials.add(material);const result=new T.Mesh(geometry,material);parent.add(result);return result;
  };
  const concrete=new T.MeshStandardMaterial({color:'#c1bcb1',roughness:.88});
  const metal=new T.MeshStandardMaterial({color:'#b4c2c4',metalness:.65,roughness:.34});
  const dark=new T.MeshStandardMaterial({color:'#293c43',metalness:.4,roughness:.65});
  const white=new T.MeshStandardMaterial({color:'#e8e5d8',metalness:.25,roughness:.58});
  const boxGeometry=new T.BoxGeometry(1,1,1);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{
    const m=mesh(boxGeometry,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=m.receiveShadow=true;return m;
  };
  const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float shore(float z){return -170.+sin(z*.0025)*90.+sin(z*.007)*32.;}`;
  const worldVertex=`varying vec3 pos;void main(){pos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);}`;
  const ground=new T.PlaneGeometry(6000,6000,performance?64:120,performance?64:120);ground.rotateX(-Math.PI/2);
  const positions=ground.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),distance=Math.hypot(x,z),shore=-170+Math.sin(z*.0025)*90+Math.sin(z*.007)*32;
    const hill=Math.min(1,Math.max(0,(distance-220)/450));
    positions.setY(i,x<shore?0:Math.max(0,hill*(2+3*Math.sin(x*.008)*Math.sin(z*.009))));
  }
  ground.computeVertexNormals();
  const groundMaterial=new T.ShaderMaterial({uniforms:{detail:{value:null},hasDetail:{value:false}},vertexShader:worldVertex,fragmentShader:`uniform sampler2D detail;uniform bool hasDetail;varying vec3 pos;${noise}
    void main(){float d=pos.x-shore(pos.z);if(d<0.)discard;
      float broad=noise(pos.xz*.006),grain=noise(pos.xz*.65),fine=noise(pos.xz*4.);
      float plants=smoothstep(12.,85.,d)*smoothstep(.25,.65,broad);
      vec3 sand=vec3(.44,.38,.25),green=mix(vec3(.09,.16,.08),vec3(.24,.28,.12),noise(pos.xz*.05));
      vec3 c=mix(sand,green,plants)*(.8+.25*grain+.12*fine);
      if(hasDetail){vec3 scan=mix(texture2D(detail,pos.xz*.035).rgb,texture2D(detail,mat2(.8,-.6,.6,.8)*pos.xz*.011).rgb,.45);
        c=mix(c,scan*.72,smoothstep(10.,60.,d)*.85);}
      float haze=1.-exp(-length(cameraPosition-pos)*.00029);c=mix(c,vec3(.40,.60,.66),haze);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});mesh(ground,groundMaterial);
  images.load(`coastal-ground-${performance?512:1024}.webp`,map=>{map.wrapS=map.wrapT=T.RepeatWrapping;groundMaterial.uniforms.detail.value=map;groundMaterial.uniforms.hasDetail.value=true;});
  const waterMaterial=new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:worldVertex,fragmentShader:`varying vec3 pos;uniform float time;${noise}
    void main(){float distance=shore(pos.z)-pos.x;
      float waves=sin(pos.x*.34+pos.z*.12-time*.7)*sin(pos.z*.4+time*.32);
      float ripples=noise(pos.xz*.13+vec2(time*.025,0.));
      vec3 c=mix(vec3(.025,.16,.23),vec3(.10,.36,.39),exp(-max(0.,distance)*.003));
      vec3 normal=normalize(vec3(waves*.035,1.,ripples*.07));vec3 view=normalize(cameraPosition-pos);
      float glint=pow(max(0.,dot(reflect(normalize(vec3(.55,-.65,-.6)),normal),view)),65.);
      c+=vec3(.9,.78,.56)*glint*.65;
      float crest=sin(pos.x*.43+pos.z*.14-time*.65);
      c+=vec3(.13,.20,.20)*pow(max(0.,crest),12.)*(1.-smoothstep(400.,1400.,length(cameraPosition-pos)))*.24;
      float foam=(1.-smoothstep(0.,8.,abs(distance-5.-waves*2.)))*(.5+.5*ripples);
      c=mix(c,vec3(.67,.77,.71),foam*.55);
      c=mix(c,vec3(.4,.60,.66),1.-exp(-length(cameraPosition-pos)*.0003));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const water=mesh(new T.PlaneGeometry(6000,6000),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-.35;
  const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sky:{value:null},hasSky:{value:false},sun:{value:new T.Vector3(-.55,.45,-.7).normalize()}},
    vertexShader:'varying vec3 direction;varying vec2 texcoord;void main(){direction=position;texcoord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;varying vec2 texcoord;uniform sampler2D sky;uniform bool hasSky;uniform vec3 sun;void main(){vec3 d=normalize(direction);float h=max(0.,d.y);
      vec3 c=mix(vec3(.68,.79,.79),vec3(.10,.32,.57),pow(h,.45));
      float glow=pow(max(0.,dot(d,sun)),28.);c+=vec3(.6,.37,.17)*glow;
      if(hasSky)c=texture2D(sky,vec2(fract(texcoord.x+.28),texcoord.y)).rgb*.95;
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});mesh(new T.SphereGeometry(2900,32,16),skyMaterial);
  images.load(`sky-${performance?1024:2048}.webp`,map=>{skyMaterial.uniforms.sky.value=map;skyMaterial.uniforms.hasSky.value=true;});
  box(0,-.05,0,95,.35,90,concrete);box(43,.02,640,13,.12,1300,dark);
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#a9aba5';ctx.fillRect(0,0,1024,1024);
    let seed=491;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<48000;i++){ctx.fillStyle=i%2?'#9c9f99':'#b9bab1';ctx.fillRect(random()*1024,random()*1024,1,1);}
    ctx.strokeStyle='#7f8681';ctx.lineWidth=2;
    for(let p=0;p<1024;p+=128){ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,1024);ctx.moveTo(0,p);ctx.lineTo(1024,p);ctx.stroke();}
    const soot=ctx.createRadialGradient(512,512,12,512,512,225);soot.addColorStop(0,'#262c29d0');soot.addColorStop(1,'#262c2900');ctx.fillStyle=soot;ctx.fillRect(0,0,1024,1024);
    ctx.strokeStyle='#e6dcb3';ctx.lineWidth=8;
    for(const r of [235,285]){ctx.beginPath();ctx.arc(512,512,r,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle='#ddb752';ctx.setLineDash([22,16]);ctx.beginPath();ctx.arc(512,512,335,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#edf0df';ctx.textAlign='center';ctx.font='600 30px sans-serif';ctx.fillText('TARUKH   /   LAUNCH 01',512,950);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;textures.push(map);
    const apron=mesh(new T.PlaneGeometry(70,70),new T.MeshStandardMaterial({map,roughness:.92}));apron.rotation.x=-Math.PI/2;apron.position.y=.15;apron.receiveShadow=true;
  }
  const cylinder=new T.CylinderGeometry(1,1,1,24),sphere=new T.SphereGeometry(1,24,12);
  const brass=new T.MeshStandardMaterial({color:'#a88d61',metalness:.7,roughness:.4});
  for(let i=0;i<5;i++){
    const x=-20+i*11,z=80+(i%2)*15,h=18+i%3*5;
    box(x,.5,z,9,1,9,concrete);
    const tank=mesh(cylinder,white);tank.position.set(x,h/2+1,z);tank.scale.set(3.8,h,3.8);tank.castShadow=true;
    const cap=mesh(sphere,metal);cap.position.set(x,h+1,z);cap.scale.set(3.8,2,3.8);
    for(const y of [4,h-2]){const band=mesh(cylinder,dark);band.position.set(x,y,z);band.scale.set(3.85,.35,3.85);}
    box(x+4.4,h/2,z,.35,h,.35,metal);box(x,1.7,z-5,8,.4,.4,metal);
    for(let y=2;y<h;y+=1.2)box(x+4.4,y,z,1.2,.09,.18,metal);
    box(x+3.9,h/2,z,.12,h,.12,metal);box(x+4.9,h/2,z,.12,h,.12,metal);
    const pipe=mesh(cylinder,brass);pipe.position.set(x-4.4,h/2,z-1);pipe.scale.set(.22,h,.22);
    box(x-3.9,1.5,z-4.5,2,2.5,1.2,dark);
    for(let j=0;j<5;j++)box(x-3.9,.65+j*.3,z-5.15,1.5,.07,.08,metal);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4;box(x+Math.cos(a)*3.83,h*.5,z+Math.sin(a)*3.83,.06,h-1,.06,metal);
    }
  }
  box(-25,12,230,62,24,90,white);box(-25,24.2,230,64,.7,92,metal);box(-25,9,184.6,49,18,.4,dark);
  box(-70,4,130,28,8,18,white);box(-70,6,120.7,24,2,.4,dark);
  for(let i=0;i<10;i++)box(-25,2+i*1.6,184.2,48,.12,.3,metal);
  const stripeMat=new T.MeshStandardMaterial({color:'#e9d9a2',roughness:1});materials.add(stripeMat);geometries.add(boxGeometry);
  const stripes=new T.InstancedMesh(boxGeometry,stripeMat,60),dummy=new T.Object3D();coast.add(stripes);
  for(let i=0;i<60;i++){dummy.position.set(43,.12,65+i*20);dummy.scale.set(.2,.02,7);dummy.updateMatrix();stripes.setMatrixAt(i,dummy.matrix);}
  const scrubGeometry=new T.PlaneGeometry(1.5,1.3);scrubGeometry.translate(0,.65,0);
  const scrubMat=new T.MeshStandardMaterial({color:'#748260',roughness:1,side:T.DoubleSide,alphaTest:.4});
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    for(let i=0;i<90;i++){const x=12+(i*41)%104,y=18+(i*23)%105;ctx.strokeStyle=i%3?'#849360':'#b0b183';ctx.lineWidth=1.5+(i%3);
      ctx.beginPath();ctx.moveTo(64,128);ctx.quadraticCurveTo(50+(i*17)%40,80,x,y);ctx.stroke();}
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;textures.push(map);scrubMat.map=map;
  }
  geometries.add(scrubGeometry);materials.add(scrubMat);
  const count=performance?200:650,scrub=new T.InstancedMesh(scrubGeometry,scrubMat,count);coast.add(scrub);const color=new T.Color();
  for(let i=0;i<count;i++){
    const z=80+((i*133.7)%1600),x=-100+((i*77.3)%420),s=1+(i%7)*.7;
    dummy.position.set(x,0,z);dummy.scale.set(s,.7+(i%3)*.3,s);dummy.rotation.y=i*2.4;dummy.updateMatrix();scrub.setMatrixAt(i,dummy.matrix);
    color.set(i%3?'#64704b':'#344e3e');scrub.setColorAt(i,color);
  }
  const lightMat=new T.MeshBasicMaterial({color:'#f3d197'});
  for(const x of [-42,42])for(const z of [-40,40]){box(x,9,z,.24,18,.24,metal);box(x,17,z,2,.4,.65,lightMat);}
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;
    const gradient=ctx.createRadialGradient(64,64,2,64,64,64);gradient.addColorStop(0,'#ffffffe0');gradient.addColorStop(.4,'#ffffff80');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const map=new T.CanvasTexture(canvas);textures.push(map);
    const cloudMat=new T.SpriteMaterial({map,color:'#f0e9da',opacity:.13,depthWrite:false});materials.add(cloudMat);
    for(let i=0;i<(performance?14:28);i++){const cloud=new T.Sprite(cloudMat);cloud.position.set(-1400+(i*193)%2800,290+(i%4)*25,700+(i%5)*220);cloud.scale.set(280+(i%3)*100,38+(i%3)*20,1);coast.add(cloud);}
  }
  batchStaticMeshes(coast,new Set());
  coast.traverse(object=>{if(object instanceof T.Mesh)geometries.add(object.geometry);});
  return {coast,ready:images.ready(),get loaded(){return images.loaded;},update(time:number,visible:boolean){coast.visible=visible;waterMaterial.uniforms.time.value=time;},
    dispose(){coast.removeFromParent();images.dispose();stripes.dispose();scrub.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const texture of textures)texture.dispose();}};
}
