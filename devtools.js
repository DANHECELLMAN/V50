(() => {
  "use strict";

  const game = window.__MEOW_GAME__;
  if (!game?.dev) return;
  const api = game.dev;
  const toggle = document.getElementById("devToggle");
  const lab = document.getElementById("devLab");
  const close = document.getElementById("devClose");
  const content = document.getElementById("devLabContent");
  const visualPanel = document.getElementById("visualTestPanel");
  const visualContent = document.getElementById("visualTestContent");
  const visualClose = document.getElementById("visualTestClose");
  const BUILD_KEY = "meowGardenDevBuilds.v1";
  let active = false;
  let animationPreviewRaf = 0;
  let animationPreviewConfig = null;
  let renderedCharacterKey = "";
  const animationPreview = { state: "move", direction: "down", speed: 1, frame: 0, elapsed: 0, last: 0 };
  let visualRaf = 0;
  const visualState = { asset:"characters:moxiaobai", state:"move", direction:"down", fps:11, scale:1, anchorX:.5, anchorY:.975, background:"game", count:1, frame:0, elapsed:0, last:0 };
  visualContent?.addEventListener("error",event=>{const image=event.target;if(!(image instanceof HTMLImageElement))return;setTimeout(()=>{if(!image.naturalWidth)image.classList.add("asset-missing");},0);},true);

  const section = (title, body, open = false) => `<details class="dev-section" ${open ? "open" : ""}><summary>${title}</summary><div class="dev-body">${body}</div></details>`;
  const button = (label, action, cls = "") => `<button class="dev-btn ${cls}" data-action="${action}">${label}</button>`;
  const field = (key, label, min, max, step) => `<label class="dev-field"><span>${label}</span><input data-field="${key}" type="number" min="${min}" max="${max}" step="${step}"></label>`;
  const levelRows = (kind, data) => Object.entries(data).map(([id, item]) => `<div class="dev-row" data-row-kind="${kind}" data-row-id="${id}"><strong title="${item.name}">${item.icon || ""} ${item.name}</strong><button data-level-kind="${kind}" data-level-id="${id}" data-delta="-1">−</button><span class="dev-level">Lv.<b>0</b>/${item.max}</span><button data-level-kind="${kind}" data-level-id="${id}" data-delta="1">＋</button></div>`).join("");
  const statItems = [
    ["fps", "FPS"], ["enemies", "敌人数"], ["projectiles", "我方弹丸"], ["enemyShots", "敌方弹丸"], ["pickups", "掉落物"],
    ["level", "等级"], ["kills", "累计击杀"], ["damage", "累计伤害"], ["taken", "累计承伤"], ["highHit", "最高单次"], ["dps", "当前 DPS"], ["dps10", "10 秒 DPS"]
  ];

  function render() {
    const { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, CHARACTERS, CHARACTER_ANIMATIONS, CHARACTER_COMBAT_KITS, RUN_TIMELINE } = api.getConfig();
    animationPreviewConfig = CHARACTER_ANIMATIONS?.xiaobai || null; renderedCharacterKey = api.getState().character?.key || "";
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
    const kit=CHARACTER_COMBAT_KITS?.[api.getState().character.key],exclusive=kit?.exclusive;
    const activeSkills=`<div class="dev-exclusive"><strong>${exclusive?.icon||"武"} ${exclusive?.name||"专属武器"}</strong><div><button data-exclusive-delta="-1">−</button><span>Lv.<b id="devExclusiveLevel">1</b>/${exclusive?.max||7}</span><button data-exclusive-delta="1">＋</button></div></div><div class="dev-grid">${(kit?.skills||[]).map(skill=>button(`${skill.key} · ${skill.name}`,`cast-${skill.id}`,skill.ultimate?"warn":"")).join("")}</div>${button("重置全部技能 CD","reset-skill-cd","accent")}`;
    const player = `${field("level","Level",1,999,1)}${field("hp","当前 HP",0,99999,1)}${field("maxHp","最大 HP",1,99999,1)}${field("attack","基础攻击力",1,99999,.1)}${field("speed","移动速度",1,3000,1)}${field("damageMul","伤害倍率",.01,100,.05)}${field("attackSpeed","攻速倍率",.05,30,.05)}${field("crit","暴击率 (0-1)",0,1,.01)}${field("armor","护甲 (0-0.9)",0,.9,.01)}${field("pickup","拾取范围",1,3000,1)}${field("coins","金币",0,999999,1)}${field("rerolls","升级刷新次数",0,999,1)}
      <div class="dev-grid">${button("恢复满血","heal-full","accent")}${button("+1 等级","level-1")}${button("+5 等级","level-5")}</div>`;
    const enemies = Object.entries(ENEMY_TYPES).map(([id, item]) => `<div class="dev-enemy-row"><strong>${item.emoji || ""} ${item.name || id}</strong><button data-enemy="${id}" data-count="1">+1</button><button data-enemy="${id}" data-count="10">+10</button><button data-enemy="${id}" data-count="1" data-elite="1">精英 +1</button></div>`).join("") +
      `<div class="dev-grid cols-4">${[10,30,50,100].map(n=>`<button class="dev-btn" data-mixed="${n}">混合 ×${n}</button>`).join("")}</div><div class="dev-grid">${button("清除普通敌人","clear-normal","warn")}${button("清除全部敌人","clear-enemies","danger-mini")}</div>`;
    const boss = `<div class="dev-grid">${button("召唤 Boss","boss-spawn","accent")}${button("Boss 第二阶段","boss-phase2")}${button("Boss 50% HP","boss-50")}${button("Boss 10% HP","boss-10")}${button("击杀 Boss","boss-kill","danger-mini")}</div>`;
    const timelineDays=[66,44,29,14,1,0].filter(day=>Object.prototype.hasOwnProperty.call(RUN_TIMELINE?.dev_days||{},day)).map(day=>`<button class="dev-btn ${day===0?"warn":""}" data-day="${day}">${day}日${day===0?" / Boss":""}</button>`).join("");
    const flow = `<div class="dev-grid">${button("打开升级","open-upgrade")}${button("打开商店","open-shop")}${button("触发宝箱","trigger-chest")}${button("打开随机事件","open-event")}${button("生成精英潮","elite-wave")}</div><div class="dev-grid cols-4">${button("进入前期","stage-early")}${button("进入中期","stage-mid")}${button("进入后期","stage-late")}${button("进入 Boss 阶段","stage-boss","accent")}</div><div class="dev-day-grid">${timelineDays}</div>`;
    const presets = `<div class="dev-grid">${button("Early Game","preset-early")}${button("Mid Game","preset-mid")}${button("Late Game","preset-late")}${button("Boss Test","preset-boss")}${button("Max Build","preset-max","accent")}${button("Stress Test","preset-stress","warn")}</div>`;
    const slots = [1,2,3].map(n => `<div class="dev-slot"><span>Slot ${n}</span><button class="dev-btn" data-slot-save="${n}">保存</button><button class="dev-btn" data-slot-load="${n}">加载</button><button class="dev-btn danger-mini" data-slot-delete="${n}">删除</button></div>`).join("");
    const buildTools = `${slots}<div class="dev-grid">${button("复制 Build JSON","copy-json")}${button("导入 Build JSON","import-json","accent")}</div><textarea id="devBuildJson" class="dev-json" spellcheck="false" placeholder="Build JSON 会显示在这里，也可以粘贴后导入"></textarea>`;
    const reset = `<div class="dev-grid">${button("Reset Player","reset-player")}${button("Reset Run","reset-run","warn")}${button("Clear Battlefield","clear-battlefield","danger-mini")}</div>`;
    const visualTest = `<p class="dev-hint">集中验收角色、敌人、动画锚点、缩放和统一 VFX。</p>${button("打开 Visual / Asset Test","open-visual-test","accent")}`;
    content.innerHTML = section("STATISTICS", stats, true) + section("RUN CONTROL", runtime, true) + section("VISUAL / ASSET TEST", visualTest, true) + section("ACTIVE SKILLS", activeSkills, true) + section("ANIMATION TEST", animationTest) + section("PLAYER", player, true) + section("PRESETS", presets, true) +
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

  function visualEntry() {
    const manifest=api.getConfig().ASSET_MANIFEST||{},[group,id]=visualState.asset.split(":");return manifest[group]?.[id]||null;
  }
  function visualFrames(entry=visualEntry()) {
    const stateFrames=entry?.animations?.[visualState.state]||{},frames=stateFrames[visualState.direction]||stateFrames.down||[];return Array.isArray(frames)&&frames.length?frames:[entry?.sprite?.art||entry?.sprite?.fallback_art||""];
  }
  function visualAssetOptions() {
    const manifest=api.getConfig().ASSET_MANIFEST||{},groups=[["characters","角色"],["enemies","敌人"],["bosses","Boss"]];
    return groups.map(([group,label])=>`<optgroup label="${label}">${Object.entries(manifest[group]||{}).map(([id,item])=>`<option value="${group}:${id}" ${visualState.asset===`${group}:${id}`?"selected":""}>${item.name}</option>`).join("")}</optgroup>`).join("");
  }
  function renderVisualTest() {
    if(!visualContent)return;
    const {VFX_LIBRARY}=api.getConfig();
    visualContent.innerHTML=`<aside class="visual-controls"><label class="visual-field"><span>测试单位</span><select id="visualAssetSelect">${visualAssetOptions()}</select></label>
      <div class="visual-label">动作</div><div class="visual-button-grid">${["move","attack","hit","death"].map(id=>`<button data-visual-state="${id}">${({move:"移动",attack:"攻击",hit:"受击",death:"死亡"})[id]}</button>`).join("")}</div>
      <div class="visual-label">方向</div><div class="visual-button-grid">${["up","down","left","right"].map(id=>`<button data-visual-direction="${id}">${({up:"上",down:"下",left:"左",right:"右"})[id]}</button>`).join("")}</div>
      <label class="visual-field"><span>动画 FPS <b id="visualFpsValue"></b></span><input id="visualFps" type="range" min="1" max="30" step="1"></label>
      <label class="visual-field"><span>Scale <b id="visualScaleValue"></b></span><input id="visualScale" type="range" min="0.25" max="2.5" step="0.05"></label>
      <label class="visual-field"><span>Anchor X <b id="visualAnchorXValue"></b></span><input id="visualAnchorX" type="range" min="0" max="1" step="0.01"></label>
      <label class="visual-field"><span>Anchor Y <b id="visualAnchorYValue"></b></span><input id="visualAnchorY" type="range" min="0" max="1" step="0.01"></label>
      <div class="visual-label">背景</div><div class="visual-button-grid cols-3">${[["white","白底"],["gray","灰底"],["game","游戏背景"]].map(([id,label])=>`<button data-visual-background="${id}">${label}</button>`).join("")}</div>
      <div class="visual-label">测试数量</div><div class="visual-button-grid cols-3">${[1,10,50].map(count=>`<button data-visual-count="${count}">${count} 个</button>`).join("")}</div>
      <div class="visual-label">统一 VFX</div><div class="visual-vfx-list">${Object.values(VFX_LIBRARY||{}).map(item=>`<button data-visual-vfx="${item.id}">${item.id}</button>`).join("")}</div>
      <p class="visual-note">资源缺失时自动显示 fallback；参数只用于验收，不写入正式存档。</p></aside>
      <main class="visual-preview"><div class="visual-readout"><b id="visualAssetName">—</b><span id="visualFrameReadout">—</span></div><div id="visualStage" class="visual-stage" data-background="game"><div id="visualUnits" class="visual-units"></div><div class="visual-ground-line"></div></div></main>`;
    visualContent.onchange=handleVisualInput;visualContent.oninput=handleVisualInput;visualContent.onclick=handleVisualClick;applyVisualEntryDefaults();syncVisualTest();startVisualLoop();
  }
  function applyVisualEntryDefaults(){const entry=visualEntry();if(!entry)return;visualState.fps=entry.stateFps?.[visualState.state]||entry.fps||8;visualState.scale=entry.scale||1;visualState.anchorX=entry.anchor?.x??.5;visualState.anchorY=entry.anchor?.y??.86;visualState.frame=0;visualState.elapsed=0;}
  function rebuildVisualUnits(){const entry=visualEntry(),host=document.getElementById("visualUnits");if(!entry||!host)return;const count=visualState.count,frames=visualFrames(entry),source=frames[visualState.frame%frames.length]||entry.sprite.art,cols=count===1?1:Math.ceil(Math.sqrt(count*1.6)),rows=Math.ceil(count/cols);host.className=`visual-units count-${count}${count>=50?" dense":""}`;host.innerHTML=Array.from({length:count},(_,index)=>{const col=index%cols,row=(index/cols)|0,left=count===1?50:8+col*(84/Math.max(1,cols-1)),top=count===1?69:18+row*(67/Math.max(1,rows-1));return `<div class="visual-unit" style="left:${left}%;top:${top}%;--unit-scale:${visualState.scale};--anchor-x:${-visualState.anchorX*100}%;--anchor-y:${-visualState.anchorY*100}%;--pivot-x:${visualState.anchorX*100}%;--pivot-y:${visualState.anchorY*100}%"><img src="${source}" data-fallback="${entry.sprite.fallback_art||""}" alt=""><i>${entry.name.slice(0,1)}</i></div>`;}).join("");}
  function syncVisualTest(){const entry=visualEntry(),frames=visualFrames(entry);document.querySelectorAll("[data-visual-state]").forEach(button=>button.classList.toggle("active",button.dataset.visualState===visualState.state));document.querySelectorAll("[data-visual-direction]").forEach(button=>button.classList.toggle("active",button.dataset.visualDirection===visualState.direction));document.querySelectorAll("[data-visual-background]").forEach(button=>button.classList.toggle("active",button.dataset.visualBackground===visualState.background));document.querySelectorAll("[data-visual-count]").forEach(button=>button.classList.toggle("active",Number(button.dataset.visualCount)===visualState.count));const bindings=[["visualFps",visualState.fps],["visualScale",visualState.scale],["visualAnchorX",visualState.anchorX],["visualAnchorY",visualState.anchorY]];for(const[id,value]of bindings){const input=document.getElementById(id),readout=document.getElementById(`${id}Value`);if(input&&document.activeElement!==input)input.value=value;if(readout)readout.textContent=Number(value).toFixed(id==="visualFps"?0:2);}const stage=document.getElementById("visualStage"),name=document.getElementById("visualAssetName"),frame=document.getElementById("visualFrameReadout");if(stage)stage.dataset.background=visualState.background;if(name)name.textContent=entry?.name||"资源未注册";if(frame)frame.textContent=`${visualState.state.toUpperCase()} · ${visualState.direction.toUpperCase()} · ${String(visualState.frame+1).padStart(2,"0")}/${String(frames.length).padStart(2,"0")}`;rebuildVisualUnits();}
  function handleVisualInput(event){const input=event.target;if(input.id==="visualAssetSelect"){visualState.asset=input.value;applyVisualEntryDefaults();syncVisualTest();return;}const map={visualFps:"fps",visualScale:"scale",visualAnchorX:"anchorX",visualAnchorY:"anchorY"};if(map[input.id]){visualState[map[input.id]]=Number(input.value);syncVisualTest();}}
  function handleVisualClick(event){const stateButton=event.target.closest("[data-visual-state]");if(stateButton){visualState.state=stateButton.dataset.visualState;applyVisualEntryDefaults();syncVisualTest();return;}const direction=event.target.closest("[data-visual-direction]");if(direction){visualState.direction=direction.dataset.visualDirection;visualState.frame=0;syncVisualTest();return;}const background=event.target.closest("[data-visual-background]");if(background){visualState.background=background.dataset.visualBackground;syncVisualTest();return;}const count=event.target.closest("[data-visual-count]");if(count){visualState.count=Number(count.dataset.visualCount);syncVisualTest();return;}const vfx=event.target.closest("[data-visual-vfx]");if(vfx)playVisualVfx(vfx.dataset.visualVfx);}
  function playVisualVfx(id){const stage=document.getElementById("visualStage"),data=api.getConfig().VFX_LIBRARY?.[id];if(!stage||!data)return;const node=document.createElement("div");node.className=`visual-fx-demo renderer-${data.renderer} shape-${data.shape||"ink"}`;node.style.setProperty("--visual-fx-color",data.color||"#2d706b");node.innerHTML=`<i></i><i></i><i></i><i></i><i></i><i></i>`;stage.appendChild(node);setTimeout(()=>node.remove(),900);}
  function stopVisualLoop(){if(visualRaf)cancelAnimationFrame(visualRaf);visualRaf=0;visualState.last=0;}
  function startVisualLoop(){stopVisualLoop();const tick=now=>{if(!visualPanel||visualPanel.classList.contains("hidden")){visualRaf=0;return;}const frames=visualFrames(),delta=visualState.last?Math.min(.1,(now-visualState.last)/1000):0;visualState.last=now;visualState.elapsed+=delta;let changed=false;while(visualState.elapsed>=1/Math.max(1,visualState.fps)){visualState.elapsed-=1/Math.max(1,visualState.fps);visualState.frame=(visualState.frame+1)%Math.max(1,frames.length);changed=true;}if(changed){const source=frames[visualState.frame]||frames[0];document.querySelectorAll("#visualUnits img").forEach(image=>{if(source&&image.dataset.frameSource!==source){image.dataset.frameSource=source;image.dataset.fallbackUsed="";image.src=source;}});const readout=document.getElementById("visualFrameReadout");if(readout)readout.textContent=`${visualState.state.toUpperCase()} · ${visualState.direction.toUpperCase()} · ${String(visualState.frame+1).padStart(2,"0")}/${String(frames.length).padStart(2,"0")}`;}visualRaf=requestAnimationFrame(tick);};visualRaf=requestAnimationFrame(tick);}
  function openVisualTest(){if(!game.getState().dev||!visualPanel)return;stopAnimationPreview();lab.classList.add("hidden");api.setLabOpen(true);visualPanel.classList.remove("hidden");renderVisualTest();}
  function closeVisualTest(){stopVisualLoop();visualPanel?.classList.add("hidden");if(game.getState().dev)openLab();}
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
    if(renderedCharacterKey!==state.character?.key){render();}
    const values = { level:p.level, hp:p.hp, maxHp:p.base.maxHp, attack:p.base.attack, speed:p.base.speed, damageMul:p.base.damageMul, attackSpeed:p.base.attackSpeed,
      crit:p.base.crit, armor:p.base.armor, pickup:p.base.pickup, coins:state.coins, rerolls:state.rerolls };
    document.querySelectorAll("[data-field]").forEach(input => { if (document.activeElement !== input) input.value = Number(values[input.dataset.field].toFixed?.(3) ?? values[input.dataset.field]); });
    document.querySelectorAll("[data-row-kind]").forEach(row => { const b=row.querySelector(".dev-level b"); if(b)b.textContent=stateLevel(row.dataset.rowKind,row.dataset.rowId); });
    const inv=document.getElementById("devInvincible"),inf=document.getElementById("devInfinite");if(inv)inv.checked=state.invincible;if(inf)inf.checked=state.infiniteRerolls;
    document.querySelectorAll("[data-speed]").forEach(b=>b.classList.toggle("active",Number(b.dataset.speed)===state.simSpeed));
    const exclusive=document.getElementById("devExclusiveLevel");if(exclusive)exclusive.textContent=p.exclusiveLevel||1;
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
    "cast-skill1":()=>api.useActiveSkill("skill1"),"cast-skill2":()=>api.useActiveSkill("skill2"),"cast-skill3":()=>api.useActiveSkill("skill3"),"cast-ultimate":()=>api.useActiveSkill("ultimate"),"reset-skill-cd":api.resetSkillCooldowns,
    "open-visual-test":openVisualTest, "copy-json":copyJson, "import-json":importJson, "reset-player":api.resetPlayer, "reset-run":api.resetRun, "clear-battlefield":api.clearBattlefield
  };

  content.addEventListener("click", event => {
    const animationState=event.target.closest("[data-animation-state]");if(animationState){animationPreview.state=animationState.dataset.animationState;animationPreview.frame=0;animationPreview.elapsed=0;syncAnimationControls();return;}
    const animationDirection=event.target.closest("[data-animation-direction]");if(animationDirection){animationPreview.direction=animationDirection.dataset.animationDirection;animationPreview.frame=0;animationPreview.elapsed=0;syncAnimationControls();return;}
    const animationSpeed=event.target.closest("[data-animation-speed]");if(animationSpeed){animationPreview.speed=Number(animationSpeed.dataset.animationSpeed)||1;syncAnimationControls();return;}
    const levelButton=event.target.closest("[data-level-kind]");if(levelButton){const kind=levelButton.dataset.levelKind,id=levelButton.dataset.levelId,next=stateLevel(kind,id)+Number(levelButton.dataset.delta);if(kind==="weapon")api.setWeaponLevel(id,next);if(kind==="passive")api.setPassiveLevel(id,next);if(kind==="device")api.setDeviceLevel(id,next);syncAll();return;}
    const exclusiveButton=event.target.closest("[data-exclusive-delta]");if(exclusiveButton){api.setExclusiveLevel((game.getState().player.exclusiveLevel||1)+Number(exclusiveButton.dataset.exclusiveDelta));syncAll();return;}
    const enemy=event.target.closest("[data-enemy]");if(enemy){api.spawnEnemy(enemy.dataset.enemy,Number(enemy.dataset.count),enemy.dataset.elite==="1");return;}
    const mixed=event.target.closest("[data-mixed]");if(mixed){api.spawnMixed(Number(mixed.dataset.mixed));return;}
    const day=event.target.closest("[data-day]");if(day){api.setTimelineDay(Number(day.dataset.day));setStatus(`Timeline：${day.dataset.day}日`);syncAll();return;}
    const save=event.target.closest("[data-slot-save]");if(save){slotSave(save.dataset.slotSave);return;}const load=event.target.closest("[data-slot-load]");if(load){slotLoad(load.dataset.slotLoad);return;}const del=event.target.closest("[data-slot-delete]");if(del){slotDelete(del.dataset.slotDelete);return;}
    const speed=event.target.closest("[data-speed]");if(speed){api.setSpeed(Number(speed.dataset.speed));setStatus(`游戏速度 ×${speed.dataset.speed}`);syncAll();return;}
    const action=event.target.closest("[data-action]");if(action&&actions[action.dataset.action]){actions[action.dataset.action]();syncAll();}
  });
  content.addEventListener("change", event => {
    const input=event.target;if(input.matches("[data-field]")){api.setPlayerValue(input.dataset.field,input.value);syncAll();}
    if(input.dataset.toggle==="invincible")api.setInvincible(input.checked);if(input.dataset.toggle==="infinite")api.setInfiniteRerolls(input.checked);
  });
  content.addEventListener("input", event => { const input=event.target;if(input.matches("[data-field]")&&input.value!=="")api.setPlayerValue(input.dataset.field,input.value); });
  toggle.addEventListener("click",()=>lab.classList.contains("hidden")?openLab():closeLab());close.addEventListener("click",closeLab);visualClose?.addEventListener("click",closeVisualTest);
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!visualPanel?.classList.contains("hidden")){event.preventDefault();event.stopImmediatePropagation();closeVisualTest();}},true);
  window.addEventListener("meow-dev-started",()=>setTimeout(activate,0));window.addEventListener("meow-dev-ended",deactivate);window.addEventListener("meow-run-ended",()=>{if(game.getState().dev)deactivate();});
  setInterval(syncStats,250);
  if(game.getState().dev){activate();if(new URLSearchParams(location.search).get("visual")==="1")setTimeout(openVisualTest,0);}
})();
