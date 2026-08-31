(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const fmt = (s) => `${String((s / 60) | 0).padStart(2, "0")}:${String(s % 60 | 0).padStart(2, "0")}`;

  const ui = {
    menu: $("menu"), how: $("howPanel"), upgrade: $("upgradePanel"), shop: $("shopPanel"),
    event: $("eventPanel"), pause: $("pausePanel"), result: $("resultPanel"), hud: $("hud"),
    joystick: $("joystick"), healthBar: $("healthBar"), healthText: $("healthText"), xpBar: $("xpBar"),
    levelText: $("levelText"), timerText: $("timerText"), phaseLabel: $("phaseLabel"), coinText: $("coinText"),
    bossHud: $("bossHud"), bossBar: $("bossBar"), bossName: $("bossName"), toast: $("objectiveToast"),
    dock: $("weaponDock"), choices: $("upgradeChoices"), rerolls: $("rerollCount"), shopChoices: $("shopChoices"),
    shopCoins: $("shopCoins"), build: $("buildSummary")
  };

  const profile = (() => {
    try { return { coins: 0, best: 0, wins: 0, ...JSON.parse(localStorage.getItem("meowGardenProfile") || "{}") }; }
    catch { return { coins: 0, best: 0, wins: 0 }; }
  })();
  function saveProfile() { localStorage.setItem("meowGardenProfile", JSON.stringify(profile)); syncProfile(); }
  function syncProfile() { $("profileCoins").textContent = profile.coins; $("bestTime").textContent = fmt(profile.best); }
  syncProfile();

  const WEAPONS = {
    yarn: { name: "追踪毛线球", icon: "🧶", max: 7, desc: "自动追踪最近目标，升级增加伤害与射速。", tags: "投射物 · 追踪" },
    fish: { name: "飞旋鱼骨", icon: "🐟", max: 7, desc: "高速穿透敌人，适合清理笔直怪群。", tags: "投射物 · 穿透" },
    laser: { name: "激光笔", icon: "🔴", max: 7, desc: "瞬间命中目标，并向附近敌人弹射。", tags: "弹射 · 感电" },
    paw: { name: "猫爪旋风", icon: "🐾", max: 7, desc: "周期性挥出环形猫爪，击退近身敌人。", tags: "范围 · 近战" }
  };
  const PASSIVES = {
    power: { name: "磨爪板", icon: "🪵", max: 3, desc: "所有伤害 +18%" },
    haste: { name: "猫薄荷", icon: "🌿", max: 3, desc: "攻击速度 +14%" },
    health: { name: "豪华罐头", icon: "🥫", max: 3, desc: "最大生命 +22，并恢复等量生命" },
    speed: { name: "追尾巴训练", icon: "💫", max: 3, desc: "移动速度 +10%" },
    magnet: { name: "铃铛磁铁", icon: "🔔", max: 3, desc: "拾取范围 +38" },
    crit: { name: "猎手胡须", icon: "〰️", max: 3, desc: "暴击率 +8%" },
    size: { name: "蓬松尾巴", icon: "☁️", max: 3, desc: "范围与投射物尺寸 +15%" },
    armor: { name: "纸箱堡垒", icon: "📦", max: 3, desc: "受到伤害 -8%" }
  };
  const DEVICES = {
    turret: { name: "自动逗猫棒", icon: "🎣", max: 5, desc: "部署一座自动发射光点的固定炮台。", tags: "装置 · 投射物" },
    trap: { name: "罐头地雷", icon: "🥫", max: 5, desc: "定期在脚下放置香味地雷，爆炸清怪。", tags: "装置 · 范围" }
  };

  let state = { mode: "menu" };
  let dpr = 1, viewW = innerWidth, viewH = innerHeight, last = performance.now(), audio = null;
  const keys = new Set();
  const joy = { active: false, id: null, x: 0, y: 0 };

  function resize() {
    viewW = innerWidth; viewH = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = viewW * dpr; canvas.height = viewH * dpr;
    canvas.style.width = `${viewW}px`; canvas.style.height = `${viewH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize); resize();

  function sound(type) {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      const map = { shoot: [520, .025, .025], hit: [170, .045, .035], level: [700, .22, .07], coin: [880, .06, .035], hurt: [110, .12, .09], boss: [75, .45, .12], win: [620, .5, .09] };
      const [f, t, v] = map[type] || map.hit; o.frequency.value = f; o.type = type === "hurt" || type === "boss" ? "sawtooth" : "sine";
      g.gain.setValueAtTime(v, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + t);
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + t);
    } catch {}
  }

  function resetGame() {
    const dev = new URLSearchParams(location.search).get("dev") === "1";
    const duration = dev ? 90 : 480;
    state = {
      dev,
      mode: "upgrade", started: false, duration, time: 0, lastSpawn: 0, shake: 0, flash: 0, kills: 0, elites: 0,
      damage: 0, taken: 0, highHit: 0, coins: 0, pendingLevels: 0, rerolls: 2, bossSpawned: false, won: false,
      schedules: { chest1: false, chest2: false, merchant: false, event: false, elite1: false, elite2: false },
      player: { x: 1200, y: 800, r: 19, hp: dev ? 400 : 120, maxHp: dev ? 400 : 120, speed: 195, invuln: 0, level: 1, xp: 0, nextXp: 16,
        pickup: 82, damageMul: dev ? 3.5 : 1, attackSpeed: dev ? 1.35 : 1, crit: .05, size: 1, armor: dev ? .25 : 0, weapons: { yarn: 1 }, passives: {}, devices: {} },
      enemies: [], projectiles: [], enemyShots: [], pickups: [], particles: [], texts: [], hazards: [], devices: [], landmarks: [], boss: null,
      timers: { yarn: 0, fish: 0, laser: 0, paw: 0, trap: 2, turret: 0 }, cam: { x: 1200, y: 800 }
    };
    makeMap();
    ui.menu.classList.add("hidden"); ui.result.classList.add("hidden"); ui.hud.classList.remove("hidden"); ui.joystick.classList.remove("hidden");
    ui.bossHud.classList.add("hidden");
    updateDock(); updateHud();
    toast(dev ? "开发快速模式 · 90 秒" : "开局祝福 · 先选一个能力", 2200);
    openUpgrade(true);
  }

  function makeMap() {
    const l = state.landmarks;
    l.push({ x: 480, y: 400, kind: "pond" }, { x: 1850, y: 440, kind: "tree" }, { x: 1750, y: 1270, kind: "shed" });
    for (let i = 0; i < 38; i++) l.push({ x: rand(120, 2280), y: rand(100, 1500), kind: pick(["flower", "flower", "rock", "bush"]) });
  }

  function toast(text, ms = 1800) {
    ui.toast.textContent = text; ui.toast.classList.remove("hidden");
    clearTimeout(toast.t); toast.t = setTimeout(() => ui.toast.classList.add("hidden"), ms);
  }

  function rarity() {
    const t = state.time / state.duration, r = Math.random();
    return r < .04 + t * .09 ? "epic" : r < .22 + t * .16 ? "rare" : "common";
  }
  function upgradePool() {
    const p = state.player, pool = [];
    Object.entries(WEAPONS).forEach(([id, d]) => {
      const lv = p.weapons[id] || 0; if (lv < d.max) pool.push({ type: "weapon", id, level: lv + 1, ...d });
    });
    Object.entries(PASSIVES).forEach(([id, d]) => {
      const lv = p.passives[id] || 0; if (lv < d.max) pool.push({ type: "passive", id, level: lv + 1, ...d });
    });
    Object.entries(DEVICES).forEach(([id, d]) => {
      const lv = p.devices[id] || 0; if (lv < d.max) pool.push({ type: "device", id, level: lv + 1, ...d });
    });
    return pool;
  }
  function chooseUpgrades() {
    let pool = upgradePool(), choices = [];
    const newPowers = pool.filter(x => (x.type === "weapon" ? !state.player.weapons[x.id] : x.type === "device" ? !state.player.devices[x.id] : false));
    if (newPowers.length && Object.keys(state.player.weapons).length + Object.keys(state.player.devices).length < 8) choices.push(pick(newPowers));
    while (choices.length < 3 && pool.length) {
      const candidate = pick(pool.filter(x => !choices.some(c => c.type === x.type && c.id === x.id)));
      if (!candidate) break; choices.push(candidate);
    }
    return choices.map(x => ({ ...x, rarity: rarity() }));
  }
  function renderUpgradeChoices() {
    const choices = chooseUpgrades(); ui.choices.innerHTML = "";
    choices.forEach(c => {
      const b = document.createElement("button"); b.className = `upgrade-card ${c.rarity}`;
      const rare = c.rarity === "epic" ? "史诗" : c.rarity === "rare" ? "稀有" : "普通";
      const bonus = c.rarity === "epic" ? " · 效果 1.5 倍" : c.rarity === "rare" ? " · 效果 1.25 倍" : "";
      b.innerHTML = `<span class="rarity">${rare}</span><span class="upgrade-icon">${c.icon}</span><h3>${c.name} <small>Lv.${c.level}</small></h3><p>${c.desc}${bonus}</p><span class="tag">${c.tags || (c.type === "passive" ? "被动强化" : "")}</span>`;
      b.onclick = () => applyUpgrade(c); ui.choices.appendChild(b);
    });
  }
  function openUpgrade(initial = false) {
    state.mode = "upgrade"; state.initialUpgrade = initial; ui.rerolls.textContent = state.rerolls;
    $("rerollButton").disabled = state.rerolls <= 0; renderUpgradeChoices(); ui.upgrade.classList.remove("hidden"); sound("level");
  }
  function applyUpgrade(c) {
    const p = state.player, factor = c.rarity === "epic" ? 1.5 : c.rarity === "rare" ? 1.25 : 1;
    if (c.type === "weapon") p.weapons[c.id] = c.level;
    if (c.type === "device") { p.devices[c.id] = c.level; if (c.id === "turret" && c.level === 1) deployTurret(); }
    if (c.type === "passive") {
      p.passives[c.id] = c.level;
      if (c.id === "power") p.damageMul *= 1 + .18 * factor;
      if (c.id === "haste") p.attackSpeed *= 1 + .14 * factor;
      if (c.id === "health") { p.maxHp += 22 * factor; p.hp += 22 * factor; }
      if (c.id === "speed") p.speed *= 1 + .10 * factor;
      if (c.id === "magnet") p.pickup += 38 * factor;
      if (c.id === "crit") p.crit += .08 * factor;
      if (c.id === "size") p.size *= 1 + .15 * factor;
      if (c.id === "armor") p.armor = clamp(p.armor + .08 * factor, 0, .55);
    }
    ui.upgrade.classList.add("hidden"); updateDock();
    if (state.pendingLevels > 0) { state.pendingLevels--; setTimeout(() => openUpgrade(false), 120); }
    else { state.mode = "playing"; state.started = true; }
  }

  function nearest(x, y, max = Infinity, filter = () => true) {
    let best = null, bd = max;
    for (const e of state.enemies) if (!e.dead && filter(e)) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    if (state.boss && !state.boss.dead && filter(state.boss)) { const d = Math.hypot(state.boss.x - x, state.boss.y - y); if (d < bd) best = state.boss; }
    return best;
  }
  function shoot(x, y, target, opts = {}) {
    if (!target) return;
    const a = Math.atan2(target.y - y, target.x - x), speed = opts.speed || 430;
    state.projectiles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: (opts.r || 7) * state.player.size,
      damage: opts.damage || 12, life: opts.life || 2, color: opts.color || "#e26c9b", pierce: opts.pierce || 0, kind: opts.kind || "yarn", hit: new Set() });
    sound("shoot");
  }
  function attack(dt) {
    const p = state.player, atk = p.attackSpeed;
    Object.keys(state.timers).forEach(k => state.timers[k] -= dt);
    if (p.weapons.yarn && state.timers.yarn <= 0) {
      const lv = p.weapons.yarn, t = nearest(p.x, p.y, 650); if (t) shoot(p.x, p.y, t, { damage: (12 + lv * 5) * p.damageMul, speed: 390 + lv * 12, r: 7 + lv * .5 });
      state.timers.yarn = Math.max(.28, (1.08 - lv * .07) / atk);
    }
    if (p.weapons.fish && state.timers.fish <= 0) {
      const lv = p.weapons.fish, t = nearest(p.x, p.y, 720); if (t) shoot(p.x, p.y, t, { kind: "fish", color: "#f3d675", damage: (18 + lv * 7) * p.damageMul, speed: 600, r: 6 + lv * .35, pierce: 1 + (lv / 3 | 0) });
      state.timers.fish = Math.max(.38, (1.6 - lv * .08) / atk);
    }
    if (p.weapons.laser && state.timers.laser <= 0) {
      const lv = p.weapons.laser, t = nearest(p.x, p.y, 560); if (t) {
        hitEnemy(t, (17 + lv * 8) * p.damageMul, "laser"); beam(p.x, p.y, t.x, t.y, "#ff5d72");
        let prev = t; for (let i = 0; i < 1 + (lv / 3 | 0); i++) { const n = nearest(prev.x, prev.y, 150 + lv * 8, e => e !== prev); if (!n) break; hitEnemy(n, (10 + lv * 4) * p.damageMul, "laser"); beam(prev.x, prev.y, n.x, n.y, "#ff8ea0"); prev = n; }
      } state.timers.laser = Math.max(.45, (1.9 - lv * .08) / atk);
    }
    if (p.weapons.paw && state.timers.paw <= 0) {
      const lv = p.weapons.paw, radius = (78 + lv * 11) * p.size;
      burst(p.x, p.y, "#ffe7a5", 18, radius); forEachEnemy(e => { if (dist(p, e) < radius + e.r) { hitEnemy(e, (16 + lv * 7) * p.damageMul, "paw"); pushFrom(e, p, 45); } });
      state.timers.paw = Math.max(.55, (2.6 - lv * .12) / atk);
    }
    if (p.devices.trap && state.timers.trap <= 0) { state.devices.push({ kind: "trap", x: p.x, y: p.y, life: 10, r: 18, level: p.devices.trap }); state.timers.trap = Math.max(2.4, 6.2 - p.devices.trap * .55); }
    for (const d of state.devices) if (d.kind === "turret") { d.cooldown -= dt; if (d.cooldown <= 0) { const t = nearest(d.x, d.y, 520); if (t) shoot(d.x, d.y, t, { kind: "spark", color: "#75d7ee", damage: (8 + d.level * 5) * p.damageMul, speed: 520, r: 5 }); d.cooldown = Math.max(.35, 1.2 - d.level * .09); } }
  }

  function deployTurret() { state.devices.push({ kind: "turret", x: state.player.x + 48, y: state.player.y + 15, r: 20, level: state.player.devices.turret || 1, cooldown: .5, life: 9999 }); }
  function beam(x1, y1, x2, y2, color) { state.particles.push({ kind: "beam", x: x1, y: y1, x2, y2, color, life: .13, max: .13 }); }
  function burst(x, y, color, count = 10, radius = 55) { for (let i = 0; i < count; i++) { const a = i / count * TAU + rand(-.15,.15); state.particles.push({ kind: "dot", x, y, vx: Math.cos(a) * rand(radius, radius * 2), vy: Math.sin(a) * rand(radius, radius * 2), r: rand(2,5), color, life: .35, max: .35 }); } }
  function pushFrom(e, source, amount) { const a = Math.atan2(e.y - source.y, e.x - source.x); e.x += Math.cos(a) * amount; e.y += Math.sin(a) * amount; }

  const ENEMY_TYPES = {
    mouse: { hp: 28, speed: 67, damage: 9, r: 15, xp: 3, color: "#9b8a91", icon: "mouse" },
    bug: { hp: 20, speed: 93, damage: 8, r: 12, xp: 3, color: "#70554d", icon: "bug" },
    hedgehog: { hp: 78, speed: 39, damage: 15, r: 20, xp: 7, color: "#9a6949", icon: "hedgehog" },
    bee: { hp: 34, speed: 54, damage: 10, r: 14, xp: 5, color: "#f0be43", icon: "bee", ranged: true },
    frog: { hp: 48, speed: 49, damage: 12, r: 17, xp: 6, color: "#71ac63", icon: "frog", ranged: true },
    snail: { hp: 92, speed: 30, damage: 17, r: 22, xp: 8, color: "#78a2b5", icon: "snail" }
  };
  function spawnEnemy(type, elite = false) {
    const p = state.player, ang = rand(0, TAU), radius = Math.max(viewW, viewH) * .65 + rand(80, 180), data = ENEMY_TYPES[type];
    const t = state.time / state.duration, scale = 1 + t * 2.1;
    state.enemies.push({ ...data, type, x: clamp(p.x + Math.cos(ang) * radius, 30, 2370), y: clamp(p.y + Math.sin(ang) * radius, 30, 1570),
      hp: data.hp * scale * (elite ? 4.2 : 1), maxHp: data.hp * scale * (elite ? 4.2 : 1), speed: data.speed * (1 + t * .16), damage: data.damage * (1 + t * .65), r: data.r * (elite ? 1.35 : 1), xp: data.xp * (elite ? 7 : 1), elite, shot: rand(1, 3), dead: false, phase: rand(0, TAU) });
  }
  function spawnTick(dt) {
    state.lastSpawn -= dt; if (state.lastSpawn > 0 || state.bossSpawned) return;
    const t = state.time / state.duration, batch = 1 + (t * 4 | 0) + (state.time > state.duration * .68 ? 2 : 0);
    const available = t < .18 ? ["mouse","bug"] : t < .42 ? ["mouse","bug","hedgehog","bee"] : ["mouse","bug","hedgehog","bee","frog","snail"];
    for (let i = 0; i < batch && state.enemies.length < 180; i++) spawnEnemy(pick(available));
    state.lastSpawn = Math.max(.12, .72 - t * .5);
  }
  function forEachEnemy(fn) { for (const e of state.enemies) if (!e.dead) fn(e); if (state.boss && !state.boss.dead) fn(state.boss); }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue; e.phase += dt * 4;
      const d = dist(e, p), a = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.ranged && d < 310) {
        e.x -= Math.cos(a) * e.speed * dt * .45; e.y -= Math.sin(a) * e.speed * dt * .45; e.shot -= dt;
        if (e.shot <= 0) { enemyShot(e.x, e.y, a, e.type === "frog" ? "glob" : "sting", e.damage); e.shot = e.type === "frog" ? 2.7 : 2.1; }
      } else { e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
      if (d < e.r + p.r) hurtPlayer(e.damage, e.x, e.y);
    }
    for (const e of state.enemies) if (e.dead) e.death -= dt;
    state.enemies = state.enemies.filter(e => !e.dead || e.death > 0);
  }
  function enemyShot(x, y, a, kind, damage) { const speed = kind === "glob" ? 150 : 235; state.enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: kind === "glob" ? 9 : 5, life: 4, damage, kind }); }
  function hitEnemy(e, raw, kind) {
    if (!e || e.dead) return; const crit = Math.random() < state.player.crit, dmg = raw * (crit ? 1.85 : 1);
    e.hp -= dmg; state.damage += dmg; state.highHit = Math.max(state.highHit, dmg); textPop(e.x, e.y - e.r, Math.round(dmg), crit ? "#ffcf58" : "#fff", crit ? 18 : 12);
    if (kind === "laser" && Math.random() < .25) e.slow = .35;
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    e.dead = true; e.death = .18; state.kills++; if (e.elite) state.elites++;
    if (e === state.boss) {
      state.coins += 80;
      burst(e.x, e.y, "#ffe37a", 40, 140);
      toast("🏆 暴走扫地机停止运转！", 2600);
      setTimeout(() => endGame(true), 1800);
      return;
    }
    const count = e.elite ? 4 : 1; for (let i = 0; i < count; i++) state.pickups.push({ kind: "xp", x: e.x + rand(-12,12), y: e.y + rand(-12,12), value: e.xp / count, r: e.elite ? 8 : 5 });
    if (Math.random() < (e.elite ? .75 : .08)) state.pickups.push({ kind: "coin", x: e.x, y: e.y, value: e.elite ? 18 : pick([1,2,3]), r: 7 });
    if (Math.random() < .012) state.pickups.push({ kind: "heart", x: e.x, y: e.y, value: 14, r: 9 });
    burst(e.x, e.y, e.color, e.elite ? 18 : 6, e.elite ? 80 : 35);
  }
  function hurtPlayer(raw, sx, sy) {
    const p = state.player; if (p.invuln > 0 || state.mode !== "playing") return;
    const dmg = Math.max(1, raw * (1 - p.armor)); p.hp -= dmg; p.invuln = .62; state.taken += dmg; state.shake = 8; state.flash = .15; sound("hurt"); textPop(p.x, p.y - 30, `-${Math.round(dmg)}`, "#ff7c78", 17); pushFrom(p, { x: sx, y: sy }, 20);
    if (p.hp <= 0) endGame(false);
  }

  function spawnBoss() {
    state.bossSpawned = true; state.enemies.length = Math.min(state.enemies.length, 18); const p = state.player;
    const bossHp = state.dev ? 1200 : 3200;
    state.boss = { x: clamp(p.x + 360, 80, 2320), y: clamp(p.y, 100, 1500), r: 46, hp: bossHp, maxHp: bossHp, damage: 20, speed: 50, phase: 1, attack: 1.5, summon: 5, dead: false, kind: "boss" };
    ui.bossHud.classList.remove("hidden"); ui.bossName.textContent = "暴走扫地机 · 第一阶段"; toast("⚠️ Boss 登场：暴走扫地机！", 3000); sound("boss"); state.shake = 14;
  }
  function updateBoss(dt) {
    const b = state.boss; if (!b || b.dead) return; const p = state.player, d = dist(b,p), a = Math.atan2(p.y-b.y,p.x-b.x);
    const nextPhase = b.hp < b.maxHp * .48 ? 2 : 1;
    if (nextPhase !== b.phase) { b.phase = nextPhase; b.speed = 72; ui.bossName.textContent = "暴走扫地机 · 狂暴清扫"; toast("Boss 狂暴！避开红色清扫区", 2400); sound("boss"); }
    b.x += Math.cos(a) * b.speed * dt * (d > 150 ? 1 : -.25); b.y += Math.sin(a) * b.speed * dt * (d > 150 ? 1 : -.25);
    if (d < b.r + p.r) hurtPlayer(b.damage, b.x, b.y);
    b.attack -= dt; b.summon -= dt;
    if (b.attack <= 0) {
      if (b.phase === 1) { for (let i=0;i<10;i++) enemyShot(b.x,b.y,i/10*TAU,"dust",14); b.attack=2.2; }
      else { state.hazards.push({ x:p.x+rand(-80,80), y:p.y+rand(-80,80), r:58, warn:1.1, life:2.2, damage:19 }); b.attack=.85; }
    }
    if (b.summon <= 0) { for(let i=0;i<(b.phase===1?3:5);i++) spawnEnemy(pick(["mouse","bug","bee"])); b.summon=b.phase===1?7:4.5; }
  }

  function updateProjectiles(dt) {
    for (const q of state.projectiles) {
      q.x += q.vx*dt; q.y += q.vy*dt; q.life -= dt;
      forEachEnemy(e => { if (q.life > 0 && !q.hit.has(e) && dist(q,e) < q.r+e.r) { q.hit.add(e); hitEnemy(e,q.damage,q.kind); if(q.pierce>0) q.pierce--; else q.life=0; } });
    }
    state.projectiles = state.projectiles.filter(q=>q.life>0);
    for (const q of state.enemyShots) { q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;if(dist(q,state.player)<q.r+state.player.r){hurtPlayer(q.damage,q.x,q.y);q.life=0;} }
    state.enemyShots=state.enemyShots.filter(q=>q.life>0);
    for (const h of state.hazards) { h.warn-=dt;h.life-=dt;if(h.warn<=0&&dist(h,state.player)<h.r+state.player.r) hurtPlayer(h.damage,h.x,h.y); }
    state.hazards=state.hazards.filter(h=>h.life>0);
    for (const d of state.devices) {
      d.life-=dt; if(d.kind==="trap") { const target=nearest(d.x,d.y,45); if(target){const radius=(72+d.level*10)*state.player.size;burst(d.x,d.y,"#f7a84b",22,radius);forEachEnemy(e=>{if(dist(d,e)<radius+e.r)hitEnemy(e,(24+d.level*12)*state.player.damageMul,"trap")});d.life=0;} }
      if(d.kind==="turret") d.level=state.player.devices.turret||d.level;
    }
    state.devices=state.devices.filter(d=>d.life>0);
  }

  function updatePickups(dt) {
    const p=state.player;
    for(const o of state.pickups){
      const d=dist(o,p); if(["xp","coin","heart"].includes(o.kind)&&d<p.pickup){const a=Math.atan2(p.y-o.y,p.x-o.x);o.x+=Math.cos(a)*Math.max(130,500-d)*dt;o.y+=Math.sin(a)*Math.max(130,500-d)*dt;}
      if(d<p.r+o.r+6){
        if(o.kind==="xp"){p.xp+=o.value;checkLevel();}
        if(o.kind==="coin"){state.coins+=o.value;sound("coin");}
        if(o.kind==="heart")p.hp=Math.min(p.maxHp,p.hp+o.value);
        if(o.kind==="chest"){state.coins+=25; state.pendingLevels++; toast("宝箱：猫币 +25，并获得一次强化！"); setTimeout(()=>openUpgrade(false),100);}
        if(o.kind==="merchant")openShop();
        if(o.kind==="event")openEvent();
        o.dead=true;
      }
    }
    state.pickups=state.pickups.filter(o=>!o.dead);
  }
  function checkLevel(){const p=state.player;while(p.xp>=p.nextXp){p.xp-=p.nextXp;p.level++;p.nextXp=Math.floor(15+p.level*7+Math.pow(p.level,1.35));state.pendingLevels++;}if(state.pendingLevels>0&&state.mode==="playing"){state.pendingLevels--;openUpgrade(false);}}
  function spawnObject(kind, label){const p=state.player,a=rand(0,TAU),r=rand(260,420);state.pickups.push({kind,x:clamp(p.x+Math.cos(a)*r,80,2320),y:clamp(p.y+Math.sin(a)*r,80,1520),r:22,label});toast(`${label} 已出现在附近`,2400);}

  function schedules() {
    const t=state.time/state.duration,s=state.schedules;
    if(!s.chest1&&t>.2){s.chest1=true;spawnObject("chest","🎁 宝箱");}
    if(!s.elite1&&t>.29){s.elite1=true;for(let i=0;i<2;i++)spawnEnemy(pick(["hedgehog","bee"]),true);toast("⚠️ 精英怪出现！");}
    if(!s.merchant&&t>.4){s.merchant=true;spawnObject("merchant","🛒 流浪猫商人");}
    if(!s.chest2&&t>.54){s.chest2=true;spawnObject("chest","🎁 稀有宝箱");}
    if(!s.event&&t>.62){s.event=true;spawnObject("event","🐝 随机事件");}
    if(!s.elite2&&t>.7){s.elite2=true;for(let i=0;i<3;i++)spawnEnemy(pick(["snail","frog","bee"]),true);toast("⚠️ 高压精英潮！");}
    if(!state.bossSpawned&&state.time>=state.duration-(state.duration<120?30:75))spawnBoss();
  }

  function openShop(){state.mode="shop";ui.shop.classList.remove("hidden");ui.shopCoins.textContent=Math.floor(state.coins);const pool=chooseUpgrades().slice(0,3);pool.push({type:"heal",id:"heal",name:"暖呼呼牛奶",icon:"🥛",desc:"恢复 45% 最大生命",level:1,rarity:"common"});ui.shopChoices.innerHTML="";pool.forEach((c,i)=>{const price=18+i*10,b=document.createElement("button");b.className=`upgrade-card ${c.rarity||""}`;b.innerHTML=`<span class="upgrade-icon">${c.icon}</span><h3>${c.name}</h3><p>${c.desc}</p><span class="price">🪙 ${price}</span>`;b.onclick=()=>{if(state.coins<price){toast("猫币不够喵！");return;}state.coins-=price;if(c.type==="heal")state.player.hp=Math.min(state.player.maxHp,state.player.hp+state.player.maxHp*.45);else applyShopUpgrade(c);b.disabled=true;b.style.opacity=.45;ui.shopCoins.textContent=Math.floor(state.coins);};ui.shopChoices.appendChild(b);});}
  function applyShopUpgrade(c){const old=state.mode;state.mode="shop";if(c.type==="weapon")state.player.weapons[c.id]=c.level;if(c.type==="device"){state.player.devices[c.id]=c.level;if(c.id==="turret"&&c.level===1)deployTurret();}if(c.type==="passive"){const fake={...c,rarity:"common"};state.mode="upgrade";applyUpgrade(fake);state.mode=old;ui.upgrade.classList.add("hidden");}updateDock();}
  function closeShop(){ui.shop.classList.add("hidden");state.mode="playing";}
  function openEvent(){state.mode="event";ui.event.classList.remove("hidden");}
  function resolveEvent(choice){const p=state.player;if(choice==="help"){p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.35);p.speed*=1.12;toast("小蜜蜂送你顺风花粉：移速提升！");}else{p.hp=Math.max(1,p.hp*.75);p.damageMul*=1.25;toast("甜蜜的代价：伤害大幅提升！");}ui.event.classList.add("hidden");state.mode="playing";}

  function movePlayer(dt){const p=state.player;let x=0,y=0;if(keys.has("KeyA")||keys.has("ArrowLeft"))x--;if(keys.has("KeyD")||keys.has("ArrowRight"))x++;if(keys.has("KeyW")||keys.has("ArrowUp"))y--;if(keys.has("KeyS")||keys.has("ArrowDown"))y++;x+=joy.x;y+=joy.y;const len=Math.hypot(x,y);if(len>.05){x/=Math.max(1,len);y/=Math.max(1,len);p.x=clamp(p.x+x*p.speed*dt,25,2375);p.y=clamp(p.y+y*p.speed*dt,25,1575);p.walk=(p.walk||0)+dt*10;}p.invuln=Math.max(0,p.invuln-dt);}
  function phase(){const t=state.time/state.duration;if(state.bossSpawned)return"最终决战";if(t<.25)return"快速成型";if(t<.62)return"中压构筑";return"高压怪潮";}
  function update(dt){if(state.mode!=="playing")return;state.time+=dt;if(state.time>=state.duration+35&&!state.boss)endGame(false);movePlayer(dt);attack(dt);spawnTick(dt);updateEnemies(dt);updateBoss(dt);updateProjectiles(dt);updatePickups(dt);schedules();updateFx(dt);state.cam.x=lerp(state.cam.x,state.player.x,.08);state.cam.y=lerp(state.cam.y,state.player.y,.08);state.shake=Math.max(0,state.shake-dt*30);state.flash=Math.max(0,state.flash-dt);updateHud();}
  function updateFx(dt){for(const p of state.particles){p.life-=dt;if(p.vx){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;}}state.particles=state.particles.filter(p=>p.life>0);for(const t of state.texts){t.life-=dt;t.y-=28*dt;}state.texts=state.texts.filter(t=>t.life>0);}
  function textPop(x,y,text,color="#fff",size=12){state.texts.push({x,y,text,color,size,life:.75,max:.75});}

  function updateHud(){if(!state.player)return;const p=state.player;ui.healthBar.style.width=`${clamp(p.hp/p.maxHp*100,0,100)}%`;ui.healthText.textContent=`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;ui.xpBar.style.width=`${p.xp/p.nextXp*100}%`;ui.levelText.textContent=p.level;ui.coinText.textContent=Math.floor(state.coins);ui.timerText.textContent=fmt(Math.max(0,state.duration-state.time));ui.phaseLabel.textContent=phase();if(state.boss)ui.bossBar.style.width=`${clamp(state.boss.hp/state.boss.maxHp*100,0,100)}%`;}
  function updateDock(){if(!state.player)return;ui.dock.innerHTML="";Object.entries(state.player.weapons).forEach(([id,lv])=>ui.dock.insertAdjacentHTML("beforeend",`<div class="weapon-slot" title="${WEAPONS[id].name}">${WEAPONS[id].icon}<small>${lv}</small></div>`));Object.entries(state.player.devices).forEach(([id,lv])=>ui.dock.insertAdjacentHTML("beforeend",`<div class="weapon-slot" title="${DEVICES[id].name}">${DEVICES[id].icon}<small>${lv}</small></div>`));}
  function buildSummary(){const p=state.player,items=[];Object.entries(p.weapons).forEach(([id,lv])=>items.push([WEAPONS[id].icon+" "+WEAPONS[id].name,"Lv."+lv]));Object.entries(p.devices).forEach(([id,lv])=>items.push([DEVICES[id].icon+" "+DEVICES[id].name,"Lv."+lv]));Object.entries(p.passives).forEach(([id,lv])=>items.push([PASSIVES[id].icon+" "+PASSIVES[id].name,"Lv."+lv]));return items;}
  function pause(){if(state.mode!=="playing")return;state.mode="paused";ui.build.innerHTML=buildSummary().map(x=>`<div class="build-item"><b>${x[0]}</b>${x[1]}</div>`).join("")||"还没有额外强化";ui.pause.classList.remove("hidden");}
  function resume(){if(state.mode!=="paused")return;ui.pause.classList.add("hidden");state.mode="playing";last=performance.now();}
  function endGame(win){if(state.mode==="result")return;state.mode="result";state.won=win;ui.hud.classList.add("hidden");ui.joystick.classList.add("hidden");ui.pause.classList.add("hidden");const survived=Math.min(state.time,state.duration);profile.best=Math.max(profile.best,Math.floor(survived));const reward=Math.floor(state.coins*(win?1:.45)+state.kills*.08+(win?80:0));profile.coins+=reward;if(win)profile.wins++;saveProfile();$("resultBadge").textContent=win?"🏆":"🐾";$("resultKicker").textContent=win?"冒险完成":"本次冒险结束";$("resultTitle").textContent=win?"庭院恢复平静！":"差一点就成功了！";$("resultLine").textContent=win?"“喵！今天的罐头可以安心吃啦。”":"保留成长，拍拍爪子马上再来。";$("resultStats").innerHTML=[["存活",fmt(survived)],["击败",state.kills],["最高伤害",Math.round(state.highHit)],["获得猫币",reward]].map(x=>`<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("");$("resultBuild").innerHTML=buildSummary().map(x=>`<span>${x[0]} ${x[1]}</span>`).join("");ui.result.classList.remove("hidden");if(win)sound("win");}

  function worldToScreen(x,y){return{x:x-state.cam.x+viewW/2,y:y-state.cam.y+viewH/2};}
  function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewW,viewH);if(!state.player){drawMenuBg();return;}const sx=state.shake?rand(-state.shake,state.shake):0,sy=state.shake?rand(-state.shake,state.shake):0;ctx.save();ctx.translate(sx,sy);drawGround();drawLandmarks();drawHazards();drawPickups();drawDevices();drawEntities();drawProjectiles();drawParticles();ctx.restore();if(state.flash>0){ctx.fillStyle=`rgba(255,75,70,${state.flash*.8})`;ctx.fillRect(0,0,viewW,viewH);}}
  function drawMenuBg(){ctx.fillStyle="#cfe9a8";ctx.fillRect(0,0,viewW,viewH);for(let i=0;i<28;i++){const x=(i*173+60)%viewW,y=(i*97+25)%viewH;flower(x,y,5+(i%3),i%2?"#f5b8c0":"#ffe179");}}
  function drawGround(){ctx.fillStyle="#b9dfa2";ctx.fillRect(0,0,viewW,viewH);const left=state.cam.x-viewW/2,top=state.cam.y-viewH/2;ctx.strokeStyle="rgba(104,156,86,.11)";ctx.lineWidth=1;for(let x=Math.floor(left/80)*80;x<left+viewW+80;x+=80){const s=worldToScreen(x,0).x;ctx.beginPath();ctx.moveTo(s,0);ctx.lineTo(s,viewH);ctx.stroke();}for(let y=Math.floor(top/80)*80;y<top+viewH+80;y+=80){const s=worldToScreen(0,y).y;ctx.beginPath();ctx.moveTo(0,s);ctx.lineTo(viewW,s);ctx.stroke();}const a=worldToScreen(0,0),b=worldToScreen(2400,1600);ctx.strokeStyle="#728b5f";ctx.lineWidth=18;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
  function drawLandmarks(){for(const l of state.landmarks){const s=worldToScreen(l.x,l.y);if(s.x<-100||s.x>viewW+100||s.y<-100||s.y>viewH+100)continue;if(l.kind==="flower")flower(s.x,s.y,7,pickStable(l.x)%2?"#fff0a1":"#f4a8b6");else if(l.kind==="rock"){ctx.fillStyle="#9eaa9a";blob(s.x,s.y,14,10);}else if(l.kind==="bush"){ctx.fillStyle="#75b46a";circle(s.x,s.y,18);ctx.fillStyle="#91c976";circle(s.x-8,s.y-5,10);}else if(l.kind==="pond"){ctx.fillStyle="#8dd1d2";ellipse(s.x,s.y,85,52);ctx.strokeStyle="#e9d89c";ctx.lineWidth=7;ctx.stroke();}else if(l.kind==="tree"){ctx.fillStyle="#8b6646";ctx.fillRect(s.x-12,s.y,24,70);ctx.fillStyle="#5ea55f";circle(s.x,s.y-20,62);ctx.fillStyle="#77ba68";circle(s.x-28,s.y-12,36);}else if(l.kind==="shed"){ctx.fillStyle="#e8b36d";ctx.fillRect(s.x-55,s.y-35,110,85);ctx.fillStyle="#c85d54";ctx.beginPath();ctx.moveTo(s.x-70,s.y-35);ctx.lineTo(s.x,s.y-85);ctx.lineTo(s.x+70,s.y-35);ctx.fill();}}
  }
  const pickStable=n=>Math.abs(Math.sin(n*12.9898)*43758.5453)|0;
  function drawHazards(){for(const h of state.hazards){const s=worldToScreen(h.x,h.y);ctx.beginPath();ctx.arc(s.x,s.y,h.r,0,TAU);ctx.fillStyle=h.warn>0?`rgba(232,78,74,${.15+Math.sin(performance.now()/80)*.08})`:`rgba(191,57,64,.46)`;ctx.fill();ctx.strokeStyle="#eb5d59";ctx.lineWidth=3;ctx.stroke();}}
  function drawPickups(){for(const o of state.pickups){const s=worldToScreen(o.x,o.y),bob=Math.sin(performance.now()/220+o.x)*3;if(o.kind==="xp"){ctx.fillStyle="#7cc9f0";diamond(s.x,s.y+bob,o.r);}else if(o.kind==="coin"){ctx.fillStyle="#f6ca4e";circle(s.x,s.y+bob,o.r);ctx.fillStyle="#fff0a1";circle(s.x-2,s.y+bob-2,o.r*.35);}else if(o.kind==="heart")iconText("♥",s.x,s.y+bob,"#ef6967",18);else{ctx.fillStyle="rgba(255,255,255,.85)";roundRect(s.x-33,s.y-37+bob,66,22,9,true);ctx.fillStyle="#453940";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(o.label,s.x,s.y-22+bob);iconText(o.kind==="chest"?"🎁":o.kind==="merchant"?"🛒":"🐝",s.x,s.y+bob,"#fff",30);}}}
  function drawDevices(){for(const d of state.devices){const s=worldToScreen(d.x,d.y);if(d.kind==="turret"){ctx.fillStyle="#68bdd2";roundRect(s.x-16,s.y-8,32,28,7,true);ctx.fillStyle="#f56e72";circle(s.x,s.y-13,8);ctx.strokeStyle="#4d6970";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(s.x,s.y-8);ctx.lineTo(s.x+16,s.y-27);ctx.stroke();}else{ctx.fillStyle="#e99745";circle(s.x,s.y,17);ctx.fillStyle="#fff2c7";ctx.fillRect(s.x-10,s.y-4,20,8);}}}
  function drawEntities(){for(const e of state.enemies)if(!e.dead)drawEnemy(e);if(state.boss&&!state.boss.dead)drawBoss(state.boss);drawCat(state.player);}
  function drawCat(p){const s=worldToScreen(p.x,p.y),blink=p.invuln>0&&((performance.now()/70|0)%2===0);if(blink)return;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.sin(p.walk||0)*.04);ctx.strokeStyle="#c66e2e";ctx.lineWidth=7;ctx.lineCap="round";ctx.beginPath();ctx.arc(-15,4,24,.1,1.6);ctx.stroke();ctx.fillStyle="#f3a047";circle(0,3,19);ctx.beginPath();ctx.moveTo(-14,-10);ctx.lineTo(-10,-27);ctx.lineTo(0,-13);ctx.moveTo(14,-10);ctx.lineTo(10,-27);ctx.lineTo(0,-13);ctx.fill();ctx.fillStyle="#fff4dc";ellipse(0,8,12,9);ctx.fillStyle="#3f3137";circle(-7,0,2.3);circle(7,0,2.3);ctx.fillStyle="#e9757b";ctx.beginPath();ctx.moveTo(-3,6);ctx.lineTo(3,6);ctx.lineTo(0,10);ctx.fill();ctx.restore();}
  function drawEnemy(e){const s=worldToScreen(e.x,e.y);ctx.save();ctx.translate(s.x,s.y+Math.sin(e.phase)*2);if(e.elite){ctx.strokeStyle="#ba6de0";ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,e.r+6,0,TAU);ctx.stroke();}ctx.fillStyle=e.color;if(e.type==="mouse"){circle(0,2,e.r);circle(-10,-11,e.r*.45);circle(10,-11,e.r*.45);ctx.fillStyle="#342d31";circle(-5,0,2);circle(5,0,2);ctx.strokeStyle="#df9c9c";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(18,9);ctx.moveTo(0,7);ctx.lineTo(-18,9);ctx.stroke();}else if(e.type==="bug"){ellipse(0,0,e.r*.75,e.r);ctx.strokeStyle="#3a2926";ctx.lineWidth=3;for(let y=-7;y<8;y+=7){ctx.beginPath();ctx.moveTo(-8,y);ctx.lineTo(8,y);ctx.stroke();}}else if(e.type==="hedgehog"){ctx.beginPath();for(let i=0;i<16;i++){const a=i/16*TAU,r=i%2?e.r:e.r+9;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.fill();ctx.fillStyle="#e9c191";circle(4,3,e.r*.62);}else if(e.type==="bee"){ellipse(0,0,e.r,e.r*.72);ctx.fillStyle="#3d3434";ctx.fillRect(-5,-10,5,20);ctx.fillRect(6,-8,4,16);ctx.fillStyle="rgba(230,250,255,.7)";ellipse(-8,-13,10,6);ellipse(8,-13,10,6);}else if(e.type==="frog"){circle(0,2,e.r);circle(-9,-10,7);circle(9,-10,7);ctx.fillStyle="#fff";circle(-9,-11,4);circle(9,-11,4);ctx.fillStyle="#333";circle(-9,-11,2);circle(9,-11,2);}else{ellipse(-4,6,e.r*.85,e.r*.6);ctx.fillStyle="#c99b65";circle(5,-4,e.r*.7);ctx.fillStyle="#50453e";circle(12,-8,2);}if(e.elite){ctx.fillStyle="#fff";iconText("★",0,-e.r-10,"#ffe25f",12);}ctx.restore();}
  function drawBoss(b){const s=worldToScreen(b.x,b.y);ctx.save();ctx.translate(s.x,s.y);ctx.rotate(performance.now()/500*(b.phase===2?2:1));ctx.fillStyle="#8c708f";circle(0,0,b.r);ctx.fillStyle="#66506b";for(let i=0;i<8;i++){ctx.rotate(TAU/8);roundRect(25,-8,35,16,6,true);}ctx.rotate(-performance.now()/500*(b.phase===2?2:1)-TAU);ctx.fillStyle="#e6dcea";roundRect(-26,-22,52,44,14,true);ctx.fillStyle="#ef5e72";circle(-11,-4,5);circle(11,-4,5);ctx.fillStyle="#504050";ctx.fillRect(-13,10,26,5);ctx.restore();}
  function drawProjectiles(){for(const q of state.projectiles){const s=worldToScreen(q.x,q.y);if(q.kind==="fish")iconText("◇",s.x,s.y,q.color,q.r*2.4);else{ctx.fillStyle=q.color;circle(s.x,s.y,q.r);}}for(const q of state.enemyShots){const s=worldToScreen(q.x,q.y);ctx.fillStyle=q.kind==="glob"?"#78ad62":"#e75b63";circle(s.x,s.y,q.r);}}
  function drawParticles(){for(const p of state.particles){if(p.kind==="beam"){const a=worldToScreen(p.x,p.y),b=worldToScreen(p.x2,p.y2);ctx.globalAlpha=p.life/p.max;ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.globalAlpha=1;}else{const s=worldToScreen(p.x,p.y);ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;circle(s.x,s.y,p.r);ctx.globalAlpha=1;}}for(const t of state.texts){const s=worldToScreen(t.x,t.y);ctx.globalAlpha=t.life/t.max;ctx.fillStyle=t.color;ctx.font=`900 ${t.size}px sans-serif`;ctx.textAlign="center";ctx.fillText(t.text,s.x,s.y);ctx.globalAlpha=1;}}
  function flower(x,y,r,color){ctx.fillStyle=color;for(let i=0;i<5;i++){const a=i/5*TAU;circle(x+Math.cos(a)*r,y+Math.sin(a)*r,r*.65);}ctx.fillStyle="#d9a83c";circle(x,y,r*.55);}
  function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
  function ellipse(x,y,rx,ry){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
  function blob(x,y,rx,ry){ellipse(x,y,rx,ry);}
  function diamond(x,y,r){ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();}
  function roundRect(x,y,w,h,r,fill=false){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill)ctx.fill();}
  function iconText(t,x,y,color,size){ctx.fillStyle=color;ctx.font=`${size}px "Segoe UI Emoji",sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(t,x,y);ctx.textBaseline="alphabetic";}

  function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);

  $("startButton").onclick=()=>{sound("coin");resetGame();};
  $("howButton").onclick=()=>ui.how.classList.remove("hidden");document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
  $("rerollButton").onclick=()=>{if(state.rerolls<=0)return;state.rerolls--;ui.rerolls.textContent=state.rerolls;renderUpgradeChoices();};
  $("leaveShop").onclick=closeShop;document.querySelectorAll("[data-event]").forEach(b=>b.onclick=()=>resolveEvent(b.dataset.event));
  $("pauseButton").onclick=pause;$("resumeButton").onclick=resume;$("quitButton").onclick=()=>endGame(false);
  $("againButton").onclick=resetGame;$("menuButton").onclick=()=>{state={mode:"menu"};ui.result.classList.add("hidden");ui.menu.classList.remove("hidden");};
  addEventListener("keydown",e=>{keys.add(e.code);if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if((e.code==="Escape"||e.code==="KeyP")&&!e.repeat){state.mode==="playing"?pause():state.mode==="paused"&&resume();}});
  addEventListener("keyup",e=>keys.delete(e.code));
  ui.joystick.addEventListener("pointerdown",e=>{joy.active=true;joy.id=e.pointerId;ui.joystick.setPointerCapture(e.pointerId);moveJoy(e);});
  ui.joystick.addEventListener("pointermove",e=>{if(joy.active&&e.pointerId===joy.id)moveJoy(e);});
  ui.joystick.addEventListener("pointerup",endJoy);ui.joystick.addEventListener("pointercancel",endJoy);
  function moveJoy(e){const r=ui.joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy),m=Math.min(1,len/43);joy.x=len?dx/len*m:0;joy.y=len?dy/len*m:0;const knob=ui.joystick.firstElementChild;knob.style.transform=`translate(${joy.x*34}px,${joy.y*34}px)`;}
  function endJoy(){joy.active=false;joy.x=joy.y=0;ui.joystick.firstElementChild.style.transform="";}

  window.__MEOW_GAME__ = { getState:()=>state, start:resetGame, end:(win=true)=>endGame(win) };
})();
