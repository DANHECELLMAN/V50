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

  const growthNode = (character_id, node_id, name, tier, node_type, prerequisites, coin_cost, description, effect_ops = [], extra = {}) => ({
    character_id, node_id, name, tier, node_type, prerequisites, coin_cost, description, effect_ops, ...extra
  });
  const SKILL_TREE_NODES = [
    growthNode("CHAR_BALANCED","B01","强健体魄",1,"BASE",[],120,"最大生命 +10%。",[{op:"add_stat",stat:"maxHp",mode:"mult",value:.10}]),
    growthNode("CHAR_BALANCED","B02","轻灵步",1,"BASE",[],120,"移动速度 +6%。",[{op:"add_stat",stat:"speed",mode:"mult",value:.06}]),
    growthNode("CHAR_BALANCED","B03","快手",1,"BASE",[],120,"攻击速度 +8%。",[{op:"add_stat",stat:"attackSpeed",mode:"mult",value:.08}]),
    growthNode("CHAR_BALANCED","B04","灵步蓄锋",2,"MECHANIC",["B02"],220,"移动累计 250 单位后，下一次有效武器攻击伤害 +25%。",[{op:"add_trigger_effect",trigger:"distance_charge",distance:250,multiplier:1.25}],{unlock_pool_ids:["CARD_BAL_STEP_EDGE"]}),
    growthNode("CHAR_BALANCED","B05","换势",2,"MECHANIC",["B03"],220,"选择武器升级后 3 秒内攻速 +18%。",[{op:"add_trigger_effect",trigger:"weapon_upgrade",attackSpeed:.18,duration:3}],{unlock_pool_ids:["CARD_BAL_SWITCH_STANCE"]}),
    growthNode("CHAR_BALANCED","B06","百兵熟练",2,"MECHANIC",["B01"],260,"首次获得新武器时，随机获得伤害、冷却或范围小熟练。",[{op:"add_trigger_effect",trigger:"new_weapon_mastery"}],{unlock_pool_ids:["CARD_BAL_FAMILIARITY"]}),
    growthNode("CHAR_BALANCED","B07","墨势显锋",3,"VFX",["B04","B05"],320,"所有武器达到 Lv.3 后，最低进入 VFX Tier 2。",[{op:"set_min_vfx_tier",target:"weapon",level:3,tier:2}],{vfx_tier_mod:{weapon_min:2}}),
    growthNode("CHAR_BALANCED","B08","兵器共鸣",3,"MECHANIC",["B06"],360,"持有 2/3/4 类武器标签时，依次获得伤害、攻速、暴击奖励。",[{op:"add_trigger_effect",trigger:"weapon_tag_resonance"}],{unlock_pool_ids:["CARD_BAL_TAG_RESONANCE"]}),
    growthNode("CHAR_BALANCED","B09","武器大师",3,"POOL",["B07"],380,"解锁局内稀有升级「熟能生巧」。",[{op:"unlock_pool_entry",id:"CARD_BAL_MASTERY"}],{unlock_pool_ids:["CARD_BAL_MASTERY"]}),
    growthNode("CHAR_BALANCED","B10","万法皆通",4,"CORE",["B08","B09"],520,"选择普通/稀有武器升级时，20% 概率追加一次次级强化。",[{op:"add_trigger_effect",trigger:"extra_minor_roll",chance:.20}],{unlock_pool_ids:["CARD_BAL_ALLWAYS"]}),
    growthNode("CHAR_BALANCED","B11","固定装置扩容",4,"SLOT",["B06"],480,"固定装置槽由 2 扩为 3。",[{op:"add_slot",target:"device",value:1}]),
    growthNode("CHAR_BALANCED","B12","装置墨脉",4,"MECHANIC",["B11"],420,"固定装置耐久 +25%，装置攻击表现最低 VFX Tier +1。",[{op:"add_stat",stat:"deviceHp",mode:"mult",value:.25},{op:"set_min_vfx_tier",target:"device",tier:2}],{unlock_pool_ids:["CARD_BAL_DEVICE_INK"]}),
    growthNode("CHAR_BALANCED","B13","挑战印记",5,"CHALLENGE",["B10","B12"],650,"解锁喵小白专属单武器挑战入口，不增加战斗属性。",[{op:"unlock_challenge",id:"balanced_single_weapon"}],{challenge_id:"balanced_single_weapon"}),
    growthNode("CHAR_BALANCED","B14","最终突破",6,"BREAKTHROUGH",["B13"],1000,"完成挑战后，在「百兵通」与「一器通神」中选择其一。",[],{breakthrough_options:[{id:"BREAK_BAL_A",name:"百兵通",description:"每种不同主标签提供 +3% 最终伤害，上限 12%。"},{id:"BREAK_BAL_B",name:"一器通神",description:"主武器类型不超过 2 时，最终伤害 +18%、冷却 -8%。"}]}),

    growthNode("CHAR_NINELIVES","N01","血战体质",1,"BASE",[],120,"最大生命 +12%。",[{op:"add_stat",stat:"maxHp",mode:"mult",value:.12}]),
    growthNode("CHAR_NINELIVES","N02","战斗本能",1,"BASE",[],120,"最终伤害 +8%。",[{op:"add_stat",stat:"damageMul",mode:"mult",value:.08}]),
    growthNode("CHAR_NINELIVES","N03","赤目",1,"BASE",[],120,"暴击率 +4%。",[{op:"add_stat",stat:"crit",mode:"add",value:.04}]),
    growthNode("CHAR_NINELIVES","N04","余火",2,"MECHANIC",["N01"],240,"每次九命复活后 6 秒内攻速 +30%。",[{op:"add_trigger_effect",trigger:"revive_afterfire",attackSpeed:.30,duration:6}],{unlock_pool_ids:["CARD_NINE_AFTERFIRE"]}),
    growthNode("CHAR_NINELIVES","N05","血墨护身",2,"MECHANIC",["N02"],260,"九命护盾破裂时释放半径 180 的朱红墨爆并强击退。",[{op:"add_trigger_effect",trigger:"shield_break_burst",radius:180,damage:1.2}],{unlock_pool_ids:["CARD_NINE_SHIELD_BURST"],vfx_tier_mod:{shield_break:1}}),
    growthNode("CHAR_NINELIVES","N06","追命",2,"MECHANIC",["N03"],260,"护盾破裂后的下一次有效武器攻击必定暴击，5 秒失效。",[{op:"add_trigger_effect",trigger:"shield_break_next_crit",duration:5}],{unlock_pool_ids:["CARD_NINE_PURSUIT"]}),
    growthNode("CHAR_NINELIVES","N07","第二命",3,"CORE",["N04"],360,"九命自动复活次数 +1。",[{op:"modify_revive",lives:1}]),
    growthNode("CHAR_NINELIVES","N08","残命韧性",3,"MECHANIC",["N05"],340,"九命复活后的最大生命保留比例提高为 60%。",[{op:"modify_revive",retention:.60}]),
    growthNode("CHAR_NINELIVES","N09","血墨显形",3,"VFX",["N06"],300,"每次九命复活令角色与武器攻击 VFX Tier +1，最高 Tier 3。",[{op:"add_trigger_effect",trigger:"revive_vfx_tier"}],{vfx_tier_mod:{by_revive:1}}),
    growthNode("CHAR_NINELIVES","N10","死斗印记",4,"CORE",["N07","N08"],520,"每次九命复活随机获得伤害、攻速或暴击印记，单种最多 2 层。",[{op:"add_trigger_effect",trigger:"revive_random_mark"}],{unlock_pool_ids:["CARD_NINE_DEATHMARK"]}),
    growthNode("CHAR_NINELIVES","N11","不屈残火",4,"MECHANIC",["N09"],480,"复活后 3 秒内首次致死伤害保留 1 HP。",[{op:"add_trigger_effect",trigger:"post_revive_death_guard",duration:3}],{unlock_pool_ids:["CARD_NINE_UNYIELDING"]}),
    growthNode("CHAR_NINELIVES","N12","第三命",4,"CORE",["N10"],560,"九命自动复活次数再 +1。",[{op:"modify_revive",lives:1}]),
    growthNode("CHAR_NINELIVES","N13","挑战印记",5,"CHALLENGE",["N11","N12"],680,"解锁赤痕专属最终命通关挑战。",[{op:"unlock_challenge",id:"ninelives_last_life"}],{challenge_id:"ninelives_last_life"}),
    growthNode("CHAR_NINELIVES","N14","最终突破",6,"BREAKTHROUGH",["N13"],1050,"完成挑战后，在「不灭」与「修罗」中选择其一。",[],{breakthrough_options:[{id:"BREAK_NINE_A",name:"不灭",description:"九命 +1，生命保留提高到 65%。"},{id:"BREAK_NINE_B",name:"修罗",description:"每次复活额外提高伤害、攻速与暴击；最后一命固定 Tier 3。"}]}),

    growthNode("CHAR_SUMMONER","S01","护身墨衣",1,"BASE",[],120,"最大生命 +12%。",[{op:"add_stat",stat:"maxHp",mode:"mult",value:.12}]),
    growthNode("CHAR_SUMMONER","S02","灵步",1,"BASE",[],120,"移动速度 +6%。",[{op:"add_stat",stat:"speed",mode:"mult",value:.06}]),
    growthNode("CHAR_SUMMONER","S03","灵契",1,"BASE",[],140,"所有召唤物最终伤害 +10%。",[{op:"add_stat",stat:"summonDamage",mode:"mult",value:.10}]),
    growthNode("CHAR_SUMMONER","S04","落笔生灵",2,"CORE",["S01"],260,"进入关卡时自动获得 Lv.1 墨鼠机关。",[{op:"start_with_summon",id:"mouse",level:1}],{unlock_pool_ids:["CARD_SUM_STARTER"],vfx_tier_mod:{starter:1}}),
    growthNode("CHAR_SUMMONER","S05","墨骨",2,"BASE",["S03"],240,"所有召唤物最大生命 +18%。",[{op:"add_stat",stat:"summonHp",mode:"mult",value:.18}]),
    growthNode("CHAR_SUMMONER","S06","灵契显形",2,"VFX",["S04"],220,"所有召唤物最低 VFX Tier 提升至 1。",[{op:"set_min_vfx_tier",target:"summon",tier:1}],{vfx_tier_mod:{summon_min:1}}),
    growthNode("CHAR_SUMMONER","S07","聚灵",3,"MECHANIC",["S04","S05"],340,"召唤击杀获得的伙伴能量 +25%。",[{op:"add_stat",stat:"partnerEnergy",mode:"mult",value:.25}],{unlock_pool_ids:["CARD_SUM_GATHER"]}),
    growthNode("CHAR_SUMMONER","S08","同心",3,"MECHANIC",["S06"],360,"存活召唤达到 3/5 时，分别获得伤害/攻速加成。",[{op:"add_trigger_effect",trigger:"alive_summon_thresholds"}],{unlock_pool_ids:["CARD_SUM_UNITY"]}),
    growthNode("CHAR_SUMMONER","S09","余魂",3,"MECHANIC",["S07"],380,"召唤物阵亡后留下 3 秒墨影，以 50% 伤害继续攻击。",[{op:"add_trigger_effect",trigger:"summon_death_echo",duration:3,damage:.5}],{unlock_pool_ids:["CARD_SUM_ECHO_SOUL"],vfx_tier_mod:{echo:1}}),
    growthNode("CHAR_SUMMONER","S10","共鸣墨线",3,"VFX",["S08"],300,"召唤 Lv.3 后最低进入 Tier 2，能量触发时显现淡金墨线。",[{op:"set_min_vfx_tier",target:"summon",level:3,tier:2},{op:"add_trigger_effect",trigger:"resonance_line"}],{vfx_tier_mod:{summon_lv3:2}}),
    growthNode("CHAR_SUMMONER","S11","快速回魂",4,"MECHANIC",["S09"],420,"召唤复活时间 -20%，复活后 5 秒攻速 +25%。",[{op:"modify_summon_respawn",multiplier:.8,attackSpeed:.25,duration:5}],{unlock_pool_ids:["CARD_SUM_RETURN"]}),
    growthNode("CHAR_SUMMONER","S12","百灵袋",4,"SLOT",["S08"],480,"召唤槽由 4 扩为 5。",[{op:"add_slot",target:"summon",value:1}]),
    growthNode("CHAR_SUMMONER","S13","画中兵器",4,"SLOT",["S10"],480,"武器槽由 3 扩为 4。",[{op:"add_slot",target:"weapon",value:1}]),
    growthNode("CHAR_SUMMONER","S14","墨阵共鸣",4,"CORE",["S11","S12"],560,"输出、坦克、辅助、控制齐全时，召唤伤害 +15%、攻速 +10%、复活时间 -10%。",[{op:"add_trigger_effect",trigger:"summon_role_set_bonus"}],{unlock_pool_ids:["CARD_SUM_FORMATION"],vfx_tier_mod:{formation:1}}),
    growthNode("CHAR_SUMMONER","S15","挑战印记",5,"CHALLENGE",["S13","S14"],700,"解锁青砚专属无召唤挑战；完成后解锁第 6 召唤槽。",[{op:"unlock_challenge",id:"summoner_no_summon"}],{challenge_id:"summoner_no_summon"}),
    growthNode("CHAR_SUMMONER","S16","最终突破",6,"BREAKTHROUGH",["S15"],1100,"完成挑战后，在「百灵图」与「真灵契」中选择其一。",[],{breakthrough_options:[{id:"BREAK_SUM_A",name:"百灵图",description:"召唤越多，伙伴能量获取越快；6 只时 +30%。"},{id:"BREAK_SUM_B",name:"真灵契",description:"封印一个槽位，换取其余召唤伤害 +22%、生命 +20% 与 Lv.5 终极表现。"}]})
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

  const ENEMY_TYPES = {
    mouse: { id: "ENM_GRUNT", name: "小墨灵", emoji: "墨", hp: 24, speed: 85, damage: 8, r: 15, xp: 1, art_key: "enemy_ink_spirit_ink", ...artAsset("enemy-ink-spirit.svg", "enemy-ink-spirit.svg"), ai_role: "melee", death_fx: "FX_006" },
    bug: { id: "ENM_FAST", name: "疾影鼠", emoji: "影", hp: 16, speed: 125, damage: 7, r: 12, xp: 1, art_key: "enemy_shadow_mouse_ink", ...artAsset("enemy-shadow-mouse.svg", "enemy-shadow-mouse.svg"), ai_role: "fast", death_fx: "FX_006" },
    hedgehog: { id: "ENM_TANK", name: "石墨兽", emoji: "石", hp: 70, speed: 60, damage: 12, r: 21, xp: 3, art_key: "enemy_stone_beast_ink", ...artAsset("enemy-stone-beast.svg", "enemy-stone-beast.svg"), ai_role: "tank", death_fx: "FX_006" },
    bee: { id: "ENM_RANGED", name: "墨羽鸦", emoji: "羽", hp: 32, speed: 70, damage: 9, r: 14, xp: 2, art_key: "enemy_ink_crow_ink", ...artAsset("enemy-shadow-mouse.svg", "enemy-ink-spirit.svg"), art_variant: "crow", ai_role: "ranged", ranged: true, death_fx: "FX_006" },
    frog: { id: "ENM_SUPPORT", name: "铃纸灵", emoji: "铃", hp: 45, speed: 65, damage: 5, r: 17, xp: 3, art_key: "enemy_bell_spirit_ink", ...artAsset("enemy-ink-spirit.svg", "enemy-ink-spirit.svg"), art_variant: "support", ai_role: "support", ranged: true, death_fx: "FX_006" },
    snail: { id: "ENM_SPECIAL", name: "残墨妖", emoji: "残", hp: 90, speed: 80, damage: 15, r: 22, xp: 5, art_key: "enemy_residual_ink", ...artAsset("enemy-stone-beast.svg", "enemy-stone-beast.svg"), art_variant: "residual", ai_role: "special", death_fx: "FX_007" }
  };

  const BOSS = { id: "BOSS_1", name: "泼墨狸将", art_key: "boss_ink_tanuki_ink", ...artAsset("boss-ink-tanuki.svg", "boss-ink-tanuki.svg"), phases: 2, hp: 3500, damage: 20, speed: 50, skill_set: ["fan_ink_bullets", "brush_mark_aoe"], phase_art: ["calm_brush", "vermilion_brush"], skill_fx: ["FX_002", "FX_005"] };
  const characterAsset = (portraitFile, fallbackFile = "hero-balanced.png", combatFile = "hero-balanced.svg") => ({
    art: `${artRoot}${portraitFile}`, portrait_art: `${artRoot}${portraitFile}`, portrait_fallback_art: `${artRoot}${fallbackFile}`,
    fallback_art: `${artRoot}${fallbackFile}`, legacy_art: `${artRoot}${fallbackFile}`,
    combat_art: `${artRoot}${combatFile}`, combat_fallback_art: `${artRoot}${fallbackFile}`
  });
  const CHARACTERS = {
    moxiaobai: {
      id: "CHAR_BALANCED", key: "moxiaobai", name: "喵小白", role: "均衡型 / 万金油", status: "ready", status_text: "可出战", palette: "teal", art_key: "character_miaoxiaobai_ink",
      ...characterAsset("character-miaoxiaobai-ink.png", "hero-balanced.png", "character-miaoxiaobai-combat.svg"), style_theme: "anime_sumi_e", summary: "青碧围巾随步势飞扬，基础扎实、武器自由，依靠本局 Build 应对各种战局。",
      traits: ["6 武器槽", "2 个固定装置槽", "不能使用自主移动召唤物", "基础属性强化效果略高"],
      base_stats: { maxHp: 120, speed: 195, damageMul: 1, attackSpeed: 1.05, crit: .05, size: 1, armor: 0, pickup: 82 },
      slot_rules: { weapon: 6, device: 2, deviceMax: 3, summon: 0 }, mechanics: { type: "standard_build", allowAutonomousSummons: false }
    },
    chihen: {
      id: "CHAR_NINELIVES", key: "chihen", name: "赤痕", role: "九命型 / 高风险高输出", status: "ready", status_text: "可出战", palette: "vermilion", art_key: "character_chihen_ink",
      ...characterAsset("character-chihen-ink.png"), style_theme: "anime_sumi_e", summary: "九命轮回，以生命上限换取永久攻击、攻速与暴击成长。",
      traits: ["赤痕裂爪 · 近身爆发", "断命突进 · 自动追斩", "九命自动复活", "复活获挡伤并永久变强"],
      base_stats: { maxHp: 120, speed: 190, damageMul: 1.12, attackSpeed: 1.08, crit: .07, size: 1, armor: 0, pickup: 78 },
      slot_rules: { weapon: 6, device: 0, summon: 0 },
      mechanics: { type: "nine_lives", lives: 1, reviveMaxHpMultiplier: .5, reviveShieldCharges: 1, reviveDamageMultiplier: 1.12, reviveAttackSpeedMultiplier: 1.08, reviveCritBonus: .03, challengeExtraRevive: false },
      skills: {
        bloodClaw: { name: "赤痕裂爪", cooldown: 4.6, damage: 48, radius: 155 },
        fateDash: { name: "断命突进", cooldown: 7.5, damage: 66, range: 230 },
        lifeWard: { name: "墨环护命", description: "每次九命复活获得 1 次完全挡伤。" }
      }
    },
    qingyan: {
      id: "CHAR_SUMMONER", key: "qingyan", name: "青砚", role: "召唤型 / 阵容经营", status: "ready", status_text: "可出战", palette: "indigo", art_key: "character_qingyan_ink",
      ...characterAsset("character-qingyan-ink.png"), style_theme: "anime_sumi_e", summary: "本体输出偏低，以伙伴能量、阵亡联动与召唤复活经营阵容。",
      traits: ["落笔召灵 · 三类伙伴", "伙伴能量 · 满值共鸣", "阵亡联动 · 余阵强化", "回墨号令与砚光护阵"],
      base_stats: { maxHp: 100, speed: 185, damageMul: .8, attackSpeed: .95, crit: .05, size: 1, armor: 0, pickup: 88 },
      slot_rules: { weapon: 3, weaponMax: 4, device: 0, summon: 4, summonMax: 6 },
      mechanics: { type: "summoner_roster", companionEnergy: true, companionEnergyMax: 100, empowerDuration: 6, deathLinkBuff: true, deathLinkDuration: 5, inheritPlayerStats: false, allowedScaling: ["summon_level", "summon_affix", "growth_tree", "specific_synergy"] },
      skills: {
        summon: { name: "落笔召灵", description: "墨鼠机关、纸鹤群、石甲犬灵从纸面入阵。" },
        recall: { name: "回墨号令", cooldown: 12, description: "治疗伙伴，并提前唤回一名阵亡伙伴。" },
        ward: { name: "砚光护阵", cooldown: 15, duration: 6, description: "展开护阵，降低本体伤害并强化伙伴。" }
      }
    }
  };
  const CHARACTER = CHARACTERS.moxiaobai;

  window.MEOW_DATA = { WEAPONS, PASSIVES, DEVICES, SUMMONS, SKILL_TREE, SKILL_TREE_NODES, GROWTH_CARDS, ENEMY_TYPES, BOSS, CHARACTER, CHARACTERS, LEGACY_ASSET_MAP, INK_FX };
})();
