// THREE.js renderer, scene, camera, lights and the shared cross-section clipping plane.

const canvas=document.getElementById('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.localClippingEnabled=true;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,1,2000);
const hemi=new THREE.HemisphereLight(0xE2ECEF,0x6B5A45,0.8);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xFFF2DE,0.85);sun.position.set(-80,150,70);scene.add(sun);
const sunCalm=new THREE.Color(0xFFF2DE),sunHaze=new THREE.Color(0xFFB070);
const clipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),200);const clipList=[clipPlane];

export {canvas,renderer,scene,camera,sun,sunCalm,sunHaze,clipPlane,clipList};
