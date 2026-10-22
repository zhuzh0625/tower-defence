export const COLS = 26;
export const ROWS = 18;
export const CELL = 40;
export const WIDTH = COLS * CELL;
export const HEIGHT = ROWS * CELL;
export const BASE = { col: 13, row: 9 };
export const BUILD_RADIUS = 7.1;
export type TowerKind = 'rapid' | 'cannon';
export type EnemyKind = 'scout' | 'runner' | 'heavy' | 'boss';
export type Side = 'west' | 'north' | 'east' | 'south';
export const TOWERS = {
  rapid: { name: '疾风机炮', caption: '精准 · 单体', cost: 65, damage: 13, cooldown: 0.36, range: 3.7, hp: 200, splash: 0, color: 0xb6dfc3 },
  cannon: { name: '震荡榴弹炮', caption: '重火力 · 范围', cost: 110, damage: 42, cooldown: 1.7, range: 4.5, hp: 290, splash: 1.45, color: 0xeac089 },
} as const;
export const ENEMIES = {
  scout: { name: '游荡者', hp: 48, speed: 1.16, damage: 12, reward: 9, radius: 9, color: 0xe68c77 },
  runner: { name: '疾行者', hp: 34, speed: 1.95, damage: 9, reward: 9, radius: 7, color: 0xe8bd87 },
  heavy: { name: '破阵者', hp: 175, speed: 0.73, damage: 30, reward: 20, radius: 13, color: 0xc17c8a },
  boss: { name: '裂地者', hp: 1100, speed: 0.48, damage: 65, reward: 100, radius: 20, color: 0xeaa18a },
} as const;
export const SIDE_LABEL: Record<Side, string> = { west: '西侧', north: '北侧', east: '东侧', south: '南侧' };
export const WAVES: { name: string; description: string; sides: Side[]; units: EnemyKind[]; interval: number; bonus: number }[] = [
  { name: '初次接触', description: '西侧出现游荡者，建立第一道防线。', sides: ['west'], units: Array(10).fill('scout'), interval: 1.45, bonus: 45 },
  { name: '快速突袭', description: '北侧与东侧出现快速目标，注意火力覆盖。', sides: ['north', 'east'], units: ['scout', 'runner', 'scout', 'runner', 'scout', 'runner', 'scout', 'runner', 'runner', 'scout', 'runner', 'scout', 'runner', 'scout'], interval: 1.2, bonus: 55 },
  { name: '重装来袭', description: '南侧与西侧出现高生命敌人，准备持续输出。', sides: ['south', 'west'], units: ['scout', 'scout', 'heavy', 'runner', 'scout', 'heavy', 'scout', 'runner', 'heavy', 'scout', 'scout', 'heavy', 'runner', 'scout', 'heavy', 'scout', 'runner', 'heavy'], interval: 1.2, bonus: 65 },
  { name: '四面楚歌', description: '敌人从四面接近，补齐防线缺口。', sides: ['west', 'north', 'east', 'south'], units: Array.from({ length: 24 }, (_, i) => i % 5 === 0 ? 'heavy' : i % 3 === 0 ? 'runner' : 'scout'), interval: 0.9, bonus: 80 },
  { name: '最后防线', description: '四面总攻，重型首领「裂地者」即将抵达。', sides: ['north', 'east', 'south', 'west'], units: [...Array.from({ length: 14 }, (_, i): EnemyKind => i % 4 === 0 ? 'heavy' : 'runner'), 'boss', ...Array.from({ length: 14 }, (_, i): EnemyKind => i % 3 === 0 ? 'heavy' : 'scout')], interval: 0.85, bonus: 0 },
];
export const TERRAIN = new Set([
  [5, 3], [6, 3], [6, 4], [20, 4], [20, 5], [21, 5],
  [3, 12], [4, 12], [4, 13], [21, 13], [22, 13], [22, 14],
  [11, 2], [12, 2], [16, 15], [17, 15],
].map(([col, row]) => row * COLS + col));
export function center(col: number, row: number) { return { x: (col + 0.5) * CELL, y: (row + 0.5) * CELL }; }
export function key(col: number, row: number) { return row * COLS + col; }
export function inside(col: number, row: number) { return col >= 0 && row >= 0 && col < COLS && row < ROWS; }
