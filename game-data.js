(() => {
  "use strict";

  const artRoot = "assets/art/";

  const WEAPONS = {
    yarn: {
      id: "WPN_001", name: "鱼骨墨针", display_name: "鱼骨墨针", icon: "鱼", max: 7,
      desc: "一笔甩出鱼骨墨针，穿透敌群；Lv.7 化作万针游鱼。", tags: "投射 · 穿透",
      style_theme: "anime_sumi_e", art_key: "weapon_fishbone", fx_id: "FX_001", ultimate_fx_id: "FX_002",
      base_stats: { damage: 18, cd: .8, amount: 1, range: 600, speed: 500, pierce: 1 }
    },
    fish: {
      id: "WPN_002", name: "流叶回锋", display_name: "流叶回锋", icon: "叶", max: 7,
      desc: "墨叶旋飞并弹向下一目标；Lv.7 引出千叶回潮。", tags: "投射 · 弹射",
      style_theme: "anime_sumi_e", art_key: "weapon_leaf", fx_id: "FX_001", ultimate_fx_id: "FX_004",
      base_stats: { damage: 16, cd: 1, amount: 1, range: 520, speed: 420, bounce: 2 }
    },
    laser: {
      id: "WPN_004", name: "铃线追魂", display_name: "铃线追魂", icon: "铃", max: 7,
      desc: "铃声牵出细长墨线瞬时点刺；Lv.7 多线扫敌。", tags: "锁敌 · 高频",
      style_theme: "anime_sumi_e", art_key: "weapon_bell_line", fx_id: "FX_003", ultimate_fx_id: "FX_003",
      base_stats: { damage: 10, cd: .2, amount: 1, range: 700 }
    },
    paw: {
      id: "WPN_003", name: "爪痕剑气", display_name: "爪痕剑气", icon: "爪", max: 7,
      desc: "半月爪痕环身挥出并击退近敌；Lv.7 留下百爪墨刃。", tags: "近战 · 范围",
      style_theme: "anime_sumi_e", art_key: "weapon_claw", fx_id: "FX_001", ultimate_fx_id: "FX_001",
      base_stats: { damage: 30, cd: 1.2, amount: 1, range: 150 }
    }
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
    turret: {
      id: "DEV_001", name: "镇纸飞刃", icon: "刃", max: 5,
      desc: "放置镇纸，持续展开墨刃攻击附近目标。", tags: "固定装置 · 输出",
      art_key: "device_paperweight", fx_id: "FX_001"
    },
    trap: {
      id: "DEV_003", name: "纸伞震阵", icon: "伞", max: 5,
      desc: "脚下留下一柄纸伞，敌人靠近时推出水纹震波。", tags: "固定装置 · 控制",
      art_key: "device_umbrella", fx_id: "FX_004"
    }
  };

  const ENEMY_TYPES = {
    mouse: { id: "ENM_GRUNT", name: "小墨灵", emoji: "墨", hp: 24, speed: 85, damage: 8, r: 15, xp: 1, art_key: "enemy_ink_spirit", art: `${artRoot}enemy-ink-spirit.svg`, ai_role: "melee", death_fx: "FX_006" },
    bug: { id: "ENM_FAST", name: "疾影鼠", emoji: "影", hp: 16, speed: 125, damage: 7, r: 12, xp: 1, art_key: "enemy_shadow_mouse", art: `${artRoot}enemy-shadow-mouse.svg`, ai_role: "fast", death_fx: "FX_006" },
    hedgehog: { id: "ENM_TANK", name: "石墨兽", emoji: "石", hp: 70, speed: 60, damage: 12, r: 21, xp: 3, art_key: "enemy_stone_beast", art: `${artRoot}enemy-stone-beast.svg`, ai_role: "tank", death_fx: "FX_006" },
    bee: { id: "ENM_RANGED", name: "墨羽鸦", emoji: "羽", hp: 32, speed: 70, damage: 9, r: 14, xp: 2, art_key: "enemy_ink_crow", art: `${artRoot}enemy-ink-spirit.svg`, art_variant: "crow", ai_role: "ranged", ranged: true, death_fx: "FX_006" },
    frog: { id: "ENM_SUPPORT", name: "铃纸灵", emoji: "铃", hp: 45, speed: 65, damage: 5, r: 17, xp: 3, art_key: "enemy_bell_spirit", art: `${artRoot}enemy-ink-spirit.svg`, art_variant: "support", ai_role: "support", ranged: true, death_fx: "FX_006" },
    snail: { id: "ENM_SPECIAL", name: "残墨妖", emoji: "残", hp: 90, speed: 80, damage: 15, r: 22, xp: 5, art_key: "enemy_residual_ink", art: `${artRoot}enemy-stone-beast.svg`, art_variant: "residual", ai_role: "special", death_fx: "FX_007" }
  };

  const BOSS = {
    id: "BOSS_1", name: "泼墨狸将", art_key: "boss_ink_tanuki", art: `${artRoot}boss-ink-tanuki.svg`,
    phases: 2, hp: 3500, damage: 20, speed: 50, skill_set: ["fan_ink_bullets", "brush_mark_aoe"],
    phase_art: ["calm_brush", "vermilion_brush"], skill_fx: ["FX_002", "FX_005"]
  };

  const CHARACTER = {
    id: "CHAR_BALANCED", name: "小橘侠", role: "均衡型", art_key: "hero_balanced",
    art: `${artRoot}hero-balanced.svg`, style_theme: "anime_sumi_e",
    base_stats: { maxHp: 120, speed: 195, damageMul: 1, attackSpeed: 1, crit: .05, size: 1, armor: 0, pickup: 82 },
    slot_rules: { weapon: 6, device: 2 }
  };

  window.MEOW_DATA = { WEAPONS, PASSIVES, DEVICES, ENEMY_TYPES, BOSS, CHARACTER };
})();
