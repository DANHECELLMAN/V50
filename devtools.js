(() => {
  "use strict";

  const game = window.__MEOW_GAME__;
  if (!game?.dev) return;
  const api = game.dev;
  const toggle = document.getElementById("devToggle");
  const lab = document.getElementById("devLab");
  const close = document.getElementById("devClose");
  const content = document.getElementById("devLabContent");
  const BUILD_KEY = "meowGardenDevBuilds.v1";
  let active = false;
  let animationPreviewRaf = 0;
  let animationPreviewConfig = null;
  const animationPreview = { state: "move", direction: "down", speed: 1, frame: 0, elapsed: 0, last: 0 };

  const section = (title, body, open = false) => `<details class="dev-section" ${open ? "open" : ""}><summary>${title}</summary><div class="dev-body">${body}</div></details>`;
  const button = (label, action, cls = "") => `<button class="dev-btn ${cls}" data-action="${action}">${label}</button>`;
  const field = (key, label, min, max, step) => `<label class="dev-field"><span>${label}</span><input data-field="${key}" type="number" min="${min}" max="${max}" step="${step}"></label>`;
  const levelRows = (kind, data) => Object.entries(data).map(([id, item]) => `<div class="dev-row" data-row-kind="${kind}" data-row-id="${id}"><strong title="${item.name}">${item.icon || ""} ${item.name}</strong><button data-level-kind="${kind}" data-level-id="${id}" data-delta="-1">−</button><span class="dev-level">Lv.<b>0</b>/${item.max}</span><button data-level-kind="${kind}" data-level-id="${id}" data-delta="1">＋</button></div>`).join("");
  const statItems = [
    ["fps", "FPS"], ["enemies", "敌人数"], ["projectiles", "我方弹丸"], ["enemyShots", "敌方弹丸"], ["pickups", "掉落物"],
    ["level", "等级"], ["kills", "累计击杀"], ["damage", "累计伤害"], ["taken", "累计承伤"], ["highHit", "最高单次"], ["dps", "当前 DPS"], ["dps10", "10 秒 DPS"]
  ];

  function render() {
    const { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, CHARACTERS, CHARACTER_ANIMATIONS } = api.getConfig();
    animationPreviewConfig = CHARACTER_ANIMATIONS?.xiaobai || null;
    const stats = `<div class="dev-stats">${statItems.map(([id, label]) => `<div class="dev-stat"><b id="devStat-${id}">0</b><small>${label}</small></div>`).join("")}</div>`;
    const runtime = `<div class="dev-grid">${button("暂停", "dev-pause")} ${button("继续", "dev-resume", "accent")}</div>
      <div class="dev-grid cols-4">${[.5,1,2,4].map(v => `<button class="dev-btn" data-speed="${v}">×${v}</button>`).join("")}</div>
      <div class="dev-grid"><label class="dev-check"><input id="devInvincible" data-toggle="invincible" type="checkbox">无敌模式</label><label class="dev-check"><input id="devInfinite" data-toggle="infinite" type="checkbox">无限刷新</label></div>`;
    const xiaobai = CHARACTERS?.moxiaobai, firstFrame = animationPreviewConfig?.states?.move?.down?.[0], fallback = xiaobai?.combat_art || xiaobai?.art || "";
    const animationTest = animationPreviewConfig ? `<div class="dev-animation-preview"><img id="devAnimationImage" src="${firstFrame}" data-fallback="${fallback}" alt="喵小白移动动画预览" draggable="false"></div>
      <div class="dev-animation-readout"><span id="devAnimationDirection">MOVE · DOWN</span><span id="devAnimationFrame">01 / 08 · 11 FPS</span></div>
      <div class="dev-grid cols-4">${[["move","移动"],["attack","攻击"],["hit","受击"],["death","死亡"]].map(([id,label]) => `<button class="dev-btn ${id === "move" ? "active" : ""}" data-animation-state="${id}">${label}</button>`).join("")}</div>
      <div class="dev-grid cols-4">${[["up","向上"],["down","向下"],["left","向左"],["right","向右"]].map(([id,label]) => `<button class="dev-btn ${id === "down" ? "active" : ""}" data-animation-direction="${id}">${label}</button>`).join("")}</div>
      <div class="dev-grid">${[.5,1,2].map(value => `<button class="dev-btn ${value === 1 ? "active" : ""}" data-animation-speed="${value}">动画 ×${value}</button>`).join("")}</div>` : `<p>未注册喵小白移动动画资源。</p>`;
    const player = `${field("level","Level",1,999,1)}${field("hp","当前 HP",0,99999,1)}${field("maxHp","最大 HP",1,99999,1)}${field("speed","移动速度",1,3000,1)}${field("damageMul","伤害倍率",.01,100,.05)}${field("attackSpeed","攻速倍率",.05,30,.05)}${field("crit","暴击率 (0-1)",0,1,.01)}${field("armor","护甲 (0-0.9)",0,.9,.01)}${field("pickup","拾取范围",1,3000,1)}${field("coins","金币",0,999999,1)}${field("rerolls","升级刷新次数",0,999,1)}
      <div class="dev-grid">${button("恢复满血","heal-full","accent")}${button("+1 等级","level-1")}${button("+5 等级","level-5")}</div>`;
    const enemies = Object.entries(ENEMY_TYPES).map(([id, item]) => `<div class="dev-enemy-row"><strong>${item.emoji || ""} ${item.name || id}</strong><button data-enemy="${id}" data-count="1">+1</button><button data-enemy="${id}" data-count="10">+10</button><button data-enemy="${id}" data-count="1" data-elite="1">精英 +1</button></div>`).join("") +
      `<div class="dev-grid cols-4">${[10,30,50,100].map(n=>`<button class="dev-btn" data-mixed="${n}">混合 ×${n}</button>`).join("")}</div><div class="dev-grid">${button("清除普通敌人","clear-normal","warn")}${button("清除全部敌人","clear-enemies","danger-mini")}</div>`;
    const boss = `<div class="dev-grid">${button("召唤 Boss","boss-spawn","accent")}${button("Boss 第二阶段","boss-phase2")}${button("Boss 50% HP","boss-50")}${button("Boss 10% HP","boss-10")}${button("击杀 Boss","boss-kill","danger-mini")}</div>`;
    const flow = `<div class="dev-grid">${button("打开升级","open-upgrade")}${button("打开商店","open-shop")}${button("触发宝箱","trigger-chest")}${button("打开随机事件","open-event")}${button("生成精英潮","elite-wave")}</div><div class="dev-grid cols-4">${button("进入前期","stage-early")}${button("进入中期","stage-mid")}${button("进入后期","stage-late")}${button("进入 Boss 阶段","stage-boss","accent")}</div>`;
    const presets = `<div class="dev-grid">${button("Early Game","preset-early")}${button("Mid Game","preset-mid")}${button("Late Game","preset-late")}${button("Boss Test","preset-boss")}${button("Max Build","preset-max","accent")}${button("Stress Test","preset-stress","warn")}</div>`;
    const slots = [1,2,3].map(n => `<div class="dev-slot"><span>Slot ${n}</span><button class="dev-btn" data-slot-save="${n}">保存</button><button class="dev-btn" data-slot-load="${n}">加载</button><button class="dev-btn danger-mini" data-slot-delete="${n}">删除</button></div>`).join("");
    const buildTools = `${slots}<div class="dev-grid">${button("复制 Build JSON","copy-json")}${button("导入 Build JSON","import-json","accent")}</div><textarea id="devBuildJson" class="dev-json" spellcheck="false" placeholder="Build JSON 会显示在这里，也可以粘贴后导入"></textarea>`;
    const reset = `<div class="dev-grid">${button("Reset Player","reset-player")}${button("Reset Run","reset-run","warn")}${button("Clear Battlefield","clear-battlefield","danger-mini")}</div>`;
    content.innerHTML = section("STATISTICS", stats, true) + section("RUN CONTROL", runtime, true) + section("ANIMATION TEST", animationTest, true) + section("PLAYER", player, true) + section("PRESETS", presets, true) +
      section("WEAPONS", levelRows("weapon", WEAPONS)) + section("PASSIVES", levelRows("passive", PASSIVES)) + section("DEVICES", levelRows("device", DEVICES)) +
      section("ENEMY SPAWNER", enemies) + section("BOSS TEST", boss) + section("FLOW / EVENTS", flow) + section("BUILD TOOLS", buildTools) + section("RESET TOOLS", reset) + `<div id="devStatus" class="dev-status">Ready.</div>`;
  }

  function setStatus(message, error = false) {
    const el = document.getElementById("devStatus"); if (!el) return; el.textContent = message; el.style.color = error ? "#ffb8b8" : "#a8ffe9";
  }
  function stopAnimationPreview() { if (animationPreviewRaf) cancelAnimationFrame(animationPreviewRaf); animationPreviewRaf = 0; animationPreview.last = 0; }
  function syncAnimationControls() {
    document.querySelectorAll("[data-animation-state]").forEach(button => button.classList.toggle("active", button.dataset.animationState === animationPreview.state));
    document.querySelectorAll("[data-animation-direction]").forEach(button => button.classList.toggle("active", button.dataset.animationDirection === animationPreview.direction));
    document.querySelectorAll("[data-animation-speed]").forEach(button => button.classList.toggle("active", Number(button.dataset.animationSpeed) === animationPreview.speed));
  }
  function startAnimationPreview() {
    stopAnimationPreview();
    if (!animationPreviewConfig) return;
    const tick = now => {
      if (!active || lab.classList.contains("hidden")) { animationPreviewRaf = 0; return; }
      const frames = animationPreviewConfig.states[animationPreview.state]?.[animationPreview.direction] || animationPreviewConfig.states.move[animationPreview.direction] || [];
      const delta = animationPreview.last ? Math.min(.1, (now - animationPreview.last) / 1000) : 0; animationPreview.last = now;
      animationPreview.elapsed += delta * animationPreview.speed;
      const previewFps = animationPreviewConfig.stateFps?.[animationPreview.state] || animationPreviewConfig.fps || 11, frameTime = 1 / previewFps;
      while (animationPreview.elapsed >= frameTime && frames.length) { animationPreview.elapsed -= frameTime; animationPreview.frame = (animationPreview.frame + 1) % frames.length; }
      const image = document.getElementById("devAnimationImage"), source = frames[animationPreview.frame];
      if (image && source && image.dataset.frameSource !== source) { image.dataset.frameSource = source; image.dataset.fallbackUsed = ""; image.src = source; }
      const direction = document.getElementById("devAnimationDirection"), frame = document.getElementById("devAnimationFrame");
      if (direction) direction.textContent = `${animationPreview.state.toUpperCase()} · ${animationPreview.direction.toUpperCase()}`; if (frame) frame.textContent = `${String(animationPreview.frame + 1).padStart(2,"0")} / ${String(frames.length).padStart(2,"0")} · ${previewFps} FPS`;
      animationPreviewRaf = requestAnimationFrame(tick);
    };
    animationPreviewRaf = requestAnimationFrame(tick);
  }
  function openLab() {
    if (!game.getState().dev) return; lab.classList.remove("hidden"); toggle.setAttribute("aria-expanded", "true"); api.setLabOpen(true); syncAll(); syncAnimationControls(); startAnimationPreview();
  }
  function closeLab() { stopAnimationPreview(); lab.classList.add("hidden"); toggle.setAttribute("aria-expanded", "false"); api.setLabOpen(false); }
  function activate() {
    const state = game.getState(); if (!state.dev) return;
    if (!active) { active = true; render(); }
    document.body.classList.add("dev-mode"); toggle.classList.remove("hidden"); openLab();
  }
  function deactivate() { stopAnimationPreview(); document.body.classList.remove("dev-mode"); toggle.classList.add("hidden"); lab.classList.add("hidden"); active = false; }

  function stateLevel(kind, id) {
    const p = game.getState().player; return kind === "weapon" ? p.weapons[id] || 0 : kind === "passive" ? p.passives[id] || 0 : p.devices[id] || 0;
  }
  function syncAll() {
    const state = game.getState(); if (!state.dev || !state.player || !active) return; const p = state.player;
    const values = { level:p.level, hp:p.hp, maxHp:p.base.maxHp, speed:p.base.speed, damageMul:p.base.damageMul, attackSpeed:p.base.attackSpeed,
      crit:p.base.crit, armor:p.base.armor, pickup:p.base.pickup, coins:state.coins, rerolls:state.rerolls };
    document.querySelectorAll("[data-field]").forEach(input => { if (document.activeElement !== input) input.value = Number(values[input.dataset.field].toFixed?.(3) ?? values[input.dataset.field]); });
    document.querySelectorAll("[data-row-kind]").forEach(row => { const b=row.querySelector(".dev-level b"); if(b)b.textContent=stateLevel(row.dataset.rowKind,row.dataset.rowId); });
    const inv=document.getElementById("devInvincible"),inf=document.getElementById("devInfinite");if(inv)inv.checked=state.invincible;if(inf)inf.checked=state.infiniteRerolls;
    document.querySelectorAll("[data-speed]").forEach(b=>b.classList.toggle("active",Number(b.dataset.speed)===state.simSpeed));
  }
  function syncStats() {
    if (!active || !game.getState().dev) return; const stats=api.getStats();
    statItems.forEach(([id])=>{const el=document.getElementById(`devStat-${id}`);if(el)el.textContent=id==="fps"?stats[id].toFixed(0):["damage","taken","highHit","dps","dps10"].includes(id)?Math.round(stats[id]).toLocaleString():stats[id].toLocaleString();});
    syncAll();
  }

  function readSlots() { try { return JSON.parse(localStorage.getItem(BUILD_KEY) || "{}") || {}; } catch { return {}; } }
  function writeSlots(slots) { localStorage.setItem(BUILD_KEY, JSON.stringify(slots)); }
  function slotSave(n) { const slots=readSlots();slots[n]=api.getBuild();writeSlots(slots);setStatus(`Slot ${n} 已保存到 localStorage。`); }
  function slotLoad(n) { const data=readSlots()[n];if(!data){setStatus(`Slot ${n} 为空。`,true);return;}try{api.loadBuild(data);setStatus(`Slot ${n} 已加载。`);syncAll();}catch(e){setStatus(`加载失败：${e.message}`,true);} }
  function slotDelete(n) { const slots=readSlots();delete slots[n];writeSlots(slots);setStatus(`Slot ${n} 已删除。`); }
  async function copyJson() {
    const text=JSON.stringify(api.getBuild(),null,2),area=document.getElementById("devBuildJson");area.value=text;
    try { await navigator.clipboard.writeText(text); setStatus("Build JSON 已复制到剪贴板。"); }
    catch { area.focus();area.select();document.execCommand("copy");setStatus("Build JSON 已选中并尝试复制。"); }
  }
  function importJson() { const area=document.getElementById("devBuildJson");try{api.loadBuild(JSON.parse(area.value));setStatus("Build JSON 导入成功。");syncAll();}catch(e){setStatus(`导入失败：${e.message}`,true);} }

  const actions = {
    "dev-pause":()=>{api.setPaused(true);setStatus("模拟已暂停。")}, "dev-resume":()=>{api.setPaused(false);setStatus("模拟继续运行。")},
    "heal-full":api.healFull, "level-1":()=>api.addLevels(1), "level-5":()=>api.addLevels(5),
    "clear-normal":api.clearNormalEnemies, "clear-enemies":api.clearAllEnemies, "boss-spawn":api.spawnBoss, "boss-phase2":api.forceBossPhase2,
    "boss-50":()=>api.setBossHealth(.5), "boss-10":()=>api.setBossHealth(.1), "boss-kill":api.killBoss,
    "open-upgrade":()=>{api.openUpgrade();closeLab()}, "open-shop":()=>{api.openShop();closeLab()}, "trigger-chest":()=>{api.triggerChest();closeLab()}, "open-event":()=>{api.openEvent();closeLab()}, "elite-wave":api.triggerEliteWave,
    "stage-early":()=>api.setStage(.1), "stage-mid":()=>api.setStage(.4), "stage-late":()=>api.setStage(.75), "stage-boss":()=>api.setStage(.84,true),
    "preset-early":()=>api.applyPreset("early"), "preset-mid":()=>api.applyPreset("mid"), "preset-late":()=>api.applyPreset("late"), "preset-boss":()=>api.applyPreset("boss"), "preset-max":()=>api.applyPreset("max"), "preset-stress":()=>api.applyPreset("stress"),
    "copy-json":copyJson, "import-json":importJson, "reset-player":api.resetPlayer, "reset-run":api.resetRun, "clear-battlefield":api.clearBattlefield
  };

  content.addEventListener("click", event => {
    const animationState=event.target.closest("[data-animation-state]");if(animationState){animationPreview.state=animationState.dataset.animationState;animationPreview.frame=0;animationPreview.elapsed=0;syncAnimationControls();return;}
    const animationDirection=event.target.closest("[data-animation-direction]");if(animationDirection){animationPreview.direction=animationDirection.dataset.animationDirection;animationPreview.frame=0;animationPreview.elapsed=0;syncAnimationControls();return;}
    const animationSpeed=event.target.closest("[data-animation-speed]");if(animationSpeed){animationPreview.speed=Number(animationSpeed.dataset.animationSpeed)||1;syncAnimationControls();return;}
    const levelButton=event.target.closest("[data-level-kind]");if(levelButton){const kind=levelButton.dataset.levelKind,id=levelButton.dataset.levelId,next=stateLevel(kind,id)+Number(levelButton.dataset.delta);if(kind==="weapon")api.setWeaponLevel(id,next);if(kind==="passive")api.setPassiveLevel(id,next);if(kind==="device")api.setDeviceLevel(id,next);syncAll();return;}
    const enemy=event.target.closest("[data-enemy]");if(enemy){api.spawnEnemy(enemy.dataset.enemy,Number(enemy.dataset.count),enemy.dataset.elite==="1");return;}
    const mixed=event.target.closest("[data-mixed]");if(mixed){api.spawnMixed(Number(mixed.dataset.mixed));return;}
    const save=event.target.closest("[data-slot-save]");if(save){slotSave(save.dataset.slotSave);return;}const load=event.target.closest("[data-slot-load]");if(load){slotLoad(load.dataset.slotLoad);return;}const del=event.target.closest("[data-slot-delete]");if(del){slotDelete(del.dataset.slotDelete);return;}
    const speed=event.target.closest("[data-speed]");if(speed){api.setSpeed(Number(speed.dataset.speed));setStatus(`游戏速度 ×${speed.dataset.speed}`);syncAll();return;}
    const action=event.target.closest("[data-action]");if(action&&actions[action.dataset.action]){actions[action.dataset.action]();syncAll();}
  });
  content.addEventListener("change", event => {
    const input=event.target;if(input.matches("[data-field]")){api.setPlayerValue(input.dataset.field,input.value);syncAll();}
    if(input.dataset.toggle==="invincible")api.setInvincible(input.checked);if(input.dataset.toggle==="infinite")api.setInfiniteRerolls(input.checked);
  });
  content.addEventListener("input", event => { const input=event.target;if(input.matches("[data-field]")&&input.value!=="")api.setPlayerValue(input.dataset.field,input.value); });
  toggle.addEventListener("click",()=>lab.classList.contains("hidden")?openLab():closeLab());close.addEventListener("click",closeLab);
  window.addEventListener("meow-dev-started",()=>setTimeout(activate,0));window.addEventListener("meow-dev-ended",deactivate);window.addEventListener("meow-run-ended",()=>{if(game.getState().dev)deactivate();});
  setInterval(syncStats,250);
  if(game.getState().dev)activate();
})();
