(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const { WEAPONS, PASSIVES, DEVICES, SUMMONS, SKILL_TREE, SKILL_TREE_NODES, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, LEGACY_ASSET_MAP, INK_FX } = window.MEOW_DATA;
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
  const fxMeta = id => INK_FX?.[id] || INK_FX?.FX_001 || { visual: "brush-slash", maxParticles: 10 };
  const fxClass = id => `fx-${fxMeta(id).visual}`;
  const weaponClass = id => id ? `weapon-${String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  const imageMarkup = (resource, alt = "") => `<img src="${resource.art}" data-fallback="${resource.fallback_art || resource.legacy_art || ""}" alt="${alt}" draggable="false">`;
  const portraitResource = character => ({ art: character.portrait_art || character.art, fallback_art: character.portrait_fallback_art || character.fallback_art });
  const combatResource = character => ({ art: character.combat_art || character.art, fallback_art: character.combat_fallback_art || character.fallback_art });
  function setArtImage(image, resource, alt = "") {
    if (!image || !resource) return;
    image.alt = alt; image.dataset.fallback = resource.fallback_art || resource.legacy_art || ""; image.dataset.fallbackUsed = ""; image.src = resource.art;
  }
  document.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.fallback || image.dataset.fallbackUsed === "1") return;
    image.dataset.fallbackUsed = "1"; image.src = image.dataset.fallback;
  }, true);

  const ui = {
    menu: $("menu"), how: $("howPanel"), upgrade: $("upgradePanel"), shop: $("shopPanel"), event: $("eventPanel"),
    pause: $("pausePanel"), result: $("resultPanel"), hud: $("hud"), joystick: $("joystick"),
    healthBar: $("healthBar"), healthText: $("healthText"), xpBar: $("xpBar"), levelText: $("levelText"),
    timerText: $("timerText"), phaseLabel: $("phaseLabel"), coinText: $("coinText"), bossHud: $("bossHud"),
    bossBar: $("bossBar"), bossName: $("bossName"), toast: $("objectiveToast"), dock: $("weaponDock"),
    choices: $("upgradeChoices"), rerolls: $("rerollCount"), shopChoices: $("shopChoices"), shopCoins: $("shopCoins"), build: $("buildSummary"), mechanic: $("characterMechanic")
  };

  const profile = (() => {
    try { return { coins: 0, best: 0, wins: 0, ...JSON.parse(localStorage.getItem("meowGardenProfile") || "{}") }; }
    catch { return { coins: 0, best: 0, wins: 0 }; }
  })();
  const saveProfile = () => { localStorage.setItem("meowGardenProfile", JSON.stringify(profile)); syncProfile(); };
  const syncProfile = () => { $("profileCoins").textContent = profile.coins; $("bestTime").textContent = fmt(profile.best); };
  syncProfile();

  const GROWTH_KEY = "meowGardenGrowth.v2";
  const growth = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GROWTH_KEY) || "{}");
      return { version: 2, unlocked: {}, choices: {}, challenges: {}, ...saved, unlocked: { ...(saved.unlocked || {}) }, choices: { ...(saved.choices || {}) }, challenges: { ...(saved.challenges || {}) } };
    } catch { return { version: 2, unlocked: {}, choices: {}, challenges: {} }; }
  })();
  const saveGrowth = () => localStorage.setItem(GROWTH_KEY, JSON.stringify(growth));
  const growthNodesFor = character => SKILL_TREE?.[character.id] || [];
  const hasGrowthNode = nodeId => Boolean(growth.unlocked[nodeId]);
  const growthSpent = character => growthNodesFor(character).reduce((sum, node) => sum + (hasGrowthNode(node.node_id) ? node.coin_cost : 0), 0);
  function compileGrowthConfig(character) {
    const config = { stats: {}, slots: {}, flags: {}, vfx: {}, revive: { lives: 0 }, summons: { damage: 1, hp: 1, energy: 1, respawn: 1, respawnAttackSpeed: 0, respawnBuffDuration: 0 }, startSummons: [] };
    const addStat = (stat, mode, value) => {
      const entry = config.stats[stat] ||= { add: 0, mult: 1 };
      if (mode === "add") entry.add += value; else entry.mult *= 1 + value;
    };
    growthNodesFor(character).filter(node => hasGrowthNode(node.node_id)).forEach(node => node.effect_ops.forEach(effect => {
      if (effect.op === "add_stat") {
        if (effect.stat === "summonDamage") config.summons.damage *= 1 + effect.value;
        else if (effect.stat === "summonHp") config.summons.hp *= 1 + effect.value;
        else if (effect.stat === "partnerEnergy") config.summons.energy *= 1 + effect.value;
        else addStat(effect.stat, effect.mode, effect.value);
      }
      if (effect.op === "add_slot") config.slots[effect.target] = (config.slots[effect.target] || 0) + effect.value;
      if (effect.op === "add_trigger_effect") config.flags[effect.trigger] = { ...effect, nodeId: node.node_id };
      if (effect.op === "modify_revive") { if (effect.lives) config.revive.lives += effect.lives; if (effect.retention) config.revive.retention = effect.retention; }
      if (effect.op === "modify_summon_respawn") { config.summons.respawn *= effect.multiplier; config.summons.respawnAttackSpeed = effect.attackSpeed; config.summons.respawnBuffDuration = effect.duration; }
      if (effect.op === "set_min_vfx_tier") config.vfx[effect.target] = { level: effect.level || 1, tier: effect.tier };
      if (effect.op === "start_with_summon") config.startSummons.push({ id: effect.id, level: effect.level || 1 });
    }));
    const breakthrough = growth.choices[character.id];
    config.breakthrough = breakthrough || null;
    if (character.key === "qingyan" && growth.challenges.summoner_no_summon === "complete") config.slots.summon = (config.slots.summon || 0) + 1;
    if (breakthrough === "BREAK_NINE_A") { config.revive.lives++; config.revive.retention = .65; }
    if (breakthrough === "BREAK_SUM_B") { config.slots.summon = (config.slots.summon || 0) - 1; config.summons.damage *= 1.22; config.summons.hp *= 1.20; }
    return config;
  }

  let homeCharacterKey = "moxiaobai";
  const characterMark = key => ({ moxiaobai: "均", chihen: "九", qingyan: "召" }[key] || "侠");
  function renderHomeCharacter(key = homeCharacterKey) {
    const character = CHARACTERS[key] || CHARACTER; homeCharacterKey = character.key;
    const growthConfig = compileGrowthConfig(character), statValue = stat => { const effect = growthConfig.stats[stat] || { add:0, mult:1 }; return (character.base_stats[stat] + effect.add) * effect.mult; };
    const ready = character.status === "ready", start = $("startButton");
    $("homeHero").dataset.character = character.key; $("homeHero").setAttribute("aria-label", `当前角色${character.name}`);
    setArtImage($("homeHeroImage"), portraitResource(character), `Q版动漫水墨猫侠${character.name}`);
    $("heroCaptionName").textContent = character.name; $("heroCaptionRole").textContent = character.role.replace(" / ", " · ");
    $("homeCharacterMark").textContent = characterMark(character.key); $("homeCharacterName").textContent = character.name; $("homeCharacterStatus").textContent = character.status_text;
    $("homeCharacterRole").textContent = character.role; $("homeCharacterSummary").textContent = character.summary;
    $("homeCharacterTraits").innerHTML = character.traits.slice(0, 4).map(trait => `<span>${trait}</span>`).join("");
    $("homeStatHp").textContent = Math.round(statValue("maxHp")); $("homeStatSpeed").textContent = Math.round(statValue("speed")); $("homeStatCrit").textContent = `${Math.round(statValue("crit") * 100)}%`; $("homeStatWeapons").textContent = character.slot_rules.weapon + (growthConfig.slots.weapon || 0);
    start.disabled = !ready; start.classList.toggle("locked-home", !ready); start.querySelector("b").textContent = ready ? "开始冒险" : `${character.name}开发中`; start.querySelector("small").textContent = ready ? "踏入墨韵旧庭 · 八分钟试炼" : "请在角色卷中选择喵小白出战";
  }
  function renderCharacterChoices() {
    $("characterChoices").innerHTML = Object.values(CHARACTERS).map(character => `<button class="character-choice ${character.palette} ${character.status !== "ready" ? "is-development" : ""}" data-character="${character.key}"><span class="character-choice-art">${imageMarkup(portraitResource(character), character.name)}</span><span class="character-choice-copy"><small>${character.status_text}</small><b>${character.name}</b><em>${character.role}</em><p>${character.summary}</p><span>${character.traits.join(" · ")}</span></span></button>`).join("");
    $("characterChoices").querySelectorAll("[data-character]").forEach(button => button.onclick = () => { renderHomeCharacter(button.dataset.character); $("characterPanel").classList.add("hidden"); });
  }
  function showInfo(type) {
    const titles = { growth: ["成长", "成长树兼容接口"], weapons: ["武器 / Build", "十二道水墨兵势"], settings: ["设置", "游戏设置"], save: ["存档", "庭院行迹"] };
    const [kicker, title] = titles[type] || ["庭院卷册", "功能信息"]; $("infoKicker").textContent = kicker; $("infoTitle").textContent = title;
    if (type === "weapons") $("infoBody").innerHTML = `<div class="weapon-catalog">${Object.values(WEAPONS).map(weapon => `<article><span>${weapon.icon}</span><div><b>${weapon.name}</b><small>${weapon.tags}</small><p>${weapon.desc}</p></div></article>`).join("")}</div>`;
    else if (type === "growth") $("infoBody").innerHTML = `<div class="paper-message"><b>成长树将在后续阶段开放</b><p>本轮已经为三名角色预留武器、装置、召唤槽与专属机制配置；当前不会新增未经策划确认的成长节点。</p></div>`;
    else if (type === "settings") $("infoBody").innerHTML = `<div class="paper-message"><b>基础设置</b><p>电脑使用 WASD / 方向键移动，P 或 Esc 暂停；手机使用左下摇杆。动画会遵循系统“减少动态效果”设置。</p><p>当前 Demo 为单机离线版本，不包含账号、联网大厅或商城。</p></div>`;
    else $("infoBody").innerHTML = `<div class="save-info"><div><small>累计铜钱</small><b>${profile.coins}</b></div><div><small>最高存活</small><b>${fmt(profile.best)}</b></div><div><small>通关次数</small><b>${profile.wins}</b></div></div><p class="panel-note">正式进度保存在当前浏览器的 localStorage；DEV 测试数据不会写入正式记录。</p>`;
    $("infoPanel").classList.remove("hidden");
  }
  const nodeTypeLabel = type => ({ BASE:"基础", MECHANIC:"机制", CORE:"核心", VFX:"视觉", POOL:"卡池", SLOT:"槽位", CHALLENGE:"挑战", BREAKTHROUGH:"突破" }[type] || type);
  let growthCharacterKey = "moxiaobai";
  let pendingChallenge = null;
  function openGrowthPanel(characterKey = homeCharacterKey) {
    growthCharacterKey = CHARACTERS[characterKey] ? characterKey : "moxiaobai";
    renderGrowthPanel(); $("growthPanel").classList.remove("hidden");
  }
  function growthNodeAvailable(node, character) {
    if (!node.prerequisites.every(hasGrowthNode)) return false;
    if (node.node_type !== "BREAKTHROUGH") return true;
    const challenge = growthNodesFor(character).find(item => item.node_type === "CHALLENGE")?.challenge_id;
    return !challenge || growth.challenges[challenge] === "complete";
  }
  function renderGrowthPanel(message = "") {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, nodes = growthNodesFor(character);
    $("growthCoins").textContent = profile.coins;
    $("growthCharacterTabs").innerHTML = Object.values(CHARACTERS).map(item => `<button class="growth-tab ${item.key === character.key ? "active" : ""} ${item.palette}" data-growth-character="${item.key}"><span>${characterMark(item.key)}</span><b>${item.name}</b><small>${growthSpent(item)} / ${growthNodesFor(item).reduce((sum,node)=>sum+node.coin_cost,0)} 钱</small></button>`).join("");
    $("growthCharacterTabs").querySelectorAll("[data-growth-character]").forEach(button => button.onclick = () => { growthCharacterKey = button.dataset.growthCharacter; renderGrowthPanel(); });
    const unlockedCount = nodes.filter(node => hasGrowthNode(node.node_id)).length, config = compileGrowthConfig(character);
    $("growthSummary").innerHTML = `<div><b>${character.name}</b><span>${character.role}</span></div><div><strong>${unlockedCount}/${nodes.length}</strong><small>已解锁节点</small></div><div><strong>Tier ${config.vfx.weapon?.tier || config.vfx.summon?.tier || 1}</strong><small>技能树视觉下限</small></div><div><strong>${config.slots.weapon ? `武器 +${config.slots.weapon}` : config.slots.summon ? `召唤 +${config.slots.summon}` : config.slots.device ? `装置 +${config.slots.device}` : "机制成长"}</strong><small>当前树特性</small></div>`;
    const tiers = [...new Set(nodes.map(node => node.tier))];
    $("skillTree").innerHTML = tiers.map(tier => `<section class="skill-tier"><header><span>第 ${tier} 层</span><i></i></header><div class="skill-tier-nodes">${nodes.filter(node => node.tier === tier).map(node => {
      const unlocked = hasGrowthNode(node.node_id), available = growthNodeAvailable(node, character), affordable = profile.coins >= node.coin_cost;
      const prerequisiteNames = node.prerequisites.map(id => nodes.find(item => item.node_id === id)?.name || id).join("、");
      const stateClass = unlocked ? "unlocked" : available ? affordable ? "available" : "unaffordable" : "locked";
      const breakthrough = node.breakthrough_options ? `<div class="breakthrough-options">${node.breakthrough_options.map(option => `<button data-breakthrough="${option.id}" ${!unlocked ? "disabled" : ""} class="${growth.choices[character.id] === option.id ? "chosen" : ""}"><b>${option.name}</b><span>${option.description}</span></button>`).join("")}</div>` : "";
      const challengeState = node.challenge_id ? `<em class="challenge-state">${growth.challenges[node.challenge_id] === "complete" ? "挑战已完成" : unlocked ? "挑战入口已开放" : "解锁后开放挑战"}</em>${unlocked && growth.challenges[node.challenge_id] !== "complete" ? `<button class="challenge-start" data-start-challenge="${node.challenge_id}">进入专属挑战</button>` : ""}` : "";
      return `<article class="skill-node ${stateClass} type-${node.node_type.toLowerCase()}" data-node-id="${node.node_id}"><div class="node-seal">${node.node_id}</div><small>${nodeTypeLabel(node.node_type)}</small><h3>${node.name}</h3><p>${node.description}</p>${node.prerequisites.length ? `<span class="node-prereq">前置：${prerequisiteNames}</span>` : `<span class="node-prereq">自由起笔</span>`}${challengeState}<button class="node-unlock" data-unlock-node="${node.node_id}" ${unlocked || !available || !affordable ? "disabled" : ""}>${unlocked ? "已解锁" : available ? `解锁 · ${node.coin_cost} 钱` : node.node_type === "BREAKTHROUGH" ? "完成专属挑战后开放" : "前置未解锁"}</button>${breakthrough}</article>`;
    }).join("")}</div></section>`).join("");
    $("skillTree").querySelectorAll("[data-unlock-node]").forEach(button => button.onclick = () => unlockGrowthNode(button.dataset.unlockNode));
    $("skillTree").querySelectorAll("[data-breakthrough]").forEach(button => button.onclick = () => chooseBreakthrough(button.dataset.breakthrough));
    $("skillTree").querySelectorAll("[data-start-challenge]").forEach(button => button.onclick = () => startGrowthChallenge(button.dataset.startChallenge));
    $("growthStatus").textContent = message || "选择可解锁的节点；基础、机制与视觉效果会在下一局自动生效。挑战节点本身不增加属性。";
  }
  function unlockGrowthNode(nodeId) {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, node = growthNodesFor(character).find(item => item.node_id === nodeId);
    if (!node || hasGrowthNode(nodeId) || !growthNodeAvailable(node, character) || profile.coins < node.coin_cost) return;
    profile.coins -= node.coin_cost; growth.unlocked[nodeId] = Date.now();
    if (node.challenge_id && !growth.challenges[node.challenge_id]) growth.challenges[node.challenge_id] = "unlocked";
    saveGrowth(); saveProfile(); renderGrowthPanel(`已解锁「${node.name}」；战斗效果将在下一局生效。`); sound("coin");
  }
  function chooseBreakthrough(optionId) {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, node = growthNodesFor(character).find(item => item.breakthrough_options?.some(option => option.id === optionId));
    if (!node || !hasGrowthNode(node.node_id)) return;
    growth.choices[character.id] = optionId; saveGrowth(); renderGrowthPanel(`已选择最终突破「${node.breakthrough_options.find(option => option.id === optionId).name}」。可通过重置当前角色重新选择。`);
  }
  function resetGrowthTree() {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, unlocked = growthNodesFor(character).filter(node => hasGrowthNode(node.node_id));
    if (!unlocked.length || !confirm(`重置 ${character.name} 的技能树并返还 ${unlocked.reduce((sum,node)=>sum+node.coin_cost,0)} 铜钱？已完成挑战会保留。`)) return;
    profile.coins += unlocked.reduce((sum,node)=>sum+node.coin_cost,0); unlocked.forEach(node => delete growth.unlocked[node.node_id]); delete growth.choices[character.id]; saveGrowth(); saveProfile(); renderGrowthPanel("技能树已重置，投入铜钱已全部返还。");
  }
  function startGrowthChallenge(challengeId) {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, node = growthNodesFor(character).find(item => item.challenge_id === challengeId);
    if (!node || !hasGrowthNode(node.node_id)) return;
    homeCharacterKey = character.key; pendingChallenge = challengeId; $("growthPanel").classList.add("hidden"); resetGame(false);
  }
  renderCharacterChoices(); renderHomeCharacter();

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
  function createPlayer(character, dev, growthConfig = compileGrowthConfig(character)) {
    const baseStats = character?.base_stats || CHARACTER.base_stats;
    const modified = Object.fromEntries(Object.entries(baseStats).map(([key, value]) => {
      const effect = growthConfig.stats[key] || { add: 0, mult: 1 };
      return [key, (value + effect.add) * effect.mult];
    }));
    const base = { ...modified, maxHp: dev ? Math.max(500, modified.maxHp) : modified.maxHp };
    return {
      x: WORLD_W / 2, y: WORLD_H / 2, r: 21, hp: base.maxHp, maxHp: base.maxHp, speed: base.speed, invuln: 0,
      level: 1, xp: 0, nextXp: levelXpRequirement(1), pickup: base.pickup, damageMul: base.damageMul,
      attackSpeed: base.attackSpeed, crit: base.crit, size: base.size, armor: base.armor, base,
      runtime: { damage: 1, speed: 1, attackSpeed: 1, crit: 0 }, weapons: { yarn: 1 }, passives: {}, passiveWeights: {}, devices: {}, summonLevels: {}, weaponMastery: {}, weaponMinor: {}, growthCards: {}, moving: false,
      facing: 1, movedDistance: 0, growthConfig
    };
  }

  function createCharacterState(character, growthConfig = compileGrowthConfig(character)) {
    if (character.key === "chihen") return { type: "nine_lives", livesRemaining: character.mechanics.lives + growthConfig.revive.lives, revivesUsed: 0, shieldCharges: 0, bloodClaw: 1.1, fateDash: 3.2, afterfireUntil: 0, forcedCritUntil: 0, deathGuardUntil: 0, deathGuardReady: false, marks: { damage: 0, attackSpeed: 0, crit: 0 } };
    if (character.key === "qingyan") return { type: "summoner_roster", energy: 0, energyMax: character.mechanics.companionEnergyMax || 100, empowerUntil: 0, deathLinkUntil: 0, recall: 7, ward: 4.5, wardUntil: 0, echoes: [], resonanceLineUntil: 0 };
    return { type: "standard_build", stepEdgeCharged: false, switchStanceUntil: 0 };
  }

  function recalculatePlayerStats({ healDelta = false } = {}) {
    const player = state.player;
    if (!player) return;
    player.base ||= { ...(state.character?.base_stats || CHARACTER.base_stats) };
    player.runtime ||= { damage: 1, speed: 1, attackSpeed: 1, crit: 0 };
    player.runtime.attackSpeed ??= 1; player.runtime.crit ??= 0;
    player.passiveWeights ||= {};
    const weight = id => Number.isFinite(player.passiveWeights[id]) ? player.passiveWeights[id] : (player.passives[id] || 0);
    const oldMax = player.maxHp || player.base.maxHp;
    const oldHp = Number.isFinite(player.hp) ? player.hp : oldMax;
    player.maxHp = Math.max(1, player.base.maxHp + 22 * weight("health"));
    player.speed = Math.max(1, player.base.speed * Math.pow(1.10, weight("speed")) * player.runtime.speed);
    player.damageMul = Math.max(.01, player.base.damageMul * Math.pow(1.18, weight("power")) * player.runtime.damage);
    player.attackSpeed = Math.max(.05, player.base.attackSpeed * Math.pow(1.14, weight("haste")) * player.runtime.attackSpeed);
    player.pickup = Math.max(1, player.base.pickup + 38 * weight("magnet"));
    player.crit = clamp(player.base.crit + .08 * weight("crit") + player.runtime.crit, 0, 1);
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
  function setWeaponLevel(id, level, { fromUpgrade = false, rarity = "common" } = {}) {
    const data = WEAPONS[id], player = state.player;
    if (!data || !player) return;
    const previous = player.weapons[id] || 0, next = clamp(Math.round(level), 0, data.max);
    if (next) player.weapons[id] = next; else delete player.weapons[id];
    const flags = state.growthConfig?.flags || {};
    if (fromUpgrade && previous === 0 && next > 0 && flags.new_weapon_mastery) {
      const mastery = pick([{ kind:"damage", value:.10, label:"锋" },{ kind:"cd", value:.08, label:"疾" },{ kind:"range", value:.10, label:"远" }]);
      player.weaponMastery[id] = mastery; toast(`${data.name} · 百兵熟练「${mastery.label}」`, 1500);
    }
    if (fromUpgrade && flags.weapon_upgrade) state.characterState.switchStanceUntil = state.time + flags.weapon_upgrade.duration;
    if (fromUpgrade && flags.extra_minor_roll && rarity !== "epic" && Math.random() < flags.extra_minor_roll.chance) {
      const minor = pick([{ kind:"damage", value:.05, label:"伤害 +5%" },{ kind:"range", value:.05, label:"范围 +5%" },{ kind:"speed", value:.08, label:"弹速 +8%" },{ kind:"cd", value:.04, label:"冷却 -4%" }]);
      const entry = player.weaponMinor[id] ||= { damage:0, range:0, speed:0, cd:0 }; entry[minor.kind] += minor.value; toast(`万法皆通 · ${data.name} ${minor.label}`, 1700);
    }
    updateDock();
  }
  function setSummonLevel(id, level) {
    const data = SUMMONS[id], player = state.player;
    if (!data || !player || state.character.key !== "qingyan") return;
    const next = clamp(Math.round(level), 0, data.max), previous = player.summonLevels[id] || 0;
    if (next) player.summonLevels[id] = next; else delete player.summonLevels[id];
    syncSummonRoster();
    const summon = state.summons.find(item => item.type === id);
    if (summon && next > previous) { summon.level = next; summon.maxHp = data.maxHp * state.growthConfig.summons.hp * (1 + (next - 1) * .12); summon.hp = summon.maxHp; burst(summon.x, summon.y, next >= 3 ? "#d6b66b" : "#607a9b", 9, 52, "FX_003"); }
    updateDock();
  }

  function clearWorldNodes() { nodes.clear(); world.replaceChildren(); }
  function resetGame(devOverride = null) {
    const queryDev = new URLSearchParams(location.search).get("dev") === "1";
    const dev = devOverride === null ? queryDev : Boolean(devOverride);
    const activeCharacter = CHARACTERS[homeCharacterKey] || CHARACTER, growthConfig = compileGrowthConfig(activeCharacter), challengeId = dev ? null : pendingChallenge;
    pendingChallenge = null;
    const baseSlots = activeCharacter.slot_rules || CHARACTER.slot_rules;
    state = {
      dev, mode: dev ? "playing" : "upgrade", started: dev, duration: 480, time: 0, lastSpawn: 0,
      shake: 0, flash: 0, kills: 0, elites: 0, damage: 0, taken: 0, highHit: 0, coins: 0,
      pendingLevels: 0, rerolls: 2, bossSpawned: false, won: false, simSpeed: 1, devLabOpen: false,
      devRunPaused: dev, invincible: false, infiniteRerolls: false, fps: 0, damageBuckets: [],
      schedules: { chest1: false, chest2: false, merchant: false, event: false, elite1: false, elite2: false },
      character: activeCharacter, challengeId, growthConfig, slotRules: { ...baseSlots, weapon: challengeId === "balanced_single_weapon" ? 1 : baseSlots.weapon + (growthConfig.slots.weapon || 0), device: baseSlots.device + (growthConfig.slots.device || 0), summon: challengeId === "summoner_no_summon" ? 0 : baseSlots.summon + (growthConfig.slots.summon || 0) }, characterState: createCharacterState(activeCharacter, growthConfig), player: createPlayer(activeCharacter, dev, growthConfig), summons: [], enemies: [], projectiles: [], enemyShots: [], pickups: [], particles: [], texts: [], hazards: [], devices: [], boss: null,
      playerZones: [], weaponPulses: [], orbiters: [], weaponDamage: {},
      timers: { ...Object.fromEntries(Object.keys(WEAPONS).map(id => [id, 0])), trap: 2, turret: 0 }, cam: { x: WORLD_W / 2, y: WORLD_H / 2 }
    };
    clearWorldNodes();
    initializeCharacterRun();
    $("hudHeroName").textContent = state.character.name; setArtImage($("hudHeroImage"), portraitResource(state.character), state.character.name);
    ui.menu.classList.add("hidden"); ui.result.classList.add("hidden"); ui.hud.classList.remove("hidden"); ui.joystick.classList.remove("hidden"); ui.bossHud.classList.add("hidden");
    updateDock(); updateHud();
    toast(dev ? "DEV MODE · 测试数据不会写入正式存档" : challengeId ? `专属挑战 · ${challengeId === "balanced_single_weapon" ? "单武器通关" : challengeId === "ninelives_last_life" ? "最终命通关" : "无召唤通关"}` : "开局墨意 · 先选一道笔势", 2200);
    if (dev) window.dispatchEvent(new CustomEvent("meow-dev-started")); else openUpgrade(true);
  }

  function createSummon(type, index = 0) {
    const data = SUMMONS[type], angle = index * TAU / Math.max(1, Object.keys(state.player.summonLevels).length), level = state.player.summonLevels[type] || 1, maxHp = data.maxHp * state.growthConfig.summons.hp;
    return { ...data, type, index, x: state.player.x + Math.cos(angle) * 74, y: state.player.y + Math.sin(angle) * 74, maxHp, hp: maxHp, attack: .35 + index * .22, level, dead: false, reviveAt: 0, buffUntil: 0, lockedElite: false };
  }
  function syncSummonRoster() {
    if (!state.player || state.character.key !== "qingyan") { state.summons = []; return; }
    const wanted = Object.keys(state.player.summonLevels).slice(0, state.slotRules.summon || 0), byType = Object.fromEntries((state.summons || []).map(summon => [summon.type, summon]));
    state.summons = wanted.map((type, index) => {
      const summon = byType[type] || createSummon(type, index), data = SUMMONS[type], level = state.player.summonLevels[type];
      summon.index = index; summon.level = level; summon.maxHp = data.maxHp * state.growthConfig.summons.hp * (1 + (level - 1) * .12); summon.hp = clamp(summon.hp, 0, summon.maxHp); return summon;
    });
  }
  function initializeCharacterRun() {
    state.characterState = createCharacterState(state.character, state.growthConfig);
    state.summons = [];
    if (state.character.key === "qingyan") {
      if (state.challengeId !== "summoner_no_summon") {
        // Keep the playable Demo's established three-partner opening. S04 still
        // guarantees the starter mouse for challenge/loadout variants.
        ["mouse","crane","dog"].forEach(id => state.player.summonLevels[id] = Math.max(state.player.summonLevels[id] || 0, 1));
        state.growthConfig.startSummons.forEach(entry => state.player.summonLevels[entry.id] = Math.max(state.player.summonLevels[entry.id] || 0, entry.level));
      }
      syncSummonRoster();
    }
  }
  function summonPower(summon) {
    const cs = state.characterState, empowered = cs.empowerUntil > state.time, linked = cs.deathLinkUntil > state.time, commanded = summon.buffUntil > state.time, warded = cs.wardUntil > state.time;
    const alive = state.summons.filter(item => !item.dead), roles = new Set(alive.flatMap(item => SUMMONS[item.type].role)), unity = state.growthConfig.flags.alive_summon_thresholds && alive.length >= 3 ? 1.10 : 1, formation = state.growthConfig.flags.summon_role_set_bonus && ["output","tank","support","control"].every(role => roles.has(role)) ? 1.15 : 1;
    return state.growthConfig.summons.damage * (1 + (summon.level - 1) * .18) * (empowered ? 1.55 : 1) * (linked ? 1.3 : 1) * (commanded ? 1.25 : 1) * (warded ? 1.18 : 1) * unity * formation;
  }
  function onSummonKill() {
    const cs = state.characterState;
    if (state.character.key !== "qingyan" || cs.empowerUntil > state.time) return;
    const extra = state.growthConfig.breakthrough === "BREAK_SUM_A" ? 1 + state.summons.filter(item => !item.dead).length * .05 : 1;
    const gatherCard = 1 + .15 * (state.player.growthCards.CARD_SUM_GATHER || 0);
    cs.energy = Math.min(cs.energyMax, cs.energy + 14 * state.growthConfig.summons.energy * extra * gatherCard);
    if (cs.energy < cs.energyMax) return;
    cs.energy = 0; cs.empowerUntil = state.time + (state.character.mechanics.empowerDuration || 6);
    state.summons.forEach(summon => { if (!summon.dead) summon.hp = Math.min(summon.maxHp, summon.hp + summon.maxHp * .25); });
    if (state.growthConfig.flags.resonance_line) { cs.resonanceLineUntil = state.time + .75; state.summons.filter(summon => !summon.dead).forEach(summon => beam(state.player.x, state.player.y, summon.x, summon.y, "#d6b66b", "FX_003", null, 2)); }
    burst(state.player.x, state.player.y, "#d6b66b", 14, 80, "FX_003"); toast("伙伴能量满盈 · 全阵共鸣！", 2200);
  }
  function defeatSummon(summon) {
    if (summon.dead) return;
    summon.dead = true; summon.hp = 0; summon.reviveAt = state.time + 10 * state.growthConfig.summons.respawn * (state.growthConfig.flags.summon_role_set_bonus ? .9 : 1);
    state.characterState.deathLinkUntil = state.time + (state.character.mechanics.deathLinkDuration || 5);
    if (state.growthConfig.flags.summon_death_echo) {
      const evolved = Boolean(state.player.growthCards.CARD_SUM_ECHO_SOUL), duration = evolved ? 4 : state.growthConfig.flags.summon_death_echo.duration, damage = evolved ? .75 : state.growthConfig.flags.summon_death_echo.damage;
      state.characterState.echoes.push({ x:summon.x, y:summon.y, type:summon.type, damage:summon.damage * summonPower(summon) * damage, attack:.1, life:duration, max:duration });
    }
    burst(summon.x, summon.y, "#38465d", 8, 44, "FX_005"); updateDock(); toast(`${summon.name} 归纸 · 余阵强化`, 1600);
  }
  function reviveSummon(summon, commanded = false) {
    summon.dead = false; summon.hp = summon.maxHp * (commanded ? 1 : .7); summon.attack = .25; summon.x = state.player.x + rand(-55, 55); summon.y = state.player.y + rand(-55, 55); summon.buffUntil = state.time + (state.growthConfig.summons.respawnBuffDuration || 3);
    burst(summon.x, summon.y, "#d6b66b", 8, 48, "FX_003"); updateDock();
  }
  function useQingyanRecall() {
    const dead = state.summons.find(summon => summon.dead);
    if (dead) reviveSummon(dead, true);
    state.summons.forEach(summon => { if (!summon.dead) { summon.hp = Math.min(summon.maxHp, summon.hp + summon.maxHp * .42); summon.buffUntil = state.time + 4; } });
    burst(state.player.x, state.player.y, "#607a9b", 12, 75, "FX_003"); toast(dead ? `回墨号令 · ${dead.name}重归阵中` : "回墨号令 · 伙伴疗愈强化", 1800);
  }
  function updateQingyan(dt) {
    const cs = state.characterState, player = state.player, alive = state.summons.filter(summon => !summon.dead);
    cs.recall -= dt; cs.ward -= dt;
    if (cs.recall <= 0) { useQingyanRecall(); cs.recall = state.character.skills.recall.cooldown; }
    if (cs.ward <= 0) { cs.wardUntil = state.time + state.character.skills.ward.duration; cs.ward = state.character.skills.ward.cooldown; state.particles.push({ kind: "claw", fxId: "FX_004", x: player.x, y: player.y, r: 145, color: "#596f91", life: .8, max: .8 }); toast("砚光护阵 · 伙伴攻势提升", 1600); }
    state.summons.forEach((summon, index) => {
      if (summon.dead) { if (state.time >= summon.reviveAt) reviveSummon(summon); return; }
      summon.attack -= dt;
      const formationAngle = state.time * .38 + index * TAU / Math.max(1, alive.length), formationRadius = summon.type === "dog" ? 72 : 98;
      let goalX = player.x + Math.cos(formationAngle) * formationRadius, goalY = player.y + Math.sin(formationAngle) * formationRadius;
      const target = nearest(summon.x, summon.y, summon.range);
      if (summon.type === "dog" && target) { goalX = target.x; goalY = target.y; }
      const angle = Math.atan2(goalY - summon.y, goalX - summon.x), distance = Math.hypot(goalX - summon.x, goalY - summon.y);
      summon.x = clamp(summon.x + Math.cos(angle) * Math.min(distance, summon.speed * dt), 35, WORLD_W - 35); summon.y = clamp(summon.y + Math.sin(angle) * Math.min(distance, summon.speed * dt), 35, WORLD_H - 35);
      const roles = new Set(alive.flatMap(item => SUMMONS[item.type].role)), formation = state.growthConfig.flags.summon_role_set_bonus && ["output","tank","support","control"].every(role => roles.has(role)), unitySpeed = state.growthConfig.flags.alive_summon_thresholds && alive.length >= 5 ? 1.08 : 1;
      const power = summonPower(summon), speedBoost = (power > 1 ? 1.28 : 1) * (summon.buffUntil > state.time && state.growthConfig.summons.respawnAttackSpeed ? 1 + state.growthConfig.summons.respawnAttackSpeed : 1) * unitySpeed * (formation ? 1.10 : 1);
      if (target && summon.attack <= 0) {
        if (summon.type === "dog" && dist(summon, target) < summon.r + target.r + 28) { hitEnemy(target, summon.damage * power, "summon-dog", null, summon); burst(target.x, target.y, "#38465d", 5, 28, "FX_001"); }
        const summonTier = summonVfxTier(summon);
        if (summon.type === "mouse") shoot(summon.x, summon.y, target, { kind: "summon-mouse", color: summon.color, damage: summon.damage * power, speed: 480, range: summon.range, r: 5, fxId: "FX_003", source: summon, scaleWithPlayer: false, vfxTier:summonTier });
        if (summon.type === "crane") shoot(summon.x, summon.y, target, { kind: "summon-crane", color: summon.color, damage: summon.damage * power, speed: 540, range: summon.range, r: 6, pierce: 1, retention: .82, fxId: "FX_003", source: summon, scaleWithPlayer: false, vfxTier:summonTier });
        if (state.growthConfig.flags.resonance_line && target.elite && !summon.lockedElite) { summon.lockedElite = true; beam(player.x, player.y, summon.x, summon.y, "#d6b66b", "FX_003", null, 2); }
        summon.attack = summon.cooldown / speedBoost;
      }
      for (const enemy of state.enemies) if (!enemy.dead && dist(summon, enemy) < summon.r + enemy.r) {
        enemy._summonContact ||= {}; const key = `${summon.type}-${summon.index}`;
        if ((enemy._summonContact[key] || 0) <= state.time) { enemy._summonContact[key] = state.time + .8; summon.hp -= enemy.damage * (summon.type === "dog" ? .45 : .7); if (summon.hp <= 0) defeatSummon(summon); }
      }
    });
    for (const echo of cs.echoes) {
      echo.life -= dt; echo.attack -= dt;
      if (echo.attack <= 0) { const target = nearest(echo.x, echo.y, 480); if (target) shoot(echo.x, echo.y, target, { kind:"summon-echo", color:"#66707a", damage:echo.damage, speed:460, range:480, r:5, fxId:"FX_005", source:{type:"echo"}, scaleWithPlayer:false, vfxTier:2 }); echo.attack = .8; }
    }
    cs.echoes = cs.echoes.filter(echo => echo.life > 0);
  }
  function updateChihen(dt) {
    const cs = state.characterState, player = state.player, skills = state.character.skills;
    cs.bloodClaw -= dt; cs.fateDash -= dt;
    if (cs.bloodClaw <= 0 && nearest(player.x, player.y, 230)) {
      damageArea({ x: player.x, y: player.y, r: skills.bloodClaw.radius * player.size, damage: skills.bloodClaw.damage * player.damageMul, kind: "chihen-claw", source: { type: "character", id: "chihen" } });
      state.particles.push({ kind: "claw", fxId: "FX_007", x: player.x, y: player.y, r: skills.bloodClaw.radius * player.size, color: "#b8422f", life: .42, max: .42 }); cs.bloodClaw = skills.bloodClaw.cooldown / player.attackSpeed;
    }
    const target = nearest(player.x, player.y, 560);
    if (cs.fateDash <= 0 && target) {
      const startX = player.x, startY = player.y, angle = Math.atan2(target.y - player.y, target.x - player.x), travel = Math.min(skills.fateDash.range, Math.max(60, dist(player, target) - 35));
      player.x = clamp(player.x + Math.cos(angle) * travel, 60, WORLD_W - 60); player.y = clamp(player.y + Math.sin(angle) * travel, 60, WORLD_H - 60); player.facing = Math.cos(angle) < 0 ? -1 : 1; player.invuln = Math.max(player.invuln, .24);
      beam(startX, startY, player.x, player.y, "#b8422f", "FX_007"); damageArea({ x: player.x, y: player.y, r: 92 * player.size, damage: skills.fateDash.damage * player.damageMul, kind: "chihen-dash", source: { type: "character", id: "chihen" }, knockback: 42 });
      cs.fateDash = skills.fateDash.cooldown / player.attackSpeed;
    }
  }
  function reviveChihen() {
    const cs = state.characterState, player = state.player, mechanics = state.character.mechanics;
    if (state.character.key !== "chihen" || cs.livesRemaining <= 0) return false;
    cs.livesRemaining--; cs.revivesUsed++; cs.shieldCharges += mechanics.reviveShieldCharges || 1;
    const retention = state.growthConfig.revive.retention || mechanics.reviveMaxHpMultiplier;
    const immortalPenalty = state.growthConfig.breakthrough === "BREAK_NINE_A" ? .9 : 1, reviveDamage = 1 + (mechanics.reviveDamageMultiplier - 1) * immortalPenalty, reviveHaste = 1 + (mechanics.reviveAttackSpeedMultiplier - 1) * immortalPenalty;
    player.base.maxHp = Math.max(8, player.base.maxHp * retention); player.runtime.damage *= reviveDamage; player.runtime.attackSpeed *= reviveHaste; player.runtime.crit += mechanics.reviveCritBonus * immortalPenalty;
    if (state.growthConfig.flags.revive_afterfire) cs.afterfireUntil = state.time + state.growthConfig.flags.revive_afterfire.duration;
    if (state.growthConfig.flags.post_revive_death_guard) { cs.deathGuardUntil = state.time + state.growthConfig.flags.post_revive_death_guard.duration + (player.growthCards.CARD_NINE_UNYIELDING ? 1 : 0); cs.deathGuardReady = true; }
    if (state.growthConfig.flags.revive_random_mark) {
      const mark = pick(["damage","attackSpeed","crit"]); if (cs.marks[mark] < 2) cs.marks[mark]++;
      const markBoost = player.growthCards.CARD_NINE_DEATHMARK ? 1.25 : 1;
      if (mark === "damage") player.runtime.damage *= 1 + .08 * markBoost; if (mark === "attackSpeed") player.runtime.attackSpeed *= 1 + .08 * markBoost; if (mark === "crit") player.runtime.crit += .05 * markBoost;
    }
    if (state.growthConfig.breakthrough === "BREAK_NINE_B") { player.runtime.damage *= 1.12; player.runtime.attackSpeed *= 1.08; player.runtime.crit += .04; }
    recalculatePlayerStats(); player.hp = player.maxHp; player.invuln = 1.5; state.flash = .28; state.shake = 14;
    burst(player.x, player.y, "#b8422f", 18, 95, "FX_007"); toast(`九命复生 · 余命 ${cs.livesRemaining} · 墨环护命`, 2400); return true;
  }
  function updateCharacterAbilities(dt) {
    if (state.character.key === "chihen") updateChihen(dt);
    if (state.character.key === "qingyan") updateQingyan(dt);
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
    const player = state.player, pool = [], weaponCount = Object.keys(player.weapons).length, deviceCount = Object.keys(player.devices).length, summonCount = Object.keys(player.summonLevels || {}).length;
    const slotRules = state.slotRules || state.character?.slot_rules || CHARACTER.slot_rules;
    Object.entries(WEAPONS).forEach(([id, data]) => { const level = player.weapons[id] || 0; if (level < data.max && (level > 0 || weaponCount < slotRules.weapon)) pool.push({ type: "weapon", id, level: level + 1, ...data }); });
    Object.entries(PASSIVES).forEach(([id, data]) => { const level = player.passives[id] || 0; if (level < data.max) pool.push({ type: "passive", id, level: level + 1, ...data }); });
    Object.entries(DEVICES).forEach(([id, data]) => { const level = player.devices[id] || 0; if (level < data.max && (level > 0 || deviceCount < slotRules.device)) pool.push({ type: "device", id, level: level + 1, ...data }); });
    if (state.character.key === "qingyan" && state.challengeId !== "summoner_no_summon") Object.entries(SUMMONS).forEach(([id, data]) => { const level = player.summonLevels[id] || 0; if (level < data.max && (level > 0 || summonCount < slotRules.summon)) pool.push({ type:"summon", id, level:level + 1, desc:`${data.name}成长：提高伤害、生命与攻击表现。Lv.3 进入进阶墨相，Lv.5 显现真灵。`, tags:`召唤 · ${data.role.join("+")}`, ...data }); });
    Object.values(GROWTH_CARDS || {}).forEach(card => {
      const current = player.growthCards[card.id] || 0, max = card.unique ? 1 : 3;
      if (card.character_id !== state.character.id || !hasGrowthNode(card.node_id) || current >= max) return;
      const alive = state.summons.filter(summon => !summon.dead), roles = new Set(alive.flatMap(summon => SUMMONS[summon.type].role));
      const eligible = card.condition === "always" || card.condition === "weapon_lv4" && Object.entries(player.weapons).some(([,level]) => level >= 4) || card.condition === "revived" && state.characterState.revivesUsed > 0 || card.condition === "has_summon" && state.summons.length > 0 || card.condition === "formation" && ["output","tank","support","control"].every(role => roles.has(role));
      if (eligible) pool.push({ ...card, type:"growthcard", level:current + 1, max, desc:card.description, tags:"角色专属 · 技能树解锁" });
    });
    return pool;
  }
  function chooseUpgrades() {
    const pool = upgradePool(), choices = [];
    const newPowers = pool.filter(item => item.type === "weapon" ? !state.player.weapons[item.id] : item.type === "device" ? !state.player.devices[item.id] : item.type === "summon" ? !state.player.summonLevels[item.id] : false);
    if (newPowers.length) choices.push(pick(newPowers));
    while (choices.length < 3 && pool.length) {
      const options = pool.filter(item => !choices.some(choice => choice.type === item.type && choice.id === item.id));
      if (!options.length) break;
      choices.push(pick(options));
    }
    return choices.map(item => ({ ...item, rarity: item.rarity || rarity() }));
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
    if (choice.type === "weapon") setWeaponLevel(choice.id, choice.level, { fromUpgrade:true, rarity:choice.rarity });
    if (choice.type === "device") setDeviceLevel(choice.id, choice.level);
    if (choice.type === "summon") setSummonLevel(choice.id, choice.level);
    if (choice.type === "growthcard") applyGrowthCard(choice);
    if (choice.type === "passive") setPassiveLevel(choice.id, choice.level, (state.player.passiveWeights[choice.id] || 0) + factor, choice.id === "health");
    ui.upgrade.classList.add("hidden");
    if (state.pendingLevels > 0) { state.pendingLevels--; setTimeout(() => openUpgrade(false), 120); }
    else { state.mode = "playing"; state.started = true; last = performance.now(); }
  }
  function applyGrowthCard(choice) {
    const player = state.player; player.growthCards[choice.id] = (player.growthCards[choice.id] || 0) + 1;
    if (choice.id === "CARD_BAL_MASTERY") {
      const candidates = Object.keys(player.weapons).filter(id => player.weapons[id] >= 4); if (candidates.length) { const id = pick(candidates), entry = player.weaponMinor[id] ||= {damage:0,range:0,speed:0,cd:0}; entry.damage += .08; toast(`熟能生巧 · ${WEAPONS[id].name} 伤害 +8%`,1600); }
    }
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
    const speed = options.speed ?? 430;
    state.projectiles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: (options.r || 7) * (options.scaleWithPlayer === false ? 1 : state.player.size),
      damage: options.damage ?? 12, life: options.life ?? ((options.range || speed * 2) / Math.max(1, speed)), color: options.color || "#356f69", pierce: options.pierce || 0,
      bounces: options.bounces || 0, kind: options.kind || "fishbone", hit: new Set(), retention: options.retention ?? 1,
      weaponId: options.weaponId || null, fxId: options.fxId || "FX_001", explodeRadius: options.explodeRadius || 0, childBlasts: options.childBlasts || 0, childDamage: options.childDamage || 0, basePierce: options.pierce || 0,
      returnRange: options.returnRange || 0, returnDamage: options.returnDamage ?? 1, originX: x, originY: y, speed, source: options.source || null, vfxTier: options.vfxTier || (options.weaponId ? weaponVfxTier(options.weaponId) : 1)
    });
  }
  function shoot(x, y, target, options = {}) {
    if (!target) return;
    const angle = Math.atan2(target.y - y, target.x - x);
    shootAngle(x, y, angle, options); sound("shoot");
  }
  function weaponStats(id, level) {
    const data = WEAPONS[id], source = data?.levels?.[clamp(level | 0, 1, data.max)]; if (!source) return null;
    const stats = { ...source }, mastery = state.player.weaponMastery?.[id], minor = state.player.weaponMinor?.[id] || {};
    if (mastery?.kind === "damage" && stats.damage) stats.damage *= 1 + mastery.value;
    if (mastery?.kind === "cd" && stats.cd) stats.cd *= 1 - mastery.value;
    if (mastery?.kind === "range" && stats.range) stats.range *= 1 + mastery.value;
    if (stats.damage && minor.damage) stats.damage *= 1 + minor.damage;
    if (stats.cd && minor.cd) stats.cd *= 1 - minor.cd;
    if (stats.range && minor.range) stats.range *= 1 + minor.range;
    if (stats.speed && minor.speed) stats.speed *= 1 + minor.speed;
    if (state.growthConfig?.breakthrough === "BREAK_BAL_B" && Object.keys(state.player.weapons).length <= 2 && stats.cd) stats.cd *= .92;
    return stats;
  }
  function weaponVfxTier(id) {
    const level = state.player?.weapons?.[id] || 1; let tier = level >= 7 ? 3 : level >= 3 ? 2 : 1;
    if (state.growthConfig?.vfx?.weapon && level >= state.growthConfig.vfx.weapon.level) tier = Math.max(tier, state.growthConfig.vfx.weapon.tier);
    if (state.character?.key === "chihen" && state.growthConfig?.flags?.revive_vfx_tier) tier += state.characterState.revivesUsed;
    if (state.growthConfig?.breakthrough === "BREAK_NINE_B" && state.characterState.livesRemaining === 0) tier = 3;
    return clamp(tier, 1, 3);
  }
  function summonVfxTier(summon) {
    let tier = summon.level >= 5 ? 3 : summon.level >= 3 ? 2 : 1;
    if (state.growthConfig?.vfx?.summon && summon.level >= state.growthConfig.vfx.summon.level) tier = Math.max(tier, state.growthConfig.vfx.summon.tier);
    if (state.growthConfig?.breakthrough === "BREAK_SUM_B" && summon.level >= 5) tier = 3;
    return clamp(tier, 1, 3);
  }
  function heldWeaponTagCount() { return new Set(Object.keys(state.player.weapons).map(id => WEAPONS[id]?.logicTags?.[0]).filter(Boolean)).size; }
  function growthAttackSpeedMultiplier() {
    let multiplier = 1; const flags = state.growthConfig?.flags || {}, count = heldWeaponTagCount(), cs = state.characterState;
    if (flags.weapon_tag_resonance && count >= 3) multiplier *= 1.05;
    if (cs.switchStanceUntil > state.time) multiplier *= 1.18;
    if (state.character.key === "chihen" && cs.afterfireUntil > state.time) multiplier *= 1.30;
    if (state.growthConfig?.breakthrough === "BREAK_BAL_B" && Object.keys(state.player.weapons).length <= 2) multiplier *= 1.08;
    return multiplier;
  }
  function growthWeaponDamageMultiplier() {
    let multiplier = 1; const flags = state.growthConfig?.flags || {}, count = heldWeaponTagCount();
    if (flags.weapon_tag_resonance && count >= 2) multiplier *= 1.04;
    if (state.growthConfig?.breakthrough === "BREAK_BAL_A") multiplier *= 1 + Math.min(4, count) * .03;
    if (state.growthConfig?.breakthrough === "BREAK_BAL_B" && Object.keys(state.player.weapons).length <= 2) multiplier *= 1.18;
    return multiplier;
  }
  function spreadAngle(index, count, degrees = 0) { return count <= 1 ? 0 : (index / (count - 1) - .5) * degrees * Math.PI / 180; }
  function queuePulse(kind, stats, index, weaponId, color) {
    state.weaponPulses.push({ kind, delay: index * (stats.waveGap || stats.hitGap || 0), x: state.player.x, y: state.player.y, r: stats.range * state.player.size, damage: stats.damage * state.player.damageMul, knockback: stats.knockback || (kind === "claw" ? 38 : 0), slow: stats.slow || 0, color, weaponId, fxId: WEAPONS[weaponId]?.fx_id || "FX_001", vfxTier:weaponVfxTier(weaponId) });
  }
  function createPlayerZone(kind, stats, weaponId, index = 0) {
    const target = nearest(state.player.x, state.player.y, 620), base = target || state.player, angle = index * TAU / Math.max(1, stats.count || 1) + rand(-.3, .3), offset = index ? 48 : 0;
    const zone = { kind, weaponId, fxId: WEAPONS[weaponId]?.fx_id || "FX_005", vfxTier:weaponVfxTier(weaponId), x: clamp(base.x + Math.cos(angle) * offset, 50, WORLD_W - 50), y: clamp(base.y + Math.sin(angle) * offset, 50, WORLD_H - 50), r: stats.range * state.player.size, life: stats.duration, duration: stats.duration, tick: stats.tick || .5, nextTick: 0, damage: stats.damage * state.player.damageMul, slow: stats.slow || 0, endBlast: stats.endBlast || 0 };
    state.playerZones.push(zone);
    const same = state.playerZones.filter(item => item.kind === kind);
    while (same.length > (stats.maxZones || stats.count || 1)) { const oldest = same.shift(); state.playerZones.splice(state.playerZones.indexOf(oldest), 1); }
  }
  function attackProjectile(id, data, stats) {
    const player = state.player, target = nearest(player.x, player.y, stats.range); if (!target) return false;
    const aim = Math.atan2(target.y - player.y, target.x - player.x);
    for (let index = 0; index < stats.count; index++) shootAngle(player.x, player.y, aim + spreadAngle(index, stats.count, stats.spread), { kind: "fishbone", damage: stats.damage * player.damageMul, speed: stats.speed, range: stats.range, r: 7, pierce: stats.pierce, retention: stats.retention, weaponId: data.id, fxId: data.fx_id });
    return true;
  }
  function attackBounce(id, data, stats) {
    const player = state.player, target = nearest(player.x, player.y, stats.range); if (!target) return false;
    const aim = Math.atan2(target.y - player.y, target.x - player.x);
    for (let index = 0; index < stats.count; index++) shootAngle(player.x, player.y, aim + spreadAngle(index, stats.count, stats.spread), { kind: "leaf", color: "#547a58", damage: stats.damage * player.damageMul, speed: stats.speed, range: stats.range, r: 6, bounces: stats.bounce, retention: stats.retention, weaponId: data.id, fxId: data.fx_id });
    return true;
  }
  function attackMelee(id, data, stats) { for (let index = 0; index < stats.count; index++) queuePulse("claw", stats, index, data.id, "#b8422f"); return true; }
  function attackBeam(id, data, stats) {
    const used = new Set(); let previous = state.player;
    for (let index = 0; index < stats.count; index++) {
      const target = nearest(previous.x, previous.y, index ? 260 : stats.range, enemy => !used.has(enemy)); if (!target) break;
      used.add(target); hitEnemy(target, stats.damage * state.player.damageMul, "bell", data.id); beam(previous.x, previous.y, target.x, target.y, "#ad853d", data.fx_id, data.id); previous = target;
    }
    return used.size > 0;
  }
  function attackBlast(id, data, stats) {
    const player = state.player, target = nearest(player.x, player.y, stats.range); if (!target) return false;
    const aim = Math.atan2(target.y - player.y, target.x - player.x);
    for (let index = 0; index < stats.count; index++) shootAngle(player.x, player.y, aim + spreadAngle(index, stats.count, stats.spread), { kind: "inkball", color: "#252823", damage: stats.damage * player.damageMul, speed: stats.speed, range: stats.range, r: 10, explodeRadius: stats.radius * player.size, childBlasts: stats.childBlasts, childDamage: stats.childDamage, weaponId: data.id, fxId: data.fx_id });
    return true;
  }
  function attackZone(id, data, stats) { for (let index = 0; index < stats.count; index++) createPlayerZone(data.behavior === "dot" ? "mist" : "sigil", stats, data.id, index); return true; }
  function attackWave(id, data, stats) { for (let index = 0; index < stats.count; index++) queuePulse(data.behavior === "roar" ? "roar" : "wave", stats, index, data.id, data.behavior === "roar" ? "#2b2e2a" : "#4f928f"); return true; }
  function attackChain(id, data, stats) {
    let target = nearest(state.player.x, state.player.y, stats.range), previous = state.player, damage = stats.damage * state.player.damageMul; const used = new Set();
    for (let index = 0; index < stats.chains && target; index++) {
      used.add(target); hitEnemy(target, damage, "chain", data.id); beam(previous.x, previous.y, target.x, target.y, "#9cbfc2", data.fx_id, data.id); previous = target; damage *= stats.retention;
      if (stats.forkChance && Math.random() < stats.forkChance) { const fork = nearest(previous.x, previous.y, 190, enemy => !used.has(enemy)); if (fork) { used.add(fork); hitEnemy(fork, damage * stats.forkDamage, "chain", data.id); beam(previous.x, previous.y, fork.x, fork.y, "#d8e8df", data.fx_id, data.id); } }
      target = nearest(previous.x, previous.y, 220, enemy => !used.has(enemy));
    }
    return used.size > 0;
  }
  function attackReturn(id, data, stats) {
    const player = state.player, target = nearest(player.x, player.y, stats.range); if (!target) return false;
    const aim = Math.atan2(target.y - player.y, target.x - player.x);
    for (let index = 0; index < stats.count; index++) shootAngle(player.x, player.y, aim + spreadAngle(index, stats.count, stats.spread), { kind: "returnblade", color: "#356f69", damage: stats.damage * player.damageMul, speed: stats.speed, life: 6, r: 8, pierce: stats.pierce, returnRange: stats.range, returnDamage: stats.returnDamage, weaponId: data.id, fxId: data.fx_id });
    return true;
  }
  function updateOrbitWeapon(id, data, stats) {
    const player = state.player, time = state.time * stats.rotSpeed * Math.PI / 180, count = stats.count;
    for (let index = 0; index < count; index++) {
      const outer = stats.dualOrbit && index % 2 === 1, radius = stats.range * player.size * (outer ? 1.38 : 1), angle = time * (outer ? -.82 : 1) + index / count * TAU, blade = { x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius, angle, outer, weaponId: data.id, vfxTier:weaponVfxTier(data.id) };
      state.orbiters.push(blade);
      forEachEnemy(enemy => {
        if (dist(blade, enemy) >= enemy.r + 12) return;
        enemy._orbitHits ||= {}; const hitKey = `${data.id}:${index}`;
        if ((enemy._orbitHits[hitKey] || 0) > state.time) return;
        enemy._orbitHits[hitKey] = state.time + Math.max(.18, .38 / player.attackSpeed); hitEnemy(enemy, stats.damage * player.damageMul * (outer ? .55 : 1), "orbit", data.id);
      });
    }
  }
  const WEAPON_BEHAVIORS = { projectile: attackProjectile, bounce: attackBounce, melee: attackMelee, beam: attackBeam, blast: attackBlast, dot: attackZone, sigil: attackZone, knockback: attackWave, roar: attackWave, chain: attackChain, return: attackReturn };

  function attack(dt) {
    const player = state.player, attackSpeed = player.attackSpeed * growthAttackSpeedMultiplier(); state.orbiters = [];
    Object.keys(state.timers).forEach(key => state.timers[key] -= dt);
    Object.entries(player.weapons).forEach(([id, level]) => {
      const data = WEAPONS[id], stats = weaponStats(id, level); if (!data || !stats) return;
      if (data.behavior === "orbit") { updateOrbitWeapon(id, data, stats); return; }
      if (state.timers[id] > 0) return;
      const fired = WEAPON_BEHAVIORS[data.behavior]?.(id, data, stats);
      state.timers[id] = Math.max(.08, stats.cd / attackSpeed);
      if (fired) sound("shoot");
    });
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
  function beam(x1, y1, x2, y2, color, fxId = "FX_003", weaponId = null, vfxTier = null) { state.particles.push({ kind: "beam", fxId, weaponId, vfxTier:vfxTier || (weaponId ? weaponVfxTier(weaponId) : 1), visual: fxMeta(fxId).visual, x: x1, y: y1, x2, y2, color, life: .14, max: .14 }); }
  function burst(x, y, color, count = 10, radius = 55, fxId = "FX_002") {
    count = Math.min(count, fxMeta(fxId).maxParticles || count);
    for (let index = 0; index < count; index++) {
      const angle = index / count * TAU + rand(-.15, .15);
      state.particles.push({ kind: "dot", fxId, visual: fxMeta(fxId).visual, x, y, vx: Math.cos(angle) * rand(radius, radius * 2), vy: Math.sin(angle) * rand(radius, radius * 2), r: rand(2, 5), color, life: .35, max: .35 });
    }
  }
  function pushFrom(entity, source, amount) {
    const angle = Math.atan2(entity.y - source.y, entity.x - source.x);
    entity.x = clamp(entity.x + Math.cos(angle) * amount, entity.r || 20, WORLD_W - (entity.r || 20));
    entity.y = clamp(entity.y + Math.sin(angle) * amount, entity.r || 20, WORLD_H - (entity.r || 20));
  }

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
      const distance = dist(enemy, player), angle = Math.atan2(player.y - enemy.y, player.x - enemy.x), moveScale = (enemy._slowUntil || 0) > state.time ? Math.max(.45, 1 - (enemy._slowAmount || .2)) : 1;
      if (enemy.ranged && distance < 310) {
        enemy.x -= Math.cos(angle) * enemy.speed * moveScale * dt * .42; enemy.y -= Math.sin(angle) * enemy.speed * moveScale * dt * .42; enemy.shot -= dt;
        if (enemy.shot <= 0) { enemyShot(enemy.x, enemy.y, angle, enemy.type === "frog" ? "glob" : "sting", enemy.damage); enemy.shot = enemy.type === "frog" ? 2.7 : 2.1; }
      } else { enemy.x += Math.cos(angle) * enemy.speed * moveScale * dt; enemy.y += Math.sin(angle) * enemy.speed * moveScale * dt; }
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
  function hitEnemy(enemy, raw, kind, weaponId = null, source = null) {
    if (!enemy || enemy.dead) return;
    const cs = state.characterState, summonSource = Boolean(SUMMONS[source?.type]);
    if (weaponId && !summonSource) raw *= growthWeaponDamageMultiplier();
    if (weaponId && state.growthConfig.flags.distance_charge && cs.stepEdgeCharged) { raw *= state.growthConfig.flags.distance_charge.multiplier; cs.stepEdgeCharged = false; state.player.movedDistance = 0; burst(enemy.x, enemy.y, "#4f928f", 10, 48, "FX_001"); }
    const forcedCrit = !summonSource && cs.forcedCritUntil > state.time;
    const growthCrit = state.growthConfig.flags.weapon_tag_resonance && heldWeaponTagCount() >= 4 ? .04 : 0;
    const summonCrit = summonSource && state.player.growthCards.CARD_SUM_FORMATION ? .08 : 0;
    const critical = summonSource ? Math.random() < summonCrit : forcedCrit || Math.random() < state.player.crit + growthCrit, damage = raw * (critical ? 1.85 : 1);
    if (forcedCrit) cs.forcedCritUntil = 0;
    enemy.hp -= damage; state.damage += damage; recordDamage(damage); state.highHit = Math.max(state.highHit, damage);
    enemy.lastHitSource = source || null;
    if (weaponId) state.weaponDamage[weaponId] = (state.weaponDamage[weaponId] || 0) + damage;
    textPop(enemy.x, enemy.y - enemy.r, Math.round(damage), critical ? "#d39b35" : "#f8f1e3", critical ? 18 : 12);
    if (kind === "bell" && Math.random() < .25) enemy.slow = .35;
    if (enemy.hp <= 0) killEnemy(enemy, source || enemy.lastHitSource);
  }
  function killEnemy(enemy, source = null) {
    enemy.deathX = clamp(enemy.x, enemy.r || 20, WORLD_W - (enemy.r || 20));
    enemy.deathY = clamp(enemy.y, enemy.r || 20, WORLD_H - (enemy.r || 20));
    enemy.dead = true; enemy.death = .3; state.kills++; if (enemy.elite) state.elites++;
    if (source?.type && SUMMONS[source.type] && state.character.key === "qingyan") onSummonKill();
    if (enemy === state.boss) {
      state.coins += 80; burst(enemy.x, enemy.y, "#ad853d", 44, 150); toast("泼墨狸将收笔认输！", 2800); ui.bossHud.classList.add("hidden");
      if (!state.dev) setTimeout(() => endGame(true), 2200);
      return;
    }
    const count = enemy.elite ? 4 : 1;
    for (let index = 0; index < count; index++) state.pickups.push({ kind: "xp", x: enemy.x + rand(-12, 12), y: enemy.y + rand(-12, 12), value: enemy.xp / count, r: enemy.elite ? 8 : 5 });
    if (Math.random() < (enemy.elite ? .75 : .08)) state.pickups.push({ kind: "coin", x: enemy.x, y: enemy.y, value: enemy.elite ? 18 : pick([1, 2, 3]), r: 7 });
    if (Math.random() < .012) state.pickups.push({ kind: "heart", x: enemy.x, y: enemy.y, value: 14, r: 9 });
    burst(enemy.x, enemy.y, enemy.elite ? "#b8422f" : "#2a2d29", enemy.elite ? 18 : 7, enemy.elite ? 80 : 36, enemy.death_fx || "FX_006");
  }
  function hurtPlayer(raw, sourceX, sourceY) {
    const player = state.player;
    if (state.invincible || player.invuln > 0 || state.mode !== "playing") return;
    const cs = state.characterState;
    if (state.character.key === "chihen" && cs.shieldCharges > 0) {
      cs.shieldCharges--; player.invuln = .45; burst(player.x, player.y, "#b8422f", 9, 48, "FX_007"); textPop(player.x, player.y - 34, "墨环挡伤", "#f0c6aa", 15);
      if (state.growthConfig.flags.shield_break_burst) {
        const primaryId = Object.keys(player.weapons)[0], baseDamage = weaponStats(primaryId, player.weapons[primaryId])?.damage || 20, cardLevel = player.growthCards.CARD_NINE_SHIELD_BURST || 0, radius = state.growthConfig.flags.shield_break_burst.radius * (1 + .25 * cardLevel), cardDamage = 1 + .4 * cardLevel;
        damageArea({ x:player.x, y:player.y, r:radius, damage:baseDamage * state.growthConfig.flags.shield_break_burst.damage * cardDamage * player.damageMul, kind:"shield-break", knockback:110, source:{type:"character",id:"chihen"} });
        state.particles.push({ kind:"claw", fxId:"FX_007", x:player.x, y:player.y, r:radius, color:"#b8422f", life:.48, max:.48, vfxTier:Math.min(3,2 + cs.revivesUsed) });
      }
      if (state.growthConfig.flags.shield_break_next_crit) cs.forcedCritUntil = state.time + state.growthConfig.flags.shield_break_next_crit.duration;
      return;
    }
    const wardReduction = state.character.key === "qingyan" && cs.wardUntil > state.time ? .35 : 0;
    const damage = Math.max(1, raw * (1 - player.armor) * (1 - wardReduction));
    player.hp -= damage; player.invuln = .62; state.taken += damage; state.shake = 8; state.flash = .15; sound("hurt");
    textPop(player.x, player.y - 30, `-${Math.round(damage)}`, "#d44f42", 17); pushFrom(player, { x: sourceX, y: sourceY }, 20);
    if (player.hp <= 0 && state.character.key === "chihen" && cs.deathGuardReady && cs.deathGuardUntil > state.time) { player.hp = 1; cs.deathGuardReady = false; player.invuln = .6; burst(player.x, player.y, "#b8422f", 12, 66, "FX_007"); textPop(player.x, player.y - 34, "不屈残火", "#f0c6aa", 16); return; }
    if (player.hp <= 0 && !reviveChihen()) endGame(false);
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

  function damageArea(effect) {
    let hits = 0;
    forEachEnemy(enemy => {
      if (dist(effect, enemy) >= effect.r + enemy.r) return;
      hits++; hitEnemy(enemy, effect.damage, effect.kind, effect.weaponId, effect.source || null);
      if (effect.knockback) pushFrom(enemy, effect, effect.knockback * (enemy === state.boss ? .22 : 1));
      if (effect.slow) { enemy._slowUntil = Math.max(enemy._slowUntil || 0, state.time + .8); enemy._slowAmount = Math.max(enemy._slowAmount || 0, effect.slow); }
    });
    return hits;
  }
  function explodeProjectile(projectile) {
    if (projectile.exploded) return; projectile.exploded = true;
    damageArea({ x: projectile.x, y: projectile.y, r: projectile.explodeRadius, damage: projectile.damage, kind: "inkblast", weaponId: projectile.weaponId });
    burst(projectile.x, projectile.y, "#252823", 14, Math.min(100, projectile.explodeRadius * .6), projectile.fxId || "FX_002");
    for (let index = 0; index < projectile.childBlasts; index++) {
      const angle = index / projectile.childBlasts * TAU + rand(-.2, .2), radius = projectile.explodeRadius * .58, x = projectile.x + Math.cos(angle) * radius, y = projectile.y + Math.sin(angle) * radius;
      damageArea({ x, y, r: projectile.explodeRadius * .46, damage: projectile.damage * projectile.childDamage, kind: "inkblast", weaponId: projectile.weaponId }); burst(x, y, "#6a5146", 7, 40, projectile.fxId || "FX_002");
    }
  }
  function updatePlayerWeaponEffects(dt) {
    for (const pulse of state.weaponPulses) {
      pulse.delay -= dt;
      if (pulse.delay > 0 || pulse.fired) continue; pulse.fired = true;
      damageArea(pulse); state.particles.push({ kind: "claw", fxId: pulse.fxId, weaponId: pulse.weaponId, vfxTier:pulse.vfxTier, visualKind: pulse.kind, visual: fxMeta(pulse.fxId).visual, x: pulse.x, y: pulse.y, r: pulse.r, color: pulse.color, life: .36, max: .36 });
    }
    state.weaponPulses = state.weaponPulses.filter(pulse => !pulse.fired);
    for (const zone of state.playerZones) {
      zone.life -= dt; zone.nextTick -= dt;
      if (zone.nextTick <= 0 && zone.life > 0) { zone.nextTick += zone.tick; damageArea(zone); }
      if (zone.life <= 0 && zone.endBlast && !zone.ended) { zone.ended = true; damageArea({ ...zone, r: zone.r * .72, damage: zone.damage * (zone.duration / zone.tick) * zone.endBlast, kind: "sigilburst" }); burst(zone.x, zone.y, "#b8422f", 12, 65, zone.fxId || "FX_005"); }
    }
    state.playerZones = state.playerZones.filter(zone => zone.life > 0);
  }

  function updateProjectiles(dt) {
    for (const projectile of state.projectiles) {
      if (projectile.returnRange) {
        const traveled = Math.hypot(projectile.x - projectile.originX, projectile.y - projectile.originY);
        if (!projectile.returning && traveled >= projectile.returnRange) { projectile.returning = true; projectile.hit.clear(); projectile.pierce = projectile.basePierce; projectile.damage *= projectile.returnDamage; }
        if (projectile.returning) { const angle = Math.atan2(state.player.y - projectile.y, state.player.x - projectile.x); projectile.vx = Math.cos(angle) * projectile.speed; projectile.vy = Math.sin(angle) * projectile.speed; if (dist(projectile, state.player) < state.player.r + 12) projectile.life = 0; }
      }
      projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
      forEachEnemy(enemy => {
        if (projectile.life <= 0 || projectile.hit.has(enemy) || dist(projectile, enemy) >= projectile.r + enemy.r) return;
        if (projectile.returnRange && projectile.pierce < 0) return;
        projectile.hit.add(enemy);
        if (projectile.explodeRadius) { explodeProjectile(projectile); projectile.life = 0; return; }
        hitEnemy(enemy, projectile.damage, projectile.kind, projectile.weaponId, projectile.source || null);
        if (projectile.bounces > 0) {
          projectile.bounces--;
          const next = nearest(enemy.x, enemy.y, 220, candidate => !projectile.hit.has(candidate));
          if (next) { const angle = Math.atan2(next.y - enemy.y, next.x - enemy.x), speed = Math.hypot(projectile.vx, projectile.vy); projectile.x = enemy.x; projectile.y = enemy.y; projectile.vx = Math.cos(angle) * speed; projectile.vy = Math.sin(angle) * speed; }
          else projectile.life = 0;
          projectile.damage *= projectile.retention;
        } else if (projectile.returnRange) { projectile.pierce--; projectile.damage *= projectile.retention; }
        else if (projectile.pierce > 0) { projectile.pierce--; projectile.damage *= projectile.retention; } else projectile.life = 0;
      });
      if (projectile.life <= 0 && projectile.explodeRadius) explodeProjectile(projectile);
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
    if (choice.type === "weapon") setWeaponLevel(choice.id, choice.level, { fromUpgrade:true, rarity:choice.rarity || "common" });
    if (choice.type === "device") setDeviceLevel(choice.id, choice.level);
    if (choice.type === "summon") setSummonLevel(choice.id, choice.level);
    if (choice.type === "growthcard") applyGrowthCard(choice);
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
    if (player.moving) {
      x /= Math.max(1, length); y /= Math.max(1, length);
      const oldX = player.x, oldY = player.y;
      // Keep the full 84px hero sprite inside the ink-court border as well as the
      // smaller physics circle. This also prevents camera-edge oscillation.
      const edgeInset = Math.max(60, player.r);
      player.x = clamp(player.x + x * player.speed * dt, edgeInset, WORLD_W - edgeInset); player.y = clamp(player.y + y * player.speed * dt, edgeInset, WORLD_H - edgeInset);
      player.movedDistance += Math.hypot(player.x - oldX, player.y - oldY); player.facing = x < 0 ? -1 : x > 0 ? 1 : player.facing || 1;
      if (state.growthConfig.flags.distance_charge && player.movedDistance >= state.growthConfig.flags.distance_charge.distance) state.characterState.stepEdgeCharged = true;
    }
    player.invuln = Math.max(0, player.invuln - dt);
  }
  function phase() { const progress = state.time / state.duration; if (state.bossSpawned) return "最终决战"; if (progress < .25) return "快速成型"; if (progress < .62) return "中压构筑"; return "高压怪潮"; }
  function update(dt) {
    if (state.mode !== "playing" || (state.dev && state.devLabOpen && state.devRunPaused)) return;
    state.time += dt;
    movePlayer(dt); attack(dt); updateCharacterAbilities(dt); updatePlayerWeaponEffects(dt); spawnTick(dt); updateEnemies(dt); updateBoss(dt); updateProjectiles(dt); updatePickups(dt); if (!state.dev) schedules(); updateFx(dt);
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
    const cs = state.characterState;
    if (state.character.key === "chihen") { ui.mechanic.className = "character-mechanic chihen"; ui.mechanic.innerHTML = `<b>九命 ${cs.livesRemaining}</b><span>墨环 ${cs.shieldCharges}</span><small>复生 ${cs.revivesUsed} 次 · 攻势随死亡提升</small>`; }
    else if (state.character.key === "qingyan") { const alive = state.summons.filter(summon => !summon.dead).length, empowered = Math.max(0, cs.empowerUntil - state.time); ui.mechanic.className = `character-mechanic qingyan${empowered > 0 ? " empowered" : ""}`; ui.mechanic.style.setProperty("--energy", `${cs.energy / cs.energyMax * 100}%`); ui.mechanic.innerHTML = `<b>伙伴 ${alive}/${state.summons.length}</b><span>墨能 ${Math.floor(cs.energy)}/${cs.energyMax}</span><small>${empowered > 0 ? `共鸣 ${empowered.toFixed(1)}s` : cs.deathLinkUntil > state.time ? "阵亡联动强化" : cs.wardUntil > state.time ? "砚光护阵展开" : "召唤独立成长"}</small>`; }
    else { ui.mechanic.className = "character-mechanic hidden"; ui.mechanic.textContent = ""; }
  }
  function updateDock() {
    if (!state.player) return;
    ui.dock.innerHTML = "";
    Object.entries(state.player.weapons).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${WEAPONS[id].name}">${WEAPONS[id].icon}<small>${level}</small></div>`));
    Object.entries(state.player.devices).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${DEVICES[id].name}">${DEVICES[id].icon}<small>${level}</small></div>`));
    state.summons?.forEach(summon => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot summon-slot vfx-tier-${summonVfxTier(summon)}${summon.dead ? " is-dead" : ""}" title="${summon.name}">${summon.icon}<small>${summon.dead ? "归" : summon.level}</small></div>`));
  }
  function buildSummary() {
    const items = [];
    Object.entries(state.player.weapons).forEach(([id, level]) => items.push([`${WEAPONS[id].icon} ${WEAPONS[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.devices).forEach(([id, level]) => items.push([`${DEVICES[id].icon} ${DEVICES[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.passives).forEach(([id, level]) => items.push([`${PASSIVES[id].icon} ${PASSIVES[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.summonLevels || {}).forEach(([id, level]) => items.push([`${SUMMONS[id].icon} ${SUMMONS[id].name}`, `Lv.${level}`]));
    Object.entries(state.player.growthCards || {}).forEach(([id, level]) => GROWTH_CARDS[id] && items.push([`${GROWTH_CARDS[id].icon} ${GROWTH_CARDS[id].name}`, `印.${level}`]));
    return items;
  }
  function pause() { if (state.mode !== "playing") return; state.mode = "paused"; ui.build.innerHTML = buildSummary().map(item => `<div class="build-item"><b>${item[0]}</b>${item[1]}</div>`).join("") || "尚未获得额外强化"; ui.pause.classList.remove("hidden"); }
  function resume() { if (state.mode !== "paused") return; ui.pause.classList.add("hidden"); state.mode = "playing"; last = performance.now(); }
  function endGame(win) {
    if (state.mode === "result") return;
    state.mode = "result"; state.won = win; ui.hud.classList.add("hidden"); ui.joystick.classList.add("hidden"); ui.pause.classList.add("hidden");
    const survived = Math.min(state.time, state.duration), reward = Math.floor(state.coins * (win ? 1 : .45) + state.kills * .08 + (win ? 80 : 0));
    let challengeCompleted = "";
    if (!state.dev) {
      profile.best = Math.max(profile.best, Math.floor(survived)); profile.coins += reward; if (win) profile.wins++;
      const challengeNode = growthNodesFor(state.character).find(node => node.node_type === "CHALLENGE" && hasGrowthNode(node.node_id));
      if (win && challengeNode && state.challengeId === challengeNode.challenge_id && growth.challenges[challengeNode.challenge_id] !== "complete") {
        const passed = state.character.key === "moxiaobai" ? Object.keys(state.player.weapons).length <= 1 : state.character.key === "chihen" ? state.characterState.livesRemaining === 0 : state.character.key === "qingyan" ? state.summons.length === 0 : false;
        if (passed) { growth.challenges[challengeNode.challenge_id] = "complete"; saveGrowth(); challengeCompleted = ` · 已完成${state.character.name}专属挑战`; }
      }
      saveProfile();
    }
    $("resultBadge").textContent = win ? "胜" : "止"; $("resultKicker").textContent = win ? "墨战落幕" : "本次试炼结束"; $("resultTitle").textContent = win ? "旧庭重归宁静" : "这一笔尚未写完";
    $("resultLine").textContent = state.dev ? "DEV 测试数据未写入正式存档。" : win ? `最后一笔落下，群墨归纸。${challengeCompleted}` : "保留经验，重新整备再入庭院。";
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
    const rawCameraX = state.player ? state.cam.x : WORLD_W / 2, rawCameraY = state.player ? state.cam.y : WORLD_H / 2;
    const cameraX = viewW >= WORLD_W ? WORLD_W / 2 : clamp(rawCameraX, viewW / 2, WORLD_W - viewW / 2);
    const cameraY = viewH >= WORLD_H ? WORLD_H / 2 : clamp(rawCameraY, viewH / 2, WORLD_H - viewH / 2);
    world.style.transform = `translate3d(${viewW / 2 - cameraX + shakeX}px,${viewH / 2 - cameraY + shakeY}px,0)`;
    damageFlash.style.opacity = String(Math.min(.75, state.flash * 4));
    if (!state.player) return;

    const playerId = "player"; active.add(playerId);
    const activeCharacter = state.character || CHARACTER;
    const cs = state.characterState;
    const characterVfxTier = activeCharacter.key === "chihen" && state.growthConfig.flags.revive_vfx_tier ? clamp(1 + cs.revivesUsed,1,3) : 1;
    const playerNode = ensureNode(playerId, `entity player character-${activeCharacter.key} vfx-tier-${characterVfxTier}${state.player.moving ? " moving" : ""}${state.player.invuln > 0 ? " invulnerable" : ""}${activeCharacter.key === "chihen" && cs.shieldCharges ? " shielded" : ""}`, imageMarkup(combatResource(activeCharacter)));
    playerNode.style.setProperty("--facing", state.player.facing || 1); playerNode.style.setProperty("--revive-stacks", cs.revivesUsed || 0); place(playerNode, state.player.x, state.player.y);

    if (activeCharacter.key === "qingyan" && cs.wardUntil > state.time) {
      const id = "qingyan-ward"; active.add(id); const ward = ensureNode(id, "qingyan-ward"); place(ward, state.player.x, state.player.y);
    }
    for (const summon of state.summons || []) if (!summon.dead) {
      const id = objectId(summon, "summon"); active.add(id); const empowered = cs.empowerUntil > state.time || cs.deathLinkUntil > state.time || summon.buffUntil > state.time, tier = summonVfxTier(summon);
      const node = ensureNode(id, `summon summon-${summon.type} vfx-tier-${tier}${empowered ? " empowered" : ""}`, `${imageMarkup(summon, summon.name)}<i></i>`); node.title = `${summon.name} Lv.${summon.level} ${Math.ceil(summon.hp)}/${Math.ceil(summon.maxHp)}`; node.style.setProperty("--summon-hp", `${clamp(summon.hp / summon.maxHp * 100, 0, 100)}%`); place(node, summon.x, summon.y, tier === 3 ? 1.08 : 1);
    }
    for (const echo of cs.echoes || []) {
      const id = objectId(echo,"summon-echo"); active.add(id); const art = SUMMONS[echo.type]; const node = ensureNode(id, `summon summon-${echo.type} summon-echo vfx-tier-2`, imageMarkup(art, "余魂墨影")); node.style.opacity = String(clamp(echo.life / echo.max * .58,0,.58)); place(node,echo.x,echo.y,.92);
    }

    for (const enemy of state.enemies) {
      const id = objectId(enemy, "enemy"); active.add(id);
      const size = Math.max(48, enemy.r * (enemy.elite ? 4.6 : 4.1));
      const node = ensureNode(id, `entity enemy ${enemy.art_variant || ""}${enemy.elite ? " elite" : ""}${enemy.dead ? " dying" : ""}`, imageMarkup(enemy));
      node.style.width = `${size}px`; node.style.height = `${size}px`;
      place(node, enemy.dead ? enemy.deathX : enemy.x, enemy.dead ? enemy.deathY : enemy.y + Math.sin(enemy.phase) * 2);
    }
    if (state.boss && !state.boss.dead) {
      const id = "boss"; active.add(id);
      const node = ensureNode(id, `entity boss phase-${state.boss.phase}`, imageMarkup(BOSS));
      place(node, state.boss.x, state.boss.y);
    }
    for (const projectile of state.projectiles) {
      const id = objectId(projectile, "projectile"); active.add(id);
      const angle = Math.atan2(projectile.vy, projectile.vx), node = ensureNode(id, `projectile ${projectile.kind} ${fxClass(projectile.fxId)} ${weaponClass(projectile.weaponId)} vfx-tier-${projectile.vfxTier || 1}`);
      node.style.width = `${Math.max(12, projectile.r * 2.8)}px`; node.style.height = `${Math.max(8, projectile.r * 1.35)}px`; node.style.color = projectile.color || fxMeta(projectile.fxId).color; node.style.setProperty("--projectile-color", projectile.color || fxMeta(projectile.fxId).color); place(node, projectile.x, projectile.y, 1, angle);
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
    for (const zone of state.playerZones) {
      const id = objectId(zone, "player-zone"); active.add(id); const node = ensureNode(id, `player-zone ${zone.kind} ${fxClass(zone.fxId)} ${weaponClass(zone.weaponId)} vfx-tier-${zone.vfxTier || 1}`);
      node.style.width = `${zone.r * 2}px`; node.style.height = `${zone.r * 2}px`; node.style.opacity = String(clamp(zone.life / Math.min(.45, zone.duration), 0, 1)); place(node, zone.x, zone.y);
    }
    state.orbiters.forEach((blade, index) => {
      const id = `orbiter-${index}`; active.add(id); const node = ensureNode(id, `orbit-blade ${weaponClass(blade.weaponId)} vfx-tier-${blade.vfxTier || 1}`); place(node, blade.x, blade.y, blade.outer ? .86 : 1, blade.angle + Math.PI / 2);
    });
    for (const particle of state.particles) {
      const id = objectId(particle, "particle"); active.add(id);
      if (particle.kind === "beam") {
        const length = Math.hypot(particle.x2 - particle.x, particle.y2 - particle.y), angle = Math.atan2(particle.y2 - particle.y, particle.x2 - particle.x), node = ensureNode(id, `ink-beam ${fxClass(particle.fxId)} ${weaponClass(particle.weaponId)} vfx-tier-${particle.vfxTier || 1}`);
        node.style.width = `${length}px`; node.style.color = particle.color; node.style.opacity = String(particle.life / particle.max); node.style.transform = `translate3d(${particle.x}px,${particle.y}px,0) rotate(${angle}rad)`;
      } else if (particle.kind === "claw") {
        const node = ensureNode(id, `claw-wave pulse-${particle.visualKind || "ink"} ${fxClass(particle.fxId)} ${weaponClass(particle.weaponId)} vfx-tier-${particle.vfxTier || 1}`); node.style.width = `${particle.r * 2}px`; node.style.height = `${particle.r * 2}px`; node.style.setProperty("--pulse-color", particle.color); place(node, particle.x, particle.y);
      } else {
        const node = ensureNode(id, `ink-burst ${fxClass(particle.fxId)} ${weaponClass(particle.weaponId)}`); node.style.width = `${particle.r * 2}px`; node.style.height = `${particle.r * 2}px`; node.style.color = particle.color; node.style.opacity = String(particle.life / particle.max); place(node, particle.x, particle.y);
      }
    }
    for (const text of state.texts) {
      const id = objectId(text, "text"); active.add(id); const node = ensureNode(id, "float-text", `<span>${text.text}</span>`); node.style.color = text.color; node.style.fontSize = `${text.size}px`; node.style.opacity = String(text.life / text.max); place(node, text.x, text.y);
    }
    for (const [id, node] of nodes) if (!active.has(id)) { node.remove(); nodes.delete(id); }
  }

  function clearNormalEnemies() { state.enemies = state.enemies.filter(enemy => enemy.elite); }
  function clearAllEnemies() { state.enemies = []; state.enemyShots = []; state.hazards = []; state.boss = null; state.bossSpawned = false; ui.bossHud.classList.add("hidden"); }
  function clearBattlefield() { clearAllEnemies(); state.projectiles = []; state.pickups = []; state.particles = []; state.texts = []; state.playerZones = []; state.weaponPulses = []; state.orbiters = []; state.devices = []; syncTurretDevice(); }
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
  function resetDevPlayer() { if (!state.dev) return; const x = state.player.x, y = state.player.y, character = state.character || CHARACTER; state.growthConfig = compileGrowthConfig(character); state.slotRules = { ...character.slot_rules, weapon:character.slot_rules.weapon + (state.growthConfig.slots.weapon || 0), device:character.slot_rules.device + (state.growthConfig.slots.device || 0), summon:character.slot_rules.summon + (state.growthConfig.slots.summon || 0) }; state.player = createPlayer(character, true, state.growthConfig); state.player.x = x; state.player.y = y; state.devices = []; initializeCharacterRun(); recalculatePlayerStats(); updateDock(); updateHud(); }
  function applyPreset(name) {
    const levels = { early: 3, mid: 10, late: 18, boss: 22, max: 35, stress: 60 }, progress = { early: .1, mid: .4, late: .75, boss: .84, max: .75, stress: .75 };
    clearBattlefield(); resetDevPlayer(); state.time = (progress[name] || .1) * state.duration;
    state.timers = { ...Object.fromEntries(Object.keys(WEAPONS).map(id => [id, 0])), trap: 2, turret: 0 };
    setPlayerLevel(levels[name] || 1);
    const giveWeapons = entries => Object.entries(entries).forEach(([id, level]) => setWeaponLevel(id, level));
    if (name === "early") { giveWeapons({ yarn: 2 }); spawnMixed(8); }
    if (name === "mid") { giveWeapons({ yarn: 3, fish: 3, paw: 2, ink: 2 }); setPassiveLevel("power", 1); setPassiveLevel("haste", 1); setDeviceLevel("turret", 1); spawnMixed(30); }
    if (name === "late") { giveWeapons({ yarn: 5, fish: 5, paw: 4, laser: 5, ink: 4, fan: 3, mist: 3, wave: 3 }); setPassiveLevel("power", 3); setPassiveLevel("haste", 2); setPassiveLevel("health", 2); setDeviceLevel("turret", 3); setDeviceLevel("trap", 2); spawnMixed(60); }
    if (name === "boss") { giveWeapons({ yarn: 5, fish: 4, paw: 4, laser: 5, ink: 5, fan: 4, wave: 4, chain: 4 }); setPassiveLevel("power", 3); setPassiveLevel("haste", 3); setPassiveLevel("health", 2); setPassiveLevel("armor", 2); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, DEVICES[id].max)); spawnBoss(); }
    if (["max", "stress"].includes(name)) { Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, WEAPONS[id].max)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, PASSIVES[id].max)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, DEVICES[id].max)); }
    if (name === "max") spawnMixed(30);
    if (name === "stress") { state.player.base.maxHp = 1000; state.player.base.damageMul = 3; recalculatePlayerStats(); spawnMixed(150); }
    healFull(); updateDock(); updateHud(); toast(`PRESET: ${name.toUpperCase()}`);
  }
  function getBuildSnapshot() {
    const player = state.player;
    return { version: 4, character: state.character.key, base: { ...player.base }, hp: player.hp, level: player.level, xp: player.xp, weapons: { ...player.weapons }, passives: { ...player.passives }, passiveWeights: { ...player.passiveWeights }, devices: { ...player.devices }, summonLevels: { ...player.summonLevels }, growthCards: { ...player.growthCards }, coins: state.coins, rerolls: state.rerolls };
  }
  function loadBuildSnapshot(data) {
    if (!data || typeof data !== "object") throw new Error("Build 必须是 JSON 对象");
    if (data.character && CHARACTERS[data.character]) { state.character = CHARACTERS[data.character]; homeCharacterKey = data.character; }
    resetDevPlayer(); const player = state.player; $("hudHeroName").textContent = state.character.name; setArtImage($("hudHeroImage"), portraitResource(state.character), state.character.name);
    if (data.base && typeof data.base === "object") for (const key of ["maxHp", "speed", "damageMul", "attackSpeed", "crit", "size", "armor", "pickup"]) if (Number.isFinite(Number(data.base[key]))) player.base[key] = Number(data.base[key]);
    setPlayerLevel(data.level || 1); player.xp = clamp(Number(data.xp) || 0, 0, player.nextXp - 1);
    Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, Number(data.weapons?.[id]) || 0)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, Number(data.passives?.[id]) || 0, Number(data.passiveWeights?.[id]) || Number(data.passives?.[id]) || 0)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, Number(data.devices?.[id]) || 0)); Object.keys(SUMMONS).forEach(id => setSummonLevel(id, Number(data.summonLevels?.[id]) || 0)); player.growthCards = Object.fromEntries(Object.entries(data.growthCards || {}).filter(([id,value]) => GROWTH_CARDS[id] && Number(value) > 0).map(([id,value]) => [id,Math.max(1,Math.round(Number(value)))]));
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
    getConfig: () => ({ WEAPONS, PASSIVES, DEVICES, SUMMONS, SKILL_TREE, GROWTH_CARDS, ENEMY_TYPES, CHARACTERS, INK_FX }), getState: () => state
  };

  function loop(now) {
    const rawDt = Math.min(.05, (now - last) / 1000); last = now;
    if (state.player) state.fps = lerp(state.fps || 1, 1 / Math.max(.001, rawDt), .08);
    update(rawDt * (state.simSpeed || 1)); renderScene(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  $("startButton").onclick = () => { if ((CHARACTERS[homeCharacterKey] || CHARACTER).status !== "ready") return; sound("coin"); resetGame(false); };
  $("devStartButton").onclick = () => { sound("coin"); resetGame(true); };
  $("howButton").onclick = () => ui.how.classList.remove("hidden");
  $("characterButton").onclick = () => { renderCharacterChoices(); $("characterPanel").classList.remove("hidden"); };
  $("growthButton").onclick = () => openGrowthPanel(homeCharacterKey); $("weaponButton").onclick = () => showInfo("weapons"); $("settingsButton").onclick = () => showInfo("settings"); $("saveButton").onclick = () => showInfo("save");
  $("growthReset").onclick = resetGrowthTree;
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $(button.dataset.close).classList.add("hidden"));
  $("rerollButton").onclick = () => { if (state.rerolls <= 0 && !state.infiniteRerolls) return; if (!state.infiniteRerolls) state.rerolls--; ui.rerolls.textContent = state.rerolls; renderUpgradeChoices(); };
  $("leaveShop").onclick = closeShop;
  document.querySelectorAll("[data-event]").forEach(button => button.onclick = () => resolveEvent(button.dataset.event));
  $("pauseButton").onclick = pause; $("resumeButton").onclick = resume; $("quitButton").onclick = () => endGame(false);
  $("againButton").onclick = () => resetGame(Boolean(state.dev));
  $("menuButton").onclick = () => { state = { mode: "menu" }; clearWorldNodes(); ui.result.classList.add("hidden"); ui.menu.classList.remove("hidden"); renderHomeCharacter(homeCharacterKey); window.dispatchEvent(new CustomEvent("meow-dev-ended")); };
  addEventListener("keydown", event => { keys.add(event.code); if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault(); if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat) { if (state.mode === "playing") pause(); else if (state.mode === "paused") resume(); } });
  addEventListener("keyup", event => keys.delete(event.code));
  ui.joystick.addEventListener("pointerdown", event => { joy.active = true; joy.id = event.pointerId; ui.joystick.setPointerCapture(event.pointerId); moveJoy(event); });
  ui.joystick.addEventListener("pointermove", event => { if (joy.active && event.pointerId === joy.id) moveJoy(event); });
  ui.joystick.addEventListener("pointerup", endJoy); ui.joystick.addEventListener("pointercancel", endJoy);
  function moveJoy(event) { const rect = ui.joystick.getBoundingClientRect(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2, dx = event.clientX - centerX, dy = event.clientY - centerY, length = Math.hypot(dx, dy), amount = Math.min(1, length / 43); joy.x = length ? dx / length * amount : 0; joy.y = length ? dy / length * amount : 0; ui.joystick.firstElementChild.style.transform = `translate(${joy.x * 34}px,${joy.y * 34}px)`; }
  function endJoy() { joy.active = false; joy.x = joy.y = 0; ui.joystick.firstElementChild.style.transform = ""; }

  window.__MEOW_GAME__ = { getState: () => state, start: resetGame, end: (win = true) => endGame(win), dev: devApi, data: { WEAPONS, PASSIVES, DEVICES, SUMMONS, SKILL_TREE, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, LEGACY_ASSET_MAP, INK_FX }, growth: { getState:()=>growth, hasNode:hasGrowthNode, compile:compileGrowthConfig, open:openGrowthPanel } };
  if (new URLSearchParams(location.search).get("dev") === "1") resetGame(true);
})();
