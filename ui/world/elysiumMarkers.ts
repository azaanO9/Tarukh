import * as T from 'three';
import {ELYSIUM_SITES,nearestElysiumSite} from '../../game/elysiumSites.ts';

/** Small original signs, shared geometry and no extra lights or render passes. */
export function createElysiumMarkers(scene:T.Scene,heightAt:(x:number,z:number)=>number) {
  const root=new T.Group();root.name='Elysium commissioning stations';scene.add(root);
  const sitesById=new Map(ELYSIUM_SITES.map(site=>[site.id,site]));
  const signGeometry=new T.PlaneGeometry(1.1,.42);
  const ringGeometry=new T.RingGeometry(.7,.78,24).rotateX(-Math.PI/2);
  const ringMaterial=new T.MeshBasicMaterial({color:0x91e0e9,transparent:true,opacity:.65,depthWrite:false});
  const resources:T.Texture[]=[];
  const signs:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[]=[];
  const rings:T.Mesh[]=[];
  for(const site of ELYSIUM_SITES){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#152630';ctx.fillRect(0,0,512,128);
    ctx.strokeStyle='#91e0e9';ctx.lineWidth=6;ctx.strokeRect(4,4,504,120);
    ctx.fillStyle='#f5f2e5';ctx.font='bold 24px sans-serif';ctx.textAlign='center';
    ctx.fillText(`${site.number} · ${site.label}`,256,72,480);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;resources.push(texture);
    const sign=new T.Mesh(signGeometry,new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
    sign.position.set(site.x,heightAt(site.x,site.z)+1.6,site.z);sign.name=`Mission terminal ${site.id}`;root.add(sign);signs.push(sign);
    const ring=new T.Mesh(ringGeometry,ringMaterial);ring.position.set(site.x,heightAt(site.x,site.z)+.07,site.z);root.add(ring);rings.push(ring);
  }
  const bodyMaterial=new T.MeshStandardMaterial({color:0xd0cbb9,roughness:.76,metalness:.3});
  const bodyGeometry=new T.BoxGeometry(.7,.8,.5);
  const mastGeometry=new T.CylinderGeometry(.04,.06,1.8,8);
  const field=ELYSIUM_SITES.find(s=>s.id==='field-sensor')!;
  const body=new T.Mesh(bodyGeometry,bodyMaterial);body.position.set(field.x,heightAt(field.x,field.z)+.4,field.z);root.add(body);
  const mast=new T.Mesh(mastGeometry,bodyMaterial);mast.position.copy(body.position);mast.position.y+=.9;root.add(mast);
  const objectiveMaterial=new T.MeshBasicMaterial({color:0xffd077,transparent:true,opacity:.8,depthWrite:false});
  const objectiveGeometry=new T.OctahedronGeometry(.5);
  const objective=new T.Mesh(objectiveGeometry,objectiveMaterial);root.add(objective);
  return {
    nearest:nearestElysiumSite,
    update(camera:T.Camera,targetId?:string){
      for(let i=0;i<signs.length;i++){
        const near=signs[i].position.distanceToSquared(camera.position)<65*65;
        signs[i].visible=near;rings[i].visible=near;
        if(near)signs[i].quaternion.copy(camera.quaternion);
      }
      const site=targetId?sitesById.get(targetId):undefined;
      objective.visible=!!site;
      if(site)objective.position.set(site.x,heightAt(site.x,site.z)+3.3,site.z);
    },
    dispose(){
      root.removeFromParent();
      for(const texture of resources)texture.dispose();
      for(const sign of signs)sign.material.dispose();
      for(const geometry of [signGeometry,ringGeometry,bodyGeometry,mastGeometry,objectiveGeometry])geometry.dispose();
      ringMaterial.dispose();bodyMaterial.dispose();objectiveMaterial.dispose();
    },
  };
}
