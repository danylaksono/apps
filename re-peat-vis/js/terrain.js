// Terrain mesh, per-vertex colouring (TMA classes / strategy) and the KPI share of safe peat.

import {K,COL} from './config.js';
import {scene,clipList} from './renderer.js';
import {nearest,surfaceY,isBurnt,blockIdx,canals,wtdFrom,classOf,st,kompOf,kompStrategy} from './model.js';

// ---------- terrain ----------
const geo=new THREE.PlaneGeometry(200,200,K.SEG,K.SEG);geo.rotateX(-Math.PI/2);
const pos=geo.attributes.position;const NV=pos.count;const vInfo=new Array(NV);const sub=[];
for(let i=0;i<NV;i++){const x=pos.getX(i),z=pos.getZ(i);const n=nearest(x,z);pos.setY(i,surfaceY(x,z,n));
  const burnt=isBurnt(x,z);const r=Math.hypot(x,z);
  vInfo[i]={x,z,n,burnt,bi:blockIdx(canals[n.ci],n.s),inKHG:r<100,kp:kompOf(x,z),
    nat:r>=100?COL.outside:(n.d<K.W+1?COL.bank:burnt?COL.burnt:(r<84?COL.forest:COL.shrub))};
  const row=Math.floor(i/(K.SEG+1)),col=i%(K.SEG+1);if(r<100&&row%4===0&&col%4===0)sub.push(i);}
geo.computeVertexNormals();
const colArr=new Float32Array(NV*3);geo.setAttribute('color',new THREE.BufferAttribute(colArr,3));
const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95,metalness:0,clippingPlanes:clipList}));
scene.add(terrain);
const SC={keep:0x7FBFAF,gate:0x4C7FC0,block:0x9C6B3C,pump:0x7E5BA8,ready:0x8E2F4F};
const CLS_HEX=[COL.ok,COL.mod,COL.high,COL.ext];
// One action per kompartemen (cheapest that closes its deficit); burnt peat still dry afterwards is residual risk.
function stratColor(v,w){return v.burnt&&w>0.6?SC.ready:SC[kompStrategy()[v.kp]];}
const tmpA=new THREE.Color(),tmpB=new THREE.Color();const kpi={pct:0};
function updateTerrainColors(){let ok=0,tot=0;
  for(let i=0;i<NV;i++){const v=vInfo[i];tmpA.setHex(v.nat);
    if(v.inKHG){const w=wtdFrom(v.x,v.z,v.n,v.burnt,v.bi);tot++;if(w<=0.4)ok++;
      if(st.color>0){tmpB.setHex(CLS_HEX[classOf(w)]);tmpA.lerp(tmpB,st.color);}
      if(st.strat>0){tmpB.setHex(stratColor(v,w));tmpA.lerp(tmpB,st.strat);}}
    colArr[i*3]=tmpA.r;colArr[i*3+1]=tmpA.g;colArr[i*3+2]=tmpA.b;}
  geo.attributes.color.needsUpdate=true;kpi.pct=tot?ok/tot:0;}
function kpiNow(list){let ok=0;for(const i of list){const v=vInfo[i];if(wtdFrom(v.x,v.z,v.n,v.burnt,v.bi)<=0.4)ok++;}return ok/list.length;}
const allIn=[];for(let i=0;i<NV;i++)if(vInfo[i].inKHG)allIn.push(i);

export {terrain,vInfo,sub,allIn,kpi,updateTerrainColors,kpiNow};
