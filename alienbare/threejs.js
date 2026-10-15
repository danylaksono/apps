// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById("canvas-container").appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const nebulaTexture = textureLoader.load("assets/nebula.jpg");
nebulaTexture.colorSpace = THREE.SRGBColorSpace;

const backgroundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(250, 140),
  new THREE.MeshBasicMaterial({
    map: nebulaTexture,
    depthWrite: false,
    fog: false,
  })
);
backgroundPlane.position.z = -200;
scene.add(backgroundPlane);

const asteroidTexture = textureLoader.load("assets/asteroid.jpg");
asteroidTexture.colorSpace = THREE.SRGBColorSpace;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

// --- Game Objects ---

// 1. The Hero Ship
const shipGroup = new THREE.Group();

// Ship Body
const shipGeo = new THREE.ConeGeometry(1, 3, 8);
shipGeo.rotateX(Math.PI / 2);
const shipMat = new THREE.MeshStandardMaterial({
  color: 0x00ffff,
  emissive: 0x0044aa,
  metalness: 0.8,
  roughness: 0.2,
});
const shipBody = new THREE.Mesh(shipGeo, shipMat);
shipGroup.add(shipBody);

// Ship Wings
const wingGeo = new THREE.BoxGeometry(4, 0.2, 1.5);
const wingMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const wings = new THREE.Mesh(wingGeo, wingMat);
wings.position.z = 0.5;
shipGroup.add(wings);

// Engine Glow
const engineGeo = new THREE.SphereGeometry(0.4, 16, 16);
const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const engine = new THREE.Mesh(engineGeo, engineMat);
engine.position.z = 1.6;
shipGroup.add(engine);

const leftCannon = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
leftCannon.rotateZ(Math.PI / 2);
const cannonMat = new THREE.MeshStandardMaterial({ color: 0x00ffdd });
const leftGun = new THREE.Mesh(leftCannon, cannonMat);
leftGun.position.set(-1.4, -0.1, 0.4);
shipGroup.add(leftGun);

const rightGun = leftGun.clone();
rightGun.position.x = 1.4;
shipGroup.add(rightGun);

const shieldGeo = new THREE.SphereGeometry(2.2, 32, 32);
const shieldMat = new THREE.MeshBasicMaterial({
  color: 0x66fffe,
  transparent: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending,
});
const shipShield = new THREE.Mesh(shieldGeo, shieldMat);
shipShield.visible = true;
shipGroup.add(shipShield);

scene.add(shipGroup);

// 2. Starfield
const starGeo = new THREE.BufferGeometry();
const starCount = 2000;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPos[i] = (Math.random() - 0.5) * 200;
}
starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// Lists for dynamic objects
let bullets = [];
let enemies = [];
let particles = [];
let enemyProjectiles = [];
let powerUps = [];
