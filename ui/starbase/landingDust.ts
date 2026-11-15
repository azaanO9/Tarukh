import * as T from 'three';

/** Fixed-size dust pool. No allocations, geometry creation or textures uploaded during flight. */
export function createLandingDust(scene:T.Scene,capacity:number){
  const geometry=new T.PlaneGeometry(1,1);
  const opacity=new T.InstancedBufferAttribute(new Float32Array(capacity),1);
  geometry.setAttribute('dustOpacity',opacity);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{dustColor:{value:new T.Color('#a58b6d')}},
    vertexShader:`attribute float dustOpacity;varying vec2 dustUv;varying float alpha;
      void main(){dustUv=uv;alpha=dustOpacity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 dustUv;varying float alpha;uniform vec3 dustColor;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      void main(){vec2 p=dustUv*2.0-1.0;float n=noise(dustUv*6.0)*.65+noise(dustUv*13.0)*.35;
      float edge=1.0-smoothstep(.2,.98,length(p)+n*.18);
      gl_FragColor=vec4(dustColor*(.82+n*.28),alpha*edge*(.5+n*.5));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name='landingGroundDust';mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
  const x=new Float32Array(capacity),z=new Float32Array(capacity),age=new Float32Array(capacity);
  const vx=new Float32Array(capacity),vz=new Float32Array(capacity),life=new Float32Array(capacity),size=new Float32Array(capacity);
  age.fill(100);
  const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3();
  let cursor=0,emission=0,seed=8192,active=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function update(dt:number,intensity:number,sourceX:number,sourceZ:number,camera:T.Camera,reduced:boolean){
    emission+=dt*intensity*(reduced?8:80);
    while(emission>=1){
      emission-=1;const i=cursor;cursor=(cursor+1)%capacity;const angle=random()*Math.PI*2,speed=5+random()*9;
      x[i]=sourceX+Math.cos(angle)*2;z[i]=sourceZ+Math.sin(angle)*2;vx[i]=Math.cos(angle)*speed;vz[i]=Math.sin(angle)*speed;
      life[i]=3+random()*2;age[i]=0;size[i]=3+random()*4;
    }
    active=0;
    for(let i=0;i<capacity;i++){
      age[i]+=dt;
      if(age[i]>=life[i]){opacity.setX(i,0);scale.setScalar(0);position.set(0,0,0);}
      else{
        active++;const t=age[i]/life[i];x[i]+=vx[i]*dt;z[i]+=vz[i]*dt;
        vx[i]*=Math.exp(-dt*.4);vz[i]*=Math.exp(-dt*.4);
        const width=size[i]+age[i]*4.4;
        position.set(x[i],1+age[i]*.72,z[i]);scale.set(width,width*.6,1);
        opacity.setX(i,Math.min(1,age[i]*3)*(1-t)*(reduced?.12:.48));
      }
      matrix.compose(position,camera.quaternion,scale);mesh.setMatrixAt(i,matrix);
    }
    mesh.visible=active>0;mesh.instanceMatrix.needsUpdate=true;opacity.needsUpdate=true;
  }
  return {mesh,update,get active(){return active;},dispose(){mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();}};
}
