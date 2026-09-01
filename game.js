(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, BOSS, CHARACTER } = window.MEOW_DATA;
  const world = $("world");
  const scene = $("gameScene");
  const damageFlash = $("damageFlash");
  const TAU = Math.PI * 2;
  const WORLD_W = 2400;
  const WORLD_H = 1600;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = array => array[(Math.random() * array.length) | 0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const fmt = seconds => `${String((seconds / 60) | 0).padStart(2, "0")}:${String(seconds % 60 | 0).padStart(2, "0")}`;

  const ui = {
    menu: $("menu"), how: $("howPanel"), upgrade: $("upgradePanel"), shop: $("shopPanel"), event: $("eventPanel"),
    pause: $("pausePanel"), result: $("resultPanel"), hud: $("hud"), joystick: $("joystick"),
    healthBar: $("healthBar"), healthText: $("healthText"), xpBar: $("xpBar"), levelText: $("levelText"),
    timerText: $("timerText"), phaseLabel: $("phaseLabel"), coinText: $("coinText"), bossHud: $("bossHud"),
    bossBar: $("bossBar"), bossName: $("bossName"), toast: $("objectiveToast"), dock: $("weaponDock"),
    choices: $("upgradeChoices"), rerolls: $("rerollCount"), shopChoices: $("shopChoices"), shopCoins: $("shopCoins"), build: $("buildSummary")
  };

  const profile = (() => {
    try { return { coins: 0, best: 0, wins: 0, ...JSON.parse(localStorage.getItem("meowGardenProfile") || "{}") }; }
    catch { return { coins: 0, best: 0, wins: 0 }; }
  })();
  const saveProfile = () => { localStorage.setItem("meowGardenProfile", JSON.stringify(profile)); syncProfile(); };
  const syncProfile = () => { $("profileCoins").textContent = profile.coins; $("bestTime").textContent = fmt(profile.best); };
  syncProfile();

  let state = { mode: "menu" };
  let viewW = innerWidth;
  let viewH = innerHeight;
  let last = performance.now();
  let audio = null;
  let uid = 0;
  const nodes = new Map();
  const keys = new Set();
  const joy = { active: false, id: null, x: 0, y: 0 };

  function resize() { viewW = innerWidth; viewH = innerHeight; }
  addEventListener("resize", resize);
  resize();

  function sound(type) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const sounds = {
        shoot: [520, .035, .022, "triangle"], hit: [165, .05, .03, "sine"], level: [690, .2, .06, "sine"],
        coin: [880, .07, .032, "sine"], hurt: [105, .13, .08, "sawtooth"], boss: [72, .42, .1, "sawtooth"], win: [610, .5, .08, "triangle"]
      };
      const [frequency, duration, volume, wave] = sounds[type] || sounds.hit;
      oscillator.frequency.value = frequency;
      oscillator.type = wave;
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    } catch {}
  }

  function levelXpRequirement(level) { return level <= 1 ? 16 : Math.floor(15 + level * 7 + Math.pow(level, 1.35)); }
  function createPlayer(dev) {
    const base = { ...CHARACTER.base_stats, maxHp: dev ? 500 : CHARACTER.base_stats.maxHp };
    return {
      x: WORLD_W / 2, y: WORLD_H / 2, r: 21, hp: base.maxHp, maxHp: base.maxHp, speed: base.speed, invuln: 0,
      level: 1, xp: 0, nextXp: levelXpRequirement(1), pickup: base.pickup, damageMul: base.damageMul,
      attackSpeed: base.attackSpeed, crit: base.crit, size: base.size, armor: base.armor, base,
      runtime: { damage: 1, speed: 1 }, weapons: { yarn: 1 }, passives: {}, passiveWeights: {}, devices: {}, moving: false
    };
  }

  function recalculatePlayerStats({ healDelta = false } = {}) {
    const player = state.player;
    if (!player) return;
    player.base ||= { ...CHARACTER.base_stats };
    player.runtime ||= { damage: 1, speed: 1 };
    player.passiveWeights ||= {};
    const weight = id => Number.isFinite(player.passiveWeights[id]) ? player.passiveWeights[id] : (player.passives[id] || 0);
    const oldMax = player.maxHp || player.base.maxHp;
    const oldHp = Number.isFinite(player.hp) ? player.hp : oldMax;
    player.maxHp = Math.max(1, player.base.maxHp + 22 * weight("health"));
    player.speed = Math.max(1, player.base.speed * Math.pow(1.10, weight("speed")) * player.runtime.speed);
    player.damageMul = Math.max(.01, player.base.damageMul * Math.pow(1.18, weight("power")) * player.runtime.damage);
    player.attackSpeed = Math.max(.05, player.base.attackSpeed * Math.pow(1.14, weight("haste")));
    player.pickup = Math.max(1, player.base.pickup + 38 * weight("magnet"));
    player.crit = clamp(player.base.crit + .08 * weight("crit"), 0, 1);
    player.size = Math.max(.1, player.base.size * Math.pow(1.15, weight("size")));
    player.armor = clamp(player.base.armor + .08 * weight("armor"), 0, .9);
    player.hp = clamp(oldHp + (healDelta ? Math.max(0, player.maxHp - oldMax) : 0), 0, player.maxHp);
  }

  function setPassiveLevel(id, level, weight = level, healDelta = false) {
    const data = PASSIVES[id], player = state.player;
    if (!data || !player) return;
    const next = clamp(Math.round(level), 0, data.max);
    if (next) { player.passives[id] = next; player.passiveWeights[id] = Math.max(0, weight); }
    else { delete player.passives[id]; delete player.passiveWeights[id]; }
    recalculatePlayerStats({ healDelta }); updateDock(); updateHud();
  }
  function setDeviceLevel(id, level) {
    const data = DEVICES[id], player = state.player;
    if (!data || !player) return;
    const next = clamp(Math.round(level), 0, data.max);
    if (next) player.devices[id] = next; else delete player.devices[id];
    if (id === "turret") syncTurretDevice();
    if (id === "trap" && !next) state.devices = state.devices.filter(device => device.kind !== "trap");
    updateDock();
  }
  function setWeaponLevel(id, level) {
    const data = WEAPONS[id], player = state.player;
    if (!data || !player) return;
    const next = clamp(Math.round(level), 0, data.max);
    if (next) player.weapons[id] = next; else delete player.weapons[id];
    updateDock();
  }

  function clearWorldNodes() { nodes.clear(); world.replaceChildren(); }
  function resetGame(devOverride = null) {
    const queryDev = new URLSearchParams(location.search).get("dev") === "1";
    const dev = devOverride === null ? queryDev : Boolean(devOverride);
    state = {
      dev, mode: dev ? "playing" : "upgrade", started: dev, duration: 480, time: 0, lastSpawn: 0,
      shake: 0, flash: 0, kills: 0, elites: 0, damage: 0, taken: 0, highHit: 0, coins: 0,
      pendingLevels: 0, rerolls: 2, bossSpawned: false, won: false, simSpeed: 1, devLabOpen: false,
      devRunPaused: dev, invincible: false, infiniteRerolls: false, fps: 0, damageBuckets: [],
      schedules: { chest1: false, chest2: false, merchant: false, event: false, elite1: false, elite2: false },
      player: createPlayer(dev), enemies: [], projectiles: [], enemyShots: [], pickups: [], particles: [], texts: [], hazards: [], devices: [], boss: null,
      timers: { yarn: 0, fish: 0, laser: 0, paw: 0, trap: 2, turret: 0 }, cam: { x: WORLD_W / 2, y: WORLD_H / 2 }
    };
    clearWorldNodes();
    ui.menu.classList.add("hidden"); ui.result.classList.add("hidden"); ui.hud.classList.remove("hidden"); ui.joystick.classList.remove("hidden"); ui.bossHud.classList.add("hidden");
    updateDock(); updateHud();
    toast(dev ? "DEV MODE · 测试数据不会写入正式存档" : "开局墨意 · 先选一道笔势", 2200);
    if (dev) window.dispatchEvent(new CustomEvent("meow-dev-started")); else openUpgrade(true);
  }

  function toast(text, ms = 1800) {
    ui.toast.textContent = text; ui.toast.classList.remove("hidden");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.add("hidden"), ms);
  }
  function rarity() {
    const progress = state.time / state.duration, roll = Math.random();
    return roll < .04 + progress * .09 ? "epic" : roll < .22 + progress * .16 ? "rare" : "common";
  }
  function upgradePool() {
    const player = state.player, pool = [];
    Object.entries(WEAPONS).forEach(([id, data]) => { const level = player.weapons[id] || 0; if (level < data.max) pool.push({ type: "weapon", id, level: level + 1, ...data }); });
    Object.entries(PASSIVES).forEach(([id, data]) => { const level = player.passives[id] || 0; if (level < data.max) pool.push({ type: "passive", id, level: level + 1, ...data }); });
    Object.entries(DEVICES).forEach(([id, data]) => { const level = player.devices[id] || 0; if (level < data.max) pool.push({ type: "device", id, level: level + 1, ...data }); });
    return pool;
  }
  function chooseUpgrades() {
    const pool = upgradePool(), choices = [];
    const newPowers = pool.filter(item => item.type === "weapon" ? !state.player.weapons[item.id] : item.type === "device" ? !state.player.devices[item.id] : false);
    if (newPowers.length && Object.keys(state.player.weapons).length + Object.keys(state.player.devices).length < 8) choices.push(pick(newPowers));
    while (choices.length < 3 && pool.length) {
      const options = pool.filter(item => !choices.some(choice => choice.type === item.type && choice.id === item.id));
      if (!options.length) break;
      choices.push(pick(options));
    }
    return choices.map(item => ({ ...item, rarity: rarity() }));
  }
  function renderUpgradeChoices() {
    ui.choices.innerHTML = "";
    chooseUpgrades().forEach(choice => {
      const button = document.createElement("button");
      button.className = `upgrade-card ${choice.rarity}`;
      const rarityName = choice.rarity === "epic" ? "史诗" : choice.rarity === "rare" ? "稀有" : "普通";
      const bonus = choice.rarity === "epic" ? " · 效果 1.5 倍" : choice.rarity === "rare" ? " · 效果 1.25 倍" : "";
      const ultimate = choice.type === "weapon" && choice.level === 7 ? `<strong class="ultimate-label">终极 · ${choice.name}</strong>` : "";
      button.innerHTML = `<span class="rarity">${rarityName}</span><span class="upgrade-icon">${choice.icon}</span><h3>${choice.name} <small>Lv.${choice.level}</small></h3><p>${choice.desc}${bonus}</p>${ultimate}<span class="tag">${choice.tags || (choice.type === "passive" ? "基础修行" : "")}</span>`;
      button.onclick = () => applyUpgrade(choice);
      ui.choices.appendChild(button);
    });
  }
  function openUpgrade(initial = false) {
    state.mode = "upgrade"; state.initialUpgrade = initial; ui.rerolls.textContent = state.rerolls;
    $("rerollButton").disabled = state.rerolls <= 0 && !state.infiniteRerolls;
    renderUpgradeChoices(); ui.upgrade.classList.remove("hidden"); sound("level");
  }
  function applyUpgrade(choice) {
    const factor = choice.rarity === "epic" ? 1.5 : choice.rarity === "rare" ? 1.25 : 1;
    if (choice.type === "weapon") setWeaponLevel(choice.id, choice.level);
    if (choice.type === "device") setDeviceLevel(choice.id, choice.level);
    if (choice.type === "passive") setPassiveLevel(choice.id, choice.level, (state.player.passiveWeights[choice.id] || 0) + factor, choice.id === "health");
    ui.upgrade.classList.add("hidden");
    if (state.pendingLevels > 0) { state.pendingLevels--; setTimeout(() => openUpgrade(false), 120); }
    else { state.mode = "playing"; state.started = true; last = performance.now(); }
  }

  function nearest(x, y, max = Infinity, filter = () => true) {
    let best = null, bestDistance = max;
    for (const enemy of state.enemies) if (!enemy.dead && filter(enemy)) {
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance < bestDistance) { bestDistance = distance; best = enemy; }
    }
    if (state.boss && !state.boss.dead && filter(state.boss)) {
      const distance = Math.hypot(state.boss.x - x, state.boss.y - y);
      if (distance < bestDistance) best = state.boss;
    }
    return best;
  }
  function shootAngle(x, y, angle, options = {}) {
    const speed = options.speed || 430;
    state.projectiles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: (options.r || 7) * state.player.size,
      damage: options.damage || 12, life: options.life || 2, color: options.color || "#356f69", pierce: options.pierce || 0,
      bounces: options.bounces || 0, kind: options.kind || "fishbone", hit: new Set()
    });
  }
  function shoot(x, y, target, options = {}) {
    if (!target) return;
    const angle = Math.atan2(target.y - y, target.x - x);
    shootAngle(x, y, angle, options); sound("shoot");
  }
  function attack(dt) {
    const player = state.player, attackSpeed = player.attackSpeed;
    Object.keys(state.timers).forEach(key => state.timers[key] -= dt);

    if (player.weapons.yarn && state.timers.yarn <= 0) {
      const level = player.weapons.yarn, target = nearest(player.x, player.y, 650);
      if (target) {
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        const amount = level === 7 ? 5 : 1;
        for (let index = 0; index < amount; index++) shootAngle(player.x, player.y, angle + (index - (amount - 1) / 2) * .14, { kind: "fishbone", damage: (13 + level * 5) * player.damageMul, speed: 470 + level * 10, r: 7, pierce: 1 + (level / 3 | 0) });
        sound("shoot");
      }
      state.timers.yarn = Math.max(.26, (.92 - level * .055) / attackSpeed);
    }
    if (player.weapons.fish && state.timers.fish <= 0) {
      const level = player.weapons.fish, target = nearest(player.x, player.y, 620);
      if (target) {
        const angle = Math.atan2(target.y - player.y, target.x - player.x), amount = level === 7 ? 3 : level >= 3 ? 2 : 1;
        for (let index = 0; index < amount; index++) shootAngle(player.x, player.y, angle + (index - (amount - 1) / 2) * .12, { kind: "leaf", color: "#547a58", damage: (12 + level * 5) * player.damageMul, speed: 420 + level * 8, r: 6, bounces: 2 + (level / 3 | 0) });
        sound("shoot");
      }
      state.timers.fish = Math.max(.34, (1.15 - level * .06) / attackSpeed);
    }
    if (player.weapons.laser && state.timers.laser <= 0) {
      const level = player.weapons.laser;
      let target = nearest(player.x, player.y, 700), previous = { x: player.x, y: player.y };
      const targetCount = level === 7 ? 6 : 1 + (level / 3 | 0);
      for (let index = 0; index < targetCount && target; index++) {
        hitEnemy(target, (8 + level * 4) * player.damageMul, "bell");
        beam(previous.x, previous.y, target.x, target.y, level === 7 ? "#ad853d" : "#6b5d3c");
        previous = target;
        target = nearest(previous.x, previous.y, 190 + level * 8, enemy => enemy !== previous);
      }
      state.timers.laser = Math.max(.18, (.72 - level * .045) / attackSpeed);
    }
    if (player.weapons.paw && state.timers.paw <= 0) {
      const level = player.weapons.paw, radius = (95 + level * 12) * player.size, waves = level === 7 ? 3 : level >= 4 ? 2 : 1;
      for (let waveIndex = 0; waveIndex < waves; waveIndex++) state.particles.push({ kind: "claw", x: player.x, y: player.y, r: radius * (1 - waveIndex * .17), color: "#b8422f", life: .34 + waveIndex * .08, max: .34 + waveIndex * .08 });
      forEachEnemy(enemy => { if (dist(player, enemy) < radius + enemy.r) { hitEnemy(enemy, (21 + level * 8) * player.damageMul, "claw"); pushFrom(enemy, player, 45); } });
      state.timers.paw = Math.max(.45, (1.48 - level * .08) / attackSpeed);
    }
    if (player.devices.trap && state.timers.trap <= 0) {
      state.devices.push({ kind: "trap", x: player.x, y: player.y, life: 10, r: 20, level: player.devices.trap });
      state.timers.trap = Math.max(2.4, 6.2 - player.devices.trap * .55);
    }
    for (const device of state.devices) if (device.kind === "turret") {
      device.cooldown -= dt;
      if (device.cooldown <= 0) {
        const target = nearest(device.x, device.y, 520);
        if (target) shoot(device.x, device.y, target, { kind: "spark", color: "#ad853d", damage: (8 + device.level * 5) * player.damageMul, speed: 520, r: 5 });
        device.cooldown = Math.max(.35, 1.2 - device.level * .09);
      }
    }
  }

  function deployTurret() { state.devices.push({ kind: "turret", x: state.player.x + 50, y: state.player.y + 18, r: 20, level: state.player.devices.turret || 1, cooldown: .5, life: 9999 }); }
  function syncTurretDevice() {
    const level = state.player?.devices?.turret || 0;
    const turret = state.devices.find(device => device.kind === "turret");
    if (!level) state.devices = state.devices.filter(device => device.kind !== "turret");
    else if (!turret) deployTurret();
    else turret.level = level;
  }
  function beam(x1, y1, x2, y2, color) { state.particles.push({ kind: "beam", x: x1, y: y1, x2, y2, color, life: .14, max: .14 }); }
  function burst(x, y, color, count = 10, radius = 55) {
    for (let index = 0; index < count; index++) {
      const angle = index / count * TAU + rand(-.15, .15);
      state.particles.push({ kind: "dot", x, y, vx: Math.cos(angle) * rand(radius, radius * 2), vy: Math.sin(angle) * rand(radius, radius * 2), r: rand(2, 5), color, life: .35, max: .35 });
    }
  }
  function pushFrom(entity, source, amount) { const angle = Math.atan2(entity.y - source.y, entity.x - source.x); entity.x += Math.cos(angle) * amount; entity.y += Math.sin(angle) * amount; }

  function spawnEnemy(type, elite = false) {
    const player = state.player, angle = rand(0, TAU), radius = Math.max(viewW, viewH) * .62 + rand(80, 180), data = ENEMY_TYPES[type];
    if (!data) return;
    const progress = state.duration ? state.time / state.duration : 0, scale = 1 + progress * 2.05;
    state.enemies.push({
      ...data, type, x: clamp(player.x + Math.cos(angle) * radius, 40, WORLD_W - 40), y: clamp(player.y + Math.sin(angle) * radius, 40, WORLD_H - 40),
      hp: data.hp * scale * (elite ? 4.2 : 1), maxHp: data.hp * scale * (elite ? 4.2 : 1), speed: data.speed * (1 + progress * .16),
      damage: data.damage * (1 + progress * .65), r: data.r * (elite ? 1.35 : 1), xp: data.xp * (elite ? 7 : 1), elite,
      shot: rand(1, 3), dead: false, phase: rand(0, TAU)
    });
  }
  function spawnTick(dt) {
    state.lastSpawn -= dt;
    if (state.lastSpawn > 0 || state.bossSpawned) return;
    const progress = state.time / state.duration, batch = 1 + (progress * 4 | 0) + (state.time > state.duration * .68 ? 2 : 0);
    const available = progress < .18 ? ["mouse", "bug"] : progress < .42 ? ["mouse", "bug", "hedgehog", "bee"] : ["mouse", "bug", "hedgehog", "bee", "frog", "snail"];
    for (let index = 0; index < batch && state.enemies.length < 150; index++) spawnEnemy(pick(available));
    state.lastSpawn = Math.max(.13, .74 - progress * .5);
  }
  function forEachEnemy(callback) { for (const enemy of state.enemies) if (!enemy.dead) callback(enemy); if (state.boss && !state.boss.dead) callback(state.boss); }

  function updateEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.phase += dt * 4;
      const distance = dist(enemy, player), angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      if (enemy.ranged && distance < 310) {
        enemy.x -= Math.cos(angle) * enemy.speed * dt * .42; enemy.y -= Math.sin(angle) * enemy.speed * dt * .42; enemy.shot -= dt;
        if (enemy.shot <= 0) { enemyShot(enemy.x, enemy.y, angle, enemy.type === "frog" ? "glob" : "sting", enemy.damage); enemy.shot = enemy.type === "frog" ? 2.7 : 2.1; }
      } else { enemy.x += Math.cos(angle) * enemy.speed * dt; enemy.y += Math.sin(angle) * enemy.speed * dt; }
      if (distance < enemy.r + player.r) hurtPlayer(enemy.damage, enemy.x, enemy.y);
    }
    for (const enemy of state.enemies) if (enemy.dead) enemy.death -= dt;
    state.enemies = state.enemies.filter(enemy => !enemy.dead || enemy.death > 0);
  }
  function enemyShot(x, y, angle, kind, damage) {
    const speed = kind === "glob" ? 150 : 235;
    state.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: kind === "glob" ? 9 : 5, life: 4, damage, kind });
  }
  function recordDamage(amount) {
    const stamp = Math.floor(state.time * 4) / 4, buckets = state.damageBuckets, lastBucket = buckets[buckets.length - 1];
    if (lastBucket && lastBucket.t === stamp) lastBucket.amount += amount; else buckets.push({ t: stamp, amount });
    while (buckets.length && buckets[0].t < state.time - 10.25) buckets.shift();
  }
  function hitEnemy(enemy, raw, kind) {
    if (!enemy || enemy.dead) return;
    const critical = Math.random() < state.player.crit, damage = raw * (critical ? 1.85 : 1);
    enemy.hp -= damage; state.damage += damage; recordDamage(damage); state.highHit = Math.max(state.highHit, damage);
    textPop(enemy.x, enemy.y - enemy.r, Math.round(damage), critical ? "#d39b35" : "#f8f1e3", critical ? 18 : 12);
    if (kind === "bell" && Math.random() < .25) enemy.slow = .35;
    if (enemy.hp <= 0) killEnemy(enemy);
  }
  function killEnemy(enemy) {
    enemy.dead = true; enemy.death = .3; state.kills++; if (enemy.elite) state.elites++;
    if (enemy === state.boss) {
      state.coins += 80; burst(enemy.x, enemy.y, "#ad853d", 44, 150); toast("泼墨狸将收笔认输！", 2800); ui.bossHud.classList.add("hidden");
      if (!state.dev) setTimeout(() => endGame(true), 2200);
      return;
    }
    const count = enemy.elite ? 4 : 1;
    for (let index = 0; index < count; index++) state.pickups.push({ kind: "xp", x: enemy.x + rand(-12, 12), y: enemy.y + rand(-12, 12), value: enemy.xp / count, r: enemy.elite ? 8 : 5 });
    if (Math.random() < (enemy.elite ? .75 : .08)) state.pickups.push({ kind: "coin", x: enemy.x, y: enemy.y, value: enemy.elite ? 18 : pick([1, 2, 3]), r: 7 });
    if (Math.random() < .012) state.pickups.push({ kind: "heart", x: enemy.x, y: enemy.y, value: 14, r: 9 });
    burst(enemy.x, enemy.y, enemy.elite ? "#b8422f" : "#2a2d29", enemy.elite ? 18 : 7, enemy.elite ? 80 : 36);
  }
  function hurtPlayer(raw, sourceX, sourceY) {
    const player = state.player;
    if (state.invincible || player.invuln > 0 || state.mode !== "playing") return;
    const damage = Math.max(1, raw * (1 - player.armor));
    player.hp -= damage; player.invuln = .62; state.taken += damage; state.shake = 8; state.flash = .15; sound("hurt");
    textPop(player.x, player.y - 30, `-${Math.round(damage)}`, "#d44f42", 17); pushFrom(player, { x: sourceX, y: sourceY }, 20);
    if (player.hp <= 0) endGame(false);
  }

  function spawnBoss() {
    if (state.boss && !state.boss.dead) return state.boss;
    state.bossSpawned = true; state.enemies.length = Math.min(state.enemies.length, 16);
    const player = state.player, bossHp = state.dev ? 1400 : BOSS.hp;
    state.boss = { ...BOSS, x: clamp(player.x + 360, 100, WORLD_W - 100), y: clamp(player.y, 110, WORLD_H - 110), r: 55, hp: bossHp, maxHp: bossHp, phase: 1, attack: 1.5, summon: 6, dead: false, kind: "boss" };
    ui.bossHud.classList.remove("hidden"); ui.bossName.textContent = "泼墨狸将 · 起笔"; toast("Boss 登场：泼墨狸将！看清朱红落笔区", 3200); sound("boss"); state.shake = 14;
    return state.boss;
  }
  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss || boss.dead) return;
    const player = state.player, distance = dist(boss, player), angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    const nextPhase = boss.hp < boss.maxHp * .48 ? 2 : 1;
    if (nextPhase !== boss.phase) {
      boss.phase = nextPhase; boss.speed = 72; ui.bossName.textContent = "泼墨狸将 · 朱印狂挥"; toast("第二阶段：毛笔落地会留下危险墨痕", 2600); sound("boss"); state.shake = 12;
    }
    boss.x += Math.cos(angle) * boss.speed * dt * (distance > 190 ? 1 : -.25);
    boss.y += Math.sin(angle) * boss.speed * dt * (distance > 190 ? 1 : -.25);
    if (distance < boss.r + player.r) hurtPlayer(boss.damage, boss.x, boss.y);
    boss.attack -= dt; boss.summon -= dt;
    if (boss.attack <= 0) {
      if (boss.phase === 1) {
        const aim = Math.atan2(player.y - boss.y, player.x - boss.x);
        for (let index = -4; index <= 4; index++) enemyShot(boss.x, boss.y, aim + index * .16, "dust", 14);
        boss.attack = 2.15;
      } else {
        state.hazards.push({ x: player.x + rand(-85, 85), y: player.y + rand(-85, 85), r: 62, warn: 1.05, life: 2.2, damage: 19 });
        boss.attack = .88;
      }
    }
    if (boss.summon <= 0) { for (let index = 0; index < (boss.phase === 1 ? 2 : 4); index++) spawnEnemy(pick(["mouse", "bug"])); boss.summon = boss.phase === 1 ? 8 : 5; }
  }

  function updateProjectiles(dt) {
    for (const projectile of state.projectiles) {
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
      forEachEnemy(enemy => {
        if (projectile.life <= 0 || projectile.hit.has(enemy) || dist(projectile, enemy) >= projectile.r + enemy.r) return;
        projectile.hit.add(enemy); hitEnemy(enemy, projectile.damage, projectile.kind);
        if (projectile.bounces > 0) {
          projectile.bounces--;
          const next = nearest(enemy.x, enemy.y, 220, candidate => !projectile.hit.has(candidate));
          if (next) { const angle = Math.atan2(next.y - enemy.y, next.x - enemy.x), speed = Math.hypot(projectile.vx, projectile.vy); projectile.x = enemy.x; projectile.y = enemy.y; projectile.vx = Math.cos(angle) * speed; projectile.vy = Math.sin(angle) * speed; }
          else projectile.life = 0;
        } else if (projectile.pierce > 0) projectile.pierce--; else projectile.life = 0;
      });
    }
    state.projectiles = state.projectiles.filter(projectile => projectile.life > 0);
    for (const shot of state.enemyShots) {
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (dist(shot, state.player) < shot.r + state.player.r) { hurtPlayer(shot.damage, shot.x, shot.y); shot.life = 0; }
    }
    state.enemyShots = state.enemyShots.filter(shot => shot.life > 0);
    for (const hazard of state.hazards) { hazard.warn -= dt; hazard.life -= dt; if (hazard.warn <= 0 && dist(hazard, state.player) < hazard.r + state.player.r) hurtPlayer(hazard.damage, hazard.x, hazard.y); }
    state.hazards = state.hazards.filter(hazard => hazard.life > 0);
    for (const device of state.devices) {
      device.life -= dt;
      if (device.kind === "trap") {
        const target = nearest(device.x, device.y, 48);
        if (target) {
          const radius = (82 + device.level * 11) * state.player.size;
          state.particles.push({ kind: "claw", x: device.x, y: device.y, r: radius, color: "#356f69", life: .36, max: .36 });
          forEachEnemy(enemy => { if (dist(device, enemy) < radius + enemy.r) { hitEnemy(enemy, (22 + device.level * 11) * state.player.damageMul, "umbrella"); pushFrom(enemy, device, 38); } });
          device.life = 0;
        }
      }
      if (device.kind === "turret") device.level = state.player.devices.turret || device.level;
    }
    state.devices = state.devices.filter(device => device.life > 0);
  }

  function updatePickups(dt) {
    const player = state.player;
    for (const item of state.pickups) {
      const distance = dist(item, player);
      if (["xp", "coin", "heart"].includes(item.kind) && distance < player.pickup) {
        const angle = Math.atan2(player.y - item.y, player.x - item.x), speed = Math.max(130, 500 - distance);
        item.x += Math.cos(angle) * speed * dt; item.y += Math.sin(angle) * speed * dt;
      }
      if (distance >= player.r + item.r + 6) continue;
      if (item.kind === "xp") { player.xp += item.value; checkLevel(); }
      if (item.kind === "coin") { state.coins += item.value; sound("coin"); }
      if (item.kind === "heart") player.hp = Math.min(player.maxHp, player.hp + item.value);
      if (item.kind === "chest") { state.coins += 25; state.pendingLevels++; toast("宝箱：铜钱 +25，并获得一次强化"); setTimeout(() => openUpgrade(false), 100); }
      if (item.kind === "merchant") openShop();
      if (item.kind === "event") openEvent();
      item.dead = true;
    }
    state.pickups = state.pickups.filter(item => !item.dead);
  }
  function checkLevel() {
    const player = state.player;
    while (player.xp >= player.nextXp) { player.xp -= player.nextXp; player.level++; player.nextXp = levelXpRequirement(player.level); state.pendingLevels++; }
    if (state.pendingLevels > 0 && state.mode === "playing") { state.pendingLevels--; openUpgrade(false); }
  }
  function spawnObject(kind, label) {
    const player = state.player, angle = rand(0, TAU), radius = rand(260, 420);
    state.pickups.push({ kind, x: clamp(player.x + Math.cos(angle) * radius, 80, WORLD_W - 80), y: clamp(player.y + Math.sin(angle) * radius, 80, WORLD_H - 80), r: 22, label });
    toast(`${label} 已出现在附近`, 2400);
  }
  function schedules() {
    const progress = state.time / state.duration, schedule = state.schedules;
    if (!schedule.chest1 && progress > .2) { schedule.chest1 = true; spawnObject("chest", "宝箱"); }
    if (!schedule.elite1 && progress > .29) { schedule.elite1 = true; for (let index = 0; index < 2; index++) spawnEnemy(pick(["hedgehog", "bee"]), true); toast("赤印精英出现！"); }
    if (!schedule.merchant && progress > .4) { schedule.merchant = true; spawnObject("merchant", "神秘商人"); }
    if (!schedule.chest2 && progress > .54) { schedule.chest2 = true; spawnObject("chest", "稀有宝箱"); }
    if (!schedule.event && progress > .62) { schedule.event = true; spawnObject("event", "庭院奇遇"); }
    if (!schedule.elite2 && progress > .7) { schedule.elite2 = true; for (let index = 0; index < 3; index++) spawnEnemy(pick(["snail", "frog", "bee"]), true); toast("高压精英潮来袭！"); }
    if (!state.bossSpawned && state.time >= state.duration - (state.duration < 120 ? 30 : 75)) spawnBoss();
  }

  function openShop() {
    state.mode = "shop"; ui.shop.classList.remove("hidden"); ui.shopCoins.textContent = Math.floor(state.coins);
    const pool = chooseUpgrades().slice(0, 3); pool.push({ type: "heal", id: "heal", name: "温热鱼汤", icon: "汤", desc: "恢复 45% 最大生命", level: 1, rarity: "common" });
    ui.shopChoices.innerHTML = "";
    pool.forEach((choice, index) => {
      const price = 18 + index * 10, button = document.createElement("button");
      button.className = `upgrade-card ${choice.rarity || ""}`;
      button.innerHTML = `<span class="upgrade-icon">${choice.icon}</span><h3>${choice.name}</h3><p>${choice.desc}</p><span class="price">铜钱 ${price}</span>`;
      button.onclick = () => {
        if (state.coins < price) { toast("铜钱不够"); return; }
        state.coins -= price;
        if (choice.type === "heal") state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.maxHp * .45); else applyShopUpgrade(choice);
        button.disabled = true; button.style.opacity = .45; ui.shopCoins.textContent = Math.floor(state.coins);
      };
      ui.shopChoices.appendChild(button);
    });
  }
  function applyShopUpgrade(choice) {
    if (choice.type === "weapon") setWeaponLevel(choice.id, choice.level);
    if (choice.type === "device") setDeviceLevel(choice.id, choice.level);
    if (choice.type === "passive") setPassiveLevel(choice.id, choice.level, (state.player.passiveWeights[choice.id] || 0) + 1, choice.id === "health");
  }
  function closeShop() { ui.shop.classList.add("hidden"); state.mode = "playing"; }
  function openEvent() { state.mode = "event"; ui.event.classList.remove("hidden"); }
  function resolveEvent(choice) {
    const player = state.player;
    if (choice === "help") { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * .35); player.runtime.speed *= 1.12; recalculatePlayerStats(); toast("莲花祝福：移速提升"); }
    else { player.hp = Math.max(1, player.hp * .75); player.runtime.damage *= 1.25; recalculatePlayerStats(); toast("摘下墨蕊：伤害大幅提升"); }
    ui.event.classList.add("hidden"); state.mode = "playing";
  }

  function movePlayer(dt) {
    const player = state.player;
    let x = 0, y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x--;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x++;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y--;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y++;
    x += joy.x; y += joy.y;
    const length = Math.hypot(x, y);
    player.moving = length > .05;
    if (player.moving) { x /= Math.max(1, length); y /= Math.max(1, length); player.x = clamp(player.x + x * player.speed * dt, 30, WORLD_W - 30); player.y = clamp(player.y + y * player.speed * dt, 30, WORLD_H - 30); player.facing = x < 0 ? -1 : x > 0 ? 1 : player.facing || 1; }
    player.invuln = Math.max(0, player.invuln - dt);
  }
  function phase() { const progress = state.time / state.duration; if (state.bossSpawned) return "最终决战"; if (progress < .25) return "快速成型"; if (progress < .62) return "中压构筑"; return "高压怪潮"; }
  function update(dt) {
    if (state.mode !== "playing" || (state.dev && state.devLabOpen && state.devRunPaused)) return;
    state.time += dt;
    movePlayer(dt); attack(dt); spawnTick(dt); updateEnemies(dt); updateBoss(dt); updateProjectiles(dt); updatePickups(dt); if (!state.dev) schedules(); updateFx(dt);
    state.cam.x = lerp(state.cam.x, state.player.x, .08); state.cam.y = lerp(state.cam.y, state.player.y, .08); state.shake = Math.max(0, state.shake - dt * 30); state.flash = Math.max(0, state.flash - dt); updateHud();
  }
  function updateFx(dt) {
    for (const particle of state.particles) { particle.life -= dt; if (particle.vx) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .94; particle.vy *= .94; } }
    state.particles = state.particles.filter(particle => particle.life > 0);
    for (const text of state.texts) { text.life -= dt; text.y -= 28 * dt; }
    state.texts = state.texts.filter(text => text.life > 0);
  }
  function textPop(x, y, text, color = "#fff", size = 12) { state.texts.push({ x, y, text, color, size, life: .75, max: .75 }); }

  function updateHud() {
    if (!state.player) return;
    const player = state.player;
    ui.healthBar.style.width = `${clamp(player.hp / player.maxHp * 100, 0, 100)}%`; ui.healthText.textContent = `${Math.ceil(player.hp)} / ${Math.ceil(player.maxHp)}`;
    ui.xpBar.style.width = `${player.xp / player.nextXp * 100}%`; ui.levelText.textContent = player.level; ui.coinText.textContent = Math.floor(state.coins);
    ui.timerText.textContent = fmt(Math.max(0, state.duration - state.time)); ui.phaseLabel.textContent = phase();
    if (state.boss) ui.bossBar.style.width = `${clamp(state.boss.hp / state.boss.maxHp * 100, 0, 100)}%`;
  }
  function updateDock() {
    if (!state.player) return;
    ui.dock.innerHTML = "";
    Object.entries(state.player.weapons).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${WEAPONS[id].name}">${WEAPONS[id].icon}<small>${level}</small></div>`));
    Object.entries(state.player.devices).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${DEVICES[id].name}">${DEVICES[id].icon}<small>${level}</small></div>`));
  }
  function buildSummary() {
    const items = [];
    Object.entries(state.player.weapons).forEach(([id, level]) => items.push([`${WEAPONS[id].icon} ${WEAPONS[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.devices).forEach(([id, level]) => items.push([`${DEVICES[id].icon} ${DEVICES[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.passives).forEach(([id, level]) => items.push([`${PASSIVES[id].icon} ${PASSIVES[id].name}`, `Lv.${level}`]));
    return items;
  }
  function pause() { if (state.mode !== "playing") return; state.mode = "paused"; ui.build.innerHTML = buildSummary().map(item => `<div class="build-item"><b>${item[0]}</b>${item[1]}</div>`).join("") || "尚未获得额外强化"; ui.pause.classList.remove("hidden"); }
  function resume() { if (state.mode !== "paused") return; ui.pause.classList.add("hidden"); state.mode = "playing"; last = performance.now(); }
  function endGame(win) {
    if (state.mode === "result") return;
    state.mode = "result"; state.won = win; ui.hud.classList.add("hidden"); ui.joystick.classList.add("hidden"); ui.pause.classList.add("hidden");
    const survived = Math.min(state.time, state.duration), reward = Math.floor(state.coins * (win ? 1 : .45) + state.kills * .08 + (win ? 80 : 0));
    if (!state.dev) { profile.best = Math.max(profile.best, Math.floor(survived)); profile.coins += reward; if (win) profile.wins++; saveProfile(); }
    $("resultBadge").textContent = win ? "胜" : "止"; $("resultKicker").textContent = win ? "墨战落幕" : "本次试炼结束"; $("resultTitle").textContent = win ? "旧庭重归宁静" : "这一笔尚未写完";
    $("resultLine").textContent = state.dev ? "DEV 测试数据未写入正式存档。" : win ? "最后一笔落下，群墨归纸。" : "保留经验，重新整备再入庭院。";
    $("resultStats").innerHTML = [["存活", fmt(survived)], ["击散", state.kills], ["最高伤害", Math.round(state.highHit)], ["获得铜钱", reward]].map(item => `<div class="stat"><b>${item[1]}</b><small>${item[0]}</small></div>`).join("");
    $("resultBuild").innerHTML = buildSummary().map(item => `<span>${item[0]} ${item[1]}</span>`).join("");
    ui.result.classList.remove("hidden"); window.dispatchEvent(new CustomEvent("meow-run-ended")); if (win) sound("win");
  }

  function objectId(object, prefix) { if (!object._domId) object._domId = `${prefix}-${++uid}`; return object._domId; }
  function ensureNode(id, className, html = "") {
    let node = nodes.get(id);
    if (!node) { node = document.createElement("div"); node.dataset.nodeId = id; world.appendChild(node); nodes.set(id, node); }
    node.className = `world-object ${className}`;
    if (html && node.dataset.htmlKey !== html) { node.innerHTML = html; node.dataset.htmlKey = html; }
    return node;
  }
  function place(node, x, y, scale = 1, rotation = 0) { node.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(${rotation}rad) scale(${scale})`; }
  function renderScene() {
    const active = new Set(), shakeX = state.shake ? rand(-state.shake, state.shake) : 0, shakeY = state.shake ? rand(-state.shake, state.shake) : 0;
    const cameraX = state.player ? state.cam.x : WORLD_W / 2, cameraY = state.player ? state.cam.y : WORLD_H / 2;
    world.style.transform = `translate3d(${viewW / 2 - cameraX + shakeX}px,${viewH / 2 - cameraY + shakeY}px,0)`;
    damageFlash.style.opacity = String(Math.min(.75, state.flash * 4));
    if (!state.player) return;

    const playerId = "player"; active.add(playerId);
    const playerNode = ensureNode(playerId, `entity player${state.player.moving ? " moving" : ""}${state.player.invuln > 0 ? " invulnerable" : ""}`, `<img src="${CHARACTER.art}" alt="" draggable="false">`);
    place(playerNode, state.player.x, state.player.y, state.player.facing || 1, 0);

    for (const enemy of state.enemies) {
      const id = objectId(enemy, "enemy"); active.add(id);
      const size = Math.max(48, enemy.r * (enemy.elite ? 4.6 : 4.1));
      const node = ensureNode(id, `entity enemy ${enemy.art_variant || ""}${enemy.elite ? " elite" : ""}${enemy.dead ? " dying" : ""}`, `<img src="${enemy.art}" alt="" draggable="false">`);
      node.style.width = `${size}px`; node.style.height = `${size}px`; place(node, enemy.x, enemy.y + Math.sin(enemy.phase) * 2);
    }
    if (state.boss && !state.boss.dead) {
      const id = "boss"; active.add(id);
      const node = ensureNode(id, `entity boss phase-${state.boss.phase}`, `<img src="${BOSS.art}" alt="" draggable="false">`);
      place(node, state.boss.x, state.boss.y);
    }
    for (const projectile of state.projectiles) {
      const id = objectId(projectile, "projectile"); active.add(id);
      const angle = Math.atan2(projectile.vy, projectile.vx), node = ensureNode(id, `projectile ${projectile.kind}`);
      node.style.width = `${Math.max(10, projectile.r * 2.6)}px`; node.style.height = `${Math.max(7, projectile.r * 1.2)}px`; place(node, projectile.x, projectile.y, 1, angle);
    }
    for (const shot of state.enemyShots) {
      const id = objectId(shot, "enemy-shot"); active.add(id); const node = ensureNode(id, `enemy-shot ${shot.kind}`); place(node, shot.x, shot.y);
    }
    for (const hazard of state.hazards) {
      const id = objectId(hazard, "hazard"); active.add(id); const node = ensureNode(id, `hazard${hazard.warn <= 0 ? " active" : ""}`); node.style.width = `${hazard.r * 2}px`; node.style.height = `${hazard.r * 2}px`; place(node, hazard.x, hazard.y);
    }
    for (const item of state.pickups) {
      const id = objectId(item, "pickup"); active.add(id); const objectKind = ["xp", "coin", "heart"].includes(item.kind) ? item.kind : "object"; const node = ensureNode(id, `pickup ${objectKind}`, objectKind === "object" ? `<span>${item.label || item.kind}</span>` : item.kind === "heart" ? "<span>心</span>" : ""); place(node, item.x, item.y);
    }
    for (const device of state.devices) {
      const id = objectId(device, "device"); active.add(id); const node = ensureNode(id, `device ${device.kind}`, `<span>${device.kind === "turret" ? "刃" : "伞"}</span>`); place(node, device.x, device.y);
    }
    for (const particle of state.particles) {
      const id = objectId(particle, "particle"); active.add(id);
      if (particle.kind === "beam") {
        const length = Math.hypot(particle.x2 - particle.x, particle.y2 - particle.y), angle = Math.atan2(particle.y2 - particle.y, particle.x2 - particle.x), node = ensureNode(id, "ink-beam");
        node.style.width = `${length}px`; node.style.color = particle.color; node.style.opacity = String(particle.life / particle.max); node.style.transform = `translate3d(${particle.x}px,${particle.y}px,0) rotate(${angle}rad)`;
      } else if (particle.kind === "claw") {
        const node = ensureNode(id, "claw-wave"); node.style.width = `${particle.r * 2}px`; node.style.height = `${particle.r * 2}px`; node.style.borderColor = particle.color; place(node, particle.x, particle.y);
      } else {
        const node = ensureNode(id, "ink-burst"); node.style.width = `${particle.r * 2}px`; node.style.height = `${particle.r * 2}px`; node.style.color = particle.color; node.style.opacity = String(particle.life / particle.max); place(node, particle.x, particle.y);
      }
    }
    for (const text of state.texts) {
      const id = objectId(text, "text"); active.add(id); const node = ensureNode(id, "float-text", `<span>${text.text}</span>`); node.style.color = text.color; node.style.fontSize = `${text.size}px`; node.style.opacity = String(text.life / text.max); place(node, text.x, text.y);
    }
    for (const [id, node] of nodes) if (!active.has(id)) { node.remove(); nodes.delete(id); }
  }

  function clearNormalEnemies() { state.enemies = state.enemies.filter(enemy => enemy.elite); }
  function clearAllEnemies() { state.enemies = []; state.enemyShots = []; state.hazards = []; }
  function clearBattlefield() { clearAllEnemies(); state.projectiles = []; state.pickups = []; state.particles = []; state.texts = []; }
  function spawnMixed(count) { const ids = Object.keys(ENEMY_TYPES); for (let index = 0; index < count; index++) spawnEnemy(pick(ids)); }
  function spawnEnemyBatch(type, count, elite = false) { if (!ENEMY_TYPES[type]) return; for (let index = 0; index < count; index++) spawnEnemy(type, elite); }
  function triggerEliteWave() { for (let index = 0; index < 4; index++) spawnEnemy(pick(Object.keys(ENEMY_TYPES)), true); }
  function triggerChest() { spawnObject("chest", "宝箱"); }
  function setStage(progress, bossNow = false) { state.time = clamp(progress, 0, 1) * state.duration; if (bossNow) spawnBoss(); }
  function forceBossPhase2() { const boss = state.boss || spawnBoss(); boss.hp = Math.min(boss.hp, boss.maxHp * .45); boss.phase = 2; }
  function setBossHealth(ratio) { const boss = state.boss || spawnBoss(); boss.hp = clamp(Number(ratio), 0, 1) * boss.maxHp; }
  function killBossForTest() { const boss = state.boss || spawnBoss(); hitEnemy(boss, boss.hp + 1, "dev"); }
  function healFull() { if (state.player) state.player.hp = state.player.maxHp; }
  function setPlayerLevel(level) { const player = state.player; player.level = Math.max(1, Math.round(level)); player.nextXp = levelXpRequirement(player.level); player.xp = clamp(player.xp || 0, 0, player.nextXp - 1); }
  function setPlayerValue(key, value) {
    const player = state.player, number = Number(value); if (!Number.isFinite(number)) return;
    if (key === "level") setPlayerLevel(number); else if (key === "hp") player.hp = clamp(number, 0, player.maxHp); else if (key === "coins") state.coins = Math.max(0, number); else if (key === "rerolls") state.rerolls = Math.max(0, Math.round(number));
    else if (["maxHp", "speed", "damageMul", "attackSpeed", "crit", "armor", "pickup", "size"].includes(key)) { player.base[key] = number; recalculatePlayerStats(); }
    updateHud();
  }
  function resetDevPlayer() { if (!state.dev) return; const x = state.player.x, y = state.player.y; state.player = createPlayer(true); state.player.x = x; state.player.y = y; state.devices = []; recalculatePlayerStats(); updateDock(); updateHud(); }
  function applyPreset(name) {
    const levels = { early: 3, mid: 10, late: 18, boss: 22, max: 35, stress: 60 };
    setPlayerLevel(levels[name] || 1);
    if (["mid", "late", "boss", "max", "stress"].includes(name)) { setWeaponLevel("fish", 3); setWeaponLevel("paw", 3); }
    if (["late", "boss", "max", "stress"].includes(name)) { setWeaponLevel("laser", 5); setPassiveLevel("power", 3); setPassiveLevel("haste", 3); setDeviceLevel("turret", 3); }
    if (["max", "stress"].includes(name)) { Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, 7)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, PASSIVES[id].max)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, DEVICES[id].max)); }
    if (name === "boss") spawnBoss();
    if (name === "stress") { state.player.base.maxHp = 1000; state.player.base.damageMul = 3; recalculatePlayerStats(); spawnMixed(120); }
    healFull(); updateDock(); updateHud(); toast(`PRESET: ${name.toUpperCase()}`);
  }
  function getBuildSnapshot() {
    const player = state.player;
    return { version: 2, base: { ...player.base }, hp: player.hp, level: player.level, xp: player.xp, weapons: { ...player.weapons }, passives: { ...player.passives }, passiveWeights: { ...player.passiveWeights }, devices: { ...player.devices }, coins: state.coins, rerolls: state.rerolls };
  }
  function loadBuildSnapshot(data) {
    if (!data || typeof data !== "object") throw new Error("Build 必须是 JSON 对象");
    resetDevPlayer(); const player = state.player;
    if (data.base && typeof data.base === "object") for (const key of ["maxHp", "speed", "damageMul", "attackSpeed", "crit", "size", "armor", "pickup"]) if (Number.isFinite(Number(data.base[key]))) player.base[key] = Number(data.base[key]);
    setPlayerLevel(data.level || 1); player.xp = clamp(Number(data.xp) || 0, 0, player.nextXp - 1);
    Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, Number(data.weapons?.[id]) || 0)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, Number(data.passives?.[id]) || 0, Number(data.passiveWeights?.[id]) || Number(data.passives?.[id]) || 0)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, Number(data.devices?.[id]) || 0));
    recalculatePlayerStats(); player.hp = clamp(Number.isFinite(Number(data.hp)) ? Number(data.hp) : player.maxHp, 0, player.maxHp); state.coins = Math.max(0, Number(data.coins) || 0); state.rerolls = Math.max(0, Math.round(Number(data.rerolls) || 0)); updateDock(); updateHud();
  }
  function getDevStats() {
    const current = state.time, buckets = state.damageBuckets || [], one = buckets.reduce((sum, bucket) => sum + (bucket.t >= current - 1 ? bucket.amount : 0), 0), ten = buckets.reduce((sum, bucket) => sum + (bucket.t >= current - 10 ? bucket.amount : 0), 0);
    return { fps: state.fps || 0, enemies: state.enemies.filter(enemy => !enemy.dead).length + (state.boss && !state.boss.dead ? 1 : 0), projectiles: state.projectiles.length, enemyShots: state.enemyShots.length, pickups: state.pickups.length, level: state.player.level, kills: state.kills, damage: state.damage, taken: state.taken, highHit: state.highHit, dps: one, dps10: ten / 10 };
  }
  function setDevLabOpen(open) { if (!state.dev) return; state.devLabOpen = Boolean(open); state.devRunPaused = Boolean(open); }
  function setDevPaused(paused) { state.devRunPaused = Boolean(paused); if (!paused && state.mode !== "playing") state.mode = "playing"; }

  const devApi = {
    setLabOpen: setDevLabOpen, setPaused: setDevPaused, setSpeed: value => state.simSpeed = clamp(Number(value) || 1, .5, 4), setInvincible: value => state.invincible = Boolean(value), setInfiniteRerolls: value => state.infiniteRerolls = Boolean(value),
    setPlayerValue, healFull, addLevels: amount => setPlayerLevel(state.player.level + amount), setWeaponLevel, setPassiveLevel, setDeviceLevel,
    spawnEnemy: spawnEnemyBatch, spawnMixed, clearNormalEnemies, clearAllEnemies, spawnBoss, forceBossPhase2, setBossHealth, killBoss: killBossForTest,
    openUpgrade: () => openUpgrade(false), openShop, triggerChest, openEvent, triggerEliteWave, setStage, applyPreset, getStats: getDevStats,
    getBuild: getBuildSnapshot, loadBuild: loadBuildSnapshot, resetPlayer: resetDevPlayer, resetRun: () => resetGame(true), clearBattlefield,
    getConfig: () => ({ WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES }), getState: () => state
  };

  function loop(now) {
    const rawDt = Math.min(.05, (now - last) / 1000); last = now;
    if (state.player) state.fps = lerp(state.fps || 1, 1 / Math.max(.001, rawDt), .08);
    update(rawDt * (state.simSpeed || 1)); renderScene(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  $("startButton").onclick = () => { sound("coin"); resetGame(false); };
  $("devStartButton").onclick = () => { sound("coin"); resetGame(true); };
  $("howButton").onclick = () => ui.how.classList.remove("hidden");
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $(button.dataset.close).classList.add("hidden"));
  $("rerollButton").onclick = () => { if (state.rerolls <= 0 && !state.infiniteRerolls) return; if (!state.infiniteRerolls) state.rerolls--; ui.rerolls.textContent = state.rerolls; renderUpgradeChoices(); };
  $("leaveShop").onclick = closeShop;
  document.querySelectorAll("[data-event]").forEach(button => button.onclick = () => resolveEvent(button.dataset.event));
  $("pauseButton").onclick = pause; $("resumeButton").onclick = resume; $("quitButton").onclick = () => endGame(false);
  $("againButton").onclick = () => resetGame(Boolean(state.dev));
  $("menuButton").onclick = () => { state = { mode: "menu" }; clearWorldNodes(); ui.result.classList.add("hidden"); ui.menu.classList.remove("hidden"); window.dispatchEvent(new CustomEvent("meow-dev-ended")); };
  addEventListener("keydown", event => { keys.add(event.code); if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) { if (state.mode === "playing") pause(); else if (state.mode === "paused") resume(); } });
  addEventListener("keyup", event => keys.delete(event.code));
  ui.joystick.addEventListener("pointerdown", event => { joy.active = true; joy.id = event.pointerId; ui.joystick.setPointerCapture(event.pointerId); moveJoy(event); });
  ui.joystick.addEventListener("pointermove", event => { if (joy.active && event.pointerId === joy.id) moveJoy(event); });
  ui.joystick.addEventListener("pointerup", endJoy); ui.joystick.addEventListener("pointercancel", endJoy);
  function moveJoy(event) { const rect = ui.joystick.getBoundingClientRect(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2, dx = event.clientX - centerX, dy = event.clientY - centerY, length = Math.hypot(dx, dy), amount = Math.min(1, length / 43); joy.x = length ? dx / length * amount : 0; joy.y = length ? dy / length * amount : 0; ui.joystick.firstElementChild.style.transform = `translate(${joy.x * 34}px,${joy.y * 34}px)`; }
  function endJoy() { joy.active = false; joy.x = joy.y = 0; ui.joystick.firstElementChild.style.transform = ""; }

  window.__MEOW_GAME__ = { getState: () => state, start: resetGame, end: (win = true) => endGame(win), dev: devApi, data: { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, BOSS, CHARACTER } };
  if (new URLSearchParams(location.search).get("dev") === "1") resetGame(true);
})();
