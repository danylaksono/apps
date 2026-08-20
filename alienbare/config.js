// --- Game State & Configuration ---

const WEAPON_LOADOUTS = {
  pulse: {
    label: "Pulse Cannon",
    fireRate: 0.22,
    bulletsPerShot: 1,
    spread: 0,
    speed: 1.5,
    damage: 1,
    color: 0x00fff2,
  },
  trident: {
    label: "Trident Burst",
    fireRate: 0.18,
    bulletsPerShot: 3,
    spread: 0.18,
    speed: 1.4,
    damage: 0.9,
    duration: 12,
    color: 0xfff455,
  },
  rail: {
    label: "Rail Lance",
    fireRate: 0.65,
    bulletsPerShot: 1,
    spread: 0,
    speed: 2.2,
    damage: 4,
    pierce: true,
    duration: 10,
    color: 0xff6df0,
  },
  sidekick: {
    label: "Wing Cannons",
    fireRate: 0.28,
    bulletsPerShot: 2,
    spread: 0.35,
    speed: 1.3,
    damage: 1.1,
    sideCannons: true,
    duration: 15,
    color: 0x50ff89,
  },
};

const POWERUP_TYPES = {
  rapid: {
    label: "Trident Core",
    description: "Triple-shot burst active",
    weapon: "trident",
  },
  rail: {
    label: "Rail Capacitor",
    description: "Rail lance loaded",
    weapon: "rail",
  },
  shield: {
    label: "Shield Battery",
    description: "+35% shield restored",
    heal: 35,
  },
  sidekick: {
    label: "Wing Drone",
    description: "Side cannons online",
    weapon: "sidekick",
  },
};

const ENEMY_TYPES = {
  drone: {
    label: "Raider",
    color: 0xff4d4d,
    hp: 2,
    damage: 15,
    speed: 0.45,
    rotSpeed: 0.8,
    score: 12,
    behavior: "wander",
  },
  racer: {
    label: "Needle",
    color: 0xf3ff4d,
    hp: 1,
    damage: 10,
    speed: 0.9,
    rotSpeed: 1.4,
    score: 16,
    behavior: "zigzag",
    amplitude: 6,
  },
  brute: {
    label: "Bulwark",
    color: 0x7c4dff,
    hp: 6,
    damage: 30,
    speed: 0.3,
    rotSpeed: 0.4,
    score: 35,
    behavior: "straight",
    scale: 1.6,
  },
  sniper: {
    label: "Rift Pod",
    color: 0x4dd3ff,
    hp: 3,
    damage: 20,
    speed: 0.35,
    rotSpeed: 0.6,
    score: 28,
    behavior: "snipe",
    fireCooldown: 3,
  },
  boss: {
    label: "Dreadnought",
    color: 0xff7b00,
    hp: 120,
    damage: 45,
    speed: 0.18,
    rotSpeed: 0.2,
    score: 250,
    behavior: "boss",
  },
};

const GAME_CONFIG = {
  maxHealth: 120,
  shieldRegenDelay: 2.5,
  shieldRegenRate: 8, // per second
  enemySpawnBase: 1.8,
  bossInterval: 350,
  powerupChance: 0.35,
};

const gameState = {
  isPlaying: false,
  score: 0,
  health: GAME_CONFIG.maxHealth,
  handDetected: false,
  targetX: 0,
  targetY: 0,
  weapon: "pulse",
  weaponExpiresAt: 0,
  shieldCooldown: 0,
  sideCannons: false,
  bossActive: false,
  nextBossScore: GAME_CONFIG.bossInterval,
};
