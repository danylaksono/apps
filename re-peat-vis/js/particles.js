// Rain, evapotranspiration (ET) and water-flow particles.

import {rand} from './utils.js';
import {scene,clipList} from './renderer.js';
import {s0,surfaceY,C1,C2,C3,cpt,st,rainNow} from './model.js';
import {waterYOn} from './water.js';
import {sb} from './sandbox.js';
import {app} from './app.js';

const RN=900;const rnGeo=new THREE.BufferGeometry();const rnPos=new Float32Array(RN*6);rnGeo.setAttribute('position',new THREE.BufferAttribute(rnPos,3));
const rnBase=[];for(let i=0;i<RN;i++){let x,z;do{x=rand()*200-100;z=rand()*200-100;}while(Math.hypot(x,z)>105);rnBase.push({x,z,ph:rand(),g:s0(x,z)});}
const rnMat=new THREE.LineBasicMaterial({color:0xD9E8F2,transparent:true,opacity:0});
scene.add(new THREE.LineSegments(rnGeo,rnMat));

const ETN=700;const etGeo=new THREE.BufferGeometry();const etPos=new Float32Array(ETN*3);const etBase=[];
for(let i=0;i<ETN;i++){let x,z;do{x=rand()*190-95;z=rand()*190-95;}while(Math.hypot(x,z)>95);etBase.push({x,z,y:surfaceY(x,z),ph:rand()});}
etGeo.setAttribute('position',new THREE.BufferAttribute(etPos,3));
const etMat=new THREE.PointsMaterial({color:0xDDEEF6,size:0.7,transparent:true,opacity:0,depthWrite:false,clippingPlanes:clipList});
scene.add(new THREE.Points(etGeo,etMat));
const flMat=new THREE.PointsMaterial({color:0xBFE6FF,size:1.3,transparent:true,opacity:.95,depthWrite:false});
const FN=110;const flGeo=new THREE.BufferGeometry();const flPos=new Float32Array(FN*3);flGeo.setAttribute('position',new THREE.BufferAttribute(flPos,3));scene.add(new THREE.Points(flGeo,flMat));
const PFN=80;const pfGeo=new THREE.BufferGeometry();const pfPos=new Float32Array(PFN*3);pfGeo.setAttribute('position',new THREE.BufferAttribute(pfPos,3));scene.add(new THREE.Points(pfGeo,flMat));

export function updateParticles(){
  // rain
  const ri=rainNow(st.t)*(app.mode==='sandbox'&&(sb.running||sb.done)?1:0);rnMat.opacity=ri*0.7;
  if(ri>0.01){for(let i=0;i<RN;i++){const b=rnBase[i];const u=1-((app.clock*1.6+b.ph)%1);const y=b.g+u*55;rnPos.set([b.x,y,b.z,b.x+0.4,y-2.4,b.z],i*6);}rnGeo.attributes.position.needsUpdate=true;}
  // ET
  etMat.opacity=st.et*0.6*(1-ri);if(st.et>0.01){for(let i=0;i<ETN;i++){const b=etBase[i];const u=(app.clock*0.18+b.ph)%1;etPos.set([b.x,b.y+u*10,b.z],i*3);}etGeo.attributes.position.needsUpdate=true;}
  // flows
  const reach=35+C3.L*st.front;const showFl=st.gate>0.4&&st.front>0.01&&st.dry<0.5;
  for(let i=0;i<FN;i++){const d=((app.clock*0.06+i/FN)%1)*115;let x=0,y=-500,z=0;
    if(showFl&&d<=reach){if(d<=35){const s=145-d;const q=cpt(C1,s);x=q[0];z=q[1];y=waterYOn(C1,s)+0.4;}else{const s=C3.L-(d-35);const q=cpt(C3,s);x=q[0];z=q[1];y=waterYOn(C3,s)+0.4;}}
    flPos.set([x,y,z],i*3);}
  flGeo.attributes.position.needsUpdate=true;
  for(let i=0;i<PFN;i++){let x=0,y=-500,z=0;if(st.pump>0.02){const s=((app.clock*0.07+i/PFN)%1)*C2.L*st.pump;const q=cpt(C2,s);x=q[0];z=q[1];y=waterYOn(C2,s)+0.4;}pfPos.set([x,y,z],i*3);}
  pfGeo.attributes.position.needsUpdate=true;
}
