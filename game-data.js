(() => {
  "use strict";

  const artRoot = "assets/art/";
  const artAsset = (inkFile, legacyFile) => ({ art: `${artRoot}${inkFile}`, fallback_art: `${artRoot}${legacyFile}`, legacy_art: `${artRoot}${legacyFile}` });
  const LEGACY_ASSET_MAP = {
    hero_balanced: "character_moxiaobai_ink", hero_nine_lives: "character_chihen_ink", hero_summoner: "character_qingyan_ink",
    weapon_old_fishbone: "weapon_fishbone_ink", weapon_old_yarn: "weapon_leaf_ink", weapon_old_claw: "weapon_claw_ink", weapon_old_laser: "weapon_bell_line_ink",
    weapon_old_can: "weapon_ink_bomb", weapon_old_orbit: "weapon_fan_blade", weapon_old_dot: "weapon_ink_mist", weapon_old_knockback: "weapon_water_wave",
    weapon_old_area: "weapon_ink_sigil", weapon_old_chain: "weapon_thunder_ink", weapon_old_return: "weapon_return_fish", weapon_old_shockwave: "weapon_ink_roar",
    enemy_old_grunt: "enemy_ink_spirit_ink", enemy_old_fast: "enemy_shadow_mouse_ink", enemy_old_tank: "enemy_stone_beast_ink", boss_old_tanuki: "boss_ink_tanuki_ink"
  };
  const INK_FX = {
    FX_001: { id: "FX_001", visual: "brush-slash", color: "#2d706b", accent: "#efe6d2", maxParticles: 12, readability: "high" },
    FX_002: { id: "FX_002", visual: "ink-bloom", color: "#242824", accent: "#a63b2e", maxParticles: 18, readability: "high" },
    FX_003: { id: "FX_003", visual: "flow-line", color: "#9bbec0", accent: "#d6b66b", maxParticles: 8, readability: "high" },
    FX_004: { id: "FX_004", visual: "water-ring", color: "#4f928f", accent: "#e8dfca", maxParticles: 12, readability: "high" },
    FX_005: { id: "FX_005", visual: "ink-pool", color: "#38465d", accent: "#a63b2e", maxParticles: 10, readability: "medium" },
    FX_006: { id: "FX_006", visual: "ink-return", color: "#272b27", accent: "#e8dfca", maxParticles: 8, readability: "high" },
    FX_007: { id: "FX_007", visual: "vermilion-return", color: "#2b2d29", accent: "#b8422f", maxParticles: 12, readability: "high" }
  };
  const levelTable = (keys, rows) => [null, ...rows.map((values, index) => ({
    level: index + 1,
    ...Object.fromEntries(keys.map((key, column) => [key, values[column]]).filter(([, value]) => value !== null && value !== undefined))
  }))];
  const weapon = (meta, keys, rows) => ({ max: 7, style_theme: "anime_sumi_e", ...meta, levels: levelTable(keys, rows) });

  const WEAPONS = {
    yarn: weapon({ id: "WPN_001", name: "鱼骨墨针", display_name: "鱼骨墨针", icon: "鱼", behavior: "projectile", desc: "一笔甩出鱼骨墨针，穿透敌群；Lv.7 化作万针游鱼。", tags: "投射 · 穿透", logicTags: ["Projectile", "Pierce"], art_key: "weapon_fishbone", fx_id: "FX_001", ultimate_fx_id: "FX_002" },
      ["damage","cd","count","range","speed","pierce","spread","retention"], [
        [18,.8,1,600,500,1,0,1],[22,.8,1,600,500,1,0,1],[22,.8,2,600,500,1,12,1],[22,.8,2,600,500,2,12,.9],[22,.68,2,600,550,2,12,.9],[28,.68,2,630,550,2,12,.9],[18,.65,5,650,580,2,40,.9]
      ]),
    fish: weapon({ id: "WPN_002", name: "流叶回锋", display_name: "流叶回锋", icon: "叶", behavior: "bounce", desc: "墨叶旋飞并弹向下一目标；Lv.7 引出千叶回潮。", tags: "投射 · 弹射", logicTags: ["Projectile", "Bounce"], art_key: "weapon_leaf", fx_id: "FX_001", ultimate_fx_id: "FX_004" },
      ["damage","cd","count","range","speed","bounce","spread","retention"], [
        [16,1,1,520,420,2,0,.8],[20,1,1,520,420,2,0,.8],[20,1,1,520,420,3,0,.82],[20,1,2,520,420,3,16,.82],[20,.85,2,520,450,3,16,.82],[24,.85,2,600,450,4,16,.88],[18,.72,4,620,500,5,30,.9]
      ]),
    paw: weapon({ id: "WPN_003", name: "爪痕剑气", display_name: "爪痕剑气", icon: "爪", behavior: "melee", desc: "半月爪痕环身挥出；Lv.7 留下百爪墨刃。", tags: "近战 · 范围", logicTags: ["Melee", "Area"], art_key: "weapon_claw", fx_id: "FX_001", ultimate_fx_id: "FX_001" },
      ["damage","cd","count","range","arc","duration","hitGap","critDamageBonus"], [
        [30,1.2,1,150,110,.2,0,0],[36,1.2,1,150,110,.2,0,0],[36,1.2,1,175,125,.22,0,0],[36,1.02,1,175,125,.22,0,0],[30,1.02,2,175,125,.3,.12,0],[40,1.02,2,185,125,.3,.12,.2],[28,.95,3,210,360,.42,.1,.2]
      ]),
    laser: weapon({ id: "WPN_004", name: "铃线追魂", display_name: "铃线追魂", icon: "铃", behavior: "beam", desc: "铃声牵出细长墨线瞬时点刺；Lv.7 多线扫敌。", tags: "锁敌 · 高频", logicTags: ["Beam", "Direct"], art_key: "weapon_bell_line", fx_id: "FX_003", ultimate_fx_id: "FX_003" },
      ["damage","cd","count","range","duration"], [
        [10,.2,1,700,.15],[12,.2,1,700,.15],[12,.2,1,800,.15],[11,.2,2,800,.15],[11,.17,2,800,.15],[13,.17,2,850,.2],[10,.14,4,900,.2]
      ]),
    ink: weapon({ id: "WPN_005", name: "泼墨团", display_name: "泼墨团", icon: "墨", behavior: "blast", desc: "浓墨落点炸成墨花；Lv.7 主爆后绽放三枚二次墨花。", tags: "投射 · 范围", logicTags: ["Projectile", "Area"], art_key: "weapon_ink_bomb", fx_id: "FX_002", ultimate_fx_id: "FX_002" },
      ["damage","cd","count","range","speed","radius","spread","childBlasts","childDamage"], [
        [42,1.6,1,500,360,120,0,0,0],[52,1.6,1,500,360,120,0,0,0],[52,1.6,1,500,360,140,0,0,0],[40,1.6,2,500,360,135,20,0,0],[40,1.36,2,500,380,135,20,0,0],[50,1.36,2,520,380,150,20,0,0],[38,1.25,2,540,400,155,20,3,.45]
      ]),
    fan: weapon({ id: "WPN_006", name: "扇骨游刃", display_name: "扇骨游刃", icon: "扇", behavior: "orbit", desc: "扇骨墨刃绕身旋切；Lv.7 形成内外双轨。", tags: "环绕 · 持续", logicTags: ["Orbit", "Area"], art_key: "weapon_fan_blade", fx_id: "FX_001", ultimate_fx_id: "FX_001" },
      ["damage","cd","count","range","rotSpeed","dualOrbit"], [
        [14,0,2,95,180,false],[16,0,2,95,180,false],[16,0,3,95,180,false],[16,0,3,112,200,false],[18,0,3,112,225,false],[20,0,4,120,235,false],[17,0,6,128,250,true]
      ]),
    mist: weapon({ id: "WPN_007", name: "残墨雾", display_name: "残墨雾", icon: "雾", behavior: "dot", desc: "在敌群脚下晕开减速墨雾；Lv.7 可同时维持三片墨海。", tags: "持续 · 控制", logicTags: ["Area", "DOT", "Control"], art_key: "weapon_ink_mist", fx_id: "FX_005", ultimate_fx_id: "FX_005" },
      ["damage","cd","count","range","duration","tick","slow","maxZones"], [
        [8,2.2,1,180,3,.5,.12,1],[10,2.2,1,180,3,.5,.12,1],[10,2.2,1,210,3,.5,.12,1],[10,2.2,1,210,3.8,.5,.16,1],[10,1.87,1,210,3.8,.5,.16,1],[12,1.87,1,230,4,.5,.22,1],[10,1.6,2,260,4.5,.5,.25,3]
      ]),
    wave: weapon({ id: "WPN_008", name: "水纹震", display_name: "水纹震", icon: "潮", behavior: "knockback", desc: "水墨波为玩家腾出空间；Lv.7 连续推出惊潮三叠。", tags: "范围 · 击退", logicTags: ["Area", "Knockback"], art_key: "weapon_water_wave", fx_id: "FX_004", ultimate_fx_id: "FX_004" },
      ["damage","cd","count","range","knockback","slow","waveGap"], [
        [26,1.5,1,190,100,0,0],[32,1.5,1,190,100,0,0],[32,1.5,1,220,100,0,0],[32,1.5,1,220,135,.2,0],[32,1.28,1,220,135,.2,0],[40,1.28,1,235,150,.2,0],[26,1.15,3,255,120,.2,.12]
      ]),
    sigil: weapon({ id: "WPN_009", name: "符墨阵", display_name: "符墨阵", icon: "符", behavior: "sigil", desc: "提前铺设持续蚀墨的极简符阵；Lv.7 三阵并存并终结爆墨。", tags: "区域 · 持续", logicTags: ["DOT", "Status", "Area"], art_key: "weapon_ink_sigil", fx_id: "FX_005", ultimate_fx_id: "FX_002" },
      ["damage","cd","count","range","duration","tick","maxZones","endBlast"], [
        [7,1.8,1,160,4,.5,1,0],[9,1.8,1,160,4,.5,1,0],[9,1.8,1,160,5,.5,1,0],[8,1.8,2,160,5,.5,2,0],[8,1.53,2,170,5,.5,2,0],[10,1.53,2,180,5.5,.5,2,0],[8,1.35,3,190,6,.5,3,.7]
      ]),
    chain: weapon({ id: "WPN_010", name: "雷墨丝", display_name: "雷墨丝", icon: "雷", behavior: "chain", desc: "青白墨线在敌群间折跃；Lv.7 链击分叉成雷丝万缕。", tags: "连锁 · 攻速", logicTags: ["Projectile", "Chain"], art_key: "weapon_thunder_ink", fx_id: "FX_003", ultimate_fx_id: "FX_003" },
      ["damage","cd","count","range","speed","chains","retention","forkChance","forkDamage"], [
        [12,.9,1,550,480,3,.75,0,0],[14,.9,1,550,480,3,.75,0,0],[14,.9,1,550,480,4,.78,0,0],[14,.77,1,550,500,4,.78,0,0],[14,.77,1,550,500,5,.82,0,0],[18,.77,1,600,520,5,.82,0,0],[14,.62,2,650,550,6,.85,.4,.6]
      ]),
    returnBlade: weapon({ id: "WPN_011", name: "回游鱼刃", display_name: "回游鱼刃", icon: "游", behavior: "return", desc: "鱼形墨刃往返穿透；Lv.7 双鱼交错回潮。", tags: "投射 · 往返", logicTags: ["Projectile", "Pierce", "Return"], art_key: "weapon_return_fish", fx_id: "FX_001", ultimate_fx_id: "FX_001" },
      ["damage","cd","count","range","speed","pierce","returnDamage","spread"], [
        [20,1.1,1,450,440,2,.9,0],[24,1.1,1,450,440,2,.9,0],[24,1.1,1,450,440,3,.9,0],[22,1.1,1,450,440,3,.7,0],[22,.94,1,450,470,3,.7,0],[28,.94,1,500,490,3,.8,0],[20,.82,2,540,520,4,.9,12]
      ]),
    roar: weapon({ id: "WPN_012", name: "狮吼墨波", display_name: "狮吼墨波", icon: "吼", behavior: "roar", desc: "低频全向墨波重整怪潮；Lv.7 三重山鸣万籁。", tags: "范围 · 控制", logicTags: ["Area", "Control", "Knockback"], art_key: "weapon_ink_roar", fx_id: "FX_004", ultimate_fx_id: "FX_004" },
      ["damage","cd","count","range","knockback","slow","waveGap"], [
        [22,2.4,1,230,120,.15,0],[28,2.4,1,230,120,.15,0],[28,2.4,1,280,120,.15,0],[28,2.04,1,280,120,.15,0],[28,2.04,1,280,160,.2,0],[36,2.04,1,310,160,.2,0],[24,1.8,3,340,130,.2,.15]
      ])
  };

  const PASSIVES = {
    power: { id: "PAS_001", name: "磨爪石", icon: "力", max: 3, desc: "所有伤害 +18%" },
    haste: { id: "PAS_002", name: "疾风纸", icon: "疾", max: 3, desc: "攻击速度 +14%" },
    health: { id: "PAS_003", name: "温汤罐", icon: "生", max: 3, desc: "最大生命 +22，并恢复等量生命" },
    speed: { id: "PAS_004", name: "燕步练习", icon: "步", max: 3, desc: "移动速度 +10%" },
    magnet: { id: "PAS_005", name: "拾墨铃", icon: "拾", max: 3, desc: "拾取范围 +38" },
    crit: { id: "PAS_006", name: "猎手胡须", icon: "会", max: 3, desc: "暴击率 +8%" },
    size: { id: "PAS_007", name: "蓬尾笔势", icon: "广", max: 3, desc: "范围与弹体尺寸 +15%" },
    armor: { id: "PAS_008", name: "护纸札", icon: "守", max: 3, desc: "受到伤害 -8%" }
  };

  const DEVICES = {
    turret: { id: "DEV_001", name: "镇纸飞刃", icon: "刃", max: 5, desc: "放置镇纸，持续展开墨刃攻击附近目标。", tags: "固定装置 · 输出", art_key: "device_paperweight", fx_id: "FX_001" },
    trap: { id: "DEV_003", name: "纸伞震阵", icon: "伞", max: 5, desc: "脚下留下一柄纸伞，敌人靠近时推出水纹震波。", tags: "固定装置 · 控制", art_key: "device_umbrella", fx_id: "FX_004" }
  };

  const ENEMY_TYPES = {
    mouse: { id: "ENM_GRUNT", name: "小墨灵", emoji: "墨", hp: 24, speed: 85, damage: 8, r: 15, xp: 1, art_key: "enemy_ink_spirit_ink", ...artAsset("enemy-ink-spirit-ink.png", "enemy-ink-spirit.svg"), ai_role: "melee", death_fx: "FX_006" },
    bug: { id: "ENM_FAST", name: "疾影鼠", emoji: "影", hp: 16, speed: 125, damage: 7, r: 12, xp: 1, art_key: "enemy_shadow_mouse_ink", ...artAsset("enemy-shadow-mouse-ink.png", "enemy-shadow-mouse.svg"), ai_role: "fast", death_fx: "FX_006" },
    hedgehog: { id: "ENM_TANK", name: "石墨兽", emoji: "石", hp: 70, speed: 60, damage: 12, r: 21, xp: 3, art_key: "enemy_stone_beast_ink", ...artAsset("enemy-stone-beast-ink.png", "enemy-stone-beast.svg"), ai_role: "tank", death_fx: "FX_006" },
    bee: { id: "ENM_RANGED", name: "墨羽鸦", emoji: "羽", hp: 32, speed: 70, damage: 9, r: 14, xp: 2, art_key: "enemy_ink_crow_ink", ...artAsset("enemy-ink-crow-ink.png", "enemy-ink-spirit.svg"), art_variant: "crow", ai_role: "ranged", ranged: true, death_fx: "FX_006" },
    frog: { id: "ENM_SUPPORT", name: "铃纸灵", emoji: "铃", hp: 45, speed: 65, damage: 5, r: 17, xp: 3, art_key: "enemy_bell_spirit_ink", ...artAsset("enemy-bell-spirit-ink.png", "enemy-ink-spirit.svg"), art_variant: "support", ai_role: "support", ranged: true, death_fx: "FX_006" },
    snail: { id: "ENM_SPECIAL", name: "残墨妖", emoji: "残", hp: 90, speed: 80, damage: 15, r: 22, xp: 5, art_key: "enemy_residual_ink", ...artAsset("enemy-residual-ink.png", "enemy-stone-beast.svg"), art_variant: "residual", ai_role: "special", death_fx: "FX_007" }
  };

  const BOSS = { id: "BOSS_1", name: "泼墨狸将", art_key: "boss_ink_tanuki_ink", ...artAsset("boss-ink-tanuki-ink.png", "boss-ink-tanuki.svg"), phases: 2, hp: 3500, damage: 20, speed: 50, skill_set: ["fan_ink_bullets", "brush_mark_aoe"], phase_art: ["calm_brush", "vermilion_brush"], skill_fx: ["FX_002", "FX_005"] };
  const CHARACTERS = {
    moxiaobai: { id: "CHAR_BALANCED", key: "moxiaobai", name: "墨小白", role: "均衡型 / 万金油", status: "ready", status_text: "可出战", palette: "teal", art_key: "character_moxiaobai_ink", ...artAsset("character-moxiaobai-ink.png", "hero-balanced.png"), style_theme: "anime_sumi_e", summary: "基础扎实、武器自由，依靠本局 Build 应对各种战局。", traits: ["6 武器槽", "2 个固定装置槽", "不能使用自主移动召唤物", "基础属性强化效果略高"], base_stats: { maxHp: 120, speed: 195, damageMul: 1, attackSpeed: 1.05, crit: .05, size: 1, armor: 0, pickup: 82 }, slot_rules: { weapon: 6, device: 2, deviceMax: 3, summon: 0 }, mechanics: { type: "standard_build", allowAutonomousSummons: false } },
    chihen: { id: "CHAR_NINE_LIVES", key: "chihen", name: "赤痕", role: "九命型 / 高风险高输出", status: "development", status_text: "开发中", palette: "vermilion", art_key: "character_chihen_ink", ...artAsset("character-chihen-ink.png", "hero-balanced.png"), style_theme: "anime_sumi_e", summary: "九命轮回，以生命上限换取永久攻击、攻速与暴击成长。", traits: ["6 武器槽", "无召唤与固定装置", "九命自动复活", "复活后获得一次完全挡伤护盾"], base_stats: { maxHp: 120, speed: 190, damageMul: 1.12, attackSpeed: 1.08, crit: .07, size: 1, armor: 0, pickup: 78 }, slot_rules: { weapon: 6, device: 0, summon: 0 }, mechanics: { type: "nine_lives", lives: 9, reviveMaxHpMultiplier: .5, reviveShieldCharges: 1, challengeExtraRevive: false } },
    qingyan: { id: "CHAR_SUMMONER", key: "qingyan", name: "青砚", role: "召唤型 / 阵容经营", status: "development", status_text: "开发中", palette: "indigo", art_key: "character_qingyan_ink", ...artAsset("character-qingyan-ink.png", "hero-balanced.png"), style_theme: "anime_sumi_e", summary: "本体输出偏低，围绕伙伴能量、阵亡联动与召唤复活经营阵容。", traits: ["初始 3 武器槽", "初始 4 召唤槽", "伙伴能量强化", "召唤物使用独立属性体系"], base_stats: { maxHp: 100, speed: 185, damageMul: .8, attackSpeed: .95, crit: .05, size: 1, armor: 0, pickup: 88 }, slot_rules: { weapon: 3, weaponMax: 4, device: 0, summon: 4, summonMax: 6 }, mechanics: { type: "summoner_roster", companionEnergy: true, deathLinkBuff: true, inheritPlayerStats: false, allowedScaling: ["summon_level", "summon_affix", "growth_tree", "specific_synergy"] } }
  };
  const CHARACTER = CHARACTERS.moxiaobai;

  window.MEOW_DATA = { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, LEGACY_ASSET_MAP, INK_FX };
})();
