// All simulation distances are continuous world units (10 units = 1 metre).
export const WIDTH = 3120;
export const HEIGHT = 2160;
export const BASE = { id: 'base', x: 540, y: 380, radius: 31 };
export const MAP_BOUNDS = { left: BASE.x - WIDTH / 2, right: BASE.x + WIDTH / 2, top: BASE.y - HEIGHT / 2, bottom: BASE.y + HEIGHT / 2 };
export const SPAWN_WARNING = 0.8;
export const SPAWN_DISTANCE = 75;
export const BUILD_RADIUS = 284;
export const BASE_LEVELS = [{ radius: BUILD_RADIUS, cost: 0 }, { radius: 360, cost: 120 }, { radius: 440, cost: 200 }] as const;
export const INITIAL_PREPARATION = 30;
export const INTERMISSION = 20;
export const constructionTime = (targetLevel: number) => targetLevel * 5;
export type TowerKind = 'rapid' | 'cannon' | 'frost' | 'sniper' | 'tesla';
export type EnemyKind = 'scout' | 'runner' | 'heavy' | 'ranged' | 'boss' | 'armored' | 'berserker' | 'medic';
export type Side = 'west' | 'north' | 'east' | 'south';
export const TOWERS = {
  rapid: { requiredBase: 1, name: '疾风机炮', caption: '精准 · 单体', cost: 65, damage: 13, cooldown: 0.36, range: 148, radius: 18, hp: 200, splash: 0, color: 0xb6dfc3 },
  cannon: { requiredBase: 1, name: '震荡榴弹炮', caption: '重火力 · 范围', cost: 110, damage: 42, cooldown: 1.7, range: 180, radius: 22.5, hp: 290, splash: 58, color: 0xeac089 },
  frost: { requiredBase: 1, name: '冰霜塔', caption: '减速 · 范围', cost: 85, damage: 8, cooldown: 0.9, range: 135, radius: 18, hp: 180, splash: 42, color: 0x9edce8 },
  sniper: { requiredBase: 2, name: '穿甲狙击塔', caption: '远程 · 破甲', cost: 150, damage: 105, cooldown: 2.8, range: 260, radius: 20, hp: 170, splash: 0, color: 0xefb4a3 },
  tesla: { requiredBase: 3, name: '电弧塔', caption: '连锁 · 群攻', cost: 135, damage: 24, cooldown: 1.1, range: 150, radius: 20, hp: 220, splash: 0, color: 0xbab3f0 },
} as const;
export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];
export const TOWER_GUIDE: Record<TowerKind, string> = {
  rapid: '高射速，优先攻击靠近基地的敌人',
  cannon: '爆炸溅射，适合清理密集敌群',
  frost: '范围减速 45%，持续 2 秒，重复命中刷新持续时间',
  sniper: '无视护甲，优先铁甲卫士，其次高生命目标',
  tesla: '连锁 3 / 4 / 5 个目标，每跳伤害保留 70%，跳跃距离 8 米',
};
export const FROST = { multiplier: 0.55, duration: 2 } as const;
export const CHAIN = { range: 80, falloff: 0.7 } as const;
export const ENEMIES = {
  scout: { name: '游荡者', hp: 48, speed: 46.4, damage: 12, reward: 9, radius: 9, color: 0xe68c77 },
  runner: { name: '疾行者', hp: 34, speed: 78, damage: 9, reward: 9, radius: 7, color: 0xe8bd87 },
  heavy: { name: '破阵者', hp: 175, speed: 29.2, damage: 30, reward: 20, radius: 13, color: 0xc17c8a },
  ranged: { name: '掠火者', hp: 90, speed: 34, damage: 18, reward: 15, radius: 11, color: 0xdba4df, range: 140, cooldown: 1.6 },
  boss: { name: '裂地者', hp: 1100, speed: 19.2, damage: 65, reward: 100, radius: 20, color: 0xeaa18a },
  armored: { name: '铁甲卫士', hp: 220, speed: 25, damage: 24, reward: 25, radius: 14, color: 0x9eafbd, armor: 6 },
  berserker: { name: '狂奔者', hp: 80, speed: 52, damage: 16, reward: 13, radius: 9, color: 0xf1a16e },
  medic: { name: '医疗兵', hp: 100, speed: 32, damage: 8, reward: 22, radius: 10, color: 0x99d5a3, heal: 16, healRange: 100, healCooldown: 2.5 },
} as const;
export const ENEMY_GUIDE: Record<EnemyKind, string> = {
  scout: '普通步兵，生命较低，疾风机炮可有效清理。',
  runner: '生命低、移动快，容易穿过防线缺口，可用冰霜塔减速。',
  heavy: '高生命、低移速，近战伤害高，需要集中火力消灭。',
  ranged: `射程 ${ENEMIES.ranged.range / 10} 米，优先攻击射程内的炮塔，再攻击基地。注意保护施工中的建筑。`,
  armored: `每次减免 ${ENEMIES.armored.armor} 点伤害，最低仍受 1 点。穿甲狙击塔可无视护甲。`,
  berserker: '生命降至一半及以下时，移速和近战伤害提高 50%。用冰霜塔限制突进。',
  medic: `每 ${ENEMIES.medic.healCooldown} 秒为 ${ENEMIES.medic.healRange / 10} 米内生命比例最低的非医疗兵伤员回复 ${ENEMIES.medic.heal} 生命。优先消灭可阻止治疗。`,
  boss: '大体型首领，生命和攻城伤害极高，移动缓慢，无护甲。用减速配合高伤害火力集中攻击。',
};
// Edge-to-edge building clearance: the largest body plus room for navigation.
export const BUILDING_GAP = Math.max(...Object.values(ENEMIES).map(enemy => enemy.radius)) * 2 + 4;
export const SIDE_LABEL: Record<Side, string> = { west: '西侧', north: '北侧', east: '东侧', south: '南侧' };
export const WAVES: { name: string; description: string; sides: Side[]; units: EnemyKind[]; interval: number; bonus: number }[] = [
  { name: '初次接触', description: '西侧出现游荡者，建立第一道防线。', sides: ['west'], units: Array(10).fill('scout'), interval: 1.45, bonus: 45 },
  { name: '快速突袭', description: '北侧与东侧来袭，狂奔者在半血时加速；冰霜塔可限制突进。', sides: ['north', 'east'], units: ['scout', 'runner', 'scout', 'runner', 'scout', 'runner', 'scout', 'runner', 'berserker', 'scout', 'runner', 'scout', 'berserker', 'scout'], interval: 1.2, bonus: 55 },
  { name: '重装来袭', description: '铁甲卫士与远程掠火者来袭；穿甲狙击塔克制护甲。', sides: ['south', 'west'], units: ['scout', 'scout', 'armored', 'runner', 'ranged', 'heavy', 'scout', 'runner', 'heavy', 'scout', 'ranged', 'armored', 'runner', 'scout', 'heavy', 'ranged', 'runner', 'heavy'], interval: 1.2, bonus: 65 },
  { name: '四面楚歌', description: '医疗兵随敌群进场，电弧塔和榴弹炮可压制成群敌人。', sides: ['west', 'north', 'east', 'south'], units: Array.from({ length: 24 }, (_, i) => i % 8 === 0 ? 'medic' : i % 5 === 0 ? 'armored' : i % 7 === 0 ? 'berserker' : i % 4 === 0 ? 'ranged' : i % 3 === 0 ? 'runner' : 'scout'), interval: 0.9, bonus: 80 },
  { name: '首领压境', description: '铁甲、医疗兵和狂奔者掩护首领「裂地者」，组合火力守住基地。', sides: ['north', 'east', 'south', 'west'], units: [...Array.from({ length: 14 }, (_, i): EnemyKind => i % 7 === 0 ? 'medic' : i % 4 === 0 ? 'armored' : i % 4 === 2 ? 'ranged' : 'berserker'), 'boss', ...Array.from({ length: 14 }, (_, i): EnemyKind => i % 7 === 0 ? 'medic' : i % 3 === 0 ? 'armored' : i % 4 === 2 ? 'ranged' : 'scout')], interval: 0.85, bonus: 110 },
  { name: '钢铁洪流', description: '铁甲卫士组成主力，穿甲火力将决定防线强度。', sides: ['west', 'east'], units: Array.from({ length: 28 }, (_, i) => i % 8 === 0 ? 'medic' : i % 3 === 0 ? 'ranged' : i % 2 === 0 ? 'heavy' : 'armored'), interval: 0.85, bonus: 130 },
  { name: '疾潮援护', description: '狂奔者在医疗支援下突进，冰霜与电弧适合组合防守。', sides: ['north', 'south', 'west', 'east'], units: Array.from({ length: 32 }, (_, i) => i % 8 === 0 ? 'medic' : i % 5 === 0 ? 'armored' : i % 4 === 0 ? 'ranged' : 'berserker'), interval: 0.85, bonus: 150 },
  { name: '终极围攻', description: '两名裂地者带领混合兵团总攻，守住最后防线。', sides: ['north', 'east', 'south', 'west'], units: Array.from({ length: 36 }, (_, i) => i === 12 || i === 24 ? 'boss' : i % 8 === 0 ? 'medic' : i % 3 === 0 ? 'armored' : i % 4 === 0 ? 'ranged' : 'berserker'), interval: 0.85, bonus: 0 },
];
export const TERRAIN = [
  [216, 137], [257, 144], [268, 183], [817, 177], [826, 219], [866, 228],
  [135, 495], [178, 505], [185, 546], [855, 534], [898, 545], [907, 586],
  [456, 96], [498, 105], [655, 616], [697, 628],
  // Outer clusters occupy the expanded land, leaving the central defense intact.
  [-155, 120], [-120, 151], [-100, 650], [-62, 675],
  [140, -100], [181, -78], [890, -80], [928, -50],
  [1210, 155], [1245, 180], [1190, 690], [1228, 723],
  [200, 830], [237, 860], [870, 830], [910, 855],
].map(([x, y], index) => ({ id: `rock-${index}`, x, y, radius: 19 }));
