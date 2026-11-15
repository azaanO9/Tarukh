import * as T from 'three';

/** Original coastal Earth and orbital backdrop. No remote models or texture downloads. */
export function createEarthDeparture(scene:T.Scene,performance:boolean){
  const coast=new T.Group(),orbit=new T.Group();coast.name='Earth coastal launch site';orbit.name='Earth from space';
  scene.add(coast,orbit);
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[];
  const mesh=(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material)=>{
    geometries.push(geometry);materials.push(material);const result=new T.Mesh(geometry,material);parent.add(result);return result;
  };
  const terrain=new T.PlaneGeometry(3600,3600,72,72);terrain.rotateX(-Math.PI/2);
  const vertices=terrain.getAttribute('position'),colors=new Float32Array(vertices.count*3),color=new T.Color();
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),shore=-230+Math.sin(z*.0025)*140+Math.sin(z*.006)*45;
    const distance=Math.hypot(x,z),water=x<shore;
    const hill=Math.max(0,Math.min(1,(distance-270)/500));
    vertices.setY(i,water?-.4:Math.max(0,x-shore<45?0:hill*(25+18*Math.sin(x*.009)*Math.cos(z*.007))));
    color.set(water?'#176b91':x-shore<45?'#b6b495':'#526948');
    if(!water)color.multiplyScalar(.9+.1*Math.sin(x*.05+z*.025));
    colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  terrain.setAttribute('color',new T.BufferAttribute(colors,3));terrain.computeVertexNormals();
  mesh(coast,terrain,new T.MeshStandardMaterial({vertexColors:true,roughness:.94})).receiveShadow=true;
  const pad=mesh(coast,new T.BoxGeometry(100,.3,110),new T.MeshStandardMaterial({color:'#a7aaa7',roughness:.9}));pad.position.set(-5,.05,0);pad.receiveShadow=true;
  const road=mesh(coast,new T.BoxGeometry(16,.08,900),new T.MeshStandardMaterial({color:'#4d5556',roughness:.95}));road.position.set(62,.08,390);
  const cloudMaterial=new T.MeshBasicMaterial({color:'#ecf2ed',transparent:true,opacity:.65,depthWrite:false});
  for(let i=0;i<(performance?6:12);i++){
    const cloud=mesh(coast,new T.SphereGeometry(1,12,6),cloudMaterial);
    cloud.position.set(-750+i*145,240+(i%3)*35,500+Math.sin(i)*200);cloud.scale.set(100,12,50);
  }
  const planet=mesh(orbit,new T.SphereGeometry(1450,64,40),new T.MeshStandardMaterial({color:'#125e96',roughness:.87}));
  planet.position.set(0,-1430,250);
  const atmosphere=mesh(orbit,new T.SphereGeometry(1468,48,32),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,
    vertexShader:'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'varying vec3 n;varying vec3 v;void main(){float rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.0);gl_FragColor=vec4(.16,.48,.94,rim*.7);}',
  }));atmosphere.position.copy(planet.position);
  // Sparse high cloud banks follow the curvature, leaving an unmistakable blue limb.
  for(let i=0;i<18;i++){
    const cloud=mesh(orbit,new T.SphereGeometry(1,12,6),new T.MeshStandardMaterial({color:'#e9f1f6',roughness:1}));
    const x=-1000+i*115,z=-180+Math.sin(i*2)*200;
    const y=planet.position.y+Math.sqrt(Math.max(1,1456**2-x*x-(z-250)**2));
    cloud.position.set(x,y,z);cloud.scale.set(110,4,30);
  }
  const stars=new Float32Array(450*3);let seed=741;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<450;i++){stars[i*3]=(random()-.5)*2800;stars[i*3+1]=150+random()*1800;stars[i*3+2]=500+random()*800;}
  const starGeometry=new T.BufferGeometry();starGeometry.setAttribute('position',new T.BufferAttribute(stars,3));geometries.push(starGeometry);
  const starMaterial=new T.PointsMaterial({color:'#e3edff',size:1.5,sizeAttenuation:false});materials.push(starMaterial);orbit.add(new T.Points(starGeometry,starMaterial));
  return {coast,orbit,setSpace(space:boolean){coast.visible=!space;orbit.visible=space;},dispose(){coast.removeFromParent();orbit.removeFromParent();for(const g of geometries)g.dispose();for(const m of new Set(materials))m.dispose();}};
}
