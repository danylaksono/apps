// Low-poly fire, smoke, embers, glow and fire lights.

import {clamp,rand} from './utils.js';
import {K} from './config.js';
import {scene,clipList} from './renderer.js';
import {burns,isBurnt,nearest,surfaceY,wtdAt,st} from './model.js';
import {cam} from './camera.js';
import {app} from './app.js';

// ---------- fire (low-poly), smoke, rain ----------
function puffTex(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,2,32,32,30);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const glowTex=puffTex();
const FIRE_N=14,FL_PER=12,SM_PER=9,EM_PER=14;
const fires=[];
{let guard=0;while(fires.length<FIRE_N&&guard<8000){guard++;const b=burns[fires.length%2];const x=b.x+(rand()*2-1)*b.rx*.8,z=b.z+(rand()*2-1)*b.rz*.8;
   if(!isBurnt(x,z))continue;const nn=nearest(x,z);if(nn.d<K.W+1.5)continue;if(fires.some(f=>Math.hypot(f.x-x,f.z-z)<4.5))continue;
   fires.push({x,z,y:surfaceY(x,z,nn),a:0,ph:rand()*10});}}
const flameMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
  new THREE.MeshBasicMaterial({transparent:true,opacity:.92,blending:THREE.AdditiveBlending,depthWrite:false,clippingPlanes:clipList}),FIRE_N*FL_PER);
const smokeMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),
  new THREE.MeshStandardMaterial({flatShading:true,roughness:1,transparent:true,opacity:.55,depthWrite:false,clippingPlanes:clipList}),FIRE_N*SM_PER);
{const c=new THREE.Color(0xffffff);for(let i=0;i<FIRE_N*FL_PER;i++)flameMesh.setColorAt(i,c);for(let i=0;i<FIRE_N*SM_PER;i++)smokeMesh.setColorAt(i,c);}
flameMesh.frustumCulled=false;smokeMesh.frustumCulled=false;scene.add(flameMesh,smokeMesh);
const emGeo=new THREE.BufferGeometry();const emPos=new Float32Array(FIRE_N*EM_PER*3);emGeo.setAttribute('position',new THREE.BufferAttribute(emPos,3));
const emMat=new THREE.PointsMaterial({color:0xFFB347,size:0.9,map:glowTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,clippingPlanes:clipList});
const embers=new THREE.Points(emGeo,emMat);embers.frustumCulled=false;scene.add(embers);
const glows=fires.map(f=>{const m=new THREE.Mesh(new THREE.CircleGeometry(4.2,18),new THREE.MeshBasicMaterial({color:0xFF6A1A,map:glowTex,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,clippingPlanes:clipList}));
  m.rotation.x=-Math.PI/2;m.position.set(f.x,f.y+0.35,f.z);scene.add(m);return m;});
const fireLights=[0,1,6].filter(i=>i<fires.length).map(i=>{const L=new THREE.PointLight(0xFF7A2A,0,45,2);L.position.set(fires[i].x,fires[i].y+4,fires[i].z);scene.add(L);return {L,i};});
const DUM=new THREE.Object3D();
const cY=new THREE.Color(0xFFE066),cO=new THREE.Color(0xFF8A2A),cR=new THREE.Color(0xC8341C),cK=new THREE.Color(0x3A3632),cG=new THREE.Color(0xBDB8B0),cT=new THREE.Color();
function updateFire(dt){const cs=clamp(cam.r/140,1,2.2);let active=0;
  fires.forEach((f,ci)=>{const on=st.color>0.5&&wtdAt(f.x,f.z)>0.6;f.a+=clamp((on?1:0)-f.a,-dt*1.2,dt*1.2);if(f.a>0.5)active++;
    for(let k=0;k<FL_PER;k++){const life=(app.clock*0.95+k/FL_PER+f.ph)%1;const ang=k*2.4+f.ph;const rr=(0.35+(k%3)*0.45)*(1-life*0.7)*cs;
      const sc=f.a*cs*(life<0.25?life/0.25*1.15:1.15*(1-(life-0.25)/0.75)+0.1);
      DUM.position.set(f.x+Math.cos(ang)*rr,f.y+0.4+life*5.2*cs,f.z+Math.sin(ang)*rr);DUM.rotation.set(app.clock*2+k,app.clock*1.3+k*0.7,0);
      DUM.scale.set(sc*0.85,sc*1.5,sc*0.85);DUM.updateMatrix();const id=ci*FL_PER+k;flameMesh.setMatrixAt(id,DUM.matrix);
      if(life<0.35)cT.copy(cY).lerp(cO,life/0.35);else cT.copy(cO).lerp(cR,(life-0.35)/0.65);flameMesh.setColorAt(id,cT);}
    for(let k=0;k<SM_PER;k++){const life=(app.clock*0.11+k/SM_PER+f.ph*0.31)%1;const fade=life>0.85?(1-life)/0.15:Math.min(1,life/0.08);
      const sc=Math.max(0.001,f.a*cs*0.7*(0.9+life*4.2)*fade);
      DUM.position.set(f.x+life*11+Math.sin(life*5+f.ph)*1.5,f.y+2+life*26*cs*0.8,f.z-life*6);DUM.rotation.set(life*3+k,f.ph+k,life*2);
      DUM.scale.set(sc,sc*0.85,sc);DUM.updateMatrix();const id=ci*SM_PER+k;smokeMesh.setMatrixAt(id,DUM.matrix);
      cT.copy(cK).lerp(cG,Math.min(1,life*1.4));smokeMesh.setColorAt(id,cT);}
    for(let k=0;k<EM_PER;k++){const life=(app.clock*0.65+k/EM_PER+f.ph*1.7)%1;const o=(ci*EM_PER+k)*3;
      if(f.a>0.3){const a=k*1.7+f.ph;emPos[o]=f.x+Math.cos(a)*life*2.5*cs+life*3;emPos[o+1]=f.y+1+life*13*cs;emPos[o+2]=f.z+Math.sin(a)*life*2.5*cs;}else emPos[o+1]=-500;}
    glows[ci].material.opacity=f.a*(0.55+0.2*Math.sin(app.clock*7+f.ph));glows[ci].scale.setScalar(cs);});
  flameMesh.instanceMatrix.needsUpdate=true;flameMesh.instanceColor.needsUpdate=true;
  smokeMesh.instanceMatrix.needsUpdate=true;smokeMesh.instanceColor.needsUpdate=true;emGeo.attributes.position.needsUpdate=true;
  emMat.size=0.9*cs;
  fireLights.forEach(({L,i})=>{L.intensity=fires[i].a*(1.6+0.6*Math.sin(app.clock*13+i)+0.3*Math.sin(app.clock*29+i*3));});
  return active;}

export {FIRE_N,updateFire};
