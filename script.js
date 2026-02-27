const JOURNAL_KEY = 'trade_journal_v4';
const SETTINGS_KEY = 'trade_settings_v2';
const POSITIONS_KEY = 'trade_positions_v1';

const defaultSettings = {
  dayRisk: 1.0,
  weekRisk: 2.5,
  tor: { green: 1.2, yellow: 1.0, red: 0.7 },
  accent: '#7c8bff',
};

let lastCalc = null;

const menuButtons = [...document.querySelectorAll('.menu-btn')];
const views = [...document.querySelectorAll('.view')];

const modeEl = document.getElementById('mode');
const signalEl = document.getElementById('signal');
const riskEl = document.getElementById('riskPercent');
const calcForm = document.getElementById('calc-form');
const calcResult = document.getElementById('calc-result');
const appliedRiskBadge = document.getElementById('appliedRiskBadge');
const dashModeBadge = document.getElementById('dashModeBadge');
const addPositionBtn = document.getElementById('add-position');
const openRangeBtn = document.getElementById('open-range');
const rangeDialog = document.getElementById('range-dialog');
const closeRangeBtn = document.getElementById('close-range');
const rangeBody = document.getElementById('range-body');

const calcSymbolEl = document.getElementById('calcSymbol');
const calcSideEl = document.getElementById('calcSide');

const dTotal = document.getElementById('dTotal');
const dWin = document.getElementById('dWin');
const dPnl = document.getElementById('dPnl');
const dAvg = document.getElementById('dAvg');
const torGreenView = document.getElementById('torGreenView');
const torYellowView = document.getElementById('torYellowView');
const torRedView = document.getElementById('torRedView');
const dayRiskView = document.getElementById('dayRiskView');
const weekRiskView = document.getElementById('weekRiskView');

const journalForm = document.getElementById('journal-form');
const journalBody = document.getElementById('journal-body');
const clearAllBtn = document.getElementById('clear-all');

const positionsBody = document.getElementById('positions-body');
const clearPositionsBtn = document.getElementById('clear-positions');

const settingsForm = document.getElementById('settings-form');
const setDayRisk = document.getElementById('setDayRisk');
const setWeekRisk = document.getElementById('setWeekRisk');
const setTorGreen = document.getElementById('setTorGreen');
const setTorYellow = document.getElementById('setTorYellow');
const setTorRed = document.getElementById('setTorRed');
const setAccent = document.getElementById('setAccent');
const resetSettingsBtn = document.getElementById('reset-settings');
const settingsStatus = document.getElementById('settings-status');

function formatKRW(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  return {
    ...defaultSettings,
    ...saved,
    tor: { ...defaultSettings.tor, ...(saved.tor || {}) },
  };
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadRows() {
  return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
}

function saveRows(rows) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(rows));
}

function loadPositions() {
  return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '[]');
}

function savePositions(rows) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(rows));
}

function getModeDefaultRisk(mode) {
  const settings = loadSettings();
  return mode === 'WEEK' ? Number(settings.weekRisk) : Number(settings.dayRisk);
}

function applyModeDefaultRisk() {
  riskEl.value = String(getModeDefaultRisk(modeEl.value));
}

function getAppliedRiskPercent() {
  return Number(riskEl.value || 0);
}

function updateRiskPreview() {
  const applied = getAppliedRiskPercent();
  appliedRiskBadge.textContent = `적용 리스크 ${applied.toFixed(2)}%`;
  dashModeBadge.textContent = `${modeEl.value} 모드`;
}

function applyThemeFromSettings() {
  const settings = loadSettings();
  document.documentElement.style.setProperty('--accent', settings.accent);
}

function fillSettingsForm() {
  const settings = loadSettings();
  setDayRisk.value = settings.dayRisk;
  setWeekRisk.value = settings.weekRisk;
  setTorGreen.value = settings.tor.green;
  setTorYellow.value = settings.tor.yellow;
  setTorRed.value = settings.tor.red;
  setAccent.value = settings.accent;
}

function syncDashboardConfigView() {
  const settings = loadSettings();
  torGreenView.textContent = settings.tor.green.toFixed(1);
  torYellowView.textContent = settings.tor.yellow.toFixed(1);
  torRedView.textContent = settings.tor.red.toFixed(1);
  dayRiskView.textContent = `${Number(settings.dayRisk).toFixed(1)}%`;
  weekRiskView.textContent = `${Number(settings.weekRisk).toFixed(1)}%`;
}

function renderStats(rows) {
  const total = rows.length;
  const pnls = rows.map((r) => r.pnl);
  const wins = pnls.filter((p) => p > 0).length;
  const sum = pnls.reduce((a, b) => a + b, 0);
  const avg = total ? sum / total : 0;

  dTotal.textContent = String(total);
  dWin.textContent = `${total ? ((wins / total) * 100).toFixed(1) : 0}%`;
  dPnl.textContent = formatKRW(sum.toFixed(0));
  dPnl.className = sum >= 0 ? 'pnl-positive' : 'pnl-negative';
  dAvg.textContent = formatKRW(avg.toFixed(0));
}

function renderRows() {
  const rows = loadRows();
  journalBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    const pnlClass = row.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.symbol}</td>
      <td>${row.side}</td>
      <td class="${pnlClass}">${formatKRW(row.pnl.toFixed(0))}</td>
      <td class="muted">${row.tag || '-'}</td>
      <td class="muted">${row.note || '-'}</td>
      <td><button class="small-btn btn-ghost" data-remove="${idx}">삭제</button></td>
    `;
    journalBody.appendChild(tr);
  });

  renderStats(rows);
}

function renderPositions() {
  const rows = loadPositions();
  positionsBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.createdAt}</td>
      <td>${row.symbol}</td>
      <td>${row.side}</td>
      <td>${row.qty.toFixed(4)}</td>
      <td>${row.entry.toFixed(2)} / ${row.stop.toFixed(2)}</td>
      <td>${formatKRW(row.riskAmount.toFixed(0))}</td>
      <td><button class="small-btn btn-ghost" data-pos-remove="${idx}">삭제</button></td>
    `;
    positionsBody.appendChild(tr);
  });
}

function calcPnl({ side, entry, exit, qty, fee }) {
  const diff = side === 'Long' ? exit - entry : entry - exit;
  return diff * qty - fee;
}

function getTargetPrice(entry, stop, r) {
  const perUnitRisk = Math.abs(entry - stop);
  return entry > stop ? entry + perUnitRisk * r : entry - perUnitRisk * r;
}

function renderRangePopup(calc) {
  rangeBody.innerHTML = '';
  for (let r = 1; r <= 10; r += 1) {
    const targetPrice = getTargetPrice(calc.entry, calc.stop, r);
    const expectedProfit = calc.adjustedRiskAmount * r;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r}R</td>
      <td>${targetPrice.toFixed(2)}</td>
      <td>${formatKRW(expectedProfit.toFixed(0))}</td>
    `;
    rangeBody.appendChild(tr);
  }
}

menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    menuButtons.forEach((b) => b.classList.toggle('active', b === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === target));
  });
});

modeEl.addEventListener('change', () => {
  applyModeDefaultRisk();
  updateRiskPreview();
});

riskEl.addEventListener('input', updateRiskPreview);

calcForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const settings = loadSettings();
  const capital = Number(document.getElementById('capital').value);
  const entry = Number(document.getElementById('entry').value);
  const stop = Number(document.getElementById('stop').value);
  const targetR = Number(document.getElementById('targetR').value || 2);

  const signal = signalEl.value;
  const tor = Number(settings.tor[signal] || 1);
  const riskPercent = getAppliedRiskPercent();
  const baseRiskAmount = capital * (riskPercent / 100);
  const adjustedRiskAmount = baseRiskAmount * tor;
  const perUnitRisk = Math.abs(entry - stop);

  if (perUnitRisk <= 0) {
    calcResult.textContent = '진입가와 손절가가 같을 수 없습니다.';
    return;
  }

  const qty = adjustedRiskAmount / perUnitRisk;
  const lossWidthPercent = entry ? (perUnitRisk / entry) * 100 : 0;
  const targetPrice = getTargetPrice(entry, stop, targetR);
  const expectedProfit = adjustedRiskAmount * targetR;

  lastCalc = {
    symbol: calcSymbolEl.value.trim().toUpperCase(),
    side: calcSideEl.value,
    mode: modeEl.value,
    signal,
    riskPercent,
    tor,
    capital,
    entry,
    stop,
    targetR,
    perUnitRisk,
    lossWidthPercent,
    adjustedRiskAmount,
    qty,
  };

  calcResult.innerHTML = `
    모드: <strong>${modeEl.value}</strong><br>
    적용 리스크: <strong>${riskPercent.toFixed(2)}%</strong> · TOR <strong>${tor}</strong><br>
    손실폭(가격차): <strong>${perUnitRisk.toFixed(2)}</strong> (${lossWidthPercent.toFixed(2)}%)<br>
    최대 손실금액(TOR 적용): <strong>${formatKRW(adjustedRiskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty.toFixed(4)}</strong><br>
    목표가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
    기대 수익: <strong>${formatKRW(expectedProfit.toFixed(0))}</strong>
  `;

  updateRiskPreview();
});

openRangeBtn.addEventListener('click', () => {
  if (!lastCalc) {
    alert('먼저 계산을 실행해주세요.');
    return;
  }
  renderRangePopup(lastCalc);
  rangeDialog.showModal();
});

closeRangeBtn.addEventListener('click', () => rangeDialog.close());

addPositionBtn.addEventListener('click', () => {
  if (!lastCalc) {
    alert('먼저 계산을 실행해주세요.');
    return;
  }

  const rows = loadPositions();
  rows.unshift({
    createdAt: new Date().toLocaleString('ko-KR'),
    symbol: lastCalc.symbol || '-',
    side: lastCalc.side,
    qty: lastCalc.qty,
    entry: lastCalc.entry,
    stop: lastCalc.stop,
    riskAmount: lastCalc.adjustedRiskAmount,
  });
  savePositions(rows);
  renderPositions();
  alert('포지션이 추가되었습니다.');
});

positionsBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pos-remove]');
  if (!btn) return;
  const idx = Number(btn.dataset.posRemove);
  const rows = loadPositions();
  rows.splice(idx, 1);
  savePositions(rows);
  renderPositions();
});

clearPositionsBtn.addEventListener('click', () => {
  if (!confirm('포지션 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(POSITIONS_KEY);
  renderPositions();
});

journalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = {
    date: document.getElementById('jDate').value,
    symbol: document.getElementById('jSymbol').value.trim().toUpperCase(),
    side: document.getElementById('jSide').value,
    entry: Number(document.getElementById('jEntry').value),
    exit: Number(document.getElementById('jExit').value),
    qty: Number(document.getElementById('jQty').value),
    fee: Number(document.getElementById('jFee').value || 0),
    tag: document.getElementById('jTag').value.trim(),
    note: document.getElementById('jNote').value.trim(),
  };

  item.pnl = calcPnl(item);
  const rows = loadRows();
  rows.unshift(item);
  saveRows(rows);
  journalForm.reset();
  renderRows();
});

journalBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  const rows = loadRows();
  rows.splice(idx, 1);
  saveRows(rows);
  renderRows();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('저널 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(JOURNAL_KEY);
  renderRows();
});

settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const next = {
    dayRisk: Number(setDayRisk.value || defaultSettings.dayRisk),
    weekRisk: Number(setWeekRisk.value || defaultSettings.weekRisk),
    tor: {
      green: Number(setTorGreen.value || defaultSettings.tor.green),
      yellow: Number(setTorYellow.value || defaultSettings.tor.yellow),
      red: Number(setTorRed.value || defaultSettings.tor.red),
    },
    accent: setAccent.value || defaultSettings.accent,
  };

  saveSettings(next);
  applyThemeFromSettings();
  syncDashboardConfigView();
  applyModeDefaultRisk();
  updateRiskPreview();
  settingsStatus.textContent = '설정이 저장되었습니다.';
});

resetSettingsBtn.addEventListener('click', () => {
  saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  syncDashboardConfigView();
  applyModeDefaultRisk();
  updateRiskPreview();
  settingsStatus.textContent = '기본값으로 복원되었습니다.';
});

function init() {
  if (!localStorage.getItem(SETTINGS_KEY)) saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  syncDashboardConfigView();
  applyModeDefaultRisk();
  updateRiskPreview();
  renderRows();
  renderPositions();
}

init();
