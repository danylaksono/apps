// Ray picking against the terrain and screen-space picking of candidate sekat rings.

import {canvas,camera} from './renderer.js';
import {terrain} from './terrain.js';
import {st,NB,allBlocks} from './model.js';

const pv=new THREE.Vector3();
const ray=new THREE.Raycaster();const ndc=new THREE.Vector2();
function pickTerrain(m){ndc.set(m.x/canvas.clientWidth*2-1,-(m.y/canvas.clientHeight)*2+1);ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObject(terrain);for(const h of hits){if(st.cut>-100&&h.point.x<st.cut)continue;if(Math.hypot(h.point.x,h.point.z)>100)return null;return h.point;}return null;}
function candAt(m){let best=-1,bd=24;for(let i=0;i<NB;i++){const b=allBlocks[i];pv.set(b.x,b.s0+0.6,b.z).project(camera);if(pv.z>1)continue;
  const sx=(pv.x*.5+.5)*canvas.clientWidth,sy=(-pv.y*.5+.5)*canvas.clientHeight;const d=Math.hypot(sx-m.x,sy-m.y);if(d<bd){bd=d;best=i;}}return best;}

export {pickTerrain,candAt};
