// --- Main Loop ---

let lastShotTime = 0;
let spawnTimer = 0;
const clock = new THREE.Clock();
const shipVelocity = new THREE.Vector3();

function setBossAlert(state) {
  if (!bossAlertEl) return;
  bossAlertEl.classList.toggle("visible", state);
}

function resetGame() {
  gameState.score = 0;
  gameState.health = GAME_CONFIG.maxHealth;
  gameState.isPlaying = true;
  gameState.weapon = "pulse";
  gameState.weaponExpiresAt = 0;
  gameState.sideCannons = false;
  gameState.bossActive = false;
  gameState.nextBossScore = GAME_CONFIG.bossInterval;
  gameState.shieldCooldown = 0;

  // Cleanup
  [...enemies, ...bullets, ...enemyProjectiles, ...powerUps, ...particles].forEach(
    (mesh) => scene.remove(mesh)
  );
  enemies = [];
  bullets = [];
  enemyProjectiles = [];
  powerUps = [];
  particles = [];

  updateHUD();
  shipGroup.visible = true;
  shipGroup.position.set(0, 0, 0);
  shipGroup.rotation.set(0, 0, 0);
  shipVelocity.set(0, 0, 0);
  setBossAlert(false);
  logPowerMessage("Awaiting pilot input...");
}

function gameOver() {
  if (!gameState.isPlaying) return;
  gameState.isPlaying = false;
  shipGroup.visible = false;
  createExplosion(shipGroup.position, 0x00ffff);
  setBossAlert(false);
  gameOverPanel.classList.remove("hidden");
  finalScoreEl.textContent = Math.round(gameState.score);
}

function updateHUD() {
  scoreEl.textContent = `SCORE: ${Math.round(gameState.score)}`;
  const shieldRatio = Math.max(0, gameState.health) / GAME_CONFIG.maxHealth;
  const shieldPercent = Math.round(shieldRatio * 100);
  healthEl.textContent = `SHIELD: ${shieldPercent}%`;
  healthEl.style.color = shieldPercent < 35 ? "#ff5b5b" : "#5af0ff";
  const weaponDef = WEAPON_LOADOUTS[gameState.weapon];
  if (weaponEl && weaponDef) {
    weaponEl.textContent = `WEAPON: ${weaponDef.label}`;
  }
}

function fireCurrentWeapon(time) {
  const weaponDef = WEAPON_LOADOUTS[gameState.weapon] || WEAPON_LOADOUTS.pulse;
  if (time - lastShotTime < weaponDef.fireRate) return;

  const shots = weaponDef.bulletsPerShot || 1;
  for (let i = 0; i < shots; i++) {
    const spread = weaponDef.spread || 0;
    const offset = spread * (i - (shots - 1) / 2);
    const dir = new THREE.Vector3(Math.sin(offset), 0, -Math.cos(offset));
    createBullet({
      origin: shipGroup.position.clone(),
      direction: dir,
      speed: weaponDef.speed,
      color: weaponDef.color,
      damage: weaponDef.damage,
      pierce: weaponDef.pierce,
    });
  }

  if (gameState.sideCannons || weaponDef.sideCannons) {
    const offsets = [-1.3, 1.3];
    offsets.forEach((x) => {
      const origin = shipGroup.position.clone().add(new THREE.Vector3(x, 0, 0));
      createBullet({
        origin,
        direction: new THREE.Vector3(0, 0, -1),
        speed: weaponDef.speed * 0.95,
        color: weaponDef.color,
        damage: weaponDef.damage * 0.8,
      });
    });
  }

  lastShotTime = time;
}

function damagePlayer(amount) {
  if (!gameState.isPlaying) return;
  gameState.health -= amount;
  gameState.shieldCooldown = GAME_CONFIG.shieldRegenDelay;
  if (gameState.health <= 0) {
    gameState.health = 0;
    updateHUD();
    gameOver();
    return;
  }
  updateHUD();
}

function spawnBoss() {
  if (gameState.bossActive) return;
  gameState.bossActive = true;
  gameState.nextBossScore += GAME_CONFIG.bossInterval;
  createEnemy("boss");
  logPowerMessage("Dreadnought inbound! Brace yourself.");
  setBossAlert(true);
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Ship Movement Physics
  const lerpRate = gameState.handDetected ? 0.08 : 0.04;
  shipVelocity.x += (gameState.targetX - shipGroup.position.x) * lerpRate;
  shipVelocity.y += (gameState.targetY - shipGroup.position.y) * lerpRate;
  shipVelocity.multiplyScalar(0.9);
  shipGroup.position.add(shipVelocity.clone().multiplyScalar(1.4));
  shipGroup.position.x = THREE.MathUtils.clamp(shipGroup.position.x, -15, 15);
  shipGroup.position.y = THREE.MathUtils.clamp(shipGroup.position.y, -10, 10);
  shipGroup.position.z = 0;

  shipGroup.rotation.z = THREE.MathUtils.clamp(-shipVelocity.x * 0.2, -0.6, 0.6);
  shipGroup.rotation.x = THREE.MathUtils.clamp(shipVelocity.y * 0.2, -0.4, 0.4);

  if (shipShield) {
    const shieldRatio = THREE.MathUtils.clamp(
      gameState.health / GAME_CONFIG.maxHealth,
      0,
      1
    );
    shipShield.material.opacity = THREE.MathUtils.lerp(0.05, 0.25, shieldRatio);
    shipShield.scale.setScalar(1.7 + (1 - shieldRatio) * 0.6);
  }

  // Starfield Animation
  const positions = stars.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 2] += 1.8;
    if (positions[i + 2] > 20) {
      positions[i + 2] = -180;
    }
  }
  stars.geometry.attributes.position.needsUpdate = true;

  if (backgroundPlane) {
    backgroundPlane.rotation.z += delta * 0.02;
  }

  if (gameState.isPlaying) {
    // Weapon expiration
    if (gameState.weapon !== "pulse") {
      gameState.weaponExpiresAt -= delta;
      if (gameState.weaponExpiresAt <= 0) {
        gameState.weapon = "pulse";
        gameState.sideCannons = false;
        logPowerMessage("Pulse cannon nominal.");
        updateHUD();
      }
    }

    // Shield regeneration
    if (gameState.shieldCooldown > 0) {
      gameState.shieldCooldown -= delta;
    } else if (gameState.health < GAME_CONFIG.maxHealth) {
      gameState.health = Math.min(
        GAME_CONFIG.maxHealth,
        gameState.health + GAME_CONFIG.shieldRegenRate * delta
      );
      updateHUD();
    }

    fireCurrentWeapon(time);

    // Enemy spawning
    if (!gameState.bossActive) {
      spawnTimer += delta;
      const spawnRate = Math.max(
        0.4,
        GAME_CONFIG.enemySpawnBase - gameState.score / 600
      );
      if (spawnTimer > spawnRate) {
        createEnemy();
        spawnTimer = 0;
      }
    }

    if (!gameState.bossActive && gameState.score >= gameState.nextBossScore) {
      spawnBoss();
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.position.add(b.userData.velocity);
      if (b.position.z < -150) {
        scene.remove(b);
        bullets.splice(i, 1);
      }
    }

    // Update enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
      const shot = enemyProjectiles[i];
      shot.position.add(shot.userData.velocity);
      if (shot.position.distanceTo(shipGroup.position) < 2.1) {
        createExplosion(shot.position, 0xff4422);
        scene.remove(shot);
        enemyProjectiles.splice(i, 1);
        damagePlayer(shot.userData.damage || 10);
        continue;
      }
      if (shot.position.z > 15 || shot.position.z < -200) {
        scene.remove(shot);
        enemyProjectiles.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const def = ENEMY_TYPES[enemy.userData.type];
      const moveSpeed = (enemy.userData.speed || 0.4) * 2.2;
      enemy.position.z += moveSpeed;
      enemy.rotation.x += 0.01 * enemy.userData.rotSpeed;
      enemy.rotation.y += 0.01 * enemy.userData.rotSpeed;

      switch (enemy.userData.behavior) {
        case "zigzag":
          enemy.position.x +=
            Math.sin(time * 4 + enemy.userData.phase) *
            delta *
            (enemy.userData.amplitude || 5);
          break;
        case "snipe":
          enemy.position.x += (shipGroup.position.x - enemy.position.x) * 0.004;
          enemy.userData.fireTimer += delta;
          if (enemy.userData.fireTimer > (def?.fireCooldown || 3)) {
            enemy.userData.fireTimer = 0;
            const dir = shipGroup.position.clone().sub(enemy.position).normalize();
            createBullet({
              origin: enemy.position.clone(),
              direction: dir,
              speed: 1.2,
              color: 0xff7722,
              damage: 12,
              fromEnemy: true,
            });
          }
          break;
        case "boss":
          enemy.userData.fireTimer += delta;
          if (enemy.userData.fireTimer > 1.2) {
            enemy.userData.fireTimer = 0;
            for (let angle = -0.6; angle <= 0.6; angle += 0.3) {
              const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
              createBullet({
                origin: enemy.position.clone().add(new THREE.Vector3(0, 0, 4)),
                direction: dir,
                speed: 1.4,
                color: 0xffaa00,
                damage: 18,
                fromEnemy: true,
              });
            }
          }
          break;
        default:
          enemy.position.x += Math.sin(time + enemy.userData.phase) * 0.05;
      }

      // Collision with ship
      if (enemy.position.distanceTo(shipGroup.position) < (enemy.userData.isBoss ? 4 : 2.2)) {
        createExplosion(enemy.position, 0xff2222);
        damagePlayer(enemy.userData.damage || 15);
        scene.remove(enemy);
        enemies.splice(i, 1);
        continue;
      }

      // Enemy passed player
      if (enemy.position.z > 12 && !enemy.userData.isBoss) {
        damagePlayer(6);
        scene.remove(enemy);
        enemies.splice(i, 1);
        continue;
      }

      // Bullet collisions
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (b.position.distanceTo(enemy.position) < (enemy.userData.isBoss ? 3.5 : 1.4)) {
          enemy.userData.hp -= b.userData.damage || 1;
          createExplosion(b.position, 0xffdd88);
          if (!b.userData.pierce) {
            scene.remove(b);
            bullets.splice(j, 1);
          }
          if (enemy.userData.hp <= 0) {
            scene.remove(enemy);
            enemies.splice(i, 1);
            gameState.score += enemy.userData.score || 10;
            updateHUD();
            createExplosion(enemy.position, 0xffaa55);

            if (enemy.userData.isBoss) {
              gameState.bossActive = false;
              setBossAlert(false);
              logPowerMessage("Boss down! Sector clear.");
            } else if (Math.random() < GAME_CONFIG.powerupChance) {
              const keys = Object.keys(POWERUP_TYPES);
              const randomType = keys[Math.floor(Math.random() * keys.length)];
              createPowerUp(randomType, enemy.position.clone());
            }
          }
          break;
        }
      }
    }

    // Update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const p = powerUps[i];
      p.position.z += 0.4;
      p.rotation.x += 0.02;
      p.rotation.y += 0.01;
      if (p.position.distanceTo(shipGroup.position) < 2) {
        applyPowerUp(p.userData.type);
        scene.remove(p);
        powerUps.splice(i, 1);
        continue;
      }
      if (p.position.z > 15) {
        scene.remove(p);
        powerUps.splice(i, 1);
      }
    }
  }

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.add(p.userData.velocity);
    p.userData.life -= 0.05;
    p.scale.setScalar(Math.max(0, p.userData.life));

    if (p.userData.life <= 0) {
      scene.remove(p);
      particles.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

// --- Initialization Flow ---

// Wait for MediaPipe to be readyish (hacky but effective for single file)
setTimeout(() => {
  cameraUtils
    .start()
    .then(() => {
      loadingPanel.classList.add("hidden");
      startPanel.classList.remove("hidden");
    })
    .catch((err) => {
      console.error(err);
      alert(
        "Camera access denied or error loading. Please allow camera access."
      );
    });
}, 1000);

startBtn.addEventListener("click", () => {
  startPanel.classList.add("hidden");
  resetGame();
});

restartBtn.addEventListener("click", () => {
  gameOverPanel.classList.add("hidden");
  resetGame();
});

// Handle Window Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start loop
animate();
