// Forest cones and burnt snags (static scenery; side-effect module).

import {K} from './config.js';
import {rand} from './utils.js';
import {scene,clipList} from './renderer.js';
import {burns,isBurnt,nearest,surfaceY} from './model.js';

const M4=new THREE.Matrix4();
{const im=new THREE.InstancedMesh(new THREE.ConeGeometry(1.15,3.6,5),new THREE.MeshStandardMaterial({flatShading:true,roughness:1,clippingPlanes:clipList}),1700);
 const cc=new THREE.Color();let n=0,guard=0;
 while(n<1700&&guard<40000){guard++;const x=rand()*190-95,z=rand()*190-95;const r=Math.hypot(x,z);
   if(r>84||isBurnt(x,z))continue;const nn=nearest(x,z);if(nn.d<K.W+2.5)continue;
   const sc=0.7+rand()*0.6;M4.makeScale(sc,sc,sc);M4.setPosition(x,surfaceY(x,z,nn)+1.6*sc,z);im.setMatrixAt(n,M4);
   cc.setHex(rand()<.5?0x4E6E40:0x63834F);im.setColorAt(n,cc);n++;}
 im.count=n;scene.add(im);
 const sn=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12,0.2,2.8,4),new THREE.MeshStandardMaterial({color:0x2A2522,flatShading:true,clippingPlanes:clipList}),160);
 let k=0;guard=0;
 while(k<160&&guard<20000){guard++;const b=burns[k%2];const x=b.x+(rand()*2-1)*b.rx,z=b.z+(rand()*2-1)*b.rz;
   if(!isBurnt(x,z))continue;const nn=nearest(x,z);if(nn.d<K.W+1)continue;
   M4.makeRotationZ((rand()-.5)*.5);M4.setPosition(x,surfaceY(x,z,nn)+1.2,z);sn.setMatrixAt(k,M4);k++;}
 sn.count=k;scene.add(sn);}
