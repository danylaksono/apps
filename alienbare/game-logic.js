// --- Game Logic Helpers ---

function pickEnemyType() {
  const score = gameState.score;
  const weights = [];
  const addWeight = (key, base) => {
    if (base <= 0) return;
    weights.push({ key, weight: base });
  };

  addWeight("drone", 3);
  addWeight("racer", score > 60 ? 2.5 : 1);
  addWeight("brute", score > 120 ? 1.6 : 0.4);
  addWeight("sniper", score > 160 ? 1.4 : 0.3);

  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = Math.random() * total;
  let acc = 0;
  for (const entry of weights) {
    acc += entry.weight;
    if (roll <= acc) return entry.key;
  }
  return "drone";
}

function createEnemy(forcedType) {
  const typeKey = forcedType || pickEnemyType();
  const def = ENEMY_TYPES[typeKey];
  let mesh;

  switch (typeKey) {
    case "drone": {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: 0x220000,
        metalness: 0.2,
        roughness: 0.6,
        flatShading: true,
      });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    case "racer": {
      const geo = new THREE.ConeGeometry(0.9, 3, 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: 0x333300,
        metalness: 0.5,
      });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    case "brute": {
      const geo = new THREE.SphereGeometry(1.6, 16, 16);
      const mat = new THREE.MeshStandardMaterial({
        map: asteroidTexture,
        roughness: 1,
      });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    case "sniper": {
      const geo = new THREE.TorusKnotGeometry(0.7, 0.2, 64, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        metalness: 0.8,
        emissive: 0x001a33,
      });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    case "boss": {
      const geo = new THREE.TorusGeometry(4, 0.8, 16, 60);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: 0x331500,
        metalness: 0.6,
        roughness: 0.2,
      });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    default:
      return;
  }

  const x = (Math.random() - 0.5) * 26;
  const y = (Math.random() - 0.5) * 18;
  const z = typeKey === "boss" ? -130 : -110;

  mesh.position.set(x, y, z);
  mesh.userData = {
    type: typeKey,
    hp: def.hp,
    speed: def.speed,
    rotSpeed: def.rotSpeed,
    damage: def.damage,
    score: def.score,
    behavior: def.behavior,
    fireTimer: 0,
    amplitude: def.amplitude || 0,
    phase: Math.random() * Math.PI * 2,
    isBoss: typeKey === "boss",
  };

  if (typeKey === "boss") {
    mesh.scale.set(1.4, 1.4, 1.4);
  } else if (def.scale) {
    mesh.scale.setScalar(def.scale);
  }

  scene.add(mesh);
  enemies.push(mesh);
}

function createBullet({
  origin = shipGroup.position,
  direction = new THREE.Vector3(0, 0, -1),
  speed = 1.5,
  color = 0x00ff00,
  damage = 1,
  pierce = false,
  fromEnemy = false,
} = {}) {
  const geo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 8);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: fromEnemy ? 0.8 : 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(origin);

  const velocity = direction.clone().normalize().multiplyScalar(speed);
  mesh.userData = {
    velocity,
    damage,
    pierce,
    fromEnemy,
  };

  scene.add(mesh);
  if (fromEnemy) {
    enemyProjectiles.push(mesh);
  } else {
    bullets.push(mesh);
  }
}

function createPowerUp(type, position) {
  const def = POWERUP_TYPES[type];
  if (!def) return;

  const core = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x111111,
      transparent: true,
      opacity: 0.6,
    })
  );
  const icon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4),
    new THREE.MeshStandardMaterial({
      color: 0xffd93d,
      emissive: 0x442200,
    })
  );
  core.add(shell);
  core.add(icon);
  core.position.copy(position);
  core.userData = {
    type,
    pulse: 0,
  };

  scene.add(core);
  powerUps.push(core);
  logPowerMessage(`${def.label} detected - ${def.description}`);
}

function applyPowerUp(type) {
  const def = POWERUP_TYPES[type];
  if (!def) return;

  if (def.weapon) {
    gameState.weapon = def.weapon;
    gameState.weaponExpiresAt = WEAPON_LOADOUTS[def.weapon].duration || 10;
    gameState.sideCannons = Boolean(WEAPON_LOADOUTS[def.weapon].sideCannons);
    logPowerMessage(`${WEAPON_LOADOUTS[def.weapon].label} armed`);
  }

  if (def.heal) {
    gameState.health = Math.min(GAME_CONFIG.maxHealth, gameState.health + def.heal);
    updateHUD();
    logPowerMessage(`Shield boosted +${def.heal}%`);
  }
}

function logPowerMessage(text) {
  if (powerupFeedEl) {
    powerupFeedEl.textContent = text;
  }
}

function createExplosion(position, color) {
  const particleCount = 20;
  for (let i = 0; i < particleCount; i++) {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);

    mesh.userData = {
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8
      ),
      life: 1.2,
    };

    scene.add(mesh);
    particles.push(mesh);
  }
}
