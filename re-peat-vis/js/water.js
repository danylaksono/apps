// Rivers, KHG boundary ring and canal water ribbons.

import {COL,K} from './config.js';
import {scene,clipList} from './renderer.js';
import {s0,canals,canalDc,surfNG,blockIdx,cpt} from './model.js';

// ---------- rivers + boundary ----------
const waterMat=new THREE.MeshStandardMaterial({color:COL.water,roughness:.35,metalness:.05,transparent:true,opacity:.92,clippingPlanes:clipList});
const rw=new THREE.Mesh(new THREE.PlaneGeometry(7,200),waterMat);rw.rotation.x=-Math.PI/2;rw.position.set(-96.5,1.15,0);scene.add(rw);
const rs=new THREE.Mesh(new THREE.PlaneGeometry(200,7),waterMat);rs.rotation.x=-Math.PI/2;rs.position.set(0,1.15,96.5);scene.add(rs);
{const pts=[];for(let k=0;k<=180;k++){const a=k/180*Math.PI*2,x=100*Math.cos(a),z=100*Math.sin(a);pts.push(new THREE.Vector3(x,s0(x,z)+0.6,z));}
 const ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:0x2A3A36,dashSize:2.4,gapSize:1.6,clippingPlanes:clipList}));
 ring.computeLineDistances();scene.add(ring);}
// Kompartemen (sub-KHG): units bounded by the main canals, extended to the KHG rim.
const kompartemen=new THREE.Group();scene.add(kompartemen);
{const h=Math.sqrt(100*100-40*40);
 const bm=new THREE.LineDashedMaterial({color:0xF4F1E6,dashSize:3.2,gapSize:1.6,clippingPlanes:clipList});
 [[[-100,0],[100,0]],[[-40,0],[-40,h]],[[10,0],[10,-99.5]]].forEach(([a,b])=>{const pts=[];const n=60;
  for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;pts.push(new THREE.Vector3(x,surfNG(x,z)+0.9,z));}
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),bm);l.computeLineDistances();kompartemen.add(l);});}

// ---------- canal water ----------
const ribbons=canals.map((c,ci)=>{const ss=[];const n=140;for(let k=0;k<=n;k++)ss.push(c.L*k/n);
  c.blocks.forEach(b=>{ss.push(Math.max(0,b.s-0.12),Math.min(c.L,b.s+0.12));});ss.sort((a,b)=>a-b);
  const N=ss.length;const g=new THREE.BufferGeometry();const p=new Float32Array(N*2*3);g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const idx=[];for(let k=0;k<N-1;k++){const a=k*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}g.setIndex(idx);scene.add(new THREE.Mesh(g,waterMat));
  return {c,ci,g,p,ss};});
function updateRibbons(){ribbons.forEach(rb=>{const c=rb.c;const nx=-c.dz,nz=c.dx;
  for(let k=0;k<rb.ss.length;k++){const s=rb.ss[k];const q=cpt(c,s);const dc=canalDc(rb.ci,s,blockIdx(c,s));
    const y=surfNG(q[0],q[1])-dc*K.VE;const hw=K.W*Math.sqrt(Math.max(0.04,1-dc*K.VE/K.GD))*0.97;
    rb.p.set([q[0]+nx*hw,y,q[1]+nz*hw,q[0]-nx*hw,y,q[1]-nz*hw],k*6);}
  rb.g.attributes.position.needsUpdate=true;rb.g.computeVertexNormals();rb.g.computeBoundingSphere();});}
function waterYOn(c,s){const q=cpt(c,s);return surfNG(q[0],q[1])-canalDc(canals.indexOf(c),s,blockIdx(c,s))*K.VE;}

export {kompartemen,waterMat,updateRibbons,waterYOn};
