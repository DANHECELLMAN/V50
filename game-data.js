(() => {
  "use strict";

  const artRoot = "assets/art/";
  const artAsset = (inkFile, legacyFile) => ({ art: `${artRoot}${inkFile}`, fallback_art: `${artRoot}${legacyFile}`, legacy_art: `${artRoot}${legacyFile}` });
  const LEGACY_ASSET_MAP = {
    hero_balanced: "character_miaoxiaobai_ink", character_moxiaobai_ink: "character_miaoxiaobai_ink", hero_nine_lives: "character_chihen_ink", hero_summoner: "character_qingyan_ink",
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

  const SUMMONS = {
    mouse: { id: "SUM_001", name: "墨鼠机关", icon: "鼠", role: ["output"], max: 5, maxHp: 82, damage: 15, range: 520, cooldown: 1.05, speed: 210, r: 18, color: "#27313a", art: `${artRoot}summon-ink-mouse.svg`, fallback_art: `${artRoot}enemy-shadow-mouse.svg`, projectile: "ink-seed" },
    crane: { id: "SUM_002", name: "纸鹤群", icon: "鹤", role: ["support", "control"], max: 5, maxHp: 68, damage: 12, range: 570, cooldown: 1.28, speed: 230, r: 18, color: "#536b87", art: `${artRoot}summon-paper-crane.svg`, fallback_art: `${artRoot}enemy-ink-spirit.svg`, projectile: "paper-feather" },
    dog: { id: "SUM_003", name: "石甲犬灵", icon: "犬", role: ["tank"], max: 5, maxHp: 150, damage: 24, range: 285, cooldown: .9, speed: 195, r: 24, color: "#3a4652", art: `${artRoot}summon-stone-dog.svg`, fallback_art: `${artRoot}enemy-stone-beast.svg`, projectile: "stone-claw" }
  };

  const QINGYAN_SUMMON_CATALOG = {
    mouse: { name:"墨鼠机关", icon:"鼠", kind:"mobile", role:"突击", hp: .90, cooldown:.65, damage:.95, range:500, speed:260, art:SUMMONS.mouse.art, fallback_art:SUMMONS.mouse.fallback_art },
    dog: { name:"石甲犬灵", icon:"犬", kind:"mobile", role:"护卫", hp:2.40, cooldown:.90, damage:.85, range:150, speed:205, art:SUMMONS.dog.art, fallback_art:SUMMONS.dog.fallback_art },
    rabbit: { name:"霜耳兔灵", icon:"兔", kind:"mobile", role:"治疗", hp:.85, cooldown:1, damage:.60, range:520, speed:225, art:SUMMONS.mouse.art, fallback_art:SUMMONS.mouse.fallback_art },
    scroll: { name:"卷轴童子", icon:"卷", kind:"mobile", role:"法术", hp:.95, cooldown:1.2, damage:.55, range:560, speed:205, art:SUMMONS.crane.art, fallback_art:SUMMONS.crane.fallback_art },
    cat: { name:"猎影猫灵", icon:"猫", kind:"mobile", role:"刺客", hp:1, cooldown:.75, damage:1, range:520, speed:255, art:SUMMONS.mouse.art, fallback_art:SUMMONS.mouse.fallback_art },
    cranes: { name:"纸鹤群", icon:"鹤", kind:"mobile", role:"穿透", hp:.70, cooldown:1.15, damage:.35, range:600, speed:235, art:SUMMONS.crane.art, fallback_art:SUMMONS.crane.fallback_art },
    guardian: { name:"团墨守灵", icon:"守", kind:"mobile", role:"防御", hp:1.80, cooldown:1.05, damage:.75, range:430, speed:180, art:SUMMONS.dog.art, fallback_art:SUMMONS.dog.fallback_art },
    bell: { name:"金铃纸灵", icon:"铃", kind:"mobile", role:"控制", hp:.90, cooldown:1.1, damage:.70, range:520, speed:215, art:SUMMONS.crane.art, fallback_art:SUMMONS.crane.fallback_art },
    thunder: { name:"雷尾仓灵", icon:"雷", kind:"mobile", role:"连锁", hp:1, cooldown:.9, damage:.85, range:540, speed:225, art:SUMMONS.mouse.art, fallback_art:SUMMONS.mouse.fallback_art },
    blade: { name:"镇纸飞刃", icon:"刃", kind:"fixed", role:"持续", duration:18, radius:110, cooldown:.45, damage:.65 },
    inkstone: { name:"墨砚增幅阵", icon:"砚", kind:"fixed", role:"增幅", duration:20, radius:220, cooldown:1, damage:0 },
    umbrella: { name:"纸伞震阵", icon:"伞", kind:"fixed", role:"控场", duration:16, radius:230, cooldown:3, damage:1.2 }
  };

  const growthNode = (character_id, node_id, name, tier, node_type, prerequisites, sp_cost, description, effect_ops = [], extra = {}) => ({
    character_id, node_id, name, tier, node_type, prerequisites, sp_cost, coin_cost:sp_cost, description, effect_ops, ...extra
  });
  const branchNodes = (character, branch, type, rows) => rows.map(([id,name,cost,tier,prerequisites,description,effect_ops=[],extra={}]) => growthNode(character,id,name,tier,type,prerequisites,cost,description,effect_ops,{ branch, ...extra }));
  const flag = (trigger, values={}) => [{ op:"add_trigger_effect", trigger, ...values }];
  const stat = (statName, value, mode="mult") => [{ op:"add_stat", stat:statName, mode, value }];
  const SKILL_TREE_NODES = [
    ...branchNodes("CHAR_BALANCED","基础修行","BASE",[
      ["XB01","墨锋初成",1,1,[],"攻击力 +8%。",stat("attack",.08)], ["XB02","身轻如燕",1,1,[],"移动速度 +6%。",stat("speed",.06)],
      ["XB03","灵息",1,2,["XB01"],"主动技能冷却 -6%。",stat("cooldownMul",-.06)], ["XB04","锐目",1,2,["XB01"],"暴击率 +5%。",stat("crit",.05,"add")], ["XB05","护体真气",1,2,["XB02"],"最大生命 +12%。",stat("maxHp",.12)]
    ]),
    ...branchNodes("CHAR_BALANCED","灵牙·墨枪","WEAPON",[
      ["XB06","枪气延展",1,1,["XB01"],"墨枪穿透 +1。",flag("spear_pierce",{value:1})], ["XB07","疾枪",1,2,["XB06"],"灵牙·墨枪攻击速度 +12%。",flag("spear_haste",{value:.12})],
      ["XB08","墨爆",2,2,["XB06"],"墨枪命中后产生 70% 攻击力小范围墨爆。",flag("spear_ink_burst",{damage:.7,radius:70})], ["XB09","双锋",2,3,["XB07"],"每3次普通攻击额外释放一道 65% 攻击力副枪气。",flag("spear_double_edge",{every:3,damage:.65})],
      ["XB10","贯阵",3,3,["XB08","XB09"],"每第4次攻击变成 280% 伤害的无限穿透巨枪气。",flag("spear_grand",{every:4,damage:2.8})], ["XB11","墨痕残锋",3,4,["XB10"],"贯穿攻击留下2秒墨痕，每0.4秒造成35%攻击力。",flag("spear_trail",{duration:2,tick:.4,damage:.35})],
      ["XB12","万枪归一",4,5,["XB11"],"每击杀10敌，下一次贯穿枪气伤害 +80%、宽度 +50%。",flag("spear_kill_charge",{kills:10,damage:.8,width:.5}),{exclusive_group:"XB_FINAL"}]
    ]),
    ...branchNodes("CHAR_BALANCED","踏墨身法","SKILL",[
      ["XB13","墨路",1,1,["XB02"],"踏墨墨痕持续时间由3秒提高到5秒。",flag("dash_trail_duration",{value:5})], ["XB14","轻身",1,2,["XB13"],"踏墨冲刺距离 +20%。",flag("dash_distance",{value:.2})],
      ["XB15","双踏",2,3,["XB14"],"踏墨获得2次充能。",flag("dash_charges",{value:2})], ["XB16","破墨",2,3,["XB13"],"冲刺终点产生160%攻击力墨爆。",flag("dash_end_burst",{damage:1.6})],
      ["XB17","影返",3,4,["XB15","XB16"],"残影1秒后复制最近一次普通攻击，伤害70%。",flag("dash_echo",{delay:1,damage:.7})], ["XB18","无迹",3,5,["XB17"],"无敌提高到0.55秒；击杀有20%概率返还踏墨充能。",flag("dash_mastery",{invuln:.55,chance:.2}),{exclusive_group:"XB_FINAL"}]
    ]),
    ...branchNodes("CHAR_BALANCED","回风·破云","SKILL",[
      ["XB19","扩风",1,1,["XB03"],"回风枪半径 +20%。",flag("wind_radius",{value:.2})], ["XB20","借势",2,2,["XB19"],"回风枪命中5敌以上返还2秒冷却。",flag("wind_refund",{hits:5,seconds:2})],
      ["XB21","回锋",2,2,["XB19"],"使用回风枪后3秒攻速 +20%。",flag("wind_haste",{value:.2,duration:3})], ["XB22","二式",3,3,["XB20","XB21"],"0.6秒后追加第二次180%回旋枪风。",flag("wind_second",{delay:.6,damage:1.8})],
      ["XB23","宽锋",1,1,["XB03"],"破云宽度 +30%。",flag("cloud_width",{value:.3})], ["XB24","猎将",2,2,["XB23"],"破云对精英/Boss额外伤害提高到 +60%。",flag("cloud_elite",{value:1.6})],
      ["XB25","裂云",3,3,["XB23"],"破云分裂为3道180%枪气，同一敌人最多承受2道。",flag("cloud_split",{count:3,damage:1.8})], ["XB26","贯日",4,4,["XB24","XB25"],"每击杀1敌，本次破云后续伤害 +8%，最高 +80%。",flag("cloud_rising",{perKill:.08,max:.8})]
    ]),
    ...branchNodes("CHAR_BALANCED","万墨归锋","ULTIMATE",[
      ["XB27","万墨归锋",3,4,["XB22","XB26"],"大招持续7秒，侧向枪气伤害提高到120%。",flag("xiaobai_ultimate",{duration:7,sideDamage:1.2})], ["XB28","墨锋极意",4,5,["XB27"],"每击杀10敌延长0.5秒（最多4秒）；终爆700%，踏墨冷却加速50%。",flag("xiaobai_ultimate_final",{endDamage:7,killExtend:.5,maxExtend:4,dashCooldown:.5}),{exclusive_group:"XB_FINAL"}]
    ]),

    ...branchNodes("CHAR_NINELIVES","基础修行","BASE",[
      ["CH01","猩红爪牙",1,1,[],"攻击力 +10%。",stat("attack",.10)], ["CH02","血躯",1,1,[],"最大生命 +12%。",stat("maxHp",.12)], ["CH03","狂意",1,1,[],"暴击伤害 +20%。",stat("critDamage",.20,"add")],
      ["CH04","临战",1,2,["CH01"],"生命低于50%时攻速 +12%。",flag("low_hp_haste",{threshold:.5,value:.12})], ["CH05","饮血",2,2,["CH02"],"生命低于30%时获得3%吸血。",flag("low_hp_lifesteal",{threshold:.3,value:.03})]
    ]),
    ...branchNodes("CHAR_NINELIVES","血狩","CORE",[
      ["CH06","血狩强化",2,1,["CH01"],"每损失10%生命，伤害加成由5%提高到6%。",flag("blood_hunt_damage",{value:.06})], ["CH07","狂速",2,2,["CH06"],"每层血狩攻速由3%提高到4%。",flag("blood_hunt_haste",{value:.04})],
      ["CH08","血眼",2,2,["CH06"],"生命低于30%时暴击率额外 +15%。",flag("blood_eye",{value:.15})], ["CH09","临界",3,3,["CH07","CH08"],"生命低于20%时攻击范围 +25%。",flag("critical_range",{value:.25})]
    ]),
    ...branchNodes("CHAR_NINELIVES","赤牙双刃","WEAPON",[
      ["CH10","双斩",1,1,["CH01"],"普通攻击变为120%+100%双斩。",flag("blade_double")], ["CH11","疾刃",1,2,["CH10"],"赤牙双刃攻速 +15%。",flag("blade_haste",{value:.15})],
      ["CH12","血刃",2,2,["CH10"],"击杀有20%概率产生85%追踪血刃。",flag("blood_blade",{chance:.2,damage:.85})], ["CH13","连锁血刃",2,3,["CH12"],"血刃可额外跳跃2个敌人。",flag("blood_blade_chain",{value:2})],
      ["CH14","猩红连斩",3,3,["CH11","CH13"],"每第5次攻击触发160%+180%+240%三连击。",flag("scarlet_combo")], ["CH15","血爆",3,4,["CH14"],"三连击最后产生150%范围爆炸。",flag("combo_burst",{damage:1.5})],
      ["CH16","杀意无尽",4,5,["CH15"],"血刃击杀敌人时，普通攻击冷却立即缩短30%。",flag("blood_blade_kill_haste",{value:.3}),{exclusive_group:"CH_FINAL"}]
    ]),
    ...branchNodes("CHAR_NINELIVES","血步","SKILL",[
      ["CH17","血影",1,1,["CH01"],"血影爆炸伤害由260%提高到340%。",flag("bloodstep_damage",{value:3.4})], ["CH18","双血步",2,2,["CH17"],"血步获得2次充能。",flag("bloodstep_charges",{value:2})],
      ["CH19","裂影",2,3,["CH17"],"血影爆炸后产生3道80%血刃。",flag("bloodstep_blades",{count:3,damage:.8})], ["CH20","残血无耗",3,3,["CH18","CH19"],"生命低于40%时血步不消耗生命。",flag("bloodstep_free",{threshold:.4})],
      ["CH21","猎杀",4,4,["CH20"],"血步击杀敌人返还1次充能，每3秒最多一次。",flag("bloodstep_refund",{cooldown:3})]
    ]),
    ...branchNodes("CHAR_NINELIVES","断命斩","SKILL",[
      ["CH22","扩斩",1,1,["CH03"],"断命斩半径 +20%。",flag("sever_radius",{value:.2})], ["CH23","死境增幅",2,2,["CH22"],"每损失10%生命的额外伤害由25%提高到35%。",flag("sever_lost_damage",{value:.35})],
      ["CH24","噬命",2,3,["CH22"],"断命斩击杀回血上限由10%提高到18%。",flag("sever_heal_cap",{value:.18})], ["CH25","绝境",4,4,["CH23","CH24"],"低于20%生命时断命斩必暴击、范围 +50%。",flag("sever_last_stand",{threshold:.2,range:.5}),{exclusive_group:"CH_FINAL"}]
    ]),
    ...branchNodes("CHAR_NINELIVES","不屈","SKILL",[
      ["CH26","铁骨",2,1,["CH02"],"不屈减伤由50%提高到65%。",flag("unyielding_reduction",{value:.65}),{choice_group:"CH_UNYIELDING"}], ["CH27","回魂",3,2,["CH26"],"不屈结束回血上限由35%提高到50%。",flag("unyielding_heal_cap",{value:.5})],
      ["CH28","狂骨",3,2,["CH02"],"不屈取消减伤，改为伤害/攻速 +70%、移速 +25%。",flag("unyielding_berserk",{damage:.7,haste:.7,speed:.25}),{choice_group:"CH_UNYIELDING"}]
    ]),
    ...branchNodes("CHAR_NINELIVES","九命","CORE",[
      ["CH29","余命",3,1,["CH02"],"九命 +1。",[{op:"modify_revive",lives:1}]], ["CH30","返魂",2,2,["CH29"],"复活生命由50%提高到65%。",[{op:"modify_revive",retention:.65}]],
      ["CH31","死战",3,3,["CH30"],"每消耗1命，本局永久伤害 +8%、攻速 +5%。",flag("life_spent_buff",{damage:.08,haste:.05})], ["CH32","九命不灭",4,4,["CH31"],"最后一命先触发5秒不灭与伤害 +100%，结束后才复活。",flag("last_life_immortal",{duration:5,damage:1}),{exclusive_group:"CH_FINAL"}]
    ]),
    ...branchNodes("CHAR_NINELIVES","九命·血狱","ULTIMATE",[
      ["CH33","九命·血狱",3,1,["CH09"],"解锁完整8秒血狱状态。",flag("blood_prison_lv1")], ["CH34","血刃覆境",3,2,["CH33"],"血狱期间额外血刃变为范围攻击。",flag("blood_prison_aoe")],
      ["CH35","血狱终爆",3,3,["CH34"],"血狱结束爆炸由650%提高到900%。",flag("blood_prison_end",{damage:9})], ["CH36","血狱·无命",4,4,["CH35"],"大招消耗命时有50%概率不真正扣除九命。",flag("blood_prison_save_life",{chance:.5}),{exclusive_group:"CH_FINAL"}]
    ]),

    ...branchNodes("CHAR_SUMMONER","基础修行","BASE",[
      ["QY01","墨契",1,1,[],"召唤物伤害 +10%。",stat("summonDamage",.10)], ["QY02","灵息",1,1,[],"召唤物生命 +15%。",stat("summonHp",.15)], ["QY03","迅灵",1,1,[],"召唤物攻速 +8%。",flag("summon_haste",{value:.08})],
      ["QY04","灵主",2,2,["QY01"],"青砚主动技能冷却 -8%。",stat("cooldownMul",-.08)], ["QY05","扩编",2,2,["QY02"],"移动召唤上限 +1。",[{op:"add_slot",target:"summon",value:1}]]
    ]),
    ...branchNodes("CHAR_SUMMONER","画灵共鸣","CORE",[
      ["QY06","共鸣强化",2,1,["QY01"],"每只召唤物提供的伤害加成由6%提高到8%。",flag("resonance_damage",{value:.08})], ["QY07","百灵加速",2,2,["QY06"],"4只以上召唤物时攻速 +15%。",flag("summon_count_haste",{count:4,value:.15})],
      ["QY08","灵主庇护",2,2,["QY06"],"每2只召唤物，青砚获得5%减伤。",flag("summon_ward",{per:2,value:.05})], ["QY09","万灵共鸣",4,3,["QY07","QY08"],"6只召唤物同时存在时，每4秒释放180%全体共鸣波。",flag("roster_resonance",{count:6,cooldown:4,damage:1.8})]
    ]),
    ...branchNodes("CHAR_SUMMONER","万灵图录","SUMMON",[
      ["QY10","石甲犬灵",2,1,["QY01"],"永久解锁坦克召唤：240%生命与咆哮嘲讽。",flag("unlock_summon",{id:"dog"})], ["QY11","卷轴童子",2,1,["QY01"],"永久解锁远程符纸召唤与卷术墨爆。",flag("unlock_summon",{id:"scroll"})], ["QY12","金铃纸灵",2,1,["QY01"],"永久解锁减速、眩晕型召唤。",flag("unlock_summon",{id:"bell"})],
      ["QY13","猎影猫灵",3,2,[],"永久解锁对精英/Boss擅长的背刺召唤。",flag("unlock_summon",{id:"cat"}),{require_count:{ids:["QY10","QY11","QY12"],count:2}}], ["QY14","纸鹤群",3,2,[],"永久解锁6只一组的穿透纸鹤。",flag("unlock_summon",{id:"cranes"}),{require_count:{ids:["QY10","QY11","QY12"],count:2}}], ["QY15","雷尾仓灵",3,2,[],"永久解锁可弹射4次的雷链召唤。",flag("unlock_summon",{id:"thunder"}),{require_count:{ids:["QY10","QY11","QY12"],count:2}}],
      ["QY16","镇纸飞刃",2,3,["QY13"],"永久解锁18秒持续旋刃装置。",flag("unlock_summon",{id:"blade"})], ["QY17","墨砚增幅阵",3,3,["QY14"],"永久解锁伤害 +20%、攻速 +15%的增幅阵。",flag("unlock_summon",{id:"inkstone"})], ["QY18","纸伞震阵",3,3,["QY15"],"永久解锁减速与震荡控场装置。",flag("unlock_summon",{id:"umbrella"})]
    ]),
    ...branchNodes("CHAR_SUMMONER","随机召唤","CORE",[
      ["QY19","偏好召唤",1,1,["QY01"],"可选择2种偏好召唤物，抽取权重 ×2。",flag("preferred_summons",{count:2})], ["QY20","广纳百灵",2,2,["QY19"],"相同召唤物连续出现概率降低50%。",flag("summon_variety",{value:.5})],
      ["QY21","双生符",3,3,["QY20"],"随机召唤有20%概率额外召唤1只。",flag("double_summon",{chance:.2})], ["QY22","阵器入池",3,3,[],"随机召唤有25%概率改为固定装置。",flag("device_pool",{chance:.25}),{require_count:{ids:["QY16","QY17","QY18"],count:1}}],
      ["QY23","满阵转化",2,4,["QY21"],"场上满员时随机召唤自动强化、回血或升星。",flag("full_roster_upgrade")]
    ]),
    ...branchNodes("CHAR_SUMMONER","灵契升星","CORE",[
      ["QY24","灵契升华",2,1,["QY02"],"允许召唤物升至2星：伤害与生命 +20%。",flag("summon_star_cap",{value:2})], ["QY25","化灵",3,2,["QY24"],"允许召唤物升至3星：伤害与生命再提高并解锁专属能力。",flag("summon_star_cap",{value:3})],
      ["QY26","同灵共契",4,3,["QY25"],"场上存在2只同类3星召唤物时触发该种类羁绊。",flag("summon_bond"),{exclusive_group:"QY_FINAL"}]
    ]),
    ...branchNodes("CHAR_SUMMONER","点灵·墨阵·归灵","SKILL",[
      ["QY27","双生",2,1,["QY04"],"点灵随机召唤数量由2只提高到3只。",flag("enlighten_count",{value:3})], ["QY28","久驻",2,2,["QY27"],"点灵的临时召唤持续时间由10秒提高到15秒。",flag("enlighten_duration",{value:15})], ["QY29","化真",4,3,["QY28"],"临时召唤击杀15敌后转为永久召唤，每次最多1只。",flag("enlighten_permanent",{kills:15}),{exclusive_group:"QY_FINAL"}],
      ["QY30","广阵",1,1,["QY04"],"墨阵半径 +25%。",flag("ink_array_radius",{value:.25})], ["QY31","杀阵",3,2,["QY30"],"墨阵每秒伤害由80%提高到150%。",flag("ink_array_damage",{value:1.5})], ["QY32","缚阵",3,2,["QY30"],"敌人首次进入墨阵时定身0.8秒。",flag("ink_array_bind",{duration:.8})], ["QY33","双阵",4,3,["QY31","QY32"],"允许同时存在两个墨阵。",flag("ink_array_count",{value:2}),{exclusive_group:"QY_FINAL"}],
      ["QY34","回生",2,1,["QY04"],"归灵回复召唤物生命由50%提高到80%。",flag("recall_heal",{value:.8})], ["QY35","群袭",3,2,["QY34"],"归灵后所有召唤物立即发动一次160%冲锋攻击。",flag("recall_charge",{damage:1.6})]
    ]),
    ...branchNodes("CHAR_SUMMONER","百鬼墨行","ULTIMATE",[
      ["QY36","百鬼墨行",3,1,["QY09"],"完整召出4移动、2高级临时召唤与1固定装置。",flag("ghost_parade_lv1")], ["QY37","百灵扩军",2,2,["QY36"],"大招随机移动召唤数量由4提高到6。",flag("ghost_parade_count",{value:6})],
      ["QY38","墨雨疾行",3,3,["QY37"],"大招墨雨间隔由2秒缩短到1.5秒。",flag("ghost_parade_rain",{value:1.5})], ["QY39","百鬼·墨将",4,4,["QY38"],"大招结束后，临时召唤汇聚为持续5秒的墨将。",flag("ghost_general"),{exclusive_group:"QY_FINAL"}]
    ])
  ];
  const SKILL_TREE = Object.freeze(Object.fromEntries(Object.values({ CHAR_BALANCED: "CHAR_BALANCED", CHAR_NINELIVES: "CHAR_NINELIVES", CHAR_SUMMONER: "CHAR_SUMMONER" }).map(id => [id, SKILL_TREE_NODES.filter(node => node.character_id === id)])));
  const GROWTH_CARDS = {
    CARD_BAL_MASTERY: { id:"CARD_BAL_MASTERY", node_id:"B09", character_id:"CHAR_BALANCED", name:"熟能生巧", icon:"熟", rarity:"rare", unique:false, condition:"weapon_lv4", description:"随机一把 Lv.4 以上武器最终伤害 +8%。" },
    CARD_NINE_SHIELD_BURST: { id:"CARD_NINE_SHIELD_BURST", node_id:"N05", character_id:"CHAR_NINELIVES", name:"血墨护身", icon:"环", rarity:"rare", unique:false, condition:"always", description:"盾破墨爆范围 +25%、伤害 +40%。" },
    CARD_NINE_DEATHMARK: { id:"CARD_NINE_DEATHMARK", node_id:"N10", character_id:"CHAR_NINELIVES", name:"死斗印记", icon:"印", rarity:"epic", unique:true, condition:"revived", description:"本局死亡印记的后续增益提高 25%。" },
    CARD_NINE_UNYIELDING: { id:"CARD_NINE_UNYIELDING", node_id:"N11", character_id:"CHAR_NINELIVES", name:"不屈残火", icon:"焰", rarity:"epic", unique:true, condition:"always", description:"复活后的死亡保护窗口延长 1 秒。" },
    CARD_SUM_GATHER: { id:"CARD_SUM_GATHER", node_id:"S07", character_id:"CHAR_SUMMONER", name:"聚灵", icon:"聚", rarity:"rare", unique:false, condition:"has_summon", description:"伙伴能量获取再提高 15%。" },
    CARD_SUM_ECHO_SOUL: { id:"CARD_SUM_ECHO_SOUL", node_id:"S09", character_id:"CHAR_SUMMONER", name:"余魂", icon:"魂", rarity:"epic", unique:true, condition:"has_summon", description:"余魂伤害提高到 75%，持续时间提高到 4 秒。" },
    CARD_SUM_FORMATION: { id:"CARD_SUM_FORMATION", node_id:"S14", character_id:"CHAR_SUMMONER", name:"墨阵共鸣", icon:"阵", rarity:"epic", unique:true, condition:"formation", description:"四职业共鸣阵额外提供召唤暴击率 +8%。" }
  };

  const enemy = (meta) => ({
    category: "normal", spawn_weight: 1, available_time: 0, attack_cooldown: 1.1,
    ai_type: "chase", warning_type: "warning_circle", death_effect: "death_ink",
    elite_modifiers: { hp: 4.2, damage: 1.35, speed: 1.06, radius: 1.35, xp: 7 },
    directions: ["down", "up", "left", "right"], animation_fps: 8, scale: 1,
    anchor: { x: .5, y: .86 }, pivot: { x: .5, y: .86 }, ...meta
  });
  const ENEMY_TYPES = {
    inkSpirit: enemy({ id:"ENM_001", name:"小墨灵", emoji:"墨", hp:24, speed:85, damage:8, r:15, xp:1, spawn_weight:32, available_time:0, art_key:"enemy_ink_spirit_ink", asset_id:"enemy.inkSpirit", ...artAsset("enemy-ink-spirit.svg","enemy-ink-spirit.svg") }),
    shadowMouse: enemy({ id:"ENM_002", name:"疾影鼠", emoji:"影", hp:16, speed:125, damage:7, r:12, xp:1, spawn_weight:26, available_time:0, attack_cooldown:.72, ai_type:"rush", art_key:"enemy_shadow_mouse_ink", asset_id:"enemy.shadowMouse", ...artAsset("enemy-shadow-mouse.svg","enemy-shadow-mouse.svg") }),
    brushBug: enemy({ id:"ENM_003", name:"残笔虫", emoji:"笔", hp:30, speed:92, damage:9, r:14, xp:2, spawn_weight:20, available_time:120, ai_type:"zigzag", art_variant:"brush-bug", art_key:"enemy_brush_bug_ink", asset_id:"enemy.brushBug", ...artAsset("enemy-ink-spirit.svg","enemy-ink-spirit.svg") }),
    paperCrow: enemy({ id:"ENM_004", name:"纸鸦", emoji:"鸦", hp:32, speed:72, damage:9, r:14, xp:2, spawn_weight:17, available_time:210, attack_cooldown:2.1, ai_type:"ranged", preferred_range:310, projectile_kind:"sting", warning_type:"warning_line", ranged:true, art_variant:"crow", art_key:"enemy_paper_crow_ink", asset_id:"enemy.paperCrow", ...artAsset("enemy-shadow-mouse.svg","enemy-ink-spirit.svg") }),
    armorBeast: enemy({ id:"ENM_005", name:"玄甲画兽", emoji:"甲", hp:72, speed:60, damage:12, r:21, xp:3, spawn_weight:13, available_time:300, attack_cooldown:1.35, ai_type:"tank", warning_type:"warning_cone", art_key:"enemy_armor_beast_ink", asset_id:"enemy.armorBeast", ...artAsset("enemy-stone-beast.svg","enemy-stone-beast.svg") }),
    lampWraith: enemy({ id:"ENM_006", name:"污墨灯魇", emoji:"灯", hp:46, speed:66, damage:6, r:17, xp:3, spawn_weight:11, available_time:390, attack_cooldown:2.7, ai_type:"support", preferred_range:300, projectile_kind:"glob", warning_type:"warning_circle", ranged:true, art_variant:"support", art_key:"enemy_lamp_wraith_ink", asset_id:"enemy.lampWraith", ...artAsset("enemy-ink-spirit.svg","enemy-ink-spirit.svg") }),
    scarletGeneral: enemy({ id:"ENM_007", name:"赤印墨将", emoji:"将", hp:94, speed:80, damage:15, r:22, xp:5, spawn_weight:8, available_time:525, attack_cooldown:1, ai_type:"bruiser", warning_type:"warning_cone", death_effect:"red_slash", art_variant:"residual", art_key:"enemy_scarlet_general_ink", asset_id:"enemy.scarletGeneral", ...artAsset("enemy-stone-beast.svg","enemy-stone-beast.svg") }),
    scholar: enemy({ id:"ENM_008", name:"执念书生", emoji:"书", hp:64, speed:70, damage:13, r:18, xp:4, spawn_weight:7, available_time:630, attack_cooldown:2.35, ai_type:"caster", preferred_range:340, projectile_kind:"glob", warning_type:"warning_line", ranged:true, art_variant:"scholar", art_key:"enemy_obsessed_scholar_ink", asset_id:"enemy.scholar", ...artAsset("enemy-ink-spirit.svg","enemy-ink-spirit.svg") }),
    bannerGeneral: enemy({ id:"ELT_001", name:"赤印墨将·执旗", emoji:"旗", category:"elite", hp:120, speed:82, damage:17, r:24, xp:12, spawn_weight:0, available_time:270, attack_cooldown:.9, ai_type:"bruiser", warning_type:"warning_cone", death_effect:"red_slash", elite_modifiers:{hp:1,damage:1,speed:1,radius:1,xp:1}, art_variant:"residual", art_key:"elite_banner_general_ink", asset_id:"enemy.bannerGeneral", ...artAsset("enemy-stone-beast.svg","enemy-stone-beast.svg") }),
    mountainBeast: enemy({ id:"ELT_002", name:"玄甲画兽·镇岳", emoji:"岳", category:"elite", hp:190, speed:56, damage:20, r:28, xp:15, spawn_weight:0, available_time:480, attack_cooldown:1.5, ai_type:"tank", warning_type:"warning_circle", elite_modifiers:{hp:1,damage:1,speed:1,radius:1,xp:1}, art_key:"elite_mountain_beast_ink", asset_id:"enemy.mountainBeast", ...artAsset("enemy-stone-beast.svg","enemy-stone-beast.svg") }),
    scrollJudge: enemy({ id:"ELT_003", name:"裂卷判官", emoji:"判", category:"elite", hp:150, speed:68, damage:18, r:25, xp:15, spawn_weight:0, available_time:660, attack_cooldown:1.8, ai_type:"caster", preferred_range:330, projectile_kind:"glob", warning_type:"warning_line", ranged:true, elite_modifiers:{hp:1,damage:1,speed:1,radius:1,xp:1}, art_variant:"scholar", art_key:"elite_scroll_judge_ink", asset_id:"enemy.scrollJudge", ...artAsset("enemy-ink-spirit.svg","enemy-ink-spirit.svg") })
  };

  const BOSS = { id:"BOSS_1", name:"泼墨狸将", category:"boss", asset_id:"boss.inkTanuki", art_key:"boss_ink_tanuki_ink", ...artAsset("boss-ink-tanuki.svg","boss-ink-tanuki.svg"), phases:2, hp:3500, damage:20, speed:50, attack_cooldown:2.15, ai_type:"boss_tanuki", warning_type:"warning_circle", death_effect:"ink_hit_large", elite_modifiers:{hp:1,damage:1,speed:1,radius:1,xp:1}, skill_set:["fan_ink_bullets","brush_mark_aoe"], phase_art:["calm_brush","vermilion_brush"], skill_fx:["FX_002","FX_005"] };
  const characterAsset = (portraitFile, fallbackFile = "hero-balanced.png", combatFile = "hero-balanced.svg") => ({
    art: `${artRoot}${portraitFile}`, portrait_art: `${artRoot}${portraitFile}`, portrait_fallback_art: `${artRoot}${fallbackFile}`,
    fallback_art: `${artRoot}${fallbackFile}`, legacy_art: `${artRoot}${fallbackFile}`,
    combat_art: `${artRoot}${combatFile}`, combat_fallback_art: `${artRoot}${fallbackFile}`
  });
  const characterFrames = (state, direction, count) => Array.from({ length: count }, (_, index) => `assets/characters/xiaobai/${state}/${direction}/${String(index + 1).padStart(2, "0")}.png`);
  const directionalFrames = (state, count) => Object.fromEntries(["down", "up", "left", "right"].map(direction => [direction, characterFrames(state, direction, count)]));
  const CHARACTER_ANIMATIONS = {
    xiaobai: {
      characterKey: "moxiaobai",
      fps: 11,
      stateFps: { move: 11, attack: 12, hit: 12, death: 8 },
      anchor: { x: .5, y: .975 },
      states: {
        idle: { down: 0, up: 0, left: 0, right: 0 },
        move: directionalFrames("move", 8),
        attack: directionalFrames("attack", 5),
        hit: directionalFrames("hit", 3),
        death: directionalFrames("death", 6)
      }
    }
  };
  const CHARACTER_COMBAT_KITS = {
    moxiaobai: {
      levelGrowth: { attack: .022, maxHp: .012 },
      exclusive: { id: "spiritSpear", name: "灵牙·墨枪", icon: "枪", max: 7, desc: "高速直线穿刺；高阶解锁墨爆与墨影贯穿。" },
      skills: [
        { id: "skill1", name: "踏墨", icon: "踏", key: "Q", cooldown: 7, desc: "冲刺并留下减速伤害墨痕。" },
        { id: "skill2", name: "回风枪", icon: "旋", key: "E", cooldown: 9, desc: "环身枪风击退贴身敌人。" },
        { id: "skill3", name: "破云", icon: "破", key: "R", cooldown: 12, desc: "向敌群最密集方向释放超长枪气。" },
        { id: "ultimate", name: "万墨归锋", icon: "万", key: "F", cooldown: 45, ultimate: true, desc: "五秒墨锋状态，结束时引爆大范围墨潮。" }
      ]
    },
    chihen: {
      levelGrowth: { attack: .018, maxHp: .01 },
      exclusive: { id: "scarletBlades", name: "赤牙双刃", icon: "刃", max: 7, desc: "近身高速扇斩；高阶解锁血刃与猩红连斩。" },
      skills: [
        { id: "skill1", name: "血步", icon: "血", key: "Q", cooldown: 6, desc: "以少量生命换取瞬移与延迟血爆。" },
        { id: "skill2", name: "断命斩", icon: "断", key: "E", cooldown: 10, desc: "生命越低威力越高，击杀可回血。" },
        { id: "skill3", name: "不屈", icon: "屹", key: "R", cooldown: 18, desc: "四秒不死并强化攻势，结束按伤害回血。" },
        { id: "ultimate", name: "九命·血狱", icon: "狱", key: "F", cooldown: 55, ultimate: true, desc: "主动燃烧一命，进入疯狂濒死狂战状态。" }
      ]
    },
    qingyan: {
      levelGrowth: { attack: .016, maxHp: .011 },
      exclusive: { id: "spiritTalisman", name: "画灵符", icon: "灵", max: 7, desc: "普攻积攒灵印，从万灵图录中随机唤灵；满阵后自动强化与升星。" },
      skills: [
        { id: "skill1", name: "点灵", icon: "点", key: "Q", cooldown: 8, desc: "从已解锁图录随机召唤两只，满阵时转为升星与恢复。" },
        { id: "skill2", name: "墨阵", icon: "阵", key: "E", cooldown: 12, desc: "展开减速敌人、强化召唤物的阵地。" },
        { id: "skill3", name: "归灵", icon: "归", key: "R", cooldown: 15, desc: "召回、治疗伙伴并发动多重墨波。" },
        { id: "ultimate", name: "百鬼墨行", icon: "行", key: "F", cooldown: 50, ultimate: true, desc: "十秒召集随机军团、临时高阶灵与固定阵器。" }
      ]
    }
  };
  const CHARACTERS = {
    moxiaobai: {
      id: "CHAR_BALANCED", key: "moxiaobai", name: "喵小白", role: "均衡型 / 灵动剑枪侠", status: "ready", status_text: "可出战", palette: "teal", art_key: "character_miaoxiaobai_ink",
      ...characterAsset("character-miaoxiaobai-ink.png", "hero-balanced.png", "character-miaoxiaobai-combat.svg"), animation_key: "xiaobai", style_theme: "anime_sumi_e", summary: "高速穿刺、墨痕切割与灵动突进兼备，稳定但绝不平庸。",
      traits: ["灵牙·墨枪 · 高速穿刺", "踏墨 · 位移留痕", "回风枪 · 贴脸解围", "万墨归锋 · 五秒主角模式"],
      base_stats: { maxHp: 120, attack: 12, speed: 195, damageMul: 1, attackSpeed: 1, crit: .08, critDamage: 1.75, cooldownMul: 1, size: 1, armor: .05, pickup: 82 },
      slot_rules: { weapon: 6, device: 2, deviceMax: 3, summon: 0 }, mechanics: { type: "standard_build", allowAutonomousSummons: false }
    },
    chihen: {
      id: "CHAR_NINELIVES", key: "chihen", name: "赤痕", role: "九命型 / 残血狂战", status: "ready", status_text: "可出战", palette: "vermilion", art_key: "character_chihen_ink",
      ...characterAsset("character-chihen-ink.png"), style_theme: "anime_sumi_e", summary: "生命越危险，攻势越疯狂；以血换位移、以击杀换回生、以九命换爆发。",
      traits: ["赤牙双刃 · 高速扇斩", "血狩 · 残血强化", "不屈 · 四秒反杀", "九命·血狱 · 主动燃命"],
      base_stats: { maxHp: 150, attack: 14, speed: 180, damageMul: 1, attackSpeed: 1, crit: .10, critDamage: 1.90, cooldownMul: 1, size: 1, armor: .08, pickup: 82 },
      slot_rules: { weapon: 6, device: 0, summon: 0 },
      mechanics: { type: "nine_lives", lives: 3, reviveMaxHpMultiplier: .5, reviveShieldCharges: 1, reviveDamageMultiplier: 1.12, reviveAttackSpeedMultiplier: 1.08, reviveCritBonus: .03, challengeExtraRevive: false }
    },
    qingyan: {
      id: "CHAR_SUMMONER", key: "qingyan", name: "青砚", role: "召唤型 / 墨灵统御", status: "ready", status_text: "可出战", palette: "indigo", art_key: "character_qingyan_ink",
      ...characterAsset("character-qingyan-ink.png"), style_theme: "anime_sumi_e", summary: "以万灵图录随机编队；满阵不空转，而会恢复、强化并升星现有伙伴。",
      traits: ["画灵符 · 灵印随机唤灵", "万灵图录 · 十二种伙伴", "满阵升星 · 构筑不空转", "百鬼墨行 · 一人即军"],
      base_stats: { maxHp: 105, attack: 9, speed: 173, damageMul: 1, attackSpeed: 1, crit: .05, critDamage: 1.75, cooldownMul: 1, size: 1, armor: .03, pickup: 88 },
      slot_rules: { weapon: 3, weaponMax: 4, device: 0, summon: 3, summonMax: 6 },
      mechanics: { type: "summoner_roster", companionEnergy: true, companionEnergyMax: 100, empowerDuration: 6, deathLinkBuff: true, deathLinkDuration: 5, inheritPlayerStats: false, allowedScaling: ["summon_level", "summon_affix", "growth_tree", "specific_synergy"] },
      skills: {}
    }
  };

  // 第一周目资源清单：核心逻辑只认资源 ID；新素材缺失时逐级回退到现有素材。
  const blankAnimationStates = () => ({ idle:{}, move:{}, attack:{}, hit:{}, death:{} });
  const unitAsset = ({ id, name, art, fallback_art, animation = null, directions = ["down","up","left","right"], fps = 8, scale = 1, anchor = {x:.5,y:.86}, pivot = anchor, collisionRadius = 16 }) => ({
    id, name, sprite:{ art, fallback_art }, animations:animation?.states || blankAnimationStates(), directions, fps,
    stateFps:animation?.stateFps || {}, scale, anchor, pivot, collisionRadius
  });
  const ASSET_MANIFEST = {
    version: 1,
    characters: {
      moxiaobai: unitAsset({ id:"character.moxiaobai", name:CHARACTERS.moxiaobai.name, art:CHARACTERS.moxiaobai.combat_art, fallback_art:CHARACTERS.moxiaobai.combat_fallback_art, animation:CHARACTER_ANIMATIONS.xiaobai, fps:11, scale:1, anchor:{x:.5,y:.975}, collisionRadius:20 }),
      chihen: unitAsset({ id:"character.chihen", name:CHARACTERS.chihen.name, art:CHARACTERS.chihen.combat_art, fallback_art:CHARACTERS.chihen.combat_fallback_art, fps:10, scale:1, anchor:{x:.5,y:.88}, collisionRadius:21 }),
      qingyan: unitAsset({ id:"character.qingyan", name:CHARACTERS.qingyan.name, art:CHARACTERS.qingyan.combat_art, fallback_art:CHARACTERS.qingyan.combat_fallback_art, fps:10, scale:1, anchor:{x:.5,y:.88}, collisionRadius:19 })
    },
    enemies: Object.fromEntries(Object.entries(ENEMY_TYPES).map(([key,data]) => [key, unitAsset({ id:`enemy.${key}`, name:data.name, art:data.art, fallback_art:data.fallback_art, directions:data.directions, fps:data.animation_fps, scale:data.scale, anchor:data.anchor, pivot:data.pivot, collisionRadius:data.r })])),
    bosses: {
      inkTanuki: unitAsset({ id:"boss.inkTanuki", name:BOSS.name, art:BOSS.art, fallback_art:BOSS.fallback_art, fps:9, scale:1, anchor:{x:.5,y:.82}, collisionRadius:55 })
    }
  };
  Object.entries(CHARACTERS).forEach(([key,value]) => { value.asset_id = `character.${key}`; });

  const VFX_LIBRARY = {
    ink_hit_small: { id:"ink_hit_small", renderer:"burst", legacy_fx_id:"FX_001", color:"#2d706b", count:8, radius:38, duration:.35 },
    ink_hit_large: { id:"ink_hit_large", renderer:"burst", legacy_fx_id:"FX_002", color:"#252823", count:18, radius:88, duration:.5 },
    cyan_slash: { id:"cyan_slash", renderer:"beam", legacy_fx_id:"FX_001", color:"#4f928f", width:5, duration:.16 },
    red_slash: { id:"red_slash", renderer:"beam", legacy_fx_id:"FX_007", color:"#b8422f", width:6, duration:.18 },
    death_ink: { id:"death_ink", renderer:"burst", legacy_fx_id:"FX_006", color:"#292d29", count:9, radius:46, duration:.42 },
    warning_circle: { id:"warning_circle", renderer:"warning", legacy_fx_id:"FX_007", shape:"circle", color:"#b8422f", duration:1.05 },
    warning_cone: { id:"warning_cone", renderer:"warning", legacy_fx_id:"FX_007", shape:"cone", color:"#b8422f", duration:.9 },
    warning_line: { id:"warning_line", renderer:"warning", legacy_fx_id:"FX_007", shape:"line", color:"#b8422f", duration:.8 },
    ink_pool: { id:"ink_pool", renderer:"zone", legacy_fx_id:"FX_005", color:"#38465d", duration:4 }
  };

  const SCENE_LAYERS = {
    id:"first_cycle_ink_courtyard",
    ground:[{ id:"garden_ground", art:"assets/scenes/first-cycle/ground/garden-base.png", fallback_art:"assets/art/garden-arena.png", scale:1, x:.5, y:.5 }],
    obstacle:[
      { id:"ink_rock", art:"assets/scenes/first-cycle/obstacle/ink-rock.png", fallback_art:"", x:.16, y:.68, scale:.9 },
      { id:"broken_fence", art:"assets/scenes/first-cycle/obstacle/broken-fence.png", fallback_art:"", x:.82, y:.64, scale:1 }
    ],
    decoration:[
      { id:"withered_bamboo", art:"assets/scenes/first-cycle/decoration/withered-bamboo.png", fallback_art:"", x:.08, y:.18, scale:1 },
      { id:"stone_path", art:"assets/scenes/first-cycle/decoration/stone-path.png", fallback_art:"", x:.48, y:.66, scale:1 },
      { id:"shallow_stream", art:"assets/scenes/first-cycle/decoration/shallow-stream.png", fallback_art:"", x:.72, y:.36, scale:1 },
      { id:"lotus_pond", art:"assets/scenes/first-cycle/decoration/lotus-pond.png", fallback_art:"", x:.24, y:.30, scale:.9 }
    ],
    landmark:[
      { id:"ruined_pavilion", art:"assets/scenes/first-cycle/landmark/ruined-pavilion.png", fallback_art:"", x:.50, y:.16, scale:1 },
      { id:"broken_bridge", art:"assets/scenes/first-cycle/landmark/broken-bridge.png", fallback_art:"", x:.86, y:.30, scale:1 }
    ],
    environment_overlay:[
      { id:"paper_cracks", art:"assets/scenes/first-cycle/overlay/paper-cracks.png", fallback_art:"", opacity:.22 },
      { id:"ink_mist", art:"assets/scenes/first-cycle/overlay/ink-mist.png", fallback_art:"", opacity:.18 }
    ]
  };

  const RUN_TIMELINE = {
    id:"first_cycle_66_days", duration:900, start_day:66, end_day:0,
    phases:[
      { id:"early", name:"墨迹初生", start:0, end:270, spawn_interval:[.74,.56], batch:[1,2], max_enemies:95 },
      { id:"mid", name:"残卷渐醒", start:270, end:540, spawn_interval:[.56,.38], batch:[2,4], max_enemies:120 },
      { id:"late", name:"墨潮压境", start:540, end:780, spawn_interval:[.38,.24], batch:[3,6], max_enemies:145 },
      { id:"final", name:"零日将至", start:780, end:900, spawn_interval:[.24,.16], batch:[5,8], max_enemies:165 }
    ],
    events:[
      { id:"chest_1", at:180, type:"object", object:"chest", label:"宝箱" },
      { id:"elite_1", at:270, type:"enemy_wave", enemies:[{id:"bannerGeneral",count:1}], label:"执旗墨将来袭！" },
      { id:"merchant", at:360, type:"object", object:"merchant", label:"神秘商人" },
      { id:"chest_2", at:486, type:"object", object:"chest", label:"稀有宝箱" },
      { id:"event", at:558, type:"object", object:"event", label:"庭院奇遇" },
      { id:"elite_2", at:630, type:"enemy_wave", enemies:[{id:"mountainBeast",count:1},{id:"scrollJudge",count:1}], label:"高压精英潮来袭！" },
      { id:"elite_3", at:780, type:"enemy_wave", enemies:[{id:"bannerGeneral",count:1},{id:"mountainBeast",count:1},{id:"scrollJudge",count:1}], label:"三墨精英合围！" },
      { id:"boss", at:900, type:"boss", label:"0日 · 泼墨狸将现身" }
    ],
    dev_days:{ 66:0, 44:300, 29:505, 14:710, 1:886, 0:900 }
  };
  const CHARACTER = CHARACTERS.moxiaobai;

  window.MEOW_DATA = { WEAPONS, PASSIVES, DEVICES, SUMMONS, QINGYAN_SUMMON_CATALOG, SKILL_TREE, SKILL_TREE_NODES, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, CHARACTER_ANIMATIONS, CHARACTER_COMBAT_KITS, LEGACY_ASSET_MAP, INK_FX, ASSET_MANIFEST, VFX_LIBRARY, SCENE_LAYERS, RUN_TIMELINE };
})();
