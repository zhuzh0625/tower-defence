import Phaser from 'phaser';
import './style.css';
import './battlefield.css';
import './menu.css';
import { BASE, BASE_LEVELS, TOWERS, TOWER_KINDS, TOWER_GUIDE, ENEMIES, ENEMY_GUIDE, WAVES, constructionTime, type TowerKind, type EnemyKind, type Side } from './data';
import { GameEngine, stats, upgradeCost, sellValue, type GameMode, type TestOption } from './engine';
import { BoardScene, type Selection } from './scene';
import { artIcon } from './art';

const model = new GameEngine();
model.paused = true;
let screen: 'menu' | 'game' = 'menu';
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
const towerArt = (kind: TowerKind) => artIcon(kind);
const enemyArt = (kind: EnemyKind) => artIcon(kind);
const enemyBadge = (kind: EnemyKind) => `<span class="enemy-badge" role="listitem" tabindex="0" data-enemy="${kind}" aria-label="${ENEMIES[kind].name}">${enemyArt(kind)}</span>`;
const enemyArmor = (kind: EnemyKind) => { const info = ENEMIES[kind]; return 'armor' in info ? info.armor : 0; };

$('#app').innerHTML = `
  <main class="shell battlefield menu-backdrop" aria-label="边境守望战场" inert>
    <div class="map-wrap">
            <div id="game"></div>
            <div class="first-tip" id="first-tip"><span class="tip-number">01</span><div><strong>你的基地，最后一道防线。</strong><p>滚轮缩放 · 按住中键拖动。<br>右键取消建造 ·「归位」恢复视角。</p></div><button id="dismiss-tip" class="tip-close" aria-label="关闭提示">${icon('close', 16)}</button></div>
            <div class="pause-overlay" id="pause-overlay" hidden><div>${icon('pause', 32)}<h2>战场已暂停</h2><p>准备好后，继续守住防线。</p><button class="primary" id="resume">继续战斗</button></div></div>
            <div class="end-overlay" id="end-overlay" hidden><div class="end-card"><div class="end-emblem" id="end-emblem">${icon('shield', 42)}</div><div class="eyebrow" id="end-caption">MISSION COMPLETE</div><h2 id="end-title">防线，守住了。</h2><p id="end-description"></p><div class="end-stats" id="end-stats"></div><button id="play-again" class="primary">${icon('reset', 18)} 再战一局</button></div></div>

      <div id="battle-hud" class="battle-hud">
      <div class="resources" aria-label="战役状态">
        <div class="resource gold-resource"><span class="resource-icon">${icon('coin', 23)}</span><div><span class="resource-label">可用金币</span><strong id="gold">240</strong></div></div>
        <div class="resource"><span class="resource-icon">${icon('shield', 23)}</span><div><span class="resource-label">基地生命</span><strong id="base-hp">400 <small>/ 400</small></strong><span class="mini-meter"><i id="base-meter"></i></span></div></div>
        <div class="resource wave-resource"><span class="resource-icon">${icon('wave', 23)}</span><div><span class="resource-label">当前波次</span><strong id="wave-number">00 <small>/ 08</small></strong></div></div>
        <div class="resource kills-resource"><div><span class="resource-label">已击退</span><strong id="kill-count">0</strong></div></div>
      </div>
        <section class="arsenal"><div class="section-heading"><div><span class="eyebrow">BUILD YOUR DEFENSE</span><h2>构筑防线</h2></div><span class="count-tag">05</span></div><p class="section-intro">选择炮塔，在基地周围自由部署。</p>
          ${TOWER_KINDS.map((kind, i) => `<button class="tower-card" id="build-${kind}" data-kind="${kind}" aria-pressed="false"><span class="tower-art ${kind}">${towerArt(kind)}</span><span class="tower-copy"><span class="tower-name">${TOWERS[kind].name}<kbd>${i + 1}</kbd></span><span class="tower-type">${TOWERS[kind].caption}</span><span class="tower-meta">${TOWER_GUIDE[kind]}</span></span><span class="tower-price" id="price-${kind}">${icon('coin', 14)}${TOWERS[kind].cost}</span></button>`).join('')}
          <div class="selection-detail" id="selection-detail"></div>
          <div class="build-tip" id="build-tip">${icon('target', 17)}<span>点击已有炮塔，可升级或拆除。</span></div>
        </section>
        <section class="dispatch" aria-label="波次倒计时与敌人种类"><div id="wave-status" class="wave-countdown" role="timer"></div><div class="enemy-intel" id="enemy-intel" role="list" aria-label="下一波敌人种类"></div></section>
      </div>
          <div class="field-controls"><div class="control-group"><button id="pause" class="control" title="暂停 / 继续（空格）">${icon('pause', 17)}<span>暂停</span></button><button id="speed" class="control" title="切换游戏速度">${icon('speed', 18)}<span>1×</span></button><span class="control-separator"></span><button id="sound" class="icon-button" title="开启音效" aria-label="开启音效">${icon('mute', 18)}</button></div><div class="control-group"><button id="reset-view" class="control" title="恢复地图缩放和位置">归位</button><button id="toggle-hud" class="control" aria-expanded="true" aria-controls="battle-hud">收起面板</button><button id="restart" class="icon-button" title="重新开始" aria-label="重新开始">${icon('reset', 18)}</button><button id="help" class="icon-button" title="资料库" aria-label="资料库">${icon('help', 18)}</button><button id="back-menu" class="control">主菜单</button></div></div>
          <details id="test-panel" class="test-panel" hidden><summary>测试模式 <span>工具</span></summary><div class="test-body">
            <label class="test-option"><input id="test-instant" type="checkbox">瞬间建造</label>
            <label class="test-option"><input id="test-free" type="checkbox">免费建造</label>
            <p>以上选项也适用于基地与炮塔升级。</p>
            <form id="test-spawn-form"><label for="test-enemy">创建敌人</label><select id="test-enemy">${(Object.keys(ENEMY_GUIDE) as EnemyKind[]).map(kind => `<option value="${kind}">${ENEMIES[kind].name}</option>`).join('')}</select>
              <div class="test-spawn-fields"><label>数量<input id="test-count" type="number" min="1" max="20" step="1" value="1" required></label><label>方向<select id="test-side"><option value="west">西侧</option><option value="north">北侧</option><option value="east">东侧</option><option value="south">南侧</option></select></label></div>
              <button id="test-spawn" type="submit" class="primary">创建敌人</button>
            </form><p>在建造范围外围生成。暂停时可创建，恢复后行动。</p>
          </div></details>
    </div>
  </main>
  <section id="main-menu" class="main-menu" aria-labelledby="menu-title">
    <div class="menu-card"><div class="menu-emblem">${icon('shield', 38)}</div><div class="eyebrow">LAST LIGHT · TOWER DEFENSE</div><h1 id="menu-title">边境守望</h1><p class="menu-intro">在旷野中构筑防线，守住最后的微光。</p>
      <nav class="menu-options" aria-label="主菜单"><button id="menu-start">${icon('play', 23)}<span><strong>开始游戏</strong><small>建立防线，迎接八波进攻</small></span>${icon('arrow', 18)}</button><button id="menu-test">${icon('target', 23)}<span><strong>测试模式</strong><small>自由调试建造与敌人</small></span>${icon('arrow', 18)}</button><button id="menu-library">${icon('help', 23)}<span><strong>资料库</strong><small>操作规则、炮塔与敌人图鉴</small></span>${icon('arrow', 18)}</button><button id="menu-settings">${icon('sound', 23)}<span><strong>游戏设置</strong><small>调整游戏音量</small></span>${icon('arrow', 18)}</button></nav>
      <p class="menu-footer">开放地图 · 自由布防</p>
    </div>
  </section>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog" aria-labelledby="help-title">
    <header class="manual-header"><div><div class="eyebrow">FIELD MANUAL</div><h2 id="help-title">资料库</h2></div><button class="icon-button" data-close="help-dialog" aria-label="关闭说明">${icon('close')}</button></header>
    <div class="library-tabs" role="tablist" aria-label="资料分类"><button id="tab-rules" role="tab" aria-controls="library-rules" aria-selected="true" data-library="rules">操作规则</button><button id="tab-towers" role="tab" aria-controls="library-towers" aria-selected="false" tabindex="-1" data-library="towers">炮塔说明</button><button id="tab-enemies" role="tab" aria-controls="library-enemies" aria-selected="false" tabindex="-1" data-library="enemies">敌人说明</button></div>
    <div class="manual-content" tabindex="0" aria-label="玩法说明内容">
      <section id="library-enemies" role="tabpanel" aria-labelledby="tab-enemies" hidden><h3 id="enemy-guide-title">敌人图鉴</h3><p class="library-note">以下为基础属性；每增加一波，敌人生命增加基础值的 10%。护甲敌人的血条旁显示盾牌与护甲值。</p><ul class="enemy-guide">
        ${(Object.keys(ENEMY_GUIDE) as EnemyKind[]).map(kind => `<li class="enemy-guide-item" data-enemy="${kind}"><span class="enemy-guide-icon" aria-hidden="true">${enemyArt(kind)}</span><div><h4>${ENEMIES[kind].name}</h4><p>${ENEMY_GUIDE[kind]}</p><dl class="library-stats"><div><dt>生命</dt><dd>${ENEMIES[kind].hp}</dd></div><div><dt>护甲</dt><dd>${enemyArmor(kind)}</dd></div><div><dt>伤害</dt><dd>${ENEMIES[kind].damage}</dd></div><div><dt>移速</dt><dd>${ENEMIES[kind].speed / 10} 米/秒</dd></div><div><dt>赏金</dt><dd>${ENEMIES[kind].reward}</dd></div></dl></div></li>`).join('')}
      </ul></section>
      <section id="library-towers" role="tabpanel" aria-labelledby="tab-towers" hidden><h3>炮塔图鉴</h3><p class="library-note">以下为 1 级属性。炮塔最多升至 3 级，升级可提高伤害、射程、耐久和射速。</p><ul class="enemy-guide tower-guide">
        ${TOWER_KINDS.map(kind => `<li class="enemy-guide-item" data-tower="${kind}"><span class="library-tower-icon">${towerArt(kind)}</span><div><h4>${TOWERS[kind].name}</h4><p>${TOWER_GUIDE[kind]}</p><dl class="library-stats"><div><dt>造价</dt><dd>${TOWERS[kind].cost} 金</dd></div><div><dt>解锁</dt><dd>基地 ${TOWERS[kind].requiredBase} 级</dd></div><div><dt>伤害</dt><dd>${TOWERS[kind].damage}</dd></div><div><dt>射程</dt><dd>${TOWERS[kind].range / 10} 米</dd></div><div><dt>攻击间隔</dt><dd>${TOWERS[kind].cooldown} 秒</dd></div><div><dt>耐久</dt><dd>${TOWERS[kind].hp}</dd></div></dl><p>升至 2 / 3 级：${Math.round(TOWERS[kind].cost * .8)} / ${Math.round(TOWERS[kind].cost * 1.2)} 金，耗时 10 / 15 秒。</p></div></li>`).join('')}
      </ul></section>
      <section id="library-rules" role="tabpanel" aria-labelledby="tab-rules"><h3 id="basic-guide-title">基础玩法</h3><ol><li><strong>部署：</strong>选择下方五种炮塔之一，自由点击基地周围的空地建造，无需对齐网格。底座必须完整位于部署范围内，不能与岩石或敌人重叠。建筑之间（含基地）需为最大体型单位预留通道，小外圈不能重叠。</li><li><strong>守卫：</strong>敌人会绕开障碍并互相避让；大体型敌人需要更宽的通道。完全封路时会攻击炮塔。</li><li><strong>经营：</strong>击杀与过关获得金币。点击主基地可升级，完成后扩大建造范围；升至 2 / 3 级分别花费 120 / 200 金币、耗时 10 / 15 秒。新建耗时 5 秒，升至 2 / 3 级分别耗时 10 / 15 秒；施工期间停火，仍会受攻击。升级完成修复原有损伤，保留施工期间受到的伤害。穿甲狙击塔需要 2 级基地，电弧塔需要 3 级基地。炮塔最多 3 级，拆除按剩余耐久返还投资的 70%。</li><li><strong>胜利：</strong>首波准备 30 秒，每波结束修整 20 秒，然后自动开始下一波。守住全部 8 波进攻。敌人抵达基地后会持续攻击，基地生命归零即失败。</li></ol>
      <p>滚轮缩放地图，按住中键拖拽，「归位」恢复视角。建造模式下左键只尝试建造；右键或 Esc 取消后可选择已有炮塔。</p><div class="manual-keys"><kbd>1</kbd> 机炮 <kbd>2</kbd> 榴弹炮 <kbd>3</kbd> 冰霜 <kbd>4</kbd> 狙击 <kbd>5</kbd> 电弧 <kbd>空格</kbd> 暂停 / 继续 <kbd>Esc</kbd> 取消选择</div></section>
    </div>
    <button class="primary manual-return" data-close="help-dialog">明白，返回战场</button>
  </dialog>
  <dialog id="settings-dialog" aria-labelledby="settings-title"><button class="dialog-close icon-button" data-close="settings-dialog" aria-label="关闭设置">${icon('close')}</button><div class="eyebrow">SETTINGS</div><h2 id="settings-title">游戏设置</h2><label class="volume-label" for="volume">音效音量 <output id="volume-value" for="volume">0%</output></label><input id="volume" type="range" min="0" max="100" step="1" value="0"><div class="volume-actions"><button id="preview-sound" class="secondary">试听音效</button><span>0% 为静音</span></div><p>设置会自动保存在此浏览器。</p><button class="primary" data-close="settings-dialog">完成</button></dialog>
  <dialog id="restart-dialog"><div class="eyebrow">NEW CAMPAIGN</div><h2>重新建立防线？</h2><p>当前这局的炮塔、金币与波次将重置。</p><div class="dialog-actions"><button class="secondary" data-close="restart-dialog">继续当前战役</button><button class="primary" id="confirm-restart">重新开始</button></div></dialog>
`;

// Keep details anchored to the viewport edge, independent of the build dock.
$('#battle-hud').append($('#selection-detail'));
const buildSidebar = document.createElement('div');
buildSidebar.id = 'build-sidebar';
buildSidebar.className = 'build-sidebar';
buildSidebar.append($('.arsenal'), $('#test-panel'));
$('.map-wrap').append(buildSidebar);
$('#toggle-hud').setAttribute('aria-controls', 'battle-hud build-sidebar');
let volume = 0;
try { const saved = Number(localStorage.getItem('last-light-volume') ?? 0); if (Number.isFinite(saved)) volume = Math.max(0, Math.min(1, saved)); } catch { /* Storage may be unavailable in private browsing. */ }
let lastAudibleVolume = volume || .5;
let audio: AudioContext | null = null;
let lastTone = 0;
function tone(type: string) {
  if (volume <= 0) return;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  if (type === 'shoot' && audio.currentTime - lastTone < 0.07) return;
  lastTone = audio.currentTime;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.type = type === 'explosion' ? 'triangle' : 'sine';
  const frequencies: Record<string, number> = { shoot: 440, explosion: 100, build: 620, wave: 380, end: 260 };
  oscillator.frequency.setValueAtTime(frequencies[type] ?? 300, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(type === 'build' ? 900 : 60, audio.currentTime + 0.13);
  gain.gain.setValueAtTime((type === 'shoot' ? 0.018 : 0.045) * volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001 * volume, audio.currentTime + 0.18);
  oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.2);
}
function setVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  if (volume > 0) lastAudibleVolume = volume;
  try { localStorage.setItem('last-light-volume', String(volume)); } catch { /* Keep the current session setting. */ }
  renderVolume();
}
function renderVolume() {
  const enabled = volume > 0;
  $('#sound').innerHTML = icon(enabled ? 'sound' : 'mute', 18);
  $('#sound').title = enabled ? '关闭音效' : '开启音效'; $('#sound').setAttribute('aria-label', $('#sound').title);
  $('#sound').classList.toggle('active', enabled);
  $<HTMLInputElement>('#volume').value = String(Math.round(volume * 100));
  $('#volume-value').textContent = `${Math.round(volume * 100)}%`;
  $<HTMLButtonElement>('#preview-sound').disabled = !enabled;
}
const priceLabel = (cost: number) => model.freeBuilding ? '免费' : `${cost} 金`;
const durationLabel = (level: number) => model.instantBuilding ? '立即完成' : `${constructionTime(level)} 秒`;

function chooseKind(kind: TowerKind) {
  if (model.phase === 'victory' || model.phase === 'defeat' || model.paused) return;
  if (model.baseLevel < TOWERS[kind].requiredBase) { model.notify(`需要 ${TOWERS[kind].requiredBase} 级基地`); renderUI(); return; }
  selection.kind = selection.kind === kind ? null : kind; selection.towerId = null; selection.base = false;
  $('#first-tip').hidden = true; renderUI();
}
function choosePosition(x: number, y: number) {
  if (model.paused || model.phase === 'victory' || model.phase === 'defeat') return;
  const tower = model.towerAt(x, y);
  if (selection.kind) model.build(x, y, selection.kind);
  else if (Math.hypot(x - BASE.x, y - BASE.y) <= BASE.radius) { selection.towerId = null; selection.base = true; }
  else if (tower) { selection.towerId = tower.id; selection.base = false; }
  else { selection.towerId = null; selection.base = false; model.notify('请选择炮塔'); }
  renderUI();
}
function cancelSelection() { selection.kind = null; selection.towerId = null; selection.base = false; renderUI(); }
let boardScene: BoardScene;
function togglePause() {
  if (screen !== 'game' || model.phase === 'victory' || model.phase === 'defeat') return;
  model.paused = !model.paused; renderUI();
}
function startGame(mode: GameMode) {
  screen = 'game'; model.reset(mode); boardScene?.resetView(); pauseBeforeDialog = false; selection.kind = null; selection.towerId = null; selection.base = false;
  $('.battlefield').inert = false; $('.battlefield').classList.remove('menu-backdrop', 'hud-collapsed');
  $('#main-menu').hidden = true; $('#battle-hud').hidden = false;
  $('#toggle-hud').textContent = '收起面板'; $('#toggle-hud').setAttribute('aria-expanded', 'true');
  $('#test-panel').hidden = mode !== 'test';
  $<HTMLDetailsElement>('#test-panel').open = mode === 'test' && innerWidth > 850 && innerHeight > 600;
  $('#first-tip').hidden = mode === 'test';
  previousMessage = model.messageId; $('#toast').classList.remove('visible'); clearTimeout(toastTimeout);
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) dialog.close();
  renderUI();
  $('#game canvas')?.focus({ preventScroll: true });
}
function restart() {
  const mode = model.mode, options = { ...model.testOptions };
  startGame(mode);
  for (const option of Object.keys(options) as TestOption[]) model.setTestOption(option, options[option]);
  renderUI();
}
function returnToMenu() {
  screen = 'menu'; model.paused = true; model.events = []; cancelSelection();
  $('.battlefield').inert = true; $('.battlefield').classList.add('menu-backdrop');
  $('#main-menu').hidden = false; $('#toast').classList.remove('visible'); clearTimeout(toastTimeout);
  $('#menu-start').focus();
}

let previousMessage = -1, toastTimeout: ReturnType<typeof setTimeout>;
let detailHTML = '', intelHTML = '', lastUiTime = 0;
function renderUI() {
  const finished = model.phase === 'victory' || model.phase === 'defeat';
  const combat = model.phase === 'combat';
  $('#gold').textContent = String(model.gold);
  const baseLabel = `${model.baseHp} <small>/ ${model.maxBaseHp}</small>`;
  if ($('#base-hp').innerHTML !== baseLabel) $('#base-hp').innerHTML = baseLabel;
  $('#base-meter').style.width = `${model.baseHp / model.maxBaseHp * 100}%`;
  $('#base-meter').classList.toggle('danger', model.baseHp < 120);
  const waveLabel = `${String(model.wave).padStart(2, '0')} <small>/ 08</small>`;
  if ($('#wave-number').innerHTML !== waveLabel) $('#wave-number').innerHTML = waveLabel;
  if (model.wave > 0) $('#first-tip').hidden = true;
  $('#kill-count').textContent = String(model.kills);
  $('#pause-overlay').hidden = screen !== 'game' || !model.paused;
  $<HTMLInputElement>('#test-instant').checked = model.instantBuilding;
  $<HTMLInputElement>('#test-free').checked = model.freeBuilding;
  $<HTMLInputElement>('#test-instant').disabled = finished;
  $<HTMLInputElement>('#test-free').disabled = finished;
  $<HTMLButtonElement>('#test-spawn').disabled = finished;
  const pause = $<HTMLButtonElement>('#pause'); pause.disabled = finished;
  const pauseHTML = `${icon(model.paused ? 'play' : 'pause', 17)}<span>${model.paused ? '继续' : '暂停'}</span>`;
  if (pause.innerHTML !== pauseHTML) pause.innerHTML = pauseHTML;
  $('#speed span').textContent = `${model.speed}×`;
  $('#speed').classList.toggle('active', model.speed === 2);
  $<HTMLButtonElement>('#speed').disabled = finished;
  for (const kind of TOWER_KINDS) {
    const button = $<HTMLButtonElement>(`#build-${kind}`);
    button.classList.toggle('selected', selection.kind === kind);
    button.classList.toggle('unaffordable', !model.freeBuilding && model.gold < TOWERS[kind].cost);
    button.setAttribute('aria-pressed', String(selection.kind === kind));
    const locked = model.baseLevel < TOWERS[kind].requiredBase;
    button.classList.toggle('locked', locked);
    button.title = locked ? `升级基地至 ${TOWERS[kind].requiredBase} 级解锁` : TOWER_GUIDE[kind];
    $(`#price-${kind}`).textContent = locked ? `基地 Lv.${TOWERS[kind].requiredBase} 解锁` : priceLabel(TOWERS[kind].cost);
    button.disabled = finished || model.paused || locked;
  }
  const tower = model.towers.find(item => item.id === selection.towerId);
  if (selection.towerId && !tower) selection.towerId = null;
  let detail = '';
  if (selection.base) {
    const work = model.baseWork, next = BASE_LEVELS[model.baseLevel];
    detail = `<div class="detail-top"><strong>主基地</strong><span>LV.${model.baseLevel} / 3</span></div><div class="detail-stats"><span>建造半径<strong>${model.buildRadius / 10} 米</strong></span><span>耐久<strong>${model.baseHp}/${model.maxBaseHp}</strong></span></div>${work ? `<div class="work-status">升级中 · ${Math.ceil(work.remaining)} 秒<progress max="${work.duration}" value="${work.duration - work.remaining}"></progress></div>` : next ? `<p class="placement-hint">升级后建造半径 ${next.radius / 10} 米<br>解锁${TOWER_KINDS.filter(kind => TOWERS[kind].requiredBase === model.baseLevel + 1).map(kind => TOWERS[kind].name).join('、')}</p>` : ''}<div class="tower-actions"><button class="upgrade" data-action="upgrade-base" ${!next || work || (!model.freeBuilding && model.gold < model.baseUpgradeCost) || model.paused || finished ? 'disabled' : ''}>${work ? '升级中' : next ? `升级 · ${priceLabel(model.baseUpgradeCost)} / ${durationLabel(model.baseLevel + 1)}` : '已满级'}</button></div>`;
  } else if (tower) {
    const info = stats(tower);
    const work = tower.work;
    const workHTML = work ? `<div class="work-status"><strong>${work.kind === 'build' ? '建造中' : `升级至 LV.${work.targetLevel}`} · ${Math.ceil(work.remaining)} 秒</strong><progress max="${work.duration}" value="${work.duration - work.remaining}"></progress><small>施工中停止攻击，仍会受到伤害</small></div>` : '';
    detail = `<div class="detail-top"><strong>${info.name}</strong><span>LV.${tower.level} / 3</span></div><div class="detail-stats"><span>伤害<strong>${info.damage}${info.splash ? ' 范围' : ''}</strong></span><span>射程<strong>${(info.range / 10).toFixed(1)} 米</strong></span><span>耐久<strong>${Math.ceil(tower.hp)}/${info.hp}</strong></span></div><p class="placement-hint">${TOWER_GUIDE[tower.kind]}</p>${workHTML}<div class="tower-actions"><button class="upgrade" data-action="upgrade" ${work || tower.level >= 3 || (!model.freeBuilding && model.gold < upgradeCost(tower)) || model.paused || finished ? 'disabled' : ''}>${work ? '施工中' : tower.level >= 3 ? '已满级' : `升级 · ${priceLabel(upgradeCost(tower))} / ${durationLabel(tower.level + 1)}`}</button><button class="sell" data-action="sell" ${model.paused || finished ? 'disabled' : ''}>拆除 +${sellValue(tower)}</button></div>`;
  } else if (selection.kind) {
    const info = TOWERS[selection.kind];
    detail = `<div class="detail-top"><strong>已选择 · ${info.name}</strong><button data-action="cancel" class="text-button">取消</button></div><div class="detail-stats"><span>伤害<strong>${info.damage}${info.splash ? ' 范围' : ''}</strong></span><span>射程<strong>${(info.range / 10).toFixed(1)} 米</strong></span><span>间隔<strong>${info.cooldown} 秒</strong></span></div><p class="placement-hint">${!model.freeBuilding && model.gold < info.cost ? '金币不足' : TOWER_GUIDE[selection.kind]}</p>`;
  }
  if (detail !== detailHTML) { $('#selection-detail').innerHTML = detail; detailHTML = detail; }
  $('#selection-detail').hidden = !detail;
  $('#game').classList.toggle('building', !!selection.kind);
  const waveIndex = Math.max(0, Math.min(model.phase === 'planning' ? model.wave : model.wave - 1, WAVES.length - 1)), wave = WAVES[waveIndex];
  const intel = [...new Set(wave.units)].map(enemyBadge).join('');
  if (intel !== intelHTML) { $('#enemy-intel').innerHTML = intel; intelHTML = intel; }
  $('#enemy-intel').setAttribute('aria-label', combat ? '当前敌人种类' : '下一波敌人种类');
  $('#wave-status').textContent = finished ? model.phase === 'victory' ? '防守成功' : '基地失守' : combat ? model.paused ? '已暂停' : '战斗中' : `下一波 · ${Math.ceil(model.preparationRemaining)} 秒${model.paused ? '（暂停）' : ''}`;
  $('#end-overlay').hidden = screen !== 'game' || !finished;
  if (finished) {
    const won = model.phase === 'victory';
    $('#end-caption').textContent = won ? 'MISSION COMPLETE' : 'SIGNAL LOST';
    $('#end-title').textContent = won ? '防线，守住了。' : '微光暂熄，再战一次。';
    $('#end-description').textContent = won ? '八波进攻全部击退。荒原哨站，依然屹立。' : '试试将机炮靠近基地，并用榴弹炮覆盖敌人汇集的位置。';
    $('#end-stats').innerHTML = `<div><strong>${won ? WAVES.length : Math.max(0, model.wave - 1)}<small>/ 8</small></strong><span>守住波次</span></div><div><strong>${model.kills}</strong><span>击退敌人</span></div><div><strong>${Math.floor(model.elapsed / 60)}:${String(Math.floor(model.elapsed % 60)).padStart(2, '0')}</strong><span>战斗用时</span></div>`;
  }
  if (model.messageId !== previousMessage) {
    previousMessage = model.messageId;
    if (screen === 'game' && model.messageId > 0) { $('#toast').textContent = model.message; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3400); }
  }
}

for (const kind of TOWER_KINDS) $(`#build-${kind}`).onclick = () => chooseKind(kind);
$('#reset-view').onclick = () => boardScene.resetView();
$('.map-wrap').addEventListener('contextmenu', event => { event.preventDefault(); cancelSelection(); });
$('#toggle-hud').onclick = () => {
  const collapsed = $('.battlefield').classList.toggle('hud-collapsed');
  $('#battle-hud').hidden = collapsed;
  $('#toggle-hud').textContent = collapsed ? '展开面板' : '收起面板';
  $('#toggle-hud').setAttribute('aria-expanded', String(!collapsed));
};
$('#pause').onclick = togglePause; $('#resume').onclick = togglePause;
$('#speed').onclick = () => { model.speed = model.speed === 1 ? 2 : 1; renderUI(); };
$('#dismiss-tip').onclick = () => { $('#first-tip').hidden = true; };
$('#selection-detail').onclick = event => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'upgrade-base') model.upgradeBase();
  if (action === 'cancel') selection.kind = null;
  if (selection.towerId && action === 'upgrade') model.upgrade(selection.towerId);
  if (selection.towerId && action === 'sell') { model.sell(selection.towerId); selection.towerId = null; selection.base = false; }
  renderUI();
};
$('#sound').onclick = () => { setVolume(volume > 0 ? 0 : lastAudibleVolume); tone('build'); };
$('#volume').oninput = () => setVolume(Number($<HTMLInputElement>('#volume').value) / 100);
$('#preview-sound').onclick = () => tone('build');
$('#menu-start').onclick = () => startGame('normal');
$('#menu-test').onclick = () => startGame('test');
$('#back-menu').onclick = returnToMenu;
$('#menu-library').onclick = () => openDialog('help-dialog');
$('#menu-settings').onclick = () => openDialog('settings-dialog');
$('#test-instant').onchange = () => { model.setTestOption('instantBuild', $<HTMLInputElement>('#test-instant').checked); renderUI(); };
$('#test-free').onchange = () => { model.setTestOption('freeBuild', $<HTMLInputElement>('#test-free').checked); renderUI(); };
$('#test-spawn-form').onsubmit = event => {
  event.preventDefault();
  model.spawnTestEnemies($<HTMLSelectElement>('#test-enemy').value as EnemyKind, Number($<HTMLInputElement>('#test-count').value), $<HTMLSelectElement>('#test-side').value as Side);
  renderUI();
};
function libraryTab(name: string) {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-library]')) {
    const active = button.dataset.library === name;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    $(`#library-${button.dataset.library}`).hidden = !active;
  }
  $('.manual-content').scrollTop = 0;
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-library]')) {
  button.onclick = () => libraryTab(button.dataset.library!);
  button.onkeydown = event => {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-library]')], index = tabs.indexOf(button);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); libraryTab(tabs[next].dataset.library!); tabs[next].focus(); }
  };
}
let pauseBeforeDialog = false;
function openDialog(id: string) {
  if (id === 'help-dialog') {
    libraryTab('rules'); $('#help-dialog .manual-return').textContent = screen === 'menu' ? '返回主菜单' : '返回战场';
  }
  pauseBeforeDialog = model.paused;
  if (model.phase !== 'victory' && model.phase !== 'defeat') model.paused = true;
  $<HTMLDialogElement>(`#${id}`).showModal(); renderUI();
}
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) dialog.addEventListener('close', () => { if (model.phase !== 'victory' && model.phase !== 'defeat') model.paused = screen === 'menu' || pauseBeforeDialog; renderUI(); });
$('#help').onclick = () => openDialog('help-dialog');
$('#restart').onclick = () => { if (!model.towers.length && !model.wave) restart(); else openDialog('restart-dialog'); };
$('#confirm-restart').onclick = restart; $('#play-again').onclick = restart;
for (const button of document.querySelectorAll<HTMLElement>('[data-close]')) button.onclick = () => $<HTMLDialogElement>(`#${button.dataset.close}`).close();
document.addEventListener('keydown', event => {
  if (screen !== 'game' || document.querySelector('dialog[open]') || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) return;
  const shortcut = Number(event.key) - 1;
  if (/^[1-5]$/.test(event.key)) chooseKind(TOWER_KINDS[shortcut]);
  if (event.key === 'Escape') cancelSelection();
  if (event.code === 'Space' && (event.target as HTMLElement)?.tagName !== 'BUTTON') { event.preventDefault(); togglePause(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && model.phase !== 'victory' && model.phase !== 'defeat' && !model.paused) { model.paused = true; model.notify('已自动暂停'); renderUI(); }
});
renderVolume(); renderUI();
new Phaser.Game({
  type: Phaser.AUTO, parent: 'game',
  backgroundColor: '#193d36', antialias: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: boardScene = new BoardScene(model, selection, choosePosition, () => {
    const now = performance.now();
    if (now - lastUiTime > 100) { renderUI(); lastUiTime = now; }
    for (const event of model.events.splice(0)) tone(event.type);
  }, cancelSelection),
  render: { roundPixels: true }, audio: { noAudio: true },
});
