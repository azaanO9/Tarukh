import * as T from 'three';
import {flightEase} from '../../game/departureSequence.ts';

/** Gentle windward glow, confined to the approach shot; no flashes or additional lights. */
export function createEntryHeating(vehicle:T.Object3D) {
  const geometry=new T.CapsuleGeometry(1.9,15.4,6,24);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{strength:{value:0}},
    vertexShader:`varying vec3 n;varying vec3 view;varying vec3 local;
      void main(){local=position;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);view=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float strength;varying vec3 n;varying vec3 view;varying vec3 local;
      void main(){float edge=pow(1.-abs(dot(normalize(n),normalize(view))),2.4);
        float windward=smoothstep(-1.8,1.4,local.x)*.75+.25;
        float nose=smoothstep(-8.,7.,local.y);
        gl_FragColor=vec4(mix(vec3(.7,.12,.025),vec3(1.,.6,.2),nose),edge*strength*windward*.55);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const shell=new T.Mesh(geometry,material);shell.name='Mars entry windward glow';shell.position.y=9.5;vehicle.add(shell);
  return {update(time:number,entry:boolean,reduced:boolean){shell.visible=entry&&!reduced;material.uniforms.strength.value=flightEase((time-13)/3)*(1-.4*flightEase((time-17)/2));},
    dispose(){shell.removeFromParent();geometry.dispose();material.dispose();}};
}
