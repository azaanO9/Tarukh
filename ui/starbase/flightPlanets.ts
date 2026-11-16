import * as T from 'three';
import {createFlightTextures} from './flightTextures.ts';
import {flightEase, type DepartureFrame} from '../../game/departureSequence.ts';

/** Textured globes and thin atmospheric shells. All images are shipped with the app. */
export function createFlightPlanets(scene:T.Scene,performance:boolean) {
  const root=new T.Group();root.name='Earth and Mars orbital photography';scene.add(root);
  const geometry=new T.SphereGeometry(1,performance?48:96,performance?32:64);
  const materials:T.Material[]=[],images=createFlightTextures();let disposed=false;
  const sun=new T.Vector3(-.55,.6,-.7).normalize();
  const worldVertex=`varying vec2 texcoord;varying vec3 worldNormal;varying vec3 worldPosition;
    void main(){texcoord=uv;vec4 world=modelMatrix*vec4(position,1.);worldPosition=world.xyz;
      worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
  function texture(name:string,apply:(texture:T.Texture)=>void,color:boolean) {
    images.load(name,apply,color,performance?2:4);
  }

  function planet(name:'earth'|'mars',radius:number) {
    const group=new T.Group();group.name=name==='earth'?'Blue Marble Earth':'Mars approach globe';root.add(group);
    const material=new T.ShaderMaterial({
      uniforms:{surface:{value:null},hasMap:{value:false},sun:{value:sun},earth:{value:name==='earth'},base:{value:new T.Color(name==='earth'?'#2379a8':'#c07c53')}},
      vertexShader:worldVertex,
      fragmentShader:`uniform sampler2D surface;uniform bool hasMap;uniform bool earth;uniform vec3 base;uniform vec3 sun;
        varying vec2 texcoord;varying vec3 worldNormal;varying vec3 worldPosition;
        void main(){vec3 n=normalize(worldNormal),v=normalize(cameraPosition-worldPosition);
          vec3 albedo=hasMap?texture2D(surface,texcoord).rgb:base;
          float daylight=smoothstep(-.16,.3,dot(n,sun));float diffuse=max(0.,dot(n,sun));
          vec3 light=albedo*(.013+daylight*(.16+diffuse*1.4));
          if(earth){float ocean=smoothstep(.015,.12,albedo.b-albedo.r);
            float glint=pow(max(dot(reflect(-sun,n),v),0.),65.);
            light+=vec3(.68,.83,1.)*glint*ocean*.55*daylight;}
          float rim=pow(1.-max(0.,dot(n,v)),3.6);
          light+= (earth?vec3(.075,.32,.8):vec3(.47,.24,.14))*rim*daylight*.35;
          gl_FragColor=vec4(light,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });materials.push(material);
    const body=new T.Mesh(geometry,material);body.scale.setScalar(radius);group.add(body);
    texture(`${name}-${performance?1024:4096}.webp`,map=>{material.uniforms.surface.value=map;material.uniforms.hasMap.value=true;},true);
    const haze=new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{sun:{value:sun},tint:{value:new T.Color(name==='earth'?'#499aff':'#d29c71')}},vertexShader:worldVertex,
      fragmentShader:`uniform vec3 sun;uniform vec3 tint;varying vec3 worldNormal;varying vec3 worldPosition;
        void main(){vec3 n=normalize(worldNormal),v=normalize(cameraPosition-worldPosition);
          float edge=pow(1.-abs(dot(n,v)),3.);float lit=smoothstep(-.3,.6,dot(n,sun));
          gl_FragColor=vec4(tint,edge*lit*.54);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });materials.push(haze);
    const atmosphere=new T.Mesh(geometry,haze);atmosphere.scale.setScalar(radius*(name==='earth'?1.026:1.012));group.add(atmosphere);
    return {group,body};
  }
  const earth=planet('earth',280),mars=planet('mars',230);
  const cloudMaterial=new T.MeshPhongMaterial({color:'#ffffff',transparent:true,opacity:.92,depthWrite:false,shininess:1});
  materials.push(cloudMaterial);
  const clouds=new T.Mesh(geometry,cloudMaterial);clouds.scale.setScalar(281.4);clouds.visible=false;earth.group.add(clouds);
  texture(`clouds-${performance?1024:2048}.webp`,map=>{cloudMaterial.alphaMap=map;cloudMaterial.needsUpdate=true;clouds.visible=true;},false);
  const count=performance?350:800,positions=new Float32Array(count*3),starColors=new Float32Array(count*3);
  let seed=741;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){
    positions[i*3]=(random()-.5)*3400;positions[i*3+1]=(random()-.3)*1800;positions[i*3+2]=1500+random()*800;
    const brightness=.23+random()*.55;starColors[i*3]=brightness;starColors[i*3+1]=brightness*.96;starColors[i*3+2]=brightness;
  }
  const starsGeometry=new T.BufferGeometry();starsGeometry.setAttribute('position',new T.BufferAttribute(positions,3));starsGeometry.setAttribute('color',new T.BufferAttribute(starColors,3));
  const starsMaterial=new T.PointsMaterial({vertexColors:true,size:performance?1:1.25,sizeAttenuation:false});materials.push(starsMaterial);
  root.add(new T.Points(starsGeometry,starsMaterial));
  return {
    root,ready:images.ready(),get loaded(){return images.loaded;},
    update(frame:DepartureFrame,time:number){
      root.visible=frame.shot==='earth-orbit'||frame.shot==='mars-entry';
      earth.group.visible=frame.shot==='earth-orbit';mars.group.visible=frame.shot==='mars-entry';
      const leave=flightEase((time-6)/6),entry=flightEase((time-12)/7);
      earth.group.position.set(-130+leave*80,155-leave*80,650+leave*220);
      earth.body.rotation.y=1.9+leave*.06;clouds.rotation.y=earth.body.rotation.y+.015;
      mars.group.position.set(-95+entry*100,180-entry*200,760-entry*370);
      mars.group.scale.setScalar(1+entry*.48);mars.body.rotation.set(.16,-.65+entry*.05,.12);
    },
    dispose(){if(disposed)return;disposed=true;images.dispose();root.removeFromParent();geometry.dispose();starsGeometry.dispose();
      for(const material of materials)material.dispose();},
  };
}
