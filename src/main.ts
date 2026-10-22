import Phaser from 'phaser';
import './style.css';
import { WIDTH, HEIGHT, TOWERS, WAVES, SIDE_LABEL, type TowerKind } from './data';
import { GameEngine, stats, upgradeCost, sellValue } from './engine';
import { BoardScene, type Selection } from './scene';

const model = new GameEngine();
const selection: Selection = { kind: null, towerId: null };
const $ = <T extends HTMLElement = HTMLElement>(query: string) => document.querySelector<T>(query)!;
const icon = (name: string, size = 20) => {
  const paths: Record<string, string> = {
    shield: '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="M9 12h6m-3-3v6"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="m12 7 3 5-3 5-3-5Z"/>',
    wave: '<path d="m3 8 4-3 5 3 5-3 4 3M3 14l4-3 5 3 5-3 4 3M3 20l4-3 5 3 5-3 4 3"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    speed: '<path d="m3 6 8 6-8 6Zm10 0 8 6-8 6Z"/>',
    reset: '<path d="M4 9a8 8 0 1 1 0 6M4 4v5h5"/>',
    sound: '<path d="m10 5-5 4H2v6h3l5 4ZM14 8c3 2 3 6 0 8m3-11c6 4 6 10 0 14"/>',
    mute: '<path d="m10 5-5 4H2v6h3l5 4ZM15 9l6 6m0-6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2m0 3h.01"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.target}</svg>`;
};
const towerArt = (kind: TowerKind) => `<svg viewBox="0 0 72 72" aria-hidden="true"><ellipse cx="37" cy="54" rx="26" ry="10" fill="#203e3420"/><path d="m36 23 23 13v17L36 66 13 53V36Z" fill="${kind === 'rapid' ? '#9daf9e' : '#bdab8e'}"/><path d="m36 16 23 13v17L36 59 13 46V29Z" fill="#31594b"/><path d="m36 16 23 13-23 13-23-13Z" fill="#618370"/><circle cx="36" cy="32" r="13" fill="${kind === 'rapid' ? '#b7d8b5' : '#e6bb82'}"/>${kind === 'rapid' ? '<path d="M31 30V7m10 23V7" stroke="#365647" stroke-width="7"/><path d="M31 28V7m10 21V7" stroke="#cbe4c1" stroke-width="3"/>' : '<path d="m36 31 0-24" stroke="#375346" stroke-width="17"/><path d="m36 28 0-21" stroke="#e3bb8e" stroke-width="11"/><path d="M29 8h14" stroke="#405e4b" stroke-width="3"/>'}<circle cx="36" cy="32" r="6" fill="#426c51"/><circle cx="36" cy="48" r="2" fill="#d6e8bf"/></svg>`;

$('#app').innerHTML = `
  <div class="shell">
    <header class="header">
      <div class="brand"><div class="brand-mark">${icon('shield', 31)}</div><div><div class="eyebrow">LAST LIGHT <span>/</span> TOWER DEFENSE</div><h1>边境守望<span class="prototype">原型 01</span></h1></div></div>
      <div class="resources" aria-label="战役状态">
        <div class="resource gold-resource"><span class="resource-icon">${icon('coin', 23)}</span><div><span class="resource-label">可用金币</span><strong id="gold">240</strong></div></div>
        <div class="resource"><span class="resource-icon">${icon('shield', 23)}</span><div><span class="resource-label">基地生命</span><strong id="base-hp">400 <small>/ 400</small></strong><span class="mini-meter"><i id="base-meter"></i></span></div></div>
        <div class="resource wave-resource"><span class="resource-icon">${icon('wave', 23)}</span><div><span class="resource-label">当前波次</span><strong id="wave-number">00 <small>/ 05</small></strong></div></div>
      </div>
    </header>
    <div class="layout">
      <main class="battle-column">
        <section class="battle-panel" aria-label="战场">
          <div class="battle-toolbar"><div class="battle-title"><span class="live-dot"></span><strong>荒原哨站</strong><span class="divider"></span><span id="phase-label">部署阶段</span></div><span class="field-tag">开放地图 · 自由布防</span></div>
          <div class="map-wrap">
            <div id="game"></div>
            <div class="first-tip" id="first-tip"><span class="tip-number">01</span><div><strong>你的基地，最后一道防线。</strong><p>选择右侧炮塔，点击地图部署。<br>先守住西侧，再开始第一波。</p></div><button id="dismiss-tip" class="tip-close" aria-label="关闭提示">${icon('close', 16)}</button></div>
            <div class="pause-overlay" id="pause-overlay" hidden><div>${icon('pause', 32)}<h2>战场已暂停</h2><p>准备好后，继续守住防线。</p><button class="primary" id="resume">继续战斗</button></div></div>
            <div class="end-overlay" id="end-overlay" hidden><div class="end-card"><div class="end-emblem" id="end-emblem">${icon('shield', 42)}</div><div class="eyebrow" id="end-caption">MISSION COMPLETE</div><h2 id="end-title">防线，守住了。</h2><p id="end-description"></p><div class="end-stats" id="end-stats"></div><button id="play-again" class="primary">${icon('reset', 18)} 再战一局</button></div></div>
          </div>
          <div class="field-controls"><div class="control-group"><button id="pause" class="control" title="暂停 / 继续（空格）">${icon('pause', 17)}<span>暂停</span></button><button id="speed" class="control" title="切换游戏速度">${icon('speed', 18)}<span>1×</span></button><span class="control-separator"></span><button id="sound" class="icon-button" title="开启音效" aria-label="开启音效">${icon('mute', 18)}</button></div><div class="control-group"><button id="restart" class="icon-button" title="重新开始" aria-label="重新开始">${icon('reset', 18)}</button><button id="help" class="icon-button" title="玩法说明" aria-label="玩法说明">${icon('help', 18)}</button></div></div>
        </section>
        <section class="wave-section" aria-label="五波进攻"><div class="section-line"><span class="eyebrow">防守进程</span><span id="kill-count">已击退 0 名敌人</span></div><div class="wave-track">${WAVES.map((wave, i) => `<div class="wave-stop" data-wave="${i + 1}"><div class="wave-node"><span>${String(i + 1).padStart(2, '0')}</span><i></i></div><strong>${wave.name}</strong><small>${i === 4 ? '首领决战' : `${wave.units.length} 名敌人`}</small></div>`).join('')}</div></section>
        <div class="field-footer"><span><i class="legend-dot base-dot"></i>基地与炮塔 <i class="legend-dot enemy-dot"></i>敌方目标 <i class="legend-dot rock-dot"></i>不可建造</span><span><kbd>1</kbd><kbd>2</kbd> 选择炮塔 <kbd>Esc</kbd> 取消</span></div>
      </main>
      <aside class="sidebar" aria-label="建造与指挥">
        <section class="arsenal"><div class="section-heading"><div><span class="eyebrow">BUILD YOUR DEFENSE</span><h2>构筑防线</h2></div><span class="count-tag">02</span></div><p class="section-intro">选择炮塔，在基地周围自由部署。</p>
          ${(['rapid', 'cannon'] as TowerKind[]).map((kind, i) => `<button class="tower-card" id="build-${kind}" data-kind="${kind}" aria-pressed="false"><span class="tower-art ${kind}">${towerArt(kind)}</span><span class="tower-copy"><span class="tower-name">${TOWERS[kind].name}<kbd>${i + 1}</kbd></span><span class="tower-type">${TOWERS[kind].caption}</span><span class="tower-meta">${kind === 'rapid' ? '高射速，优先清除近基地目标' : '爆炸溅射，应对密集敌群'}</span></span><span class="tower-price">${icon('coin', 14)}${TOWERS[kind].cost}</span></button>`).join('')}
          <div class="selection-detail" id="selection-detail"></div>
          <div class="build-tip" id="build-tip">${icon('target', 17)}<span>点击已有炮塔，可升级或拆除。</span></div>
        </section>
        <section class="dispatch"><div class="dispatch-kicker"><span class="signal-mark"></span><span id="dispatch-kicker">下一波情报</span><span id="incoming-index">01 / 05</span></div><h2 id="incoming-title">初次接触</h2><p id="incoming-description">西侧出现游荡者，建立第一道防线。</p><div class="incoming-info"><span id="incoming-sides">↗ 西侧</span><span id="incoming-count">10 名敌人</span></div><div class="wave-progress"><i id="wave-progress"></i></div><button id="start-wave" class="primary">开始第 1 波 ${icon('arrow', 19)}</button><p class="dispatch-footnote" id="dispatch-footnote">准备时间不限，布防完毕再出发。</p></section>
        <div class="field-note"><span>战术笔记 / 01</span><p>炮塔也会阻挡敌人。<br>有路就绕，封死后就会攻击炮塔。</p></div>
      </aside>
    </div>
    <footer class="page-footer"><span>守住微光，直到最后一刻。</span><span>LOCAL CAMPAIGN <i></i> 5 WAVES</span></footer>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog"><button class="dialog-close icon-button" data-close="help-dialog" aria-label="关闭说明">${icon('close')}</button><div class="eyebrow">FIELD MANUAL</div><h2>守住你的基地</h2><ol><li><strong>部署：</strong>选择机炮或榴弹炮，在基地周围虚线范围内点击建造。岩石、基地和敌人占用的位置无法建造。</li><li><strong>守卫：</strong>敌人动态寻路。完全封路时会攻击炮塔，突破后继续冲向基地。</li><li><strong>经营：</strong>击杀与过关获得金币。点击已有炮塔可升级（同时修复）或拆除。最多 3 级，拆除按剩余耐久返还投资的 70%。</li><li><strong>胜利：</strong>守住全部 5 波进攻。敌人抵达基地后会持续攻击，基地生命归零即失败。</li></ol><div class="manual-keys"><kbd>1</kbd> 机炮 <kbd>2</kbd> 榴弹炮 <kbd>空格</kbd> 开始 / 暂停 <kbd>Esc</kbd> 取消选择</div><button class="primary" data-close="help-dialog">明白，返回战场</button></dialog>
  <dialog id="restart-dialog"><div class="eyebrow">NEW CAMPAIGN</div><h2>重新建立防线？</h2><p>当前这局的炮塔、金币与波次将重置。</p><div class="dialog-actions"><button class="secondary" data-close="restart-dialog">继续当前战役</button><button class="primary" id="confirm-restart">重新开始</button></div></dialog>
`;

let soundEnabled = false;
let audio: AudioContext | null = null;
let lastTone = 0;
function tone(type: string) {
  if (!soundEnabled) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  if (type === 'shoot' && audio.currentTime - lastTone < 0.07) return;
  lastTone = audio.currentTime;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = type === 'explosion' ? 'triangle' : 'sine';
  const frequencies: Record<string, number> = { shoot: 440, explosion: 100, build: 620, wave: 380, end: 260 };
  oscillator.frequency.setValueAtTime(frequencies[type] ?? 300, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(type === 'build' ? 900 : 60, audio.currentTime + 0.13);
  gain.gain.setValueAtTime(type === 'shoot' ? 0.018 : 0.045, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
}

function chooseKind(kind: TowerKind) {
  if (model.phase === 'victory' || model.phase === 'defeat' || model.paused) return;
  selection.kind = selection.kind === kind ? null : kind; selection.towerId = null;
  $('#first-tip').hidden = true; renderUI();
}
function chooseCell(col: number, row: number) {
  if (model.paused || model.phase === 'victory' || model.phase === 'defeat') return;
  const tower = model.towerAt(col, row);
  if (tower) { selection.towerId = tower.id; selection.kind = null; }
  else if (selection.kind) model.build(col, row, selection.kind);
  else { selection.towerId = null; model.notify('先选择右侧炮塔，或按 1 / 2，再点击地图建造。'); }
  renderUI();
}
function togglePause() {
  if (model.phase !== 'combat') return;
  model.paused = !model.paused; renderUI();
}
function startWave() {
  if (model.startWave()) { $('#first-tip').hidden = true; selection.kind = null; selection.towerId = null; }
  renderUI();
}
function restart() {
  model.reset(); selection.kind = null; selection.towerId = null;
  $('#first-tip').hidden = false;
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) dialog.close();
  renderUI();
}

let previousMessage = -1, toastTimeout: ReturnType<typeof setTimeout>;
let detailHTML = '', lastUiTime = 0;
function renderUI() {
  const finished = model.phase === 'victory' || model.phase === 'defeat';
  const combat = model.phase === 'combat';
  $('#gold').textContent = String(model.gold);
  const baseLabel = `${model.baseHp} <small>/ ${model.maxBaseHp}</small>`;
  if ($('#base-hp').innerHTML !== baseLabel) $('#base-hp').innerHTML = baseLabel;
  $('#base-meter').style.width = `${model.baseHp / model.maxBaseHp * 100}%`;
  $('#base-meter').classList.toggle('danger', model.baseHp < 120);
  const waveLabel = `${String(model.wave).padStart(2, '0')} <small>/ 05</small>`;
  if ($('#wave-number').innerHTML !== waveLabel) $('#wave-number').innerHTML = waveLabel;
  $('#phase-label').textContent = finished ? model.phase === 'victory' ? '防守成功' : '基地失守' : model.paused ? '已暂停' : combat ? '战斗进行中' : '部署阶段';
  $('.live-dot').classList.toggle('combat', combat && !model.paused);
  $('#kill-count').textContent = `已击退 ${model.kills} 名敌人`;
  $('#pause-overlay').hidden = !model.paused;
  const pause = $<HTMLButtonElement>('#pause'); pause.disabled = !combat;
  const pauseHTML = `${icon(model.paused ? 'play' : 'pause', 17)}<span>${model.paused ? '继续' : '暂停'}</span>`;
  if (pause.innerHTML !== pauseHTML) pause.innerHTML = pauseHTML;
  $('#speed span').textContent = `${model.speed}×`;
  $('#speed').classList.toggle('active', model.speed === 2);
  $<HTMLButtonElement>('#speed').disabled = finished;
  for (const kind of ['rapid', 'cannon'] as TowerKind[]) {
    const button = $<HTMLButtonElement>(`#build-${kind}`);
    button.classList.toggle('selected', selection.kind === kind);
    button.classList.toggle('unaffordable', model.gold < TOWERS[kind].cost);
    button.setAttribute('aria-pressed', String(selection.kind === kind));
    button.disabled = finished || model.paused;
  }
  const tower = model.towers.find(item => item.id === selection.towerId);
  if (selection.towerId && !tower) selection.towerId = null;
  let detail = '';
  if (tower) {
    const info = stats(tower);
    detail = `<div class="detail-top"><strong>${info.name}</strong><span>LV.${tower.level} / 3</span></div><div class="detail-stats"><span>伤害<strong>${info.damage}${tower.kind === 'cannon' ? ' 范围' : ''}</strong></span><span>射程<strong>${info.range.toFixed(1)} 格</strong></span><span>耐久<strong>${Math.ceil(tower.hp)}/${info.hp}</strong></span></div><div class="tower-actions"><button class="upgrade" data-action="upgrade" ${tower.level >= 3 || model.gold < upgradeCost(tower) || model.paused || finished ? 'disabled' : ''}>${tower.level >= 3 ? '已满级' : `升级并修复 · ${upgradeCost(tower)}`}</button><button class="sell" data-action="sell" ${model.paused || finished ? 'disabled' : ''}>拆除 +${sellValue(tower)}</button></div>`;
  } else if (selection.kind) {
    const info = TOWERS[selection.kind];
    detail = `<div class="detail-top"><strong>已选择 · ${info.name}</strong><button data-action="cancel" class="text-button">取消</button></div><div class="detail-stats"><span>伤害<strong>${info.damage}${selection.kind === 'cannon' ? ' 范围' : ''}</strong></span><span>射程<strong>${info.range} 格</strong></span><span>间隔<strong>${info.cooldown} 秒</strong></span></div><p class="placement-hint">${model.gold < info.cost ? '金币不足，击败敌人后继续建造。' : '点击虚线范围内的空地部署，可连续建造。'}</p>`;
  }
  if (detail !== detailHTML) { $('#selection-detail').innerHTML = detail; detailHTML = detail; }
  $('#selection-detail').hidden = !detail;
  $('#game').classList.toggle('building', !!selection.kind);
  const waveIndex = Math.max(0, Math.min(model.phase === 'planning' ? model.wave : model.wave - 1, 4)), wave = WAVES[waveIndex];
  $('#dispatch-kicker').textContent = finished ? '战役结算' : combat ? '当前进攻' : '下一波情报';
  $('#incoming-index').textContent = `${String(waveIndex + 1).padStart(2, '0')} / 05`;
  $('#incoming-title').textContent = finished ? model.phase === 'victory' ? '荒原仍有微光' : '重整旗鼓' : wave.name;
  $('#incoming-description').textContent = finished ? model.message : wave.description;
  $('#incoming-sides').textContent = `↗ ${wave.sides.map(side => SIDE_LABEL[side]).join(' / ')}`;
  $('#incoming-count').textContent = combat ? `剩余 ${model.remaining} 名` : `${wave.units.length} 名敌人`;
  $('#wave-progress').style.width = `${combat ? model.progress * 100 : finished ? 100 : 0}%`;
  const start = $<HTMLButtonElement>('#start-wave'); start.disabled = combat || finished;
  const startHTML = combat ? `<span class="button-pulse"></span> ${model.paused ? '战斗已暂停' : '防守进行中'}` : finished ? model.phase === 'victory' ? '全部波次已完成' : '本次战役已结束' : `开始第 ${model.wave + 1} 波 ${icon('arrow', 19)}`;
  if (start.innerHTML !== startHTML) start.innerHTML = startHTML;
  $('#dispatch-footnote').textContent = combat ? '战斗中也可建造、升级或拆除炮塔。' : finished ? '点击「再战一局」尝试新的布局。' : model.wave ? `上一波补给 +${WAVES[model.wave - 1].bonus} 金币，准备好再继续。` : '准备时间不限，布防完毕再出发。';
  for (const element of document.querySelectorAll<HTMLElement>('.wave-stop')) {
    const waveNumber = Number(element.dataset.wave);
    element.classList.toggle('complete', waveNumber <= model.wave && !(combat || model.phase === 'defeat' ? waveNumber === model.wave : false));
    element.classList.toggle('current', combat ? waveNumber === model.wave : !finished && waveNumber === model.wave + 1);
  }
  $('#end-overlay').hidden = !finished;
  if (finished) {
    const won = model.phase === 'victory';
    $('#end-caption').textContent = won ? 'MISSION COMPLETE' : 'SIGNAL LOST';
    $('#end-title').textContent = won ? '防线，守住了。' : '微光暂熄，再战一次。';
    $('#end-description').textContent = won ? '五波进攻全部击退。荒原哨站，依然屹立。' : '试试将机炮靠近基地，并用榴弹炮覆盖敌人汇集的位置。';
    $('#end-stats').innerHTML = `<div><strong>${won ? 5 : Math.max(0, model.wave - 1)}<small>/ 5</small></strong><span>守住波次</span></div><div><strong>${model.kills}</strong><span>击退敌人</span></div><div><strong>${Math.floor(model.elapsed / 60)}:${String(Math.floor(model.elapsed % 60)).padStart(2, '0')}</strong><span>战斗用时</span></div>`;
  }
  if (model.messageId !== previousMessage) {
    previousMessage = model.messageId;
    if (model.messageId > 0) { $('#toast').textContent = model.message; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3400); }
  }
}

$('#build-rapid').onclick = () => chooseKind('rapid');
$('#build-cannon').onclick = () => chooseKind('cannon');
$('#start-wave').onclick = startWave;
$('#pause').onclick = togglePause; $('#resume').onclick = togglePause;
$('#speed').onclick = () => { model.speed = model.speed === 1 ? 2 : 1; renderUI(); };
$('#dismiss-tip').onclick = () => { $('#first-tip').hidden = true; };
$('#selection-detail').onclick = event => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'cancel') selection.kind = null;
  if (selection.towerId && action === 'upgrade') model.upgrade(selection.towerId);
  if (selection.towerId && action === 'sell') { model.sell(selection.towerId); selection.towerId = null; }
  renderUI();
};
$('#sound').onclick = () => {
  soundEnabled = !soundEnabled; $('#sound').innerHTML = icon(soundEnabled ? 'sound' : 'mute', 18);
  $('#sound').title = soundEnabled ? '关闭音效' : '开启音效'; $('#sound').setAttribute('aria-label', $('#sound').title);
  $('#sound').classList.toggle('active', soundEnabled); if (soundEnabled) tone('build');
};
let pauseBeforeDialog = false;
function openDialog(id: string) {
  pauseBeforeDialog = model.paused;
  if (model.phase === 'combat') model.paused = true;
  $<HTMLDialogElement>(`#${id}`).showModal(); renderUI();
}
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) dialog.addEventListener('close', () => { if (model.phase === 'combat') model.paused = pauseBeforeDialog; renderUI(); });
$('#help').onclick = () => openDialog('help-dialog');
$('#restart').onclick = () => { if (!model.towers.length && !model.wave) restart(); else openDialog('restart-dialog'); };
$('#confirm-restart').onclick = restart; $('#play-again').onclick = restart;
for (const button of document.querySelectorAll<HTMLElement>('[data-close]')) button.onclick = () => $<HTMLDialogElement>(`#${button.dataset.close}`).close();
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) return;
  if (event.key === '1') chooseKind('rapid');
  if (event.key === '2') chooseKind('cannon');
  if (event.key === 'Escape') { selection.kind = null; selection.towerId = null; renderUI(); }
  if (event.code === 'Space' && (event.target as HTMLElement)?.tagName !== 'BUTTON') { event.preventDefault(); if (model.phase === 'planning') startWave(); else togglePause(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && model.phase === 'combat' && !model.paused) { model.paused = true; model.notify('已自动暂停，返回后可继续战斗。'); renderUI(); }
});
renderUI();
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: WIDTH, height: HEIGHT,
  backgroundColor: '#193d36', antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: new BoardScene(model, selection, chooseCell, () => {
    const now = performance.now();
    if (now - lastUiTime > 100) { renderUI(); lastUiTime = now; }
    for (const event of model.events.splice(0)) tone(event.type);
  }),
  render: { roundPixels: true }, audio: { noAudio: true },
});
