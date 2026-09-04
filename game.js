(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const { WEAPONS, PASSIVES, DEVICES, SUMMONS, QINGYAN_SUMMON_CATALOG, SKILL_TREE, SKILL_TREE_NODES, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, CHARACTER_ANIMATIONS, CHARACTER_COMBAT_KITS, LEGACY_ASSET_MAP, INK_FX, ASSET_MANIFEST, VFX_LIBRARY, SCENE_LAYERS, RUN_TIMELINE } = window.MEOW_DATA;
  const world = $("world");
  const sceneLayers = $("sceneLayers");
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
  const combatKitFor = character => CHARACTER_COMBAT_KITS?.[character?.key] || CHARACTER_COMBAT_KITS?.moxiaobai;
  const fxClass = id => `fx-${fxMeta(id).visual}`;
  const weaponClass = id => id ? `weapon-${String(id).toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  function assetEntry(resource) {
    const assetId = resource?.asset_id;
    if (!assetId) return null;
    const [kind, id] = assetId.split(".");
    const group = kind === "character" ? "characters" : kind === "enemy" ? "enemies" : kind === "boss" ? "bosses" : kind;
    return ASSET_MANIFEST?.[group]?.[id] || null;
  }
  function spriteResource(resource) {
    const entry = assetEntry(resource), sprite = entry?.sprite || {};
    return { art:sprite.art || resource?.art || "", fallback_art:sprite.fallback_art || resource?.fallback_art || resource?.legacy_art || "" };
  }
  const imageMarkup = (resource, alt = "") => { const sprite=spriteResource(resource); return `<img src="${sprite.art}" data-fallback="${sprite.fallback_art}" alt="${alt}" draggable="false">`; };
  const portraitResource = character => ({ art: character.portrait_art || character.art, fallback_art: character.portrait_fallback_art || character.fallback_art });
  const combatResource = character => ({ art: character.combat_art || character.art, fallback_art: character.combat_fallback_art || character.fallback_art });
  const animationConfigFor = character => CHARACTER_ANIMATIONS?.[character?.animation_key || ""] || null;
  const characterFrameStatus = new Map();
  function setArtImage(image, resource, alt = "") {
    if (!image || !resource) return;
    image.alt = alt; image.dataset.fallback = resource.fallback_art || resource.legacy_art || ""; image.dataset.fallbackUsed = ""; image.src = resource.art;
  }
  document.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.fallback || image.dataset.fallbackUsed === "1") return;
    image.dataset.fallbackUsed = "1"; image.src = image.dataset.fallback;
  }, true);

  function preloadCharacterAnimations() {
    for (const config of Object.values(CHARACTER_ANIMATIONS || {})) {
      for (const stateName of ["move", "attack", "hit", "death"]) for (const frames of Object.values(config.states?.[stateName] || {})) for (const source of frames) {
          if (characterFrameStatus.has(source)) continue;
          characterFrameStatus.set(source, "pending");
          const image = new Image();
          image.onload = () => characterFrameStatus.set(source, "loaded");
          image.onerror = () => characterFrameStatus.set(source, "missing");
          image.src = source;
        }
    }
    for (const group of [ASSET_MANIFEST?.characters, ASSET_MANIFEST?.enemies, ASSET_MANIFEST?.bosses]) for (const config of Object.values(group || {})) {
      for (const stateFrames of Object.values(config.animations || {})) for (const frames of Object.values(stateFrames || {})) for (const source of Array.isArray(frames) ? frames : []) {
        if (characterFrameStatus.has(source)) continue;
        characterFrameStatus.set(source, "pending");
        const image = new Image(); image.onload = () => characterFrameStatus.set(source, "loaded"); image.onerror = () => characterFrameStatus.set(source, "missing"); image.src = source;
      }
    }
  }
  preloadCharacterAnimations();

  function initializeSceneLayers() {
    if (!sceneLayers || !SCENE_LAYERS) return;
    sceneLayers.replaceChildren();
    for (const layerName of ["ground","obstacle","decoration","landmark","environment_overlay"]) {
      const layer=document.createElement("div"); layer.className=`scene-layer scene-layer-${layerName.replace("_","-")}`; layer.dataset.layer=layerName;
      for (const item of SCENE_LAYERS[layerName] || []) {
        const image=document.createElement("img"); image.alt=""; image.dataset.assetId=item.id; image.dataset.fallback=item.fallback_art||""; image.dataset.fallbackUsed=""; image.src=item.art;
        image.style.setProperty("--scene-x",`${(item.x ?? .5)*100}%`); image.style.setProperty("--scene-y",`${(item.y ?? .5)*100}%`); image.style.setProperty("--scene-scale",item.scale ?? 1); image.style.opacity=String(item.opacity ?? 1);
        image.addEventListener("error",()=>{ if(image.dataset.fallback && image.dataset.fallbackUsed!=="1"){image.dataset.fallbackUsed="1";image.src=image.dataset.fallback;}else image.classList.add("asset-missing"); });
        layer.appendChild(image);
      }
      sceneLayers.appendChild(layer);
    }
  }
  initializeSceneLayers();

  function createCharacterAnimation(character) {
    return { state: "idle", direction: "down", frame: 0, elapsed: 0, speed: 1, available: Boolean(animationConfigFor(character)) };
  }

  const CHARACTER_ANIMATION_PRIORITY = { idle: 0, move: 0, attack: 1, hit: 2, death: 3 };
  const characterFramesFor = (config, stateName, direction) => config?.states?.[stateName]?.[direction] || [];
  function triggerCharacterAnimation(player, stateName, { force = false, restart = false, target = null } = {}) {
    const config = animationConfigFor(state.character || CHARACTER), animation = player?.animation;
    if (!config || !animation || !characterFramesFor(config, stateName, animation.direction).length) return false;
    const currentPriority = CHARACTER_ANIMATION_PRIORITY[animation.state] || 0, nextPriority = CHARACTER_ANIMATION_PRIORITY[stateName] || 0;
    if (!force && (nextPriority < currentPriority || (animation.state === stateName && !restart))) return false;
    if (target && Number.isFinite(target.x) && Number.isFinite(target.y)) {
      animation.direction = resolveMoveDirection(target.x - player.x, target.y - player.y, animation.direction);
      player.facing = animation.direction === "left" ? -1 : animation.direction === "right" ? 1 : player.facing || 1;
    }
    animation.state = stateName; animation.frame = 0; animation.elapsed = 0;
    return true;
  }

  function characterAnimationDuration(character, stateName) {
    const config = animationConfigFor(character), frames = characterFramesFor(config, stateName, "down"), fps = config?.stateFps?.[stateName] || config?.fps || 11;
    return frames.length ? frames.length / fps : 0;
  }

  function resolveMoveDirection(x, y, current = "down") {
    const ax = Math.abs(x), ay = Math.abs(y), horizontal = current === "left" || current === "right";
    if (horizontal && ax * 1.25 >= ay && ax > .01) return x < 0 ? "left" : "right";
    if (!horizontal && ay * 1.25 >= ax && ay > .01) return y < 0 ? "up" : "down";
    return ax > ay ? (x < 0 ? "left" : "right") : (y < 0 ? "up" : "down");
  }

  function updatePlayerAnimation(player, dt, x, y) {
    const config = animationConfigFor(state.character || CHARACTER), animation = player.animation ||= createCharacterAnimation(state.character || CHARACTER);
    if (!config) return;
    if (["attack", "hit", "death"].includes(animation.state)) {
      const frames = characterFramesFor(config, animation.state, animation.direction), frameTime = 1 / (config.stateFps?.[animation.state] || config.fps || 11);
      animation.elapsed += dt * (animation.speed || 1);
      while (animation.elapsed >= frameTime && frames.length) {
        animation.elapsed -= frameTime;
        if (animation.frame < frames.length - 1) animation.frame++;
        else if (animation.state !== "death") { animation.state = player.moving ? "move" : "idle"; animation.frame = 0; animation.elapsed = 0; break; }
        else { animation.frame = frames.length - 1; animation.elapsed = 0; break; }
      }
      return;
    }
    if (!player.moving) { animation.state = "idle"; animation.frame = 0; animation.elapsed = 0; return; }
    const direction = resolveMoveDirection(x, y, animation.direction);
    if (animation.state !== "move" || animation.direction !== direction) { animation.state = "move"; animation.direction = direction; animation.frame = 0; animation.elapsed = 0; }
    animation.elapsed += dt * (animation.speed || 1);
    const frameTime = 1 / (config.stateFps?.move || config.fps || 11), frames = config.states.move[animation.direction] || [];
    while (animation.elapsed >= frameTime && frames.length) { animation.elapsed -= frameTime; animation.frame = (animation.frame + 1) % frames.length; }
  }

  function currentCharacterFrame(character, player) {
    const config = animationConfigFor(character), animation = player.animation;
    if (!config || !animation) return combatResource(character);
    const stateFrames = characterFramesFor(config, animation.state, animation.direction), moveFrames = characterFramesFor(config, "move", animation.direction).length ? characterFramesFor(config, "move", animation.direction) : config.states.move.down || [];
    const frames = stateFrames.length ? stateFrames : moveFrames;
    const index = animation.state === "idle" ? (config.states.idle?.[animation.direction] || 0) : animation.frame % Math.max(1, frames.length);
    let art = frames[index] || frames[0];
    if (characterFrameStatus.get(art) === "missing") art = frames.find(source => characterFrameStatus.get(source) === "loaded") || moveFrames.find(source => characterFrameStatus.get(source) === "loaded") || combatResource(character).art;
    return { art, fallback_art: combatResource(character).art || combatResource(character).fallback_art };
  }

  const configuredFrames = (resource, stateName, direction) => {
    const frames=assetEntry(resource)?.animations?.[stateName]?.[direction];
    return Array.isArray(frames) ? frames : [];
  };
  function createConfiguredAnimation(resource) {
    const entry=assetEntry(resource);
    return entry ? { state:"move", direction:"down", frame:0, elapsed:0 } : null;
  }
  function triggerConfiguredAnimation(entity, stateName) {
    if (!entity?.animation || !configuredFrames(entity,stateName,entity.animation.direction).length) return false;
    entity.animation.state=stateName; entity.animation.frame=0; entity.animation.elapsed=0; return true;
  }
  function configuredAnimationDuration(resource,stateName){const entry=assetEntry(resource),frames=configuredFrames(resource,stateName,"down");return frames.length/Math.max(1,entry?.stateFps?.[stateName]||entry?.fps||8);}
  function updateConfiguredAnimation(entity, dt, dx=0, dy=0) {
    const animation=entity?.animation, entry=assetEntry(entity); if(!animation||!entry)return;
    const locked=["attack","hit","death"].includes(animation.state), direction=resolveMoveDirection(dx,dy,animation.direction);
    if(!locked&&Math.hypot(dx,dy)>.01){animation.state="move";animation.direction=direction;}
    let frames=configuredFrames(entity,animation.state,animation.direction);
    if(!frames.length){animation.state="move";frames=configuredFrames(entity,"move",animation.direction);}
    if(!frames.length)return;
    const fps=entry.stateFps?.[animation.state]||entry.fps||8; animation.elapsed+=dt;
    while(animation.elapsed>=1/fps){animation.elapsed-=1/fps;animation.frame++;
      if(animation.frame>=frames.length){if(locked&&animation.state!=="death"){animation.state="move";animation.frame=0;}else animation.frame=animation.state==="death"?frames.length-1:0;}
    }
  }
  function configuredFrameResource(resource) {
    const entry=assetEntry(resource), animation=resource?.animation; if(!entry||!animation)return spriteResource(resource);
    const frames=configuredFrames(resource,animation.state,animation.direction), source=frames[animation.frame]||frames[0];
    if(!source||characterFrameStatus.get(source)==="missing")return spriteResource(resource);
    return {art:source,fallback_art:entry.sprite?.art||entry.sprite?.fallback_art||resource.fallback_art||""};
  }

  function updateCharacterSprite(node, character, player) {
    const image = node.querySelector("img");
    if (!image) return;
    const resource = currentCharacterFrame(character, player);
    if (!resource.art || image.dataset.frameSource === resource.art) return;
    image.dataset.frameSource = resource.art;
    setArtImage(image, resource, character.name);
  }

  const ui = {
    menu: $("menu"), how: $("howPanel"), upgrade: $("upgradePanel"), shop: $("shopPanel"), event: $("eventPanel"),
    pause: $("pausePanel"), result: $("resultPanel"), hud: $("hud"), joystick: $("joystick"),
    healthBar: $("healthBar"), healthText: $("healthText"), xpBar: $("xpBar"), levelText: $("levelText"),
    timerText: $("timerText"), phaseLabel: $("phaseLabel"), coinText: $("coinText"), bossHud: $("bossHud"),
    bossBar: $("bossBar"), bossName: $("bossName"), toast: $("objectiveToast"), dock: $("weaponDock"),
    choices: $("upgradeChoices"), rerolls: $("rerollCount"), shopChoices: $("shopChoices"), shopCoins: $("shopCoins"), build: $("buildSummary"), mechanic: $("characterMechanic"), skills: $("activeSkillBar")
  };

  const profile = (() => {
    try { return { coins: 0, best: 0, wins: 0, ...JSON.parse(localStorage.getItem("meowGardenProfile") || "{}") }; }
    catch { return { coins: 0, best: 0, wins: 0 }; }
  })();
  const saveProfile = () => { localStorage.setItem("meowGardenProfile", JSON.stringify(profile)); syncProfile(); };
  const syncProfile = () => { $("profileCoins").textContent = profile.coins; $("bestTime").textContent = fmt(profile.best); };
  syncProfile();

  const GROWTH_KEY = "meowGardenGrowth.v3";
  const growth = (() => {
    try {
      const current = JSON.parse(localStorage.getItem(GROWTH_KEY) || "null"), legacy = JSON.parse(localStorage.getItem("meowGardenGrowth.v2") || "{}");
      const saved = current || legacy, isLegacy = !current;
      const unlocked = isLegacy ? {} : { ...(saved.unlocked || {}) };
      const migratedPoints = isLegacy ? Math.max(10, Object.keys(saved.unlocked || {}).length) : 10;
      return { version:3, sp:migratedPoints, unlocked, preferences:{ qingyan:["mouse","rabbit"] }, ...saved, version:3, sp:Number.isFinite(saved.sp)?saved.sp:migratedPoints, unlocked, preferences:{ qingyan:["mouse","rabbit"], ...(saved.preferences || {}) } };
    } catch { return { version:3, sp:10, unlocked:{}, preferences:{ qingyan:["mouse","rabbit"] } }; }
  })();
  const saveGrowth = () => localStorage.setItem(GROWTH_KEY, JSON.stringify(growth));
  const growthNodesFor = character => SKILL_TREE?.[character.id] || [];
  const hasGrowthNode = nodeId => Boolean(growth.unlocked[nodeId]);
  const growthSpent = character => growthNodesFor(character).reduce((sum, node) => sum + (hasGrowthNode(node.node_id) ? node.sp_cost : 0), 0);
  function compileGrowthConfig(character) {
    const config = { stats: {}, slots: {}, flags: {}, vfx: {}, revive: { lives: 0 }, summons: { damage: 1, hp: 1, energy: 1, respawn: 1, respawnAttackSpeed: 0, respawnBuffDuration: 0, unlocked:new Set(["mouse","rabbit","guardian"]), starCap:1 }, startSummons: [] };
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
      if (effect.op === "add_trigger_effect") {
        if (effect.trigger === "unlock_summon") config.summons.unlocked.add(effect.id);
        else if (effect.trigger === "summon_star_cap") config.summons.starCap = Math.max(config.summons.starCap,effect.value);
        else config.flags[effect.trigger] = { ...effect, nodeId: node.node_id };
      }
      if (effect.op === "modify_revive") { if (effect.lives) config.revive.lives += effect.lives; if (effect.retention) config.revive.retention = effect.retention; }
      if (effect.op === "modify_summon_respawn") { config.summons.respawn *= effect.multiplier; config.summons.respawnAttackSpeed = effect.attackSpeed; config.summons.respawnBuffDuration = effect.duration; }
      if (effect.op === "set_min_vfx_tier") config.vfx[effect.target] = { level: effect.level || 1, tier: effect.tier };
      if (effect.op === "start_with_summon") config.startSummons.push({ id: effect.id, level: effect.level || 1 });
    }));
    config.summons.unlocked = [...config.summons.unlocked];
    config.preferences = growth.preferences?.qingyan || ["mouse","rabbit"];
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
    start.disabled = !ready; start.classList.toggle("locked-home", !ready); start.querySelector("b").textContent = ready ? "开始冒险" : `${character.name}开发中`; start.querySelector("small").textContent = ready ? "踏入墨韵旧庭 · 十五分钟试炼" : "请在角色卷中选择喵小白出战";
  }
  function renderCharacterChoices() {
    $("characterChoices").innerHTML = Object.values(CHARACTERS).map(character => `<button class="character-choice ${character.palette} ${character.status !== "ready" ? "is-development" : ""}" data-character="${character.key}"><span class="character-choice-art">${imageMarkup(portraitResource(character), character.name)}</span><span class="character-choice-copy"><small>${character.status_text}</small><b>${character.name}</b><em>${character.role}</em><p>${character.summary}</p><span>${character.traits.join(" · ")}</span></span></button>`).join("");
    $("characterChoices").querySelectorAll("[data-character]").forEach(button => button.onclick = () => { renderHomeCharacter(button.dataset.character); $("characterPanel").classList.add("hidden"); });
  }
  function showInfo(type) {
    const titles = { growth: ["成长", "成长树兼容接口"], weapons: ["武器 / Build", "十二道水墨兵势"], settings: ["设置", "游戏设置"], save: ["存档", "庭院行迹"] };
    const [kicker, title] = titles[type] || ["庭院卷册", "功能信息"]; $("infoKicker").textContent = kicker; $("infoTitle").textContent = title;
    if (type === "weapons") $("infoBody").innerHTML = `<div class="weapon-catalog">${Object.values(WEAPONS).map(weapon => `<article><span>${weapon.icon}</span><div><b>${weapon.name}</b><small>${weapon.tags}</small><p>${weapon.desc}</p></div></article>`).join("")}</div>`;
    else if (type === "growth") $("infoBody").innerHTML = `<div class="paper-message"><b>三角色技能树已开放</b><p>使用修行点解锁基础、专属武器、主动技能、大招与万灵图录节点；正式局结算会获得修行点。</p></div>`;
    else if (type === "settings") $("infoBody").innerHTML = `<div class="paper-message"><b>基础设置</b><p>电脑使用 WASD / 方向键移动，P 或 Esc 暂停；手机使用左下摇杆。动画会遵循系统“减少动态效果”设置。</p><p>当前 Demo 为单机离线版本，不包含账号、联网大厅或商城。</p></div>`;
    else $("infoBody").innerHTML = `<div class="save-info"><div><small>累计铜钱</small><b>${profile.coins}</b></div><div><small>最高存活</small><b>${fmt(profile.best)}</b></div><div><small>通关次数</small><b>${profile.wins}</b></div></div><p class="panel-note">正式进度保存在当前浏览器的 localStorage；DEV 测试数据不会写入正式记录。</p>`;
    $("infoPanel").classList.remove("hidden");
  }
  const nodeTypeLabel = type => ({ BASE:"基础", WEAPON:"武器", SKILL:"主动", CORE:"核心", SUMMON:"图录", DEVICE:"装置", ULTIMATE:"大招" }[type] || type);
  let growthCharacterKey = "moxiaobai";
  let growthBranch = "";
  let selectedGrowthNodeId = "";
  let growthBranchOpen = false;
  function openGrowthPanel(characterKey = homeCharacterKey) {
    growthCharacterKey = CHARACTERS[characterKey] ? characterKey : "moxiaobai";
    growthBranchOpen = false;
    renderGrowthPanel(); $("growthPanel").classList.remove("hidden");
  }
  function closeGrowthBranch(){growthBranchOpen=false;$("growthBranchWindow").classList.add("hidden");}
  function growthNodeAvailable(node, character) {
    if (!node.prerequisites.every(hasGrowthNode)) return false;
    if (node.require_count && node.require_count.ids.filter(hasGrowthNode).length < node.require_count.count) return false;
    if (node.exclusive_group && growthNodesFor(character).some(other => other.node_id !== node.node_id && other.exclusive_group === node.exclusive_group && hasGrowthNode(other.node_id))) return false;
    if (node.choice_group && growthNodesFor(character).some(other => other.node_id !== node.node_id && other.choice_group === node.choice_group && hasGrowthNode(other.node_id))) return false;
    return true;
  }
  function renderGrowthDetail(character,nodes,node) {
    const target=node||nodes[0];if(!target){$("growthNodeDetail").innerHTML="";return;}
    selectedGrowthNodeId=target.node_id;const unlocked=hasGrowthNode(target.node_id),available=growthNodeAvailable(target,character),affordable=growth.sp>=target.sp_cost;
    const prerequisites=target.prerequisites.map(id=>nodes.find(item=>item.node_id===id)?.name||id);if(target.require_count)prerequisites.push(`指定节点中完成 ${target.require_count.count} 个`);
    const preferences=target.node_id==="QY19"&&unlocked?`<div class="summon-preferences"><b>偏好召唤（最多2种）</b>${[...new Set([...(state?.growthConfig?.summons?.unlocked||[]),...compileGrowthConfig(character).summons.unlocked])].filter(id=>QINGYAN_SUMMON_CATALOG[id]?.kind==="mobile").map(id=>`<button data-preferred-summon="${id}" class="${growth.preferences.qingyan.includes(id)?"chosen":""}">${QINGYAN_SUMMON_CATALOG[id].icon} ${QINGYAN_SUMMON_CATALOG[id].name}</button>`).join("")}</div>`:"";
    $("growthNodeDetail").innerHTML=`<div class="growth-detail-brush"><small>${nodeTypeLabel(target.node_type)} · ${target.branch}</small><h3>${target.name}</h3></div><div class="growth-detail-icon">${target.name.slice(0,1)}</div><div class="growth-detail-level"><span>修行状态</span><b>${unlocked?"已完成":"未修行"}</b></div><p>${target.description}</p>${prerequisites.length?`<small class="growth-detail-prereq">前置：${prerequisites.join("、")}</small>`:""}${preferences}<div class="growth-detail-cost">消耗修行点 <b>${target.sp_cost} SP</b></div><button class="growth-detail-unlock" data-detail-unlock="${target.node_id}" ${unlocked||!available||!affordable?"disabled":""}>${unlocked?"已修行":!available?"前置未完成":!affordable?"修行点不足":"修行此节点"}</button>`;
    $("growthNodeDetail").querySelector("[data-detail-unlock]")?.addEventListener("click",()=>unlockGrowthNode(target.node_id));
    $("growthNodeDetail").querySelectorAll("[data-preferred-summon]").forEach(button=>button.onclick=()=>togglePreferredSummon(button.dataset.preferredSummon));
  }
  function togglePreferredSummon(id){const list=growth.preferences.qingyan||=[];const index=list.indexOf(id);if(index>=0)list.splice(index,1);else{if(list.length>=2)list.shift();list.push(id);}saveGrowth();renderGrowthPanel("偏好召唤已更新；下一局随机权重翻倍。");}
  function renderGrowthPanel(message = "") {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, nodes = growthNodesFor(character);
    $("growthCoins").textContent = growth.sp;
    $("growthCharacterTabs").innerHTML = Object.values(CHARACTERS).map(item => `<button class="growth-tab ${item.key === character.key ? "active" : ""} ${item.palette}" data-growth-character="${item.key}"><span class="growth-tab-art">${imageMarkup(portraitResource(item),item.name)}</span><b>${item.name}</b><small>${growthSpent(item)} SP</small></button>`).join("");
    $("growthCharacterTabs").querySelectorAll("[data-growth-character]").forEach(button => button.onclick = () => { growthCharacterKey = button.dataset.growthCharacter; growthBranch="";selectedGrowthNodeId="";growthBranchOpen=false;renderGrowthPanel(); });
    const unlockedCount = nodes.filter(node => hasGrowthNode(node.node_id)).length, config = compileGrowthConfig(character);
    const statValue=key=>{const effect=config.stats[key]||{add:0,mult:1};return((character.base_stats[key]||0)+effect.add)*effect.mult;};
    $("growthSummary").innerHTML = `<div><b>${character.name}</b><span>${character.role}</span></div><div><strong>心 ${Math.round(statValue("maxHp"))}</strong><small>生命</small></div><div><strong>锋 ${statValue("attack").toFixed(1)}</strong><small>攻击</small></div><div><strong>盾 ${Math.round(statValue("armor")*100)}%</strong><small>防御</small></div><div><strong>暴 ${Math.round(statValue("crit")*100)}%</strong><small>暴击率</small></div><div><strong>${unlockedCount}/${nodes.length}</strong><small>已修行</small></div>`;
    const branches=[...new Set(nodes.map(node=>node.branch))];if(!branches.includes(growthBranch))growthBranch=branches[0]||"";
    $("growthBranches").innerHTML=branches.map(branch=>{const entries=nodes.filter(node=>node.branch===branch),done=entries.filter(node=>hasGrowthNode(node.node_id)).length;return`<button class="growth-branch-card" data-growth-branch="${branch}"><span>${branch.slice(0,1)}</span><div><b>${branch}</b><small>${done} / ${entries.length} 已修行</small></div><em>查看升级 ›</em></button>`;}).join("");
    $("growthBranches").querySelectorAll("[data-growth-branch]").forEach(button=>button.onclick=()=>{growthBranch=button.dataset.growthBranch;selectedGrowthNodeId="";growthBranchOpen=true;renderGrowthPanel();});
    const branchNodes=nodes.filter(node=>node.branch===growthBranch),tiers=[...new Set(branchNodes.map(node=>node.tier))].sort((a,b)=>a-b);
    $("skillTree").innerHTML=tiers.map(tier=>`<section class="skill-tier"><header><span>${tier}层</span></header><div class="skill-tier-nodes">${branchNodes.filter(node=>node.tier===tier).map(node=>{const unlocked=hasGrowthNode(node.node_id),available=growthNodeAvailable(node,character),affordable=growth.sp>=node.sp_cost,stateClass=unlocked?"unlocked":available?(affordable?"available":"unaffordable"):"locked";return`<button class="skill-node ${stateClass} type-${node.node_type.toLowerCase()} ${node.node_id===selectedGrowthNodeId?"selected":""}" data-node-id="${node.node_id}" title="${node.description}"><span class="skill-node-icon">${node.name.slice(0,1)}</span><b>${node.name}</b><small>${unlocked?"✓ 已修行":available?`${node.sp_cost} SP`:"锁定"}</small></button>`;}).join("")}</div></section>`).join("");
    $("skillTree").querySelectorAll("[data-node-id]").forEach(button=>button.onclick=()=>{selectedGrowthNodeId=button.dataset.nodeId;renderGrowthPanel();});
    const selected=nodes.find(node=>node.node_id===selectedGrowthNodeId&&node.branch===growthBranch)||branchNodes[0];renderGrowthDetail(character,nodes,selected);
    $("growthBranchKicker").textContent=`${character.name} · 技能修行`;$("growthBranchTitle").textContent=growthBranch||"升级路线";$("growthBranchWindow").classList.toggle("hidden",!growthBranchOpen);
    $("growthStatus").textContent = message || "点击技能卡片进入升级窗口；终局流派节点互斥。";
  }
  function unlockGrowthNode(nodeId) {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, node = growthNodesFor(character).find(item => item.node_id === nodeId);
    if (!node || hasGrowthNode(nodeId) || !growthNodeAvailable(node, character) || growth.sp < node.sp_cost) return;
    growth.sp -= node.sp_cost; growth.unlocked[nodeId] = Date.now();saveGrowth();selectedGrowthNodeId=nodeId;renderGrowthPanel(`已修行「${node.name}」；效果将在下一局生效。`);sound("coin");
  }
  function resetGrowthTree() {
    const character = CHARACTERS[growthCharacterKey] || CHARACTER, unlocked = growthNodesFor(character).filter(node => hasGrowthNode(node.node_id));
    const refund=unlocked.reduce((sum,node)=>sum+node.sp_cost,0);if(!unlocked.length||!confirm(`重置 ${character.name} 的技能树并返还 ${refund} 修行点？`))return;
    growth.sp+=refund;unlocked.forEach(node=>delete growth.unlocked[node.node_id]);if(character.key==="qingyan")growth.preferences.qingyan=["mouse","rabbit"];selectedGrowthNodeId="";saveGrowth();renderGrowthPanel("技能树已重置，修行点已全部返还。");
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
      attack: base.attack || 10, attackSpeed: base.attackSpeed, crit: base.crit, critDamage: base.critDamage || 1.75, cooldownMul: base.cooldownMul || 1, size: base.size, armor: base.armor, base,
      runtime: { damage: 1, speed: 1, attackSpeed: 1, crit: 0 }, weapons: {}, exclusiveLevel: 1, passives: {}, passiveWeights: {}, devices: {}, summonLevels: {}, weaponMastery: {}, weaponMinor: {}, growthCards: {}, moving: false,
      facing: 1, animation: createCharacterAnimation(character), movedDistance: 0, growthConfig
    };
  }

  function createCharacterState(character, growthConfig = compileGrowthConfig(character)) {
    const maxCharges={skill1:growthConfig.flags.dash_charges?.value||growthConfig.flags.bloodstep_charges?.value||1,skill2:1,skill3:1,ultimate:1};
    const common = { exclusiveTimer: .2, exclusiveCount: 0, skillCooldowns: { skill1:0, skill2:0, skill3:0, ultimate:0 }, skillMaxCharges:maxCharges, skillCharges:{...maxCharges}, skillCastLock: 0, stepEdgeCharged: false, switchStanceUntil: 0 };
    if (character.key === "chihen") return { ...common, type: "nine_lives", livesRemaining: character.mechanics.lives + growthConfig.revive.lives, revivesUsed: 0, shieldCharges: 0, afterfireUntil: 0, forcedCritUntil: 0, deathGuardUntil: 0, deathGuardReady: false, marks: { damage: 0, attackSpeed: 0, crit: 0 }, unyieldingUntil:0, unyieldingDamageStart:0, bloodPrisonUntil:0, bloodPrisonFinalized:true,lastLifeUntil:0,lastLifePending:false,bloodstepRefundAt:0 };
    if (character.key === "qingyan") return { ...common, type: "summoner_roster", energy: 0, energyMax: character.mechanics.companionEnergyMax || 100, empowerUntil: 0, deathLinkUntil: 0, wardUntil: 0, echoes: [], resonanceLineUntil: 0, talismanCount:0, resonanceTimer:4, armyUntil:0, armyRainTimer:0,lastSummonType:null,doubleSummonLock:false,convertedTemporary:false };
    return { ...common, type: "standard_build", inkEdgeUntil:0, inkEdgeFinalized:true,ultimateKills:0,ultimateBaseEnd:0,spearKillCounter:0,spearCharged:false };
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
    const kit = combatKitFor(state.character), level = Math.max(1, player.level || 1), hpGrowth = Math.pow(1 + (kit?.levelGrowth?.maxHp || 0), level - 1), attackGrowth = Math.pow(1 + (kit?.levelGrowth?.attack || 0), level - 1);
    player.maxHp = Math.max(1, player.base.maxHp * hpGrowth + 22 * weight("health"));
    player.attack = Math.max(1, (player.base.attack || 10) * attackGrowth);
    player.speed = Math.max(1, player.base.speed * Math.pow(1.10, weight("speed")) * player.runtime.speed);
    player.damageMul = Math.max(.01, player.base.damageMul * Math.pow(1.18, weight("power")) * player.runtime.damage);
    player.attackSpeed = Math.max(.05, player.base.attackSpeed * Math.pow(1.14, weight("haste")) * player.runtime.attackSpeed);
    player.pickup = Math.max(1, player.base.pickup + 38 * weight("magnet"));
    player.crit = clamp(player.base.crit + .08 * weight("crit") + player.runtime.crit, 0, 1);
    player.critDamage = Math.max(1, player.base.critDamage || 1.75);
    player.cooldownMul = Math.max(.25, player.base.cooldownMul || 1);
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
  function setExclusiveLevel(level) {
    const data = combatKitFor(state.character)?.exclusive, player = state.player;
    if (!data || !player) return;
    player.exclusiveLevel = clamp(Math.round(Number(level) || 1), 1, data.max || 7);
    updateDock(); updateHud();
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

  function clearWorldNodes() { nodes.clear(); if(sceneLayers)world.replaceChildren(sceneLayers);else world.replaceChildren(); }
  function resetGame(devOverride = null) {
    const queryDev = new URLSearchParams(location.search).get("dev") === "1";
    const dev = devOverride === null ? queryDev : Boolean(devOverride);
    const activeCharacter = CHARACTERS[homeCharacterKey] || CHARACTER, growthConfig = compileGrowthConfig(activeCharacter), challengeId = null;
    const baseSlots = activeCharacter.slot_rules || CHARACTER.slot_rules;
    state = {
      dev, mode: dev ? "playing" : "upgrade", started: dev, duration: RUN_TIMELINE?.duration || 900, time: 0, lastSpawn: 0,
      shake: 0, flash: 0, kills: 0, elites: 0, damage: 0, taken: 0, highHit: 0, coins: 0,
      pendingLevels: 0, rerolls: 2, bossSpawned: false, won: false, simSpeed: 1, devLabOpen: false,
      devRunPaused: dev, invincible: false, infiniteRerolls: false, fps: 0, damageBuckets: [],
      schedules: Object.fromEntries((RUN_TIMELINE?.events || []).map(event => [event.id,false])),
      character: activeCharacter, challengeId, growthConfig, slotRules: { ...baseSlots, weapon: baseSlots.weapon + (growthConfig.slots.weapon || 0), device: baseSlots.device + (growthConfig.slots.device || 0), summon: baseSlots.summon + (growthConfig.slots.summon || 0) }, characterState: createCharacterState(activeCharacter, growthConfig), player: createPlayer(activeCharacter, dev, growthConfig), summons: [], inkSpirits: [], delayedEffects: [], enemies: [], projectiles: [], enemyShots: [], pickups: [], particles: [], texts: [], hazards: [], devices: [], boss: null,
      playerZones: [], weaponPulses: [], orbiters: [], weaponDamage: {},
      timers: { ...Object.fromEntries(Object.keys(WEAPONS).map(id => [id, 0])), trap: 2, turret: 0 }, cam: { x: WORLD_W / 2, y: WORLD_H / 2 }
    };
    clearWorldNodes();
    initializeCharacterRun();
    $("hudHeroName").textContent = state.character.name; setArtImage($("hudHeroImage"), portraitResource(state.character), state.character.name);
    ui.menu.classList.add("hidden"); ui.result.classList.add("hidden"); ui.hud.classList.remove("hidden"); ui.joystick.classList.remove("hidden"); ui.bossHud.classList.add("hidden");
    updateDock(); updateHud();
    toast(dev ? "DEV MODE · 测试数据不会写入正式存档" : "开局墨意 · 先选一道笔势", 2200);
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
    state.inkSpirits = [];
    state.delayedEffects = [];
    if (state.character.key === "qingyan") {
      // 画灵符通过万灵图录持续随机召唤；旧三伙伴仍作为兼容升级项保留。
      state.growthConfig.startSummons.forEach(entry => state.player.summonLevels[entry.id] = Math.max(state.player.summonLevels[entry.id] || 0, entry.level));
      syncSummonRoster();
    }
    renderSkillBar();
  }
  function summonPower(summon) {
    const cs = state.characterState, empowered = cs.empowerUntil > state.time, linked = cs.deathLinkUntil > state.time, commanded = summon.buffUntil > state.time, warded = cs.wardUntil > state.time;
    const alive = state.summons.filter(item => !item.dead), roles = new Set(alive.flatMap(item => SUMMONS[item.type].role)), unity = state.growthConfig.flags.alive_summon_thresholds && alive.length >= 3 ? 1.10 : 1, formation = state.growthConfig.flags.summon_role_set_bonus && ["output","tank","support","control"].every(role => roles.has(role)) ? 1.15 : 1;
    const resonance = 1 + Math.min(6, state.summons.filter(item=>!item.dead).length + livingInkSpirits().length) * .06;
    return state.growthConfig.summons.damage * (1 + (summon.level - 1) * .18) * (empowered ? 1.55 : 1) * (linked ? 1.3 : 1) * (commanded ? 1.25 : 1) * (warded ? 1.18 : 1) * unity * formation * resonance;
  }
  function onSummonKill() {
    const cs = state.characterState;
    if (state.character.key !== "qingyan" || cs.empowerUntil > state.time) return;
    const gatherCard = 1 + .15 * (state.player.growthCards.CARD_SUM_GATHER || 0);
    cs.energy = Math.min(cs.energyMax, cs.energy + 14 * state.growthConfig.summons.energy * gatherCard);
    if (cs.energy < cs.energyMax) return;
    cs.energy = 0; cs.empowerUntil = state.time + (state.character.mechanics.empowerDuration || 6);
    state.summons.forEach(summon => { if (!summon.dead) summon.hp = Math.min(summon.maxHp, summon.hp + summon.maxHp * .25); });
    livingInkSpirits().forEach(spirit=>{spirit.hp=Math.min(spirit.maxHp,spirit.hp+spirit.maxHp*.25);spirit.buffUntil=state.time+(state.character.mechanics.empowerDuration||6);});
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
  function updateLegacySummons(dt) {
    const cs = state.characterState, player = state.player, alive = state.summons.filter(summon => !summon.dead);
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
  function skillDirection(preferCrowd = false) {
    const player = state.player;
    if (preferCrowd) {
      const targets = [];
      forEachEnemy(enemy => targets.push(enemy));
      targets.sort((a,b) => dist(player,a) - dist(player,b));
      const sample = targets.slice(0, 12);
      if (sample.length) {
        const vector = sample.reduce((sum, enemy) => ({ x:sum.x + (enemy.x-player.x) / Math.max(1,dist(player,enemy)), y:sum.y + (enemy.y-player.y) / Math.max(1,dist(player,enemy)) }), {x:0,y:0});
        const length = Math.hypot(vector.x, vector.y) || 1; return { x:vector.x/length, y:vector.y/length };
      }
    }
    let x = joy.x, y = joy.y;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x--; if (keys.has("KeyD") || keys.has("ArrowRight")) x++;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y--; if (keys.has("KeyS") || keys.has("ArrowDown")) y++;
    if (Math.hypot(x,y) < .05) {
      const direction = player.animation?.direction || (player.facing < 0 ? "left" : "right");
      return direction === "up" ? {x:0,y:-1} : direction === "down" ? {x:0,y:1} : direction === "left" ? {x:-1,y:0} : {x:1,y:0};
    }
    const length = Math.hypot(x,y); return {x:x/length,y:y/length};
  }
  function damageLine({ x, y, dx, dy, length, width, damage, kind, source, eliteMultiplier = 1, knockback = 0, hitCounts = null, maxHits = Infinity, rising = null }) {
    let hits = 0, kills = 0; const mag = Math.hypot(dx,dy) || 1, ux=dx/mag, uy=dy/mag;
    forEachEnemy(enemy => {
      const rx=enemy.x-x, ry=enemy.y-y, along=rx*ux+ry*uy, side=Math.abs(rx*uy-ry*ux);
      if (along < -enemy.r || along > length+enemy.r || side > width/2+enemy.r || hitCounts && (hitCounts.get(enemy)||0)>=maxHits) return;
      if(hitCounts)hitCounts.set(enemy,(hitCounts.get(enemy)||0)+1);
      const wasAlive=!enemy.dead, scaled=damage*(1+(rising?.bonus||0))*(enemy.elite || enemy===state.boss ? eliteMultiplier : 1); hitEnemy(enemy,scaled,kind,null,source); hits++;
      if (wasAlive && enemy.dead) { kills++;if(rising)rising.bonus=Math.min(rising.max,rising.bonus+rising.perKill); }
      if (knockback && enemy!==state.boss) pushFrom(enemy,{x:x-ux*20,y:y-uy*20},knockback*(enemy.elite?.4:1));
    });
    beam(x,y,x+ux*length,y+uy*length,kind.includes("chihen")?"#b8422f":"#4f928f",kind.includes("chihen")?"FX_007":"FX_001",null,3);
    return {hits,kills};
  }
  function damageCone({ x, y, angle, range, arc, damages, kind, source }) {
    let hits=0,kills=0;
    forEachEnemy(enemy=>{ const a=Math.atan2(enemy.y-y,enemy.x-x), delta=Math.atan2(Math.sin(a-angle),Math.cos(a-angle)); if(dist({x,y},enemy)>range+enemy.r||Math.abs(delta)>arc/2)return; const before=!enemy.dead; for(const damage of damages)if(!enemy.dead)hitEnemy(enemy,damage,kind,null,source); hits++;if(before&&enemy.dead)kills++; });
    state.particles.push({kind:"claw",fxId:"FX_007",x,y,r:range,color:"#b8422f",life:.34,max:.34,visualKind:"scarlet"}); return {hits,kills};
  }
  function addTrail(x1,y1,x2,y2,{life=3,tick=.5,damage=0,slow=0,kind="skill-trail",color="#4f928f"}={}) {
    const distance=Math.hypot(x2-x1,y2-y1),steps=Math.max(2,Math.ceil(distance/52));
    for(let index=0;index<=steps;index++){const t=index/steps;state.playerZones.push({kind,fxId:"FX_005",vfxTier:2,x:lerp(x1,x2,t),y:lerp(y1,y2,t),r:44,life,duration:life,tick,nextTick:0,damage,slow,source:{type:"character",id:state.character.key},color});}
  }
  function dashPlayer(distance) {
    const player=state.player,direction=skillDirection(false),start={x:player.x,y:player.y};
    player.x=clamp(player.x+direction.x*distance,60,WORLD_W-60);player.y=clamp(player.y+direction.y*distance,60,WORLD_H-60);player.facing=direction.x<0?-1:direction.x>0?1:player.facing;player.animation.direction=resolveMoveDirection(direction.x,direction.y,player.animation.direction);
    return {...start,endX:player.x,endY:player.y,direction};
  }
  function livingInkSpirits(kind=null){return(state.inkSpirits||[]).filter(spirit=>!spirit.dead&&(!kind||spirit.kind===kind));}
  function inkSpiritCap(){return Math.min(state.character.slot_rules.summonMax||6,state.slotRules.summon||3);}
  function qingyanPool(kind="mobile"){return(state.growthConfig.summons.unlocked||[]).filter(id=>QINGYAN_SUMMON_CATALOG[id]?.kind===kind);}
  function weightedSummonType(kind="mobile"){
    const pool=qingyanPool(kind);if(!pool.length)return null;const preferences=state.growthConfig.preferences||[],last=state.characterState.lastSummonType;
    const weighted=pool.map(id=>{let weight=preferences.includes(id)&&state.growthConfig.flags.preferred_summons?2:1;const same=livingInkSpirits(kind).filter(spirit=>spirit.catalogId===id).length;if(same>=2)weight*=.5;if(id===last&&state.growthConfig.flags.summon_variety)weight*=.5;return{id,weight};});
    let roll=Math.random()*weighted.reduce((sum,item)=>sum+item.weight,0);for(const item of weighted){roll-=item.weight;if(roll<=0)return item.id;}return weighted.at(-1).id;
  }
  function strengthenSpirit(spirit,amount=1){
    if(!spirit)return null;const starCap=state.growthConfig.summons.starCap||1;
    for(let i=0;i<amount;i++){if(spirit.star<starCap){spirit.star++;const factor=spirit.star===2?1.2:1.35;spirit.maxHp*=factor;spirit.hp=spirit.maxHp;textPop(spirit.x,spirit.y-30,`${spirit.star}星` ,"#d6b66b",16);}else{spirit.hp=Math.min(spirit.maxHp,spirit.hp+spirit.maxHp*.4);spirit.buffUntil=state.time+5;}}
    burst(spirit.x,spirit.y,"#d6b66b",9,55,"FX_003");return spirit;
  }
  function addInkSpirit({temporary=false,big=false,duration=0,type=null,forceKind=null}={}){
    const kind=forceKind||(big?"mobile":state.growthConfig.flags.device_pool&&Math.random()<state.growthConfig.flags.device_pool.chance?"fixed":"mobile"),catalogId=type||weightedSummonType(kind);if(!catalogId)return null;const data=QINGYAN_SUMMON_CATALOG[catalogId];
    const current=livingInkSpirits(kind);if(!temporary&&((kind==="mobile"&&current.length>=inkSpiritCap())||(kind==="fixed"&&current.length>=1))){if(!state.growthConfig.flags.full_roster_upgrade)return null;const same=current.filter(item=>item.catalogId===catalogId);return strengthenSpirit(pick(same.length?same:current));}
    const index=state.inkSpirits.length,angle=index*2.4,star=big?Math.max(2,state.growthConfig.summons.starCap):1,maxHp=data.kind==="fixed"?9999:state.player.maxHp*(data.hp||1)*state.growthConfig.summons.hp*(big?1.5:1);
    const spirit={type:"ink-spirit",catalogId,kind:data.kind,name:big?`高阶·${data.name}`:data.name,icon:data.icon,role:data.role,art:data.art||SUMMONS.mouse.art,fallback_art:data.fallback_art||SUMMONS.mouse.fallback_art,x:state.player.x+Math.cos(angle)*(data.kind==="fixed"?115:70),y:state.player.y+Math.sin(angle)*(data.kind==="fixed"?115:70),r:data.kind==="fixed"?Math.min(28,(data.radius||110)*.18):big?25:18,maxHp,hp:maxHp,attack:rand(.05,.25),special:rand(.5,1.2),attackCount:0,kills:0,temporary,big,star,expiresAt:(duration||data.duration)?state.time+(duration||data.duration):0,buffUntil:0,dead:false};
    state.inkSpirits.push(spirit);state.characterState.lastSummonType=catalogId;burst(spirit.x,spirit.y,big?"#d6b66b":"#536b87",big?12:7,big?70:40,"FX_003");
    if(!temporary&&state.growthConfig.flags.double_summon&&!state.characterState.doubleSummonLock&&Math.random()<state.growthConfig.flags.double_summon.chance){state.characterState.doubleSummonLock=true;addInkSpirit({forceKind:kind});state.characterState.doubleSummonLock=false;}
    return spirit;
  }
  function inkSpiritStats(spirit){
    const data=QINGYAN_SUMMON_CATALOG[spirit.catalogId]||{damage:1,cooldown:.8},count=Math.min(6,livingInkSpirits().length),resonance=1+count*(state.growthConfig.flags.resonance_damage?.value||.06),starPower=spirit.star===3?1.55:spirit.star===2?1.2:1;
    let cooldown=(spirit.big?.65:data.cooldown||.8),power=resonance*starPower*(spirit.big?1.35:1);const bonded=state.growthConfig.flags.summon_bond&&spirit.star>=3&&livingInkSpirits(spirit.kind).filter(item=>item.catalogId===spirit.catalogId&&item.star>=3).length>=2;if(bonded){power*=1.25;cooldown/=1.15;}
    cooldown/=1+(state.growthConfig.flags.summon_haste?.value||0);if(count>=4)cooldown/=1+(state.growthConfig.flags.summon_count_haste?.value||0);if(spirit.buffUntil>state.time)cooldown/=1.5;
    if(state.characterState.armyUntil>state.time){cooldown/=1.6;power*=1.4;}
    const array=state.playerZones.find(zone=>zone.kind==="qingyan-array"&&zone.life>0&&dist(zone,spirit)<zone.r);if(array){cooldown/=1.35;power*=1.25;}
    const inkstone=livingInkSpirits("fixed").find(item=>item.catalogId==="inkstone"&&dist(item,spirit)<QINGYAN_SUMMON_CATALOG.inkstone.radius);if(inkstone){cooldown/=1.15;power*=inkstone.star>=3?1.3:1.2;}
    return{damage:state.player.attack*(data.damage||1)*power*state.growthConfig.summons.damage,cooldown};
  }
  function summonStrike(spirit,target,stats){
    const data=QINGYAN_SUMMON_CATALOG[spirit.catalogId],source=spirit,color=spirit.big?"#d6b66b":"#536b87";spirit.attackCount++;
    if(spirit.catalogId==="dog"){if(dist(spirit,target)<190)hitEnemy(target,stats.damage,"summon-dog",null,source);else shoot(spirit.x,spirit.y,target,{kind:"summon-dog",color,damage:stats.damage,speed:430,range:240,r:7,fxId:"FX_003",source,scaleWithPlayer:false});}
    else if(spirit.catalogId==="scroll"){const count=spirit.star>=3?5:3,aim=Math.atan2(target.y-spirit.y,target.x-spirit.x);for(let i=0;i<count;i++)shootAngle(spirit.x,spirit.y,aim+spreadAngle(i,count,26),{kind:"summon-scroll",color,damage:stats.damage,speed:500,range:560,r:5,fxId:"FX_003",source,scaleWithPlayer:false});if(spirit.attackCount%4===0)damageArea({x:target.x,y:target.y,r:90,damage:state.player.attack*1.3*stats.damage/(state.player.attack*(data.damage||1)),kind:"summon-scroll-burst",source});}
    else if(spirit.catalogId==="cranes"){const count=spirit.star>=3?8:6,aim=Math.atan2(target.y-spirit.y,target.x-spirit.x);for(let i=0;i<count;i++)shootAngle(spirit.x,spirit.y,aim+spreadAngle(i,count,34),{kind:"summon-crane",color,damage:stats.damage,speed:560,range:600,r:4,pierce:1,retention:.8,fxId:"FX_003",source,scaleWithPlayer:false});}
    else{shoot(spirit.x,spirit.y,target,{kind:`summon-${spirit.catalogId}`,color,damage:stats.damage,speed:520,range:data.range||560,r:spirit.big?8:5,bounces:spirit.catalogId==="thunder"&&spirit.attackCount%3===0?(spirit.star>=3?6:4):0,retention:.82,fxId:"FX_003",source,scaleWithPlayer:false,vfxTier:spirit.star});}
    if(spirit.catalogId==="mouse"&&state.time>=spirit.special){const hits=spirit.star>=3?2:1;for(let i=0;i<hits;i++)hitEnemy(target,state.player.attack*1.8*state.growthConfig.summons.damage,"summon-mouse-dash",null,source);spirit.special=state.time+4;beam(spirit.x,spirit.y,target.x,target.y,color,"FX_003",null,2);}
    if(spirit.catalogId==="cat"&&state.time>=spirit.special){spirit.x=clamp(target.x-35,35,WORLD_W-35);spirit.y=clamp(target.y+25,35,WORLD_H-35);hitEnemy(target,state.player.attack*2.2*(target.elite||target===state.boss?1.2:1)*state.growthConfig.summons.damage,"summon-cat-backstab",null,source);if(spirit.star>=3)hitEnemy(target,stats.damage,"summon-cat-follow",null,source);spirit.special=state.time+3.5;}
  }
  function updateInkSpirits(dt){
    if(state.character.key!=="qingyan")return;const player=state.player,cs=state.characterState,alive=livingInkSpirits(),mobile=livingInkSpirits("mobile");
    state.inkSpirits.forEach((spirit,index)=>{if(spirit.dead)return;if(spirit.expiresAt&&state.time>=spirit.expiresAt){spirit.dead=true;burst(spirit.x,spirit.y,"#38465d",8,46,"FX_005");return;}spirit.attack-=dt;spirit.special-=spirit.special<state.time-30?0:0;
      const data=QINGYAN_SUMMON_CATALOG[spirit.catalogId]||{},target=nearest(spirit.x,spirit.y,data.range||560);
      if(spirit.kind==="mobile"){const formationAngle=state.time*.35+index*TAU/Math.max(1,mobile.length),pursue=["dog","cat","mouse"].includes(spirit.catalogId)&&target,goalX=pursue?target.x:player.x+Math.cos(formationAngle)*(spirit.big?130:92),goalY=pursue?target.y:player.y+Math.sin(formationAngle)*(spirit.big?130:92),angle=Math.atan2(goalY-spirit.y,goalX-spirit.x),distance=Math.hypot(goalX-spirit.x,goalY-spirit.y);spirit.x=clamp(spirit.x+Math.cos(angle)*Math.min(distance,(data.speed||220)*dt),35,WORLD_W-35);spirit.y=clamp(spirit.y+Math.sin(angle)*Math.min(distance,(data.speed||220)*dt),35,WORLD_H-35);}
      if(spirit.kind==="fixed"&&spirit.attack<=0){if(spirit.catalogId==="blade")damageArea({x:spirit.x,y:spirit.y,r:data.radius*(spirit.star>=3?1.3:1),damage:state.player.attack*data.damage*state.growthConfig.summons.damage,kind:"summon-blade-device",source:spirit});if(spirit.catalogId==="umbrella"){forEachEnemy(enemy=>{if(dist(spirit,enemy)<data.radius+enemy.r){hitEnemy(enemy,state.player.attack*data.damage*state.growthConfig.summons.damage,"summon-umbrella",null,spirit);enemy._slowUntil=state.time+1;enemy._slowAmount=.35;pushFrom(enemy,spirit,24);if(spirit.star>=3)enemy.stunUntil=state.time+1;}});state.particles.push({kind:"claw",fxId:"FX_004",x:spirit.x,y:spirit.y,r:data.radius,color:"#536b87",life:.5,max:.5});}spirit.attack=data.cooldown;}
      if(spirit.kind==="mobile"&&target&&spirit.attack<=0){const stats=inkSpiritStats(spirit);summonStrike(spirit,target,stats);spirit.attack=stats.cooldown;}
      if(spirit.catalogId==="rabbit"&&state.time>=spirit.special){player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.06*(spirit.star>=3?1.5:1));alive.forEach(item=>item.hp=Math.min(item.maxHp,item.hp+item.maxHp*.06*(spirit.star>=3?1.5:1)));spirit.special=state.time+5;burst(spirit.x,spirit.y,"#8aa79e",8,55,"FX_003");}
      if(spirit.catalogId==="guardian"&&state.time>=spirit.special){cs.wardUntil=Math.max(cs.wardUntil,state.time+2);spirit.special=state.time+6;burst(player.x,player.y,"#d6b66b",8,62,"FX_003");}
      if(spirit.catalogId==="bell"&&state.time>=spirit.special){forEachEnemy(enemy=>{if(dist(spirit,enemy)<180+enemy.r){enemy._slowUntil=state.time+2;enemy._slowAmount=enemy===state.boss?.2:.4;if(!enemy.elite&&enemy!==state.boss)enemy.stunUntil=state.time+(spirit.star>=3?1.2:.8);}});spirit.special=state.time+5;}
      if(spirit.kind==="mobile")for(const enemy of state.enemies)if(!enemy.dead&&dist(spirit,enemy)<spirit.r+enemy.r){enemy._spiritContact||={};const key=objectId(spirit,"ink-spirit");if((enemy._spiritContact[key]||0)<=state.time){enemy._spiritContact[key]=state.time+.8;spirit.hp-=enemy.damage*(spirit.catalogId==="dog"?.4:.7);if(spirit.hp<=0){spirit.dead=true;cs.deathLinkUntil=state.time+3;burst(spirit.x,spirit.y,"#38465d",9,50,"FX_005");}}}
    });
    state.inkSpirits=state.inkSpirits.filter(spirit=>!spirit.dead);
    if(state.growthConfig.flags.roster_resonance&&alive.length>=state.growthConfig.flags.roster_resonance.count){cs.resonanceTimer-=dt;if(cs.resonanceTimer<=0){damageArea({x:player.x,y:player.y,r:300,damage:skillPower(state.growthConfig.flags.roster_resonance.damage),kind:"qingyan-resonance",source:{type:"ink-spirit"}});state.particles.push({kind:"claw",fxId:"FX_004",x:player.x,y:player.y,r:300,color:"#536b87",life:.5,max:.5});cs.resonanceTimer=state.growthConfig.flags.roster_resonance.cooldown;}}
  }
  function updateExclusiveWeapon(dt){
    const player=state.player,cs=state.characterState,level=player.exclusiveLevel||1;cs.exclusiveTimer-=dt;if(cs.exclusiveTimer>0)return;
    const target=nearest(player.x,player.y,720);if(!target){cs.exclusiveTimer=.15;return;}cs.exclusiveCount++;
    if(state.character.key==="moxiaobai"){
      const flags=state.growthConfig.flags,interval=(level>=6?.58:level>=4?.68:.85),damage=player.attack*(level>=6?1.55:level>=3?1.35:level>=2?1.25:1.10),pierce=(level>=4?4:level>=2?3:2)+(flags.spear_pierce?.value||0),aim=Math.atan2(target.y-player.y,target.x-player.x),grandEvery=flags.spear_grand?.every||4,ultimate=(level>=7||flags.spear_grand)&&cs.exclusiveCount%grandEvery===0,ultBuff=cs.inkEdgeUntil>state.time,charged=ultimate&&cs.spearCharged;
      shootAngle(player.x,player.y,aim,{kind:ultimate?"xiaobai-grand-spear":"xiaobai-spear",color:"#2d8078",damage:ultimate?player.attack*(flags.spear_grand?.damage||2.8)*(charged?1.8:1):damage,speed:720,range:ultimate?980:720,r:ultimate?(charged?27:18):8,pierce:ultimate||ultBuff?999:pierce,explodeRadius:!ultimate&&(level>=5||flags.spear_ink_burst)?(flags.spear_ink_burst?.radius||70):0,childBlasts:0,weaponId:"exclusive-moxiaobai",fxId:"FX_001",source:{type:"character",id:"xiaobai-exclusive"},vfxTier:ultimate?3:level>=4?2:1});
      if(charged){cs.spearCharged=false;cs.spearKillCounter=0;}
      const doubleEdge=flags.spear_double_edge&&cs.exclusiveCount%flags.spear_double_edge.every===0;if((level>=3||doubleEdge)&&!ultimate)shootAngle(player.x,player.y,aim+(cs.exclusiveCount%2?-.1:.1),{kind:"xiaobai-ink-blade",color:"#6ca9a1",damage:player.attack*(doubleEdge?flags.spear_double_edge.damage:level>=6?.75:.55),speed:650,range:620,r:5,pierce:2,weaponId:"exclusive-moxiaobai",fxId:"FX_001",source:{type:"character",id:"xiaobai-exclusive"},vfxTier:2});
      if(ultimate&&(level>=7||flags.spear_trail)){const trail=flags.spear_trail||{duration:2,tick:.4,damage:.35};addTrail(player.x,player.y,player.x+Math.cos(aim)*900,player.y+Math.sin(aim)*900,{life:trail.duration,tick:trail.tick,damage:player.attack*trail.damage,slow:0,kind:"xiaobai-grand-trail"});}
      if(ultBuff)for(const offset of[-.24,.24])shootAngle(player.x,player.y,aim+offset,{kind:"xiaobai-side-spear",color:"#89bdb5",damage:player.attack*(flags.xiaobai_ultimate?.sideDamage||.9),speed:700,range:760,r:7,pierce:999,weaponId:"exclusive-moxiaobai",fxId:"FX_001",source:{type:"character",id:"xiaobai-exclusive"},vfxTier:3});
      cs.exclusiveTimer=interval/(player.attackSpeed*growthAttackSpeedMultiplier());
    }else if(state.character.key==="chihen"){
      const flags=state.growthConfig.flags,interval=level>=4?.58:.75,angle=Math.atan2(target.y-player.y,target.x-player.x),range=(level>=2?150:130)*(player.hp/player.maxHp<.2&&flags.critical_range?1+flags.critical_range.value:1),source={type:"character",id:"chihen-exclusive"};let damages=level>=6?[player.attack*1.5,player.attack*1.3]:level>=3||flags.blade_double?[player.attack*1.2,player.attack]:[player.attack*(level>=2?1.4:1.25)];
      if((level>=7||flags.scarlet_combo)&&cs.exclusiveCount%5===0){damages=[player.attack*1.6,player.attack*1.8,player.attack*2.4];if(level>=7||flags.combo_burst)state.delayedEffects.push({delay:.18,run:()=>{damageArea({x:player.x+Math.cos(angle)*80,y:player.y+Math.sin(angle)*80,r:120,damage:player.attack*(flags.combo_burst?.damage||1.5),kind:"chihen-blood-burst",source});burst(player.x+Math.cos(angle)*80,player.y+Math.sin(angle)*80,"#b8422f",14,75,"FX_007");}});}
      damageCone({x:player.x,y:player.y,angle,range,arc:1.65,damages,kind:"chihen-exclusive",source});
      if(cs.bloodPrisonUntil>state.time)shootAngle(player.x,player.y,angle,{kind:"chihen-blood-blade",color:"#b8422f",damage:player.attack,speed:640,range:580,r:7,pierce:2,explodeRadius:flags.blood_prison_aoe?72:0,childBlasts:0,fxId:"FX_007",source});
      cs.exclusiveTimer=interval/((1+(flags.blade_haste?.value||0))*player.attackSpeed*growthAttackSpeedMultiplier());
    }else{
      shoot(player.x,player.y,target,{kind:"qingyan-talisman",color:"#536b87",damage:player.attack*.8,speed:540,range:650,r:6,pierce:1,fxId:"FX_003",source:{type:"character",id:"qingyan-exclusive"},vfxTier:level>=4?2:1});cs.talismanCount++;
      if(cs.talismanCount%6===0)addInkSpirit();cs.exclusiveTimer=1.2/(player.attackSpeed*growthAttackSpeedMultiplier());
    }
    triggerCharacterAnimation(player,"attack",{target});
  }
  function finishTimedCharacterStates(){
    const cs=state.characterState,player=state.player;
    if(state.character.key==="moxiaobai"&&!cs.inkEdgeFinalized&&state.time>=cs.inkEdgeUntil){cs.inkEdgeFinalized=true;damageArea({x:player.x,y:player.y,r:420,damage:player.attack*(state.growthConfig.flags.xiaobai_ultimate_final?.endDamage||4.5),kind:"xiaobai-ultimate-end",source:{type:"character",id:"moxiaobai"}});state.particles.push({kind:"claw",fxId:"FX_002",x:player.x,y:player.y,r:420,color:"#2d706b",life:.7,max:.7});}
    if(state.character.key==="chihen"&&!cs.unyieldingFinalized&&state.time>=cs.unyieldingUntil){cs.unyieldingFinalized=true;const dealt=Math.max(0,state.damage-cs.unyieldingDamageStart),cap=state.growthConfig.flags.unyielding_heal_cap?.value||.35,heal=Math.min(player.maxHp*cap,dealt*.03);player.hp=Math.min(player.maxHp,player.hp+heal);textPop(player.x,player.y-40,`回生 +${Math.round(heal)}`,"#e3b09e",15);}
    if(state.character.key==="chihen"&&!cs.bloodPrisonFinalized&&state.time>=cs.bloodPrisonUntil){cs.bloodPrisonFinalized=true;damageArea({x:player.x,y:player.y,r:430,damage:player.attack*(state.growthConfig.flags.blood_prison_end?.damage||6.5),kind:"chihen-blood-prison-end",source:{type:"character",id:"chihen"}});player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.4);state.particles.push({kind:"claw",fxId:"FX_007",x:player.x,y:player.y,r:430,color:"#b8422f",life:.75,max:.75});}
    if(state.character.key==="chihen"&&cs.lastLifePending&&state.time>=cs.lastLifeUntil){cs.lastLifePending=false;reviveChihen();}
    if(state.character.key==="qingyan"&&cs.armyUntil&&state.time>=cs.armyUntil){cs.armyUntil=0;const army=state.inkSpirits.filter(spirit=>spirit.big);if(army.length){damageArea({x:player.x,y:player.y,r:200,damage:player.attack*2.2*Math.min(4,army.length)*state.growthConfig.summons.damage,kind:"qingyan-army-end",source:{type:"ink-spirit"}});army.forEach(spirit=>spirit.dead=true);if(state.growthConfig.flags.ghost_general){const data=QINGYAN_SUMMON_CATALOG.guardian,maxHp=player.maxHp*5;state.inkSpirits.push({type:"ink-spirit",catalogId:"guardian",kind:"mobile",name:"墨将",icon:"将",role:"终极",art:data.art,fallback_art:data.fallback_art,x:player.x,y:player.y,r:30,maxHp,hp:maxHp,attack:.1,special:state.time+2,attackCount:0,kills:0,temporary:true,big:true,star:3,expiresAt:state.time+5,buffUntil:state.time+5,dead:false});}burst(player.x,player.y,"#d6b66b",20,120,"FX_003");}}
  }
  function updateDelayedEffects(dt){for(const effect of state.delayedEffects){effect.delay-=dt;if(effect.delay<=0&&!effect.done){effect.done=true;effect.run();}}state.delayedEffects=state.delayedEffects.filter(effect=>!effect.done);}
  function updateActiveSkills(dt){
    const cs=state.characterState;for(const key of Object.keys(cs.skillCooldowns||{})){const before=cs.skillCooldowns[key];cs.skillCooldowns[key]=Math.max(0,before-dt);if(before>0&&cs.skillCooldowns[key]===0&&(cs.skillCharges[key]||0)===0)cs.skillCharges[key]=cs.skillMaxCharges[key]||1;}cs.skillCastLock=Math.max(0,(cs.skillCastLock||0)-dt);
    if(state.character.key==="qingyan"&&cs.armyUntil>state.time){cs.armyRainTimer-=dt;if(cs.armyRainTimer<=0){const target=densestEnemy()||state.player;damageArea({x:target.x,y:target.y,r:180,damage:skillPower(2.2),kind:"qingyan-ink-rain",source:{type:"ink-spirit"}});state.particles.push({kind:"claw",fxId:"FX_003",x:target.x,y:target.y,r:180,color:"#536b87",life:.5,max:.5});cs.armyRainTimer=state.growthConfig.flags.ghost_parade_rain?.value||2;}}
    finishTimedCharacterStates();updateDelayedEffects(dt);updateSkillBar();
  }
  function densestEnemy() {
    const candidates=[];forEachEnemy(enemy=>candidates.push(enemy));let best=null,bestScore=-1;
    for(const enemy of candidates){let score=enemy.elite?2:1;for(const other of candidates)if(other!==enemy&&dist(enemy,other)<180)score++;if(score>bestScore){best=enemy;bestScore=score;}}
    return best;
  }
  function skillPower(multiplier){return state.player.attack*state.player.damageMul*multiplier;}
  function castXiaobaiSkill(id){
    const player=state.player,cs=state.characterState,source={type:"character",id:"moxiaobai"};
    const flags=state.growthConfig.flags;
    if(id==="skill1"){const distance=240*(1+(flags.dash_distance?.value||0)),dash=dashPlayer(distance),invuln=flags.dash_mastery?.invuln||.35,life=flags.dash_trail_duration?.value||3;player.invuln=Math.max(player.invuln,invuln);addTrail(dash.x,dash.y,dash.endX,dash.endY,{life,tick:.5,damage:skillPower(.45),slow:.30,kind:"xiaobai-dash-trail"});if(flags.dash_end_burst)damageArea({x:dash.endX,y:dash.endY,r:95,damage:skillPower(flags.dash_end_burst.damage),kind:"xiaobai-dash-end",source});if(flags.dash_echo)state.delayedEffects.push({delay:flags.dash_echo.delay,run:()=>{const target=nearest(player.x,player.y,720);if(target)shoot(player.x,player.y,target,{kind:"xiaobai-dash-echo",color:"#6ca9a1",damage:skillPower(flags.dash_echo.damage),speed:720,range:720,r:7,pierce:3,fxId:"FX_001",source});}});beam(dash.x,dash.y,dash.endX,dash.endY,"#4f928f","FX_001",null,3);toast("踏墨 · 墨痕留锋",900);return true;}
    if(id==="skill2"){const radius=180*(1+(flags.wind_radius?.value||0));let hits=0;const strike=damage=>forEachEnemy(enemy=>{if(dist(player,enemy)>radius+enemy.r)return;let total=skillPower(damage);if(damage===2.4&&(enemy._xiaobaiWeaponHitUntil||0)>state.time)total+=skillPower(.8);hitEnemy(enemy,total,"xiaobai-return-wind",null,source);if(enemy!==state.boss)pushFrom(enemy,player,enemy.elite?60:150);hits++;});strike(2.4);if(flags.wind_second)state.delayedEffects.push({delay:flags.wind_second.delay,run:()=>{strike(flags.wind_second.damage);state.particles.push({kind:"claw",fxId:"FX_004",x:player.x,y:player.y,r:radius,color:"#4f928f",life:.48,max:.48,visualKind:"wave"});}});if(flags.wind_haste)cs.switchStanceUntil=state.time+flags.wind_haste.duration;if(flags.wind_refund&&hits>=flags.wind_refund.hits)cs.nextCooldownFlat=flags.wind_refund.seconds;state.particles.push({kind:"claw",fxId:"FX_004",x:player.x,y:player.y,r:radius,color:"#4f928f",life:.48,max:.48,visualKind:"wave"});toast(hits?"回风枪 · 清开身侧":"回风枪",900);return true;}
    if(id==="skill3"){const direction=skillDirection(true),width=110*(1+(flags.cloud_width?.value||0)),eliteMultiplier=flags.cloud_elite?.value||1.4,hitCounts=flags.cloud_split?new Map():null,rising=flags.cloud_rising?{bonus:0,perKill:flags.cloud_rising.perKill,max:flags.cloud_rising.max}:null;let result=damageLine({x:player.x,y:player.y,dx:direction.x,dy:direction.y,length:750,width,damage:skillPower(flags.cloud_split?1.8:3.6),eliteMultiplier,kind:"xiaobai-cloudbreak",source,hitCounts,maxHits:2,rising});if(flags.cloud_split)for(const turn of[-.12,.12]){const extra=damageLine({x:player.x,y:player.y,dx:direction.x*Math.cos(turn)-direction.y*Math.sin(turn),dy:direction.x*Math.sin(turn)+direction.y*Math.cos(turn),length:750,width:width*.72,damage:skillPower(flags.cloud_split.damage||1.8),eliteMultiplier,kind:"xiaobai-cloudbreak-split",source,hitCounts,maxHits:2,rising});result={hits:result.hits+extra.hits,kills:result.kills+extra.kills};}if(result.kills>=5)cs.nextCooldownRatio=.7;state.particles.push({kind:"claw",fxId:"FX_001",x:player.x+direction.x*330,y:player.y+direction.y*330,r:155,color:"#2d706b",life:.42,max:.42});toast(result.kills>=5?"破云 · CD返还 30%":"破云 · 一线开天",1000);return true;}
    if(id==="ultimate"){damageArea({x:player.x,y:player.y,r:2000,damage:skillPower(2.2),kind:"xiaobai-ultimate-open",source});const duration=flags.xiaobai_ultimate?.duration||5;cs.inkEdgeUntil=state.time+duration;cs.ultimateBaseEnd=cs.inkEdgeUntil;cs.ultimateKills=0;cs.inkEdgeFinalized=false;state.flash=.22;state.shake=12;burst(player.x,player.y,"#2d706b",18,120,"FX_001");toast("万墨归锋 · 墨锋状态！",1500);return true;}
    return false;
  }
  function castChihenSkill(id){
    const player=state.player,cs=state.characterState,source={type:"character",id:"chihen"};
    const flags=state.growthConfig.flags;
    if(id==="skill1"){const threshold=flags.bloodstep_free?.threshold||.30,low=player.hp/player.maxHp<threshold;if(!low)player.hp=Math.max(1,player.hp-player.hp*.05);const dash=dashPlayer(210),x=dash.x,y=dash.y;beam(x,y,dash.endX,dash.endY,"#b8422f","FX_007",null,3);state.delayedEffects.push({delay:.6,run:()=>{const before=state.kills;damageArea({x,y,r:130,damage:skillPower(low?3.9:flags.bloodstep_damage?.value||2.6),kind:"chihen-bloodstep",source});if(flags.bloodstep_blades)for(let i=0;i<flags.bloodstep_blades.count;i++){const target=nearest(x,y,520);if(target)shootAngle(x,y,Math.atan2(target.y-y,target.x-x)+spreadAngle(i,flags.bloodstep_blades.count,28),{kind:"chihen-bloodstep-blade",color:"#b8422f",damage:skillPower(flags.bloodstep_blades.damage),speed:620,range:520,r:6,pierce:1,fxId:"FX_007",source});}if(flags.bloodstep_refund&&state.kills>before&&state.time>=cs.bloodstepRefundAt){cs.skillCharges.skill1=Math.min(cs.skillMaxCharges.skill1,cs.skillCharges.skill1+1);cs.skillCooldowns.skill1=0;cs.bloodstepRefundAt=state.time+flags.bloodstep_refund.cooldown;}state.particles.push({kind:"claw",fxId:"FX_007",x,y,r:130,color:"#b8422f",life:.5,max:.5});}});toast(low?"血步 · 残血无耗":"血步 · 留影待爆",900);return true;}
    if(id==="skill2"){const ratio=player.hp/player.maxHp,lostTens=Math.min(9,Math.floor((1-ratio)*10+1e-6)),damage=skillPower(3+lostTens*(flags.sever_lost_damage?.value||.25)),desperate=ratio<(flags.sever_last_stand?.threshold||0),radius=190*(1+(flags.sever_radius?.value||0))*(desperate?1+(flags.sever_last_stand?.range||0):1);let kills=0;forEachEnemy(enemy=>{if(dist(player,enemy)>radius+enemy.r)return;const before=!enemy.dead;if(desperate)cs.forcedCritUntil=state.time+.1;hitEnemy(enemy,damage,"chihen-life-sever",null,source);if(before&&enemy.dead)kills++;});const cap=flags.sever_heal_cap?.value||.10,heal=Math.min(cap,kills*.01)*player.maxHp;player.hp=Math.min(player.maxHp,player.hp+heal);state.particles.push({kind:"claw",fxId:"FX_007",x:player.x,y:player.y,r:radius,color:"#b8422f",life:.5,max:.5});toast(`断命斩 · 斩 ${kills} · 回生 ${Math.round(heal)}`,1100);return true;}
    if(id==="skill3"){cs.unyieldingUntil=state.time+4;cs.unyieldingFinalized=false;cs.unyieldingDamageStart=state.damage;burst(player.x,player.y,"#b8422f",12,82,"FX_007");toast("不屈 · 四秒不死",1300);return true;}
    if(id==="ultimate"){const strong=cs.livesRemaining>0,save=strong&&flags.blood_prison_save_life&&Math.random()<flags.blood_prison_save_life.chance;if(strong&&!save){cs.livesRemaining--;if(flags.life_spent_buff){player.runtime.damage*=1+flags.life_spent_buff.damage;player.runtime.attackSpeed*=1+flags.life_spent_buff.haste;recalculatePlayerStats();}}cs.bloodPrisonUntil=state.time+(strong?(flags.blood_prison_lv1?8:6):4);cs.bloodPrisonFinalized=false;player.hp=Math.max(1,player.hp);state.shake=15;state.flash=.3;burst(player.x,player.y,"#b8422f",22,135,"FX_007");toast(save?"九命·血狱 · 无命不耗":strong?`九命·血狱 · 余命 ${cs.livesRemaining}`:"血狱残式 · 四秒",1700);return true;}
    return false;
  }
  function castQingyanSkill(id){
    const player=state.player,cs=state.characterState,spirits=livingInkSpirits(),flags=state.growthConfig.flags;
    if(id==="skill1"){cs.convertedTemporary=false;const count=flags.enlighten_count?.value||2,duration=flags.enlighten_duration?.value||10,permanent=livingInkSpirits("mobile").filter(spirit=>!spirit.temporary&&!spirit.big);for(let i=0;i<count;i++){if(permanent.length>=inkSpiritCap())strengthenSpirit(pick(permanent));else addInkSpirit({temporary:true,duration,forceKind:"mobile"});}toast(permanent.length>=inkSpiritCap()?"点灵 · 满阵升星":"点灵 · 万灵入阵",1100);return true;}
    if(id==="skill2"){const existing=state.playerZones.filter(zone=>zone.kind==="qingyan-array");if(existing.length>=(flags.ink_array_count?.value||1))existing.sort((a,b)=>a.life-b.life)[0].life=0;const radius=210*(1+(flags.ink_array_radius?.value||0));state.playerZones.push({kind:"qingyan-array",fxId:"FX_005",vfxTier:3,x:player.x,y:player.y,r:radius,life:6,duration:6,tick:1,nextTick:0,damage:skillPower(flags.ink_array_damage?.value||.8),slow:.35,bindDuration:flags.ink_array_bind?.duration||0,source:{type:"character",id:"qingyan"}});toast("墨阵 · 阵地展开",1100);return true;}
    if(id==="skill3"){const alive=livingInkSpirits("mobile");alive.forEach((spirit,index)=>{const angle=index*TAU/Math.max(1,alive.length);spirit.x=player.x+Math.cos(angle)*68;spirit.y=player.y+Math.sin(angle)*68;spirit.hp=Math.min(spirit.maxHp,spirit.hp+spirit.maxHp*(flags.recall_heal?.value||.5));spirit.buffUntil=state.time+3;});const hits=Math.min(3,alive.length),damage=flags.recall_charge?.damage||1.4;if(hits)damageArea({x:player.x,y:player.y,r:265,damage:skillPower(damage*hits),kind:"qingyan-return",source:{type:"ink-spirit"}});state.particles.push({kind:"claw",fxId:"FX_004",x:player.x,y:player.y,r:265,color:"#536b87",life:.55,max:.55});toast(`归灵 · ${alive.length} 灵归阵`,1100);return true;}
    if(id==="ultimate"){const count=flags.ghost_parade_count?.value||4;for(let i=0;i<count;i++)addInkSpirit({forceKind:"mobile"});for(let i=0;i<(flags.ghost_parade_lv1?2:1);i++)addInkSpirit({temporary:true,big:true,duration:10,forceKind:"mobile"});if(flags.ghost_parade_lv1&&qingyanPool("fixed").length)addInkSpirit({temporary:true,duration:10,forceKind:"fixed"});cs.armyUntil=state.time+10;cs.armyRainTimer=.2;state.shake=10;burst(player.x,player.y,"#d6b66b",20,140,"FX_003");toast("百鬼墨行 · 万灵出纸！",1500);return true;}
    return false;
  }
  function useActiveSkill(id,{force=false}={}){
    if(!state.player||(!force&&state.mode!=="playing"))return false;const cs=state.characterState,skill=combatKitFor(state.character)?.skills?.find(item=>item.id===id);if(!skill||(!force&&((cs.skillCooldowns[id]||0)>0||(cs.skillCharges[id]||0)<=0||cs.skillCastLock>0)))return false;
    const used=state.character.key==="moxiaobai"?castXiaobaiSkill(id):state.character.key==="chihen"?castChihenSkill(id):castQingyanSkill(id);if(!used)return false;
    cs.skillCharges[id]=Math.max(0,(cs.skillCharges[id]||1)-1);const baseCooldown=Math.max(.2,skill.cooldown*state.player.cooldownMul*(cs.nextCooldownRatio||1)-(cs.nextCooldownFlat||0));cs.skillCooldowns[id]=cs.skillCharges[id]>0?0:baseCooldown;cs.nextCooldownRatio=0;cs.nextCooldownFlat=0;cs.skillCastLock=.12;triggerCharacterAnimation(state.player,"attack",{restart:true,target:nearest(state.player.x,state.player.y,700)});updateSkillBar();return true;
  }
  function renderSkillBar(){
    if(!ui.skills||!state.player)return;const kit=combatKitFor(state.character);ui.skills.innerHTML=(kit?.skills||[]).map(skill=>`<button class="active-skill${skill.ultimate?" ultimate":""}" data-active-skill="${skill.id}" title="${skill.name} · ${skill.desc}"><span class="skill-key">${skill.key}</span><b>${skill.icon}</b><small>${skill.name}</small><i></i><em></em></button>`).join("");
    ui.skills.querySelectorAll("[data-active-skill]").forEach(button=>button.addEventListener("pointerdown",event=>{event.preventDefault();useActiveSkill(button.dataset.activeSkill);}));updateSkillBar();
  }
  function updateSkillBar(){
    if(!ui.skills||!state.player)return;const cs=state.characterState,kit=combatKitFor(state.character);for(const skill of kit?.skills||[]){const button=ui.skills.querySelector(`[data-active-skill="${skill.id}"]`);if(!button)continue;const remaining=cs.skillCooldowns?.[skill.id]||0,ratio=clamp(remaining/(skill.cooldown*state.player.cooldownMul),0,1),charges=cs.skillCharges?.[skill.id]||0,max=cs.skillMaxCharges?.[skill.id]||1;button.classList.toggle("cooling",remaining>0||charges<=0);button.style.setProperty("--cooldown",`${ratio*100}%`);const label=button.querySelector("em");if(label)label.textContent=max>1&&charges>0?`${charges}/${max}`:remaining>0?remaining.toFixed(remaining<10?1:0):"READY";}
  }
  function reviveChihen() {
    const cs = state.characterState, player = state.player, mechanics = state.character.mechanics;
    if (state.character.key !== "chihen" || cs.livesRemaining <= 0) return false;
    cs.livesRemaining--; cs.revivesUsed++; cs.shieldCharges += mechanics.reviveShieldCharges || 1;
    const retention = state.growthConfig.revive.retention || mechanics.reviveMaxHpMultiplier;
    const reviveDamage = mechanics.reviveDamageMultiplier, reviveHaste = mechanics.reviveAttackSpeedMultiplier;
    player.base.maxHp = Math.max(8, player.base.maxHp * retention); player.runtime.damage *= reviveDamage; player.runtime.attackSpeed *= reviveHaste; player.runtime.crit += mechanics.reviveCritBonus;
    if (state.growthConfig.flags.revive_afterfire) cs.afterfireUntil = state.time + state.growthConfig.flags.revive_afterfire.duration;
    if (state.growthConfig.flags.post_revive_death_guard) { cs.deathGuardUntil = state.time + state.growthConfig.flags.post_revive_death_guard.duration + (player.growthCards.CARD_NINE_UNYIELDING ? 1 : 0); cs.deathGuardReady = true; }
    if (state.growthConfig.flags.revive_random_mark) {
      const mark = pick(["damage","attackSpeed","crit"]); if (cs.marks[mark] < 2) cs.marks[mark]++;
      const markBoost = player.growthCards.CARD_NINE_DEATHMARK ? 1.25 : 1;
      if (mark === "damage") player.runtime.damage *= 1 + .08 * markBoost; if (mark === "attackSpeed") player.runtime.attackSpeed *= 1 + .08 * markBoost; if (mark === "crit") player.runtime.crit += .05 * markBoost;
    }
    if (state.growthConfig.flags.life_spent_buff) { player.runtime.damage *= 1 + state.growthConfig.flags.life_spent_buff.damage; player.runtime.attackSpeed *= 1 + state.growthConfig.flags.life_spent_buff.haste; }
    recalculatePlayerStats(); player.hp = player.maxHp; player.invuln = 1.5; state.flash = .28; state.shake = 14;
    burst(player.x, player.y, "#b8422f", 18, 95, "FX_007"); toast(`九命复生 · 余命 ${cs.livesRemaining} · 墨环护命`, 2400); return true;
  }
  function updateCharacterAbilities(dt) {
    updateExclusiveWeapon(dt); updateActiveSkills(dt);
    if (state.character.key === "qingyan") { updateLegacySummons(dt); updateInkSpirits(dt); }
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
    const exclusive = combatKitFor(state.character)?.exclusive;
    if (exclusive && player.exclusiveLevel < exclusive.max) pool.push({ type:"exclusive", id:exclusive.id, level:player.exclusiveLevel + 1, ...exclusive, tags:"角色固有 · 不占武器槽" });
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
      const ultimate = ["weapon","exclusive"].includes(choice.type) && choice.level === 7 ? `<strong class="ultimate-label">终极 · ${choice.name}</strong>` : "";
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
    if (choice.type === "exclusive") setExclusiveLevel(choice.level);
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
    return stats;
  }
  function weaponVfxTier(id) {
    const level = state.player?.weapons?.[id] || 1; let tier = level >= 7 ? 3 : level >= 3 ? 2 : 1;
    if (state.growthConfig?.vfx?.weapon && level >= state.growthConfig.vfx.weapon.level) tier = Math.max(tier, state.growthConfig.vfx.weapon.tier);
    if (state.character?.key === "chihen" && state.growthConfig?.flags?.revive_vfx_tier) tier += state.characterState.revivesUsed;
    return clamp(tier, 1, 3);
  }
  function summonVfxTier(summon) {
    let tier = summon.level >= 5 ? 3 : summon.level >= 3 ? 2 : 1;
    if (state.growthConfig?.vfx?.summon && summon.level >= state.growthConfig.vfx.summon.level) tier = Math.max(tier, state.growthConfig.vfx.summon.tier);
    return clamp(tier, 1, 3);
  }
  function heldWeaponTagCount() { return new Set(Object.keys(state.player.weapons).map(id => WEAPONS[id]?.logicTags?.[0]).filter(Boolean)).size; }
  function growthAttackSpeedMultiplier() {
    let multiplier = 1; const flags = state.growthConfig?.flags || {}, count = heldWeaponTagCount(), cs = state.characterState;
    if (flags.weapon_tag_resonance && count >= 3) multiplier *= 1.05;
    if (cs.switchStanceUntil > state.time) multiplier *= 1.18;
    if (state.character.key === "chihen" && cs.afterfireUntil > state.time) multiplier *= 1.30;
    if (state.character.key === "chihen") {
      const lostTens = Math.min(9, Math.floor((1 - state.player.hp / Math.max(1, state.player.maxHp)) * 10 + 1e-6));
      multiplier *= 1 + lostTens * (flags.blood_hunt_haste?.value||.03);
      if(state.player.hp/state.player.maxHp<(flags.low_hp_haste?.threshold||0))multiplier*=1+(flags.low_hp_haste?.value||0);
      if (cs.unyieldingUntil > state.time) multiplier *= flags.unyielding_berserk ? 1+flags.unyielding_berserk.haste : 1.40;
      if (cs.bloodPrisonUntil > state.time) multiplier *= 2;
    }
    if(state.character.key==="moxiaobai")multiplier*=1+(flags.spear_haste?.value||0);
    if (state.character.key === "moxiaobai" && cs.inkEdgeUntil > state.time) multiplier *= 1.80;
    return multiplier;
  }
  function characterDamageMultiplier() {
    const cs = state.characterState;
    let multiplier = 1;
    if (state.character.key === "chihen") {
      const lostTens = Math.min(9, Math.floor((1 - state.player.hp / Math.max(1, state.player.maxHp)) * 10 + 1e-6));
      multiplier *= 1 + lostTens * (state.growthConfig.flags.blood_hunt_damage?.value||.05);
      if(cs.lastLifeUntil>state.time)multiplier*=2;
      if (cs.unyieldingUntil > state.time) multiplier *= state.growthConfig.flags.unyielding_berserk?1+state.growthConfig.flags.unyielding_berserk.damage:1.35;
      if (cs.bloodPrisonUntil > state.time) multiplier *= 1.80;
    }
    if (state.character.key === "qingyan") multiplier *= 1 + Math.min(6, livingInkSpirits().length + state.summons.filter(item => !item.dead).length) * (state.growthConfig.flags.resonance_damage?.value||.06);
    return multiplier;
  }
  function effectiveCritChance() {
    let value = state.player.crit;
    if (state.character.key === "chihen" && state.player.hp / Math.max(1, state.player.maxHp) < .30) value += .15+(state.growthConfig.flags.blood_eye?.value||0);
    if (state.character.key === "chihen" && state.characterState.bloodPrisonUntil > state.time) value += .30;
    return clamp(value, 0, 1);
  }
  function effectiveMoveSpeedMultiplier() {
    if (state.character.key === "moxiaobai" && state.characterState.inkEdgeUntil > state.time) return 1.25;
    if (state.character.key === "chihen" && state.characterState.bloodPrisonUntil > state.time) return 1.20;
    if(state.character.key==="chihen"&&state.characterState.unyieldingUntil>state.time&&state.growthConfig.flags.unyielding_berserk)return 1+state.growthConfig.flags.unyielding_berserk.speed;
    return 1;
  }
  function growthWeaponDamageMultiplier() {
    let multiplier = 1; const flags = state.growthConfig?.flags || {}, count = heldWeaponTagCount();
    if (flags.weapon_tag_resonance && count >= 2) multiplier *= 1.04;
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
      if (fired) { sound("shoot"); triggerCharacterAnimation(player, "attack", { target: nearest(player.x, player.y, stats.range || 620) }); }
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
  const vfxByLegacy=Object.fromEntries(Object.values(VFX_LIBRARY||{}).map(item=>[item.legacy_fx_id,item]));
  function playVFX(id, options={}) {
    if(!state?.particles)return null;
    const data=VFX_LIBRARY?.[id]||vfxByLegacy[id]||{id,legacy_fx_id:id,renderer:"burst"},fxId=options.fxId||data.legacy_fx_id||"FX_001",renderer=options.renderer||data.renderer||"burst",color=options.color||data.color||fxMeta(fxId).color;
    if(renderer==="beam"){
      const life=options.duration||data.duration||.14;state.particles.push({kind:"beam",resourceId:data.id||id,fxId,weaponId:options.weaponId||null,vfxTier:options.vfxTier||1,visual:fxMeta(fxId).visual,x:options.x||0,y:options.y||0,x2:options.x2??options.x??0,y2:options.y2??options.y??0,color,life,max:life});return data;
    }
    if(renderer==="pulse"||renderer==="zone"||renderer==="warning"){
      const life=options.duration||data.duration||.42;state.particles.push({kind:"claw",resourceId:data.id||id,fxId,weaponId:options.weaponId||null,vfxTier:options.vfxTier||1,visualKind:data.shape||renderer,x:options.x||0,y:options.y||0,r:(options.radius||55)*(options.scale||1),color,life,max:life});return data;
    }
    let count=Math.round((options.count||data.count||10)*(options.scale||1)),radius=(options.radius||data.radius||55)*(options.scale||1);count=Math.min(count,fxMeta(fxId).maxParticles||count);
    for (let index = 0; index < count; index++) {
      const angle = index / count * TAU + rand(-.15, .15);
      const life=options.duration||data.duration||.35;state.particles.push({ kind:"dot",resourceId:data.id||id,fxId,visual:fxMeta(fxId).visual,x:options.x||0,y:options.y||0,vx:Math.cos(angle)*rand(radius,radius*2),vy:Math.sin(angle)*rand(radius,radius*2),r:rand(2,5)*(options.scale||1),color,life,max:life });
    }
    return data;
  }
  function beam(x1, y1, x2, y2, color, fxId = "FX_003", weaponId = null, vfxTier = null) { playVFX(fxId,{renderer:"beam",x:x1,y:y1,x2,y2,color,fxId,weaponId,vfxTier:vfxTier || (weaponId ? weaponVfxTier(weaponId) : 1)}); }
  function burst(x, y, color, count = 10, radius = 55, fxId = "FX_002") { playVFX(fxId,{renderer:"burst",x,y,color,count,radius,fxId}); }
  function pushFrom(entity, source, amount) {
    const angle = Math.atan2(entity.y - source.y, entity.x - source.x);
    entity.x = clamp(entity.x + Math.cos(angle) * amount, entity.r || 20, WORLD_W - (entity.r || 20));
    entity.y = clamp(entity.y + Math.sin(angle) * amount, entity.r || 20, WORLD_H - (entity.r || 20));
  }

  function spawnEnemy(type, elite = false) {
    const player = state.player, angle = rand(0, TAU), radius = Math.max(viewW, viewH) * .62 + rand(80, 180), data = ENEMY_TYPES[type];
    if (!data) return;
    const progress = state.duration ? state.time / state.duration : 0, scale = 1 + progress * 2.05, isElite = elite || data.category === "elite", modifiers = isElite ? (data.elite_modifiers || {}) : {};
    const hpScale = isElite ? (modifiers.hp || 4.2) : 1, damageScale = isElite ? (modifiers.damage || 1.35) : 1, speedScale = isElite ? (modifiers.speed || 1.06) : 1, radiusScale = isElite ? (modifiers.radius || 1.35) : 1, xpScale = isElite ? (modifiers.xp || 7) : 1;
    state.enemies.push({
      ...data, type, x: clamp(player.x + Math.cos(angle) * radius, 40, WORLD_W - 40), y: clamp(player.y + Math.sin(angle) * radius, 40, WORLD_H - 40),
      hp: data.hp * scale * hpScale, maxHp: data.hp * scale * hpScale, speed: data.speed * (1 + progress * .16) * speedScale,
      damage: data.damage * (1 + progress * .65) * damageScale, r: data.r * radiusScale, xp: data.xp * xpScale, elite:isElite,
      shot: rand(.35, data.attack_cooldown || 1.1), dead: false, phase: rand(0, TAU), animation:createConfiguredAnimation(data)
    });
  }
  function timelinePhase(time = state.time) {
    const phases=RUN_TIMELINE?.phases || []; return phases.find(item=>time>=item.start&&time<item.end) || phases[phases.length-1] || {name:"庭院试炼",spawn_interval:[.74,.24],batch:[1,6],max_enemies:150};
  }
  function weightedEnemyPick(time = state.time) {
    const pool=Object.entries(ENEMY_TYPES).filter(([,data])=>data.category!=="elite"&&(data.available_time||0)<=time&&(data.spawn_weight||0)>0);
    if(!pool.length)return Object.keys(ENEMY_TYPES)[0];
    let roll=Math.random()*pool.reduce((sum,[,data])=>sum+(data.spawn_weight||1),0);
    for(const [id,data] of pool){roll-=data.spawn_weight||1;if(roll<=0)return id;}return pool[pool.length-1][0];
  }
  function spawnTick(dt) {
    state.lastSpawn -= dt;
    if (state.lastSpawn > 0 || state.bossSpawned) return;
    const phase=timelinePhase(), progress=clamp((state.time-phase.start)/Math.max(1,phase.end-phase.start),0,1), batch=Math.round(lerp(phase.batch?.[0]||1,phase.batch?.[1]||4,progress));
    for (let index = 0; index < batch && state.enemies.length < (phase.max_enemies || 150); index++) spawnEnemy(weightedEnemyPick());
    state.lastSpawn = Math.max(.12,lerp(phase.spawn_interval?.[0]||.74,phase.spawn_interval?.[1]||.24,progress));
  }
  function forEachEnemy(callback) { for (const enemy of state.enemies) if (!enemy.dead) callback(enemy); if (state.boss && !state.boss.dead) callback(state.boss); }

  function updateEnemies(dt) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.dead) { updateConfiguredAnimation(enemy,dt,0,0); continue; }
      enemy.phase += dt * 4;
      if ((enemy.stunUntil || 0) > state.time) continue;
      const distance = dist(enemy, player), angle = Math.atan2(player.y - enemy.y, player.x - enemy.x), moveScale = (enemy._slowUntil || 0) > state.time ? Math.max(.45, 1 - (enemy._slowAmount || .2)) : 1;
      let dx=Math.cos(angle),dy=Math.sin(angle),speedFactor=enemy.ai_type==="rush"?1.08:1;
      if(enemy.ai_type==="zigzag"){const sway=Math.sin(enemy.phase*1.7)*.42,cos=Math.cos(sway),sin=Math.sin(sway);[dx,dy]=[dx*cos-dy*sin,dx*sin+dy*cos];}
      if (enemy.ranged && distance < (enemy.preferred_range || 310)) {
        dx*=-.42;dy*=-.42;enemy.shot -= dt;
        if (enemy.shot <= 0) { enemyShot(enemy.x, enemy.y, angle, enemy.projectile_kind || "sting", enemy.damage); enemy.shot = enemy.attack_cooldown || 2.1; triggerConfiguredAnimation(enemy,"attack"); }
      }
      enemy.x=clamp(enemy.x+dx*enemy.speed*moveScale*speedFactor*dt,enemy.r,WORLD_W-enemy.r);enemy.y=clamp(enemy.y+dy*enemy.speed*moveScale*speedFactor*dt,enemy.r,WORLD_H-enemy.r);updateConfiguredAnimation(enemy,dt,dx,dy);
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
    const spiritSource = source?.type === "ink-spirit";
    if (!summonSource && !spiritSource) raw *= characterDamageMultiplier();
    const forcedCrit = !summonSource && !spiritSource && cs.forcedCritUntil > state.time;
    const growthCrit = state.growthConfig.flags.weapon_tag_resonance && heldWeaponTagCount() >= 4 ? .04 : 0;
    const summonCrit = summonSource && state.player.growthCards.CARD_SUM_FORMATION ? .08 : 0;
    const critical = summonSource || spiritSource ? Math.random() < summonCrit : forcedCrit || Math.random() < effectiveCritChance() + growthCrit, damage = raw * (critical ? state.player.critDamage : 1);
    if (forcedCrit) cs.forcedCritUntil = 0;
    enemy.hp -= damage; state.damage += damage; recordDamage(damage); state.highHit = Math.max(state.highHit, damage);
    if(enemy!==state.boss)triggerConfiguredAnimation(enemy,"hit");
    if (state.character.key === "chihen" && !summonSource && !spiritSource && state.growthConfig.flags.low_hp_lifesteal && state.player.hp / Math.max(1, state.player.maxHp) < state.growthConfig.flags.low_hp_lifesteal.threshold) state.player.hp = Math.min(state.player.maxHp, state.player.hp + damage * state.growthConfig.flags.low_hp_lifesteal.value);
    enemy.lastHitSource = source || null;
    if (state.character.key === "moxiaobai" && (weaponId === "exclusive-moxiaobai" || kind.startsWith("xiaobai"))) enemy._xiaobaiWeaponHitUntil = state.time + 1;
    if (weaponId) state.weaponDamage[weaponId] = (state.weaponDamage[weaponId] || 0) + damage;
    textPop(enemy.x, enemy.y - enemy.r, Math.round(damage), critical ? "#d39b35" : "#f8f1e3", critical ? 18 : 12);
    if (kind === "bell" && Math.random() < .25) enemy.slow = .35;
    if (enemy.hp <= 0) killEnemy(enemy, source || enemy.lastHitSource);
  }
  function killEnemy(enemy, source = null) {
    enemy.deathX = clamp(enemy.x, enemy.r || 20, WORLD_W - (enemy.r || 20));
    enemy.deathY = clamp(enemy.y, enemy.r || 20, WORLD_H - (enemy.r || 20));
    enemy.dead = true; enemy.death = Math.max(.3,configuredAnimationDuration(enemy,"death")); triggerConfiguredAnimation(enemy,"death"); state.kills++; if (enemy.elite) state.elites++;
    if (state.character.key === "moxiaobai") {
      const flags=state.growthConfig.flags,cs=state.characterState;
      if(source?.id==="xiaobai-exclusive"&&flags.spear_kill_charge&&!cs.spearCharged){cs.spearKillCounter=(cs.spearKillCounter||0)+1;if(cs.spearKillCounter>=flags.spear_kill_charge.kills){cs.spearCharged=true;textPop(state.player.x,state.player.y-44,"万枪归一","#83b8b0",16);}}
      if(cs.inkEdgeUntil>state.time&&flags.xiaobai_ultimate_final){cs.ultimateKills=(cs.ultimateKills||0)+1;if(cs.ultimateKills%10===0){const extended=Math.max(0,cs.inkEdgeUntil-cs.ultimateBaseEnd);if(extended<flags.xiaobai_ultimate_final.maxExtend)cs.inkEdgeUntil+=Math.min(flags.xiaobai_ultimate_final.killExtend,flags.xiaobai_ultimate_final.maxExtend-extended);}}
      if(flags.dash_mastery&&Math.random()<flags.dash_mastery.chance){cs.skillCharges.skill1=Math.min(cs.skillMaxCharges.skill1,cs.skillCharges.skill1+1);if(cs.skillCharges.skill1>0)cs.skillCooldowns.skill1=0;}
    }
    if (state.character.key === "qingyan" && (source?.type === "ink-spirit" || source?.type && SUMMONS[source.type])) {
      onSummonKill();
      if(source?.type==="ink-spirit"&&source.temporary&&!source.big&&state.growthConfig.flags.enlighten_permanent&&!state.characterState.convertedTemporary){source.kills=(source.kills||0)+1;if(source.kills>=state.growthConfig.flags.enlighten_permanent.kills){const permanent=livingInkSpirits("mobile").filter(spirit=>!spirit.temporary&&!spirit.big);if(permanent.length>=inkSpiritCap()){strengthenSpirit(pick(permanent));source.dead=true;}else{source.temporary=false;source.expiresAt=0;}state.characterState.convertedTemporary=true;textPop(source.x,source.y-34,"化真","#d6b66b",17);burst(source.x,source.y,"#d6b66b",12,70,"FX_003");}}
    }
    const bloodBladeEnabled=(state.player.exclusiveLevel||1)>=5||state.growthConfig.flags.blood_blade;
    if (state.character.key === "chihen" && source?.id === "chihen-exclusive" && bloodBladeEnabled && Math.random() < (state.growthConfig.flags.blood_blade?.chance||.20)) {
      const target = nearest(enemy.x, enemy.y, 420);
      if (target) shoot(enemy.x, enemy.y, target, { kind:"chihen-blood-blade", color:"#b8422f", damage:skillPower((state.player.exclusiveLevel || 1) >= 6 ? 1.10 : state.growthConfig.flags.blood_blade?.damage||.85), speed:650, range:520, r:7, bounces:state.growthConfig.flags.blood_blade_chain?.value||2, retention:.8, fxId:"FX_007", source:{type:"character",id:"chihen-blood-blade"}, scaleWithPlayer:false, vfxTier:2 });
    }
    if(state.character.key==="chihen"&&source?.id==="chihen-blood-blade"&&state.growthConfig.flags.blood_blade_kill_haste)state.characterState.exclusiveTimer*=1-state.growthConfig.flags.blood_blade_kill_haste.value;
    if (enemy === state.boss) {
      state.coins += 80; burst(enemy.x, enemy.y, "#ad853d", 44, 150); toast("泼墨狸将收笔认输！", 2800); ui.bossHud.classList.add("hidden");
      if (!state.dev) setTimeout(() => endGame(true), 2200);
      return;
    }
    const count = enemy.elite ? 4 : 1;
    for (let index = 0; index < count; index++) state.pickups.push({ kind: "xp", x: enemy.x + rand(-12, 12), y: enemy.y + rand(-12, 12), value: enemy.xp / count, r: enemy.elite ? 8 : 5 });
    if (Math.random() < (enemy.elite ? .75 : .08)) state.pickups.push({ kind: "coin", x: enemy.x, y: enemy.y, value: enemy.elite ? 18 : pick([1, 2, 3]), r: 7 });
    if (Math.random() < .012) state.pickups.push({ kind: "heart", x: enemy.x, y: enemy.y, value: 14, r: 9 });
    playVFX(enemy.death_effect || "death_ink", {x:enemy.x,y:enemy.y,scale:enemy.elite?1.7:1,color:enemy.elite?"#b8422f":undefined});
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
    const spiritWard=state.character.key==="qingyan"&&state.growthConfig.flags.summon_ward?Math.min(.30,Math.floor(livingInkSpirits().length/state.growthConfig.flags.summon_ward.per)*state.growthConfig.flags.summon_ward.value):0;
    const wardReduction = Math.max(spiritWard,state.character.key === "qingyan" && cs.wardUntil > state.time ? .35 : 0);
    const unyieldingReduction = state.character.key === "chihen" && cs.unyieldingUntil > state.time ? (state.growthConfig.flags.unyielding_berserk?0:state.growthConfig.flags.unyielding_reduction?.value||.50) : 0;
    const damage = Math.max(1, raw * (1 - player.armor) * (1 - wardReduction) * (1 - unyieldingReduction));
    player.hp -= damage; player.invuln = .62; state.taken += damage; state.shake = 8; state.flash = .15; sound("hurt"); triggerCharacterAnimation(player, "hit", { restart: true, target: { x: sourceX, y: sourceY } });
    textPop(player.x, player.y - 30, `-${Math.round(damage)}`, "#d44f42", 17); pushFrom(player, { x: sourceX, y: sourceY }, 20);
    if (player.hp <= 0 && state.character.key === "chihen" && cs.unyieldingUntil > state.time) { player.hp = 1; player.invuln = .2; textPop(player.x, player.y - 34, "不屈", "#f0c6aa", 16); return; }
    if (player.hp <= 0 && state.character.key === "chihen" && cs.bloodPrisonUntil > state.time) { player.hp = 1; player.invuln = .2; return; }
    if (player.hp <= 0 && state.character.key === "chihen" && cs.lastLifeUntil > state.time) { player.hp = 1; player.invuln = .2; return; }
    if (player.hp <= 0 && state.character.key === "chihen" && cs.deathGuardReady && cs.deathGuardUntil > state.time) { player.hp = 1; cs.deathGuardReady = false; player.invuln = .6; burst(player.x, player.y, "#b8422f", 12, 66, "FX_007"); textPop(player.x, player.y - 34, "不屈残火", "#f0c6aa", 16); return; }
    if(player.hp<=0&&state.character.key==="chihen"&&cs.livesRemaining===1&&state.growthConfig.flags.last_life_immortal&&!cs.lastLifePending){player.hp=1;cs.lastLifePending=true;cs.lastLifeUntil=state.time+state.growthConfig.flags.last_life_immortal.duration;player.invuln=.35;burst(player.x,player.y,"#b8422f",18,95,"FX_007");toast("九命不灭 · 最后一命燃烧",1800);return;}
    if (player.hp <= 0 && !reviveChihen()) beginPlayerDeath();
  }

  function beginPlayerDeath() {
    if (state.mode === "dying" || state.mode === "result") return;
    const player = state.player, animated = triggerCharacterAnimation(player, "death", { force: true, restart: true });
    if (!animated) { endGame(false); return; }
    player.moving = false; state.mode = "dying"; state.deathTimer = characterAnimationDuration(state.character, "death"); ui.joystick.classList.add("hidden");
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
    if (boss.summon <= 0) { for (let index = 0; index < (boss.phase === 1 ? 2 : 4); index++) spawnEnemy(pick(["inkSpirit", "shadowMouse"])); boss.summon = boss.phase === 1 ? 8 : 5; }
  }

  function damageArea(effect) {
    let hits = 0;
    forEachEnemy(enemy => {
      if (dist(effect, enemy) >= effect.r + enemy.r) return;
      hits++; hitEnemy(enemy, effect.damage, effect.kind, effect.weaponId, effect.source || null);
      if (effect.knockback) pushFrom(enemy, effect, effect.knockback * (enemy === state.boss ? .22 : 1));
      if (effect.slow) { enemy._slowUntil = Math.max(enemy._slowUntil || 0, state.time + (effect.slowDuration || .8)); enemy._slowAmount = Math.max(enemy._slowAmount || 0, effect.slow); }
    });
    return hits;
  }
  function explodeProjectile(projectile) {
    if (projectile.exploded) return; projectile.exploded = true;
    damageArea({ x: projectile.x, y: projectile.y, r: projectile.explodeRadius, damage: projectile.damage, kind: projectile.kind.includes("chihen") ? "chihen-blood-blade-burst" : "inkblast", weaponId: projectile.weaponId, source:projectile.source||null });
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
      if (zone.nextTick <= 0 && zone.life > 0) { zone.nextTick += zone.tick; damageArea(zone);if(zone.bindDuration){forEachEnemy(enemy=>{if(dist(zone,enemy)>=zone.r+enemy.r)return;enemy._boundZones||=new Set();if(!enemy._boundZones.has(zone)){enemy._boundZones.add(zone);enemy.stunUntil=Math.max(enemy.stunUntil||0,state.time+zone.bindDuration);}});} }
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
    recalculatePlayerStats({ healDelta:true });
    if (state.pendingLevels > 0 && state.mode === "playing") { state.pendingLevels--; openUpgrade(false); }
  }
  function spawnObject(kind, label) {
    const player = state.player, angle = rand(0, TAU), radius = rand(260, 420);
    state.pickups.push({ kind, x: clamp(player.x + Math.cos(angle) * radius, 80, WORLD_W - 80), y: clamp(player.y + Math.sin(angle) * radius, 80, WORLD_H - 80), r: 22, label });
    toast(`${label} 已出现在附近`, 2400);
  }
  function runTimelineEvent(event) {
    if(event.type==="object")spawnObject(event.object,event.label);
    if(event.type==="enemy_wave"){for(const entry of event.enemies||[])for(let index=0;index<(entry.count||1);index++)spawnEnemy(entry.id,Boolean(entry.elite));if(event.label)toast(event.label);}
    if(event.type==="boss"){spawnBoss();if(event.label)toast(event.label,2600);}
  }
  function schedules() {
    for(const event of RUN_TIMELINE?.events||[]){if(state.schedules[event.id]||state.time<event.at)continue;state.schedules[event.id]=true;runTimelineEvent(event);}
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
    if (choice.type === "exclusive") setExclusiveLevel(choice.level);
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
    updatePlayerAnimation(player, dt, x, y);
    if (player.moving) {
      x /= Math.max(1, length); y /= Math.max(1, length);
      const oldX = player.x, oldY = player.y;
      // Keep the full 84px hero sprite inside the ink-court border as well as the
      // smaller physics circle. This also prevents camera-edge oscillation.
      const edgeInset = Math.max(60, player.r);
      const moveSpeed = player.speed * effectiveMoveSpeedMultiplier();
      player.x = clamp(player.x + x * moveSpeed * dt, edgeInset, WORLD_W - edgeInset); player.y = clamp(player.y + y * moveSpeed * dt, edgeInset, WORLD_H - edgeInset);
      player.movedDistance += Math.hypot(player.x - oldX, player.y - oldY); player.facing = x < 0 ? -1 : x > 0 ? 1 : player.facing || 1;
      if (state.growthConfig.flags.distance_charge && player.movedDistance >= state.growthConfig.flags.distance_charge.distance) state.characterState.stepEdgeCharged = true;
    }
    player.invuln = Math.max(0, player.invuln - dt);
  }
  function remainingDay(time=state.time){return Math.max(0,Math.round((RUN_TIMELINE?.start_day||66)*(1-clamp(time/state.duration,0,1))));}
  function phase() { if (state.bossSpawned) return "0日 · 最终决战"; return `${remainingDay()}日 · ${timelinePhase().name}`; }
  function update(dt) {
    if (state.mode === "dying") {
      if (state.dev && state.devLabOpen && state.devRunPaused) return;
      updatePlayerAnimation(state.player, dt, 0, 0); updateFx(dt); state.deathTimer -= dt; state.shake = Math.max(0, state.shake - dt * 30); state.flash = Math.max(0, state.flash - dt);
      if (state.deathTimer <= 0) endGame(false);
      return;
    }
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
    else if (state.character.key === "qingyan") { const alive = state.summons.filter(summon => !summon.dead).length + livingInkSpirits().length, empowered = Math.max(0, cs.empowerUntil - state.time); ui.mechanic.className = `character-mechanic qingyan${empowered > 0 || cs.armyUntil > state.time ? " empowered" : ""}`; ui.mechanic.style.setProperty("--energy", `${cs.energy / cs.energyMax * 100}%`); ui.mechanic.innerHTML = `<b>墨灵 ${alive}</b><span>墨能 ${Math.floor(cs.energy)}/${cs.energyMax}</span><small>${cs.armyUntil > state.time ? `百鬼墨行 ${(cs.armyUntil-state.time).toFixed(1)}s` : empowered > 0 ? `共鸣 ${empowered.toFixed(1)}s` : cs.deathLinkUntil > state.time ? "阵亡联动强化" : "画灵共鸣 · 每只 +6%"}</small>`; }
    else { ui.mechanic.className = "character-mechanic hidden"; ui.mechanic.textContent = ""; }
  }
  function updateDock() {
    if (!state.player) return;
    ui.dock.innerHTML = "";
    const exclusive=combatKitFor(state.character)?.exclusive;if(exclusive)ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot exclusive-slot" title="${exclusive.name}">${exclusive.icon}<small>${state.player.exclusiveLevel}</small></div>`);
    Object.entries(state.player.weapons).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${WEAPONS[id].name}">${WEAPONS[id].icon}<small>${level}</small></div>`));
    Object.entries(state.player.devices).forEach(([id, level]) => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot" title="${DEVICES[id].name}">${DEVICES[id].icon}<small>${level}</small></div>`));
    state.summons?.forEach(summon => ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot summon-slot vfx-tier-${summonVfxTier(summon)}${summon.dead ? " is-dead" : ""}" title="${summon.name}">${summon.icon}<small>${summon.dead ? "归" : summon.level}</small></div>`));
    if(state.character.key==="qingyan"&&livingInkSpirits().length)ui.dock.insertAdjacentHTML("beforeend", `<div class="weapon-slot summon-slot vfx-tier-2" title="当前墨灵">灵<small>${livingInkSpirits().length}</small></div>`);
  }
  function buildSummary() {
    const items = [];
    const exclusive=combatKitFor(state.character)?.exclusive;if(exclusive)items.push([`${exclusive.icon} ${exclusive.name}`,`Lv.${state.player.exclusiveLevel}`]);
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
    let spReward = 0;
    if (!state.dev) {
      profile.best = Math.max(profile.best, Math.floor(survived)); profile.coins += reward; if (win) profile.wins++;
      spReward=Math.max(1,Math.floor(state.player.level/6))+(win?2:0);growth.sp+=spReward;saveGrowth();
      saveProfile();
    }
    $("resultBadge").textContent = win ? "胜" : "止"; $("resultKicker").textContent = win ? "墨战落幕" : "本次试炼结束"; $("resultTitle").textContent = win ? "旧庭重归宁静" : "这一笔尚未写完";
    $("resultLine").textContent = state.dev ? "DEV 测试数据未写入正式存档。" : win ? `最后一笔落下，群墨归纸。获得 ${spReward} 修行点。` : `保留经验，获得 ${spReward} 修行点。`;
    $("resultStats").innerHTML = [["存活", fmt(survived)], ["击散", state.kills], ["最高伤害", Math.round(state.highHit)], ["获得铜钱", reward], ["修行点", state.dev?0:spReward]].map(item => `<div class="stat"><b>${item[1]}</b><small>${item[0]}</small></div>`).join("");
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
    const animationConfig = animationConfigFor(activeCharacter);
    const playerNode = ensureNode(playerId, `entity player character-${activeCharacter.key} vfx-tier-${characterVfxTier}${animationConfig ? " animated-character" : ""}${state.player.moving ? " moving" : ""}${state.player.invuln > 0 ? " invulnerable" : ""}${activeCharacter.key === "chihen" && cs.shieldCharges ? " shielded" : ""}`, imageMarkup(combatResource(activeCharacter)));
    if (animationConfig) updateCharacterSprite(playerNode, activeCharacter, state.player);
    playerNode.dataset.animationState = state.player.animation?.state || "idle"; playerNode.dataset.direction = state.player.animation?.direction || "down"; playerNode.dataset.frame = String(state.player.animation?.frame || 0);
    playerNode.style.setProperty("--facing", state.player.facing || 1); playerNode.style.setProperty("--revive-stacks", cs.revivesUsed || 0); playerNode.style.setProperty("--sprite-anchor-y", `${-(animationConfig?.anchor?.y || .975) * 100}%`); place(playerNode, state.player.x, state.player.y);

    if (activeCharacter.key === "qingyan" && cs.wardUntil > state.time) {
      const id = "qingyan-ward"; active.add(id); const ward = ensureNode(id, "qingyan-ward"); place(ward, state.player.x, state.player.y);
    }
    for (const summon of state.summons || []) if (!summon.dead) {
      const id = objectId(summon, "summon"); active.add(id); const empowered = cs.empowerUntil > state.time || cs.deathLinkUntil > state.time || summon.buffUntil > state.time, tier = summonVfxTier(summon);
      const node = ensureNode(id, `summon summon-${summon.type} vfx-tier-${tier}${empowered ? " empowered" : ""}`, `${imageMarkup(summon, summon.name)}<i></i>`); node.title = `${summon.name} Lv.${summon.level} ${Math.ceil(summon.hp)}/${Math.ceil(summon.maxHp)}`; node.style.setProperty("--summon-hp", `${clamp(summon.hp / summon.maxHp * 100, 0, 100)}%`); place(node, summon.x, summon.y, tier === 3 ? 1.08 : 1);
    }
    for (const spirit of state.inkSpirits || []) if (!spirit.dead) {
      const id=objectId(spirit,"ink-spirit");active.add(id);const empowered=spirit.buffUntil>state.time||cs.armyUntil>state.time;
      const node=ensureNode(id,`summon summon-mouse ink-spirit${spirit.big?" big-spirit":""}${spirit.temporary?" temporary-spirit":""}${empowered?" empowered":""}`,`${imageMarkup(spirit,spirit.name)}<i></i>`);node.title=`${spirit.name} ${Math.ceil(spirit.hp)}/${Math.ceil(spirit.maxHp)}`;node.style.setProperty("--summon-hp",`${clamp(spirit.hp/spirit.maxHp*100,0,100)}%`);place(node,spirit.x,spirit.y,spirit.big?1.35:spirit.temporary?1.05:.92);
    }
    for (const echo of cs.echoes || []) {
      const id = objectId(echo,"summon-echo"); active.add(id); const art = SUMMONS[echo.type]; const node = ensureNode(id, `summon summon-${echo.type} summon-echo vfx-tier-2`, imageMarkup(art, "余魂墨影")); node.style.opacity = String(clamp(echo.life / echo.max * .58,0,.58)); place(node,echo.x,echo.y,.92);
    }

    for (const enemy of state.enemies) {
      const id = objectId(enemy, "enemy"); active.add(id);
      const asset=assetEntry(enemy),hasAnimation=Object.values(asset?.animations||{}).some(stateFrames=>Object.values(stateFrames||{}).some(frames=>Array.isArray(frames)&&frames.length)),size = Math.max(48, enemy.r * (enemy.elite ? 4.6 : 4.1))*(asset?.scale||1);
      const node = ensureNode(id, `entity enemy ${enemy.art_variant || ""}${enemy.elite ? " elite" : ""}${enemy.dead ? " dying" : ""}${hasAnimation?" configured-sprite":""}`, imageMarkup(configuredFrameResource(enemy),enemy.name));
      node.style.width = `${size}px`; node.style.height = `${size}px`;
      node.style.setProperty("--sprite-anchor-y",`${-(asset?.anchor?.y||.86)*100}%`);
      place(node, enemy.dead ? enemy.deathX : enemy.x, enemy.dead ? enemy.deathY : enemy.y + Math.sin(enemy.phase) * 2);
    }
    if (state.boss && !state.boss.dead) {
      const id = "boss"; active.add(id);
      const node = ensureNode(id, `entity boss phase-${state.boss.phase}`, imageMarkup(BOSS));
      place(node, state.boss.x, state.boss.y,assetEntry(BOSS)?.scale||1);
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
  function clearBattlefield() { clearAllEnemies(); state.projectiles = []; state.pickups = []; state.particles = []; state.texts = []; state.playerZones = []; state.weaponPulses = []; state.orbiters = []; state.devices = []; state.inkSpirits = []; state.delayedEffects = []; syncTurretDevice(); }
  function spawnMixed(count) { for (let index = 0; index < count; index++) spawnEnemy(weightedEnemyPick()); }
  function spawnEnemyBatch(type, count, elite = false) { if (!ENEMY_TYPES[type]) return; for (let index = 0; index < count; index++) spawnEnemy(type, elite); }
  function triggerEliteWave() { const ids=Object.keys(ENEMY_TYPES).filter(id=>ENEMY_TYPES[id].category==="elite");for (let index = 0; index < 4; index++) spawnEnemy(pick(ids)); }
  function triggerChest() { spawnObject("chest", "宝箱"); }
  function setTimelineTime(time,bossNow=false){state.time=clamp(time,0,state.duration);for(const event of RUN_TIMELINE?.events||[])state.schedules[event.id]=event.at<=state.time;if(bossNow)spawnBoss();updateHud();}
  function setStage(progress, bossNow = false) { setTimelineTime(clamp(progress,0,1)*state.duration,bossNow); }
  function setTimelineDay(day){const numeric=Math.max(0,Math.min(RUN_TIMELINE?.start_day||66,Number(day)||0)),mapped=RUN_TIMELINE?.dev_days?.[numeric],time=Number.isFinite(mapped)?mapped:state.duration*(1-numeric/(RUN_TIMELINE?.start_day||66));clearAllEnemies();setTimelineTime(time,numeric===0);toast(numeric===0?"0日 · Boss 测试":"已跳转至剩余天数："+numeric+"日",1500);}
  function forceBossPhase2() { const boss = state.boss || spawnBoss(); boss.hp = Math.min(boss.hp, boss.maxHp * .45); boss.phase = 2; }
  function setBossHealth(ratio) { const boss = state.boss || spawnBoss(); boss.hp = clamp(Number(ratio), 0, 1) * boss.maxHp; }
  function killBossForTest() { const boss = state.boss || spawnBoss(); hitEnemy(boss, boss.hp + 1, "dev"); }
  function healFull() { if (state.player) state.player.hp = state.player.maxHp; }
  function setPlayerLevel(level) { const player = state.player; player.level = Math.max(1, Math.round(level)); player.nextXp = levelXpRequirement(player.level); player.xp = clamp(player.xp || 0, 0, player.nextXp - 1); recalculatePlayerStats(); }
  function setPlayerValue(key, value) {
    const player = state.player, number = Number(value); if (!Number.isFinite(number)) return;
    if (key === "level") setPlayerLevel(number); else if (key === "hp") player.hp = clamp(number, 0, player.maxHp); else if (key === "coins") state.coins = Math.max(0, number); else if (key === "rerolls") state.rerolls = Math.max(0, Math.round(number));
    else if (["maxHp", "attack", "speed", "damageMul", "attackSpeed", "crit", "critDamage", "cooldownMul", "armor", "pickup", "size"].includes(key)) { player.base[key] = number; recalculatePlayerStats(); }
    updateHud();
  }
  function resetDevPlayer() { if (!state.dev) return; const x = state.player.x, y = state.player.y, character = state.character || CHARACTER; state.growthConfig = compileGrowthConfig(character); state.slotRules = { ...character.slot_rules, weapon:character.slot_rules.weapon + (state.growthConfig.slots.weapon || 0), device:character.slot_rules.device + (state.growthConfig.slots.device || 0), summon:character.slot_rules.summon + (state.growthConfig.slots.summon || 0) }; state.player = createPlayer(character, true, state.growthConfig); state.player.x = x; state.player.y = y; state.devices = []; initializeCharacterRun(); recalculatePlayerStats(); updateDock(); updateHud(); }
  function applyPreset(name) {
    const levels = { early: 3, mid: 10, late: 18, boss: 22, max: 35, stress: 60 }, progress = { early: .1, mid: .4, late: .75, boss: .84, max: .75, stress: .75 };
    clearBattlefield(); resetDevPlayer(); state.time = (progress[name] || .1) * state.duration;
    state.timers = { ...Object.fromEntries(Object.keys(WEAPONS).map(id => [id, 0])), trap: 2, turret: 0 };
    setPlayerLevel(levels[name] || 1);
    const giveWeapons = entries => Object.entries(entries).forEach(([id, level]) => setWeaponLevel(id, level));
    if (name === "early") { setExclusiveLevel(2); giveWeapons({ yarn: 1 }); spawnMixed(8); }
    if (name === "mid") { setExclusiveLevel(4); giveWeapons({ yarn: 3, fish: 3, paw: 2, ink: 2 }); setPassiveLevel("power", 1); setPassiveLevel("haste", 1); setDeviceLevel("turret", 1); spawnMixed(30); }
    if (name === "late") { setExclusiveLevel(6); giveWeapons({ yarn: 5, fish: 5, paw: 4, laser: 5, ink: 4, fan: 3, mist: 3, wave: 3 }); setPassiveLevel("power", 3); setPassiveLevel("haste", 2); setPassiveLevel("health", 2); setDeviceLevel("turret", 3); setDeviceLevel("trap", 2); spawnMixed(60); }
    if (name === "boss") { setExclusiveLevel(7); giveWeapons({ yarn: 5, fish: 4, paw: 4, laser: 5, ink: 5, fan: 4, wave: 4, chain: 4 }); setPassiveLevel("power", 3); setPassiveLevel("haste", 3); setPassiveLevel("health", 2); setPassiveLevel("armor", 2); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, DEVICES[id].max)); spawnBoss(); }
    if (["max", "stress"].includes(name)) { setExclusiveLevel(7); Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, WEAPONS[id].max)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, PASSIVES[id].max)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, DEVICES[id].max)); }
    if (name === "max") spawnMixed(30);
    if (name === "stress") { state.player.base.maxHp = 1000; state.player.base.damageMul = 3; recalculatePlayerStats(); spawnMixed(150); }
    healFull(); updateDock(); updateHud(); toast(`PRESET: ${name.toUpperCase()}`);
  }
  function getBuildSnapshot() {
    const player = state.player;
    return { version: 5, character: state.character.key, base: { ...player.base }, hp: player.hp, level: player.level, xp: player.xp, exclusiveLevel:player.exclusiveLevel, weapons: { ...player.weapons }, passives: { ...player.passives }, passiveWeights: { ...player.passiveWeights }, devices: { ...player.devices }, summonLevels: { ...player.summonLevels }, growthCards: { ...player.growthCards }, coins: state.coins, rerolls: state.rerolls };
  }
  function loadBuildSnapshot(data) {
    if (!data || typeof data !== "object") throw new Error("Build 必须是 JSON 对象");
    if (data.character && CHARACTERS[data.character]) { state.character = CHARACTERS[data.character]; homeCharacterKey = data.character; }
    resetDevPlayer(); const player = state.player; $("hudHeroName").textContent = state.character.name; setArtImage($("hudHeroImage"), portraitResource(state.character), state.character.name);
    if (data.base && typeof data.base === "object") for (const key of ["maxHp", "attack", "speed", "damageMul", "attackSpeed", "crit", "critDamage", "cooldownMul", "size", "armor", "pickup"]) if (Number.isFinite(Number(data.base[key]))) player.base[key] = Number(data.base[key]);
    setExclusiveLevel(data.exclusiveLevel || 1);
    setPlayerLevel(data.level || 1); player.xp = clamp(Number(data.xp) || 0, 0, player.nextXp - 1);
    Object.keys(WEAPONS).forEach(id => setWeaponLevel(id, Number(data.weapons?.[id]) || 0)); Object.keys(PASSIVES).forEach(id => setPassiveLevel(id, Number(data.passives?.[id]) || 0, Number(data.passiveWeights?.[id]) || Number(data.passives?.[id]) || 0)); Object.keys(DEVICES).forEach(id => setDeviceLevel(id, Number(data.devices?.[id]) || 0)); Object.keys(SUMMONS).forEach(id => setSummonLevel(id, Number(data.summonLevels?.[id]) || 0)); player.growthCards = Object.fromEntries(Object.entries(data.growthCards || {}).filter(([id,value]) => GROWTH_CARDS[id] && Number(value) > 0).map(([id,value]) => [id,Math.max(1,Math.round(Number(value)))]));
    recalculatePlayerStats(); player.hp = clamp(Number.isFinite(Number(data.hp)) ? Number(data.hp) : player.maxHp, 0, player.maxHp); state.coins = Math.max(0, Number(data.coins) || 0); state.rerolls = Math.max(0, Math.round(Number(data.rerolls) || 0));
    if(state.dev){state.mode="playing";state.started=true;[ui.upgrade,ui.shop,ui.event,ui.pause,ui.result].forEach(panel=>panel.classList.add("hidden"));ui.hud.classList.remove("hidden");ui.joystick.classList.remove("hidden");last=performance.now();}
    updateDock(); updateHud();
  }
  function getDevStats() {
    const current = state.time, buckets = state.damageBuckets || [], one = buckets.reduce((sum, bucket) => sum + (bucket.t >= current - 1 ? bucket.amount : 0), 0), ten = buckets.reduce((sum, bucket) => sum + (bucket.t >= current - 10 ? bucket.amount : 0), 0);
    return { fps: state.fps || 0, enemies: state.enemies.filter(enemy => !enemy.dead).length + (state.boss && !state.boss.dead ? 1 : 0), projectiles: state.projectiles.length, enemyShots: state.enemyShots.length, pickups: state.pickups.length, level: state.player.level, kills: state.kills, damage: state.damage, taken: state.taken, highHit: state.highHit, dps: one, dps10: ten / 10 };
  }
  function setDevLabOpen(open) { if (!state.dev) return; state.devLabOpen = Boolean(open); state.devRunPaused = Boolean(open); }
  function setDevPaused(paused) { state.devRunPaused = Boolean(paused); if (!paused && state.mode !== "playing") state.mode = "playing"; }

  const devApi = {
    setLabOpen: setDevLabOpen, setPaused: setDevPaused, setSpeed: value => state.simSpeed = clamp(Number(value) || 1, .5, 4), setInvincible: value => state.invincible = Boolean(value), setInfiniteRerolls: value => state.infiniteRerolls = Boolean(value),
    setPlayerValue, healFull, addLevels: amount => setPlayerLevel(state.player.level + amount), setWeaponLevel, setExclusiveLevel, setPassiveLevel, setDeviceLevel,
    useActiveSkill: id => useActiveSkill(id,{force:true}), resetSkillCooldowns:()=>{Object.keys(state.characterState.skillCooldowns||{}).forEach(id=>state.characterState.skillCooldowns[id]=0);state.characterState.skillCharges={...state.characterState.skillMaxCharges};updateSkillBar();},
    spawnEnemy: spawnEnemyBatch, spawnMixed, clearNormalEnemies, clearAllEnemies, spawnBoss, forceBossPhase2, setBossHealth, killBoss: killBossForTest,
    openUpgrade: () => openUpgrade(false), openShop, triggerChest, openEvent, triggerEliteWave, setStage, setTimelineDay, playVFX, applyPreset, getStats: getDevStats,
    getBuild: getBuildSnapshot, loadBuild: loadBuildSnapshot, resetPlayer: resetDevPlayer, resetRun: () => resetGame(true), clearBattlefield,
    getConfig: () => ({ WEAPONS, PASSIVES, DEVICES, SUMMONS, QINGYAN_SUMMON_CATALOG, SKILL_TREE, GROWTH_CARDS, ENEMY_TYPES, CHARACTERS, CHARACTER_ANIMATIONS, CHARACTER_COMBAT_KITS, INK_FX, ASSET_MANIFEST, VFX_LIBRARY, SCENE_LAYERS, RUN_TIMELINE }), getState: () => state
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
  $("growthBranchClose").onclick = closeGrowthBranch;
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => $(button.dataset.close).classList.add("hidden"));
  $("rerollButton").onclick = () => { if (state.rerolls <= 0 && !state.infiniteRerolls) return; if (!state.infiniteRerolls) state.rerolls--; ui.rerolls.textContent = state.rerolls; renderUpgradeChoices(); };
  $("leaveShop").onclick = closeShop;
  document.querySelectorAll("[data-event]").forEach(button => button.onclick = () => resolveEvent(button.dataset.event));
  $("pauseButton").onclick = pause; $("resumeButton").onclick = resume; $("quitButton").onclick = () => endGame(false);
  $("againButton").onclick = () => resetGame(Boolean(state.dev));
  $("menuButton").onclick = () => { state = { mode: "menu" }; clearWorldNodes(); ui.result.classList.add("hidden"); ui.menu.classList.remove("hidden"); renderHomeCharacter(homeCharacterKey); window.dispatchEvent(new CustomEvent("meow-dev-ended")); };
  addEventListener("keydown", event => {
    const typing=["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName);if(!typing)keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code) && !typing) event.preventDefault();
    if(!typing&&!event.repeat){const skillKey={KeyQ:"skill1",Digit1:"skill1",KeyE:"skill2",Digit2:"skill2",KeyR:"skill3",Digit3:"skill3",KeyF:"ultimate",Digit4:"ultimate"}[event.code];if(skillKey)useActiveSkill(skillKey);}
    if(event.code==="Escape"&&!event.repeat&&!typing&&growthBranchOpen&&!$("growthPanel").classList.contains("hidden")){closeGrowthBranch();return;}
    if ((event.code === "Escape" || event.code === "KeyP") && !event.repeat && !typing) { if (state.mode === "playing") pause(); else if (state.mode === "paused") resume(); }
  });
  addEventListener("keyup", event => keys.delete(event.code));
  ui.joystick.addEventListener("pointerdown", event => { joy.active = true; joy.id = event.pointerId; ui.joystick.setPointerCapture(event.pointerId); moveJoy(event); });
  ui.joystick.addEventListener("pointermove", event => { if (joy.active && event.pointerId === joy.id) moveJoy(event); });
  ui.joystick.addEventListener("pointerup", endJoy); ui.joystick.addEventListener("pointercancel", endJoy);
  function moveJoy(event) { const rect = ui.joystick.getBoundingClientRect(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2, dx = event.clientX - centerX, dy = event.clientY - centerY, length = Math.hypot(dx, dy), amount = Math.min(1, length / 43); joy.x = length ? dx / length * amount : 0; joy.y = length ? dy / length * amount : 0; ui.joystick.firstElementChild.style.transform = `translate(${joy.x * 34}px,${joy.y * 34}px)`; }
  function endJoy() { joy.active = false; joy.x = joy.y = 0; ui.joystick.firstElementChild.style.transform = ""; }

  window.__MEOW_GAME__ = { getState: () => state, start: resetGame, end: (win = true) => endGame(win), dev: devApi, data: { WEAPONS, PASSIVES, DEVICES, SUMMONS, QINGYAN_SUMMON_CATALOG, SKILL_TREE, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, CHARACTER_ANIMATIONS, CHARACTER_COMBAT_KITS, LEGACY_ASSET_MAP, INK_FX, ASSET_MANIFEST, VFX_LIBRARY, SCENE_LAYERS, RUN_TIMELINE }, growth: { getState:()=>growth, hasNode:hasGrowthNode, compile:compileGrowthConfig, open:openGrowthPanel } };
  if (new URLSearchParams(location.search).get("dev") === "1") resetGame(true);
})();
