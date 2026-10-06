// Cross-section (potongan melintang) of the peat dome and the influence bracket.

import {K,COL} from './config.js';
import {scene} from './renderer.js';
import {nearest,surfaceY,surfNG,wtdFrom,isBurnt,blockIdx,canals,st} from './model.js';
import {app} from './app.js';

const PN=200;const prof=new THREE.Group();scene.add(prof);
function stripMesh(color){const g=new THREE.BufferGeometry();const p=new Float32Array(PN*18);g.setAttribute('position',new THREE.BufferAttribute(p,3));
  prof.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide})));return {g,p};}
const stDry=stripMesh(0xB98B5A),stSat=stripMesh(0x4A3A31),stMin=stripMesh(0x8F8C82),stWat=stripMesh(COL.water),stWT=stripMesh(0x7FC4F0),stTgt=stripMesh(0xF4F1E6);
function fillStrip(S,x,zs,top,bot,mask){let o=0;for(let i=0;i<PN;i++){const on=!mask||mask[i];const z0=zs[i],z1=zs[i+1];
  const t0=on?top[i]:bot[i],t1=on?top[i+1]:bot[i+1],b0=bot[i],b1=bot[i+1];S.p.set([x,t0,z0,x,b0,z0,x,t1,z1,x,b0,z0,x,b1,z1,x,t1,z1],o);o+=18;}
  S.g.attributes.position.needsUpdate=true;S.g.computeBoundingSphere();}
const zsA=new Float32Array(PN+1);for(let i=0;i<=PN;i++)zsA[i]=-100+i*200/PN;
function updateProfile(){const on=st.cut>-100;prof.visible=on;if(!on)return;const x=st.cut-0.04;
  const surf=[],dryBot=[],base=[],minB=[],watTop=[],wtTop=[],wtBot=[],tgT=[],tgB=[],tgMask=[];
  for(let i=0;i<=PN;i++){const z=zsA[i];const n=nearest(st.cut,z);const sy=surfaceY(st.cut,z,n);const ng=surfNG(st.cut,z);
    const wy=ng-wtdFrom(st.cut,z,n,isBurnt(st.cut,z),blockIdx(canals[n.ci],n.s))*K.VE;
    surf.push(sy);dryBot.push(Math.min(wy,sy));base.push(K.BASE);minB.push(K.BASE-3);watTop.push(Math.max(wy,sy));
    wtTop.push(Math.min(wy,sy)+0.14);wtBot.push(Math.min(wy,sy)-0.14);const ty=ng-0.4*K.VE;tgT.push(ty+0.11);tgB.push(ty-0.11);tgMask.push(n.d>K.W&&(Math.floor(i/2)%2===0));}
  fillStrip(stDry,x,zsA,surf,dryBot);fillStrip(stSat,x,zsA,dryBot,base);fillStrip(stMin,x,zsA,base,minB);
  fillStrip(stWat,x-0.01,zsA,watTop,surf);fillStrip(stWT,x-0.02,zsA,wtTop,wtBot);fillStrip(stTgt,x-0.03,zsA,tgT,tgB,tgMask);}
const brGeo=new THREE.BufferGeometry();const brPos=new Float32Array(18);brGeo.setAttribute('position',new THREE.BufferAttribute(brPos,3));
const bracket=new THREE.LineSegments(brGeo,new THREE.LineBasicMaterial({color:0x1F2E2A}));scene.add(bracket);bracket.visible=false;
function updateBracket(){const show=app.mode==='story'&&app.sceneIdx===2&&st.cut>-100&&st.pB>0.3;bracket.visible=show;if(!show)return;
  const x=st.cut-0.2,y=surfNG(st.cut,4)+3.2,z0=K.W,z1=K.W+200/K.U;brPos.set([x,y,z0,x,y,z1,x,y-0.8,z0,x,y+0.8,z0,x,y-0.8,z1,x,y+0.8,z1]);brGeo.attributes.position.needsUpdate=true;}

export {updateProfile,updateBracket};
