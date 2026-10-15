// Sekat (canal blocks) and their candidate rings, the sluice gate, pumps, embung and deep wells.

import {K} from './config.js';
import {ease} from './utils.js';
import {scene,clipList,canvas} from './renderer.js';
import {canals,C2,C3,GATE_S,cpt,s0,surfaceY,allBlocks,NB,blockAct,st} from './model.js';
import {waterMat} from './water.js';
import {app} from './app.js';
import {sb} from './sandbox.js';
import {input} from './camera.js';
import {mouse} from './input.js';
import {candAt} from './picking.js';

const M4=new THREE.Matrix4();
const blockMeshes=[];
{const bg=new THREE.BoxGeometry(2*K.W+1.2,1.6,0.9);const bm=new THREE.MeshStandardMaterial({color:0x8A6A44,flatShading:true,roughness:.9,clippingPlanes:clipList});
 allBlocks.forEach(b=>{const c=canals[b.ci];const m=new THREE.Mesh(bg,bm);m.rotation.y=Math.PI/2-Math.atan2(c.dz,c.dx);
   b.yFinal=b.s0-0.15*K.VE+0.35-0.8;m.position.set(b.x,b.yFinal+20,b.z);m.visible=false;scene.add(m);blockMeshes.push({m,b});});}
const cand=new THREE.InstancedMesh(new THREE.TorusGeometry(2.6,0.28,6,20),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.95}),NB);
{const cc=new THREE.Color(0xffffff);for(let i=0;i<NB;i++)cand.setColorAt(i,cc);}
cand.visible=false;scene.add(cand);
const gate=new THREE.Group();
{const gp=cpt(C3,GATE_S);const top=s0(gp[0],gp[1])+0.8;const steel=new THREE.MeshStandardMaterial({color:0x56666E,roughness:.6,metalness:.3,clippingPlanes:clipList});
 const plateM=new THREE.MeshStandardMaterial({color:0x7E9097,roughness:.5,metalness:.35,clippingPlanes:clipList});const post=new THREE.BoxGeometry(0.45,5.4,0.45);
 const p1=new THREE.Mesh(post,steel);p1.position.set(-(K.W+0.5),0,0);const p2=p1.clone();p2.position.x=K.W+0.5;
 const beam=new THREE.Mesh(new THREE.BoxGeometry(2*K.W+1.6,0.4,0.5),steel);beam.position.y=2.6;
 const plate=new THREE.Mesh(new THREE.BoxGeometry(2*K.W+0.6,2.6,0.25),plateM);plate.position.y=-1.4;
 gate.add(p1,p2,beam,plate);gate.position.set(gp[0],top-1.2,gp[1]);gate.userData.plate=plate;scene.add(gate);}

// ---------- pumps, embung, deep wells ----------
const pumpGroup=new THREE.Group();scene.add(pumpGroup);const pumps=[];
{const bodyM=new THREE.MeshStandardMaterial({color:0xD3A62B,flatShading:true,roughness:.6,clippingPlanes:clipList});
 const engM=new THREE.MeshStandardMaterial({color:0x3B4447,flatShading:true,roughness:.7,clippingPlanes:clipList});
 const hoseM=new THREE.LineBasicMaterial({color:0x1F2E2A,clippingPlanes:clipList});
 [{x:-34.5,z:91,s:3,emb:false},{x:-34.5,z:65,s:35,emb:true},{x:-34.5,z:30,s:70,emb:true}].forEach(sp=>{const g=new THREE.Group();const y=surfaceY(sp.x,sp.z);
   const b=new THREE.Mesh(new THREE.BoxGeometry(2.4,1.5,1.7),bodyM);const e=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,1.2,6),engM);
   e.rotation.z=Math.PI/2;e.position.set(0,1.1,0);g.add(b,e);g.position.set(sp.x,y+0.75,sp.z);pumpGroup.add(g);
   const q=cpt(C2,sp.s);pumpGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sp.x-1.2,y+0.6,sp.z),new THREE.Vector3(q[0],s0(q[0],q[1])-0.5,q[1])]),hoseM));
   if(sp.emb){const em=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.2,0.4,10),waterMat);em.position.set(sp.x+5,surfaceY(sp.x+5,sp.z)+0.1,sp.z);pumpGroup.add(em);}
   pumps.push({g,y:y+0.75,x:sp.x,z:sp.z});});}
pumpGroup.visible=false;
const wells=new THREE.Group();scene.add(wells);
{const wm=new THREE.MeshStandardMaterial({color:0x6E7478,flatShading:true,clippingPlanes:clipList});
 const rm=new THREE.LineDashedMaterial({color:0x8E2F4F,dashSize:1.2,gapSize:0.8,clippingPlanes:clipList});
 [[-52,33],[-44,40],[-50,41],[17,-45],[25,-52],[22,-42]].forEach(([x,z])=>{const y=surfaceY(x,z);
   const w=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,2,6),wm);w.position.set(x,y+1,z);wells.add(w);
   const pts=[];for(let k=0;k<=48;k++){const a=k/48*Math.PI*2;const px=x+9*Math.cos(a),pz=z+9*Math.sin(a);pts.push(new THREE.Vector3(px,surfaceY(px,pz)+0.5,pz));}
   const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),rm);ring.computeLineDistances();wells.add(ring);});}
wells.visible=false;

// Per-frame update. Returns the index of the hovered candidate sekat (-1 if none).
function updateStructures(){
  blockMeshes.forEach(({m,b})=>{const a=blockAct[b.gi];m.visible=a>0.001;if(m.visible)m.position.y=b.yFinal+(1-ease(a))*16;});
  gate.userData.plate.position.y=-1.4+st.gate*3.0;
  const editing=app.mode==='sandbox'&&!sb.running;cand.visible=editing;let hov=-1;
  if(editing&&mouse.in&&!input.down)hov=candAt(mouse);
  canvas.classList.toggle('pick',hov>=0);
  if(editing){const cc=new THREE.Color();for(let i=0;i<NB;i++){const b=allBlocks[i];const on=sb.blocks.has(i);
      const s=(i===hov?1.35:1)*(on?0.8:1+0.08*Math.sin(app.clock*4+i));M4.makeRotationX(Math.PI/2);M4.scale(new THREE.Vector3(s,s,s));M4.setPosition(b.x,b.s0+0.7,b.z);cand.setMatrixAt(i,M4);
      cc.setHex(i===hov?0xFFD35A:on?0x7FE0D0:0xFFFFFF);cand.setColorAt(i,cc);}
    cand.instanceMatrix.needsUpdate=true;if(cand.instanceColor)cand.instanceColor.needsUpdate=true;}
  // pumps + wells
  pumpGroup.visible=(app.mode==='story'&&app.sceneIdx>=4)||(app.mode==='sandbox'&&sb.pump);
  pumps.forEach((p,i)=>{p.g.position.y=p.y+(st.pump>0.01?Math.sin(app.clock*40+i)*0.06:0);});
  wells.visible=st.strat>0.05;
  return hov;}

export {gate,pumps,updateStructures};
