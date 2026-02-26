const JOURNAL_KEY = 'trade_journal_v3';
const SETTINGS_KEY = 'trade_settings_v1';

const defaultSettings = {
  baseRisk: 1.0,
  weekBoost: 0.5,
  tor: { green: 1.2, yellow: 1.0, red: 0.7 },
  accent: '#7c8bff',
};

const menuButtons = [...document.querySelectorAll('.menu-btn')];
const views = [...document.querySelectorAll('.view')];

const modeEl = document.getElementById('mode');
const signalEl = document.getElementById('signal');
const riskEl = document.getElementById('riskPercent');
const calcForm = document.getElementById('calc-form');
const calcResult = document.getElementById('calc-result');
const appliedRiskBadge = document.getElementById('appliedRiskBadge');
const dashModeBadge = document.getElementById('dashModeBadge');

const dTotal = document.getElementById('dTotal');
const dWin = document.getElementById('dWin');
const dPnl = document.getElementById('dPnl');
const dAvg = document.getElementById('dAvg');
const torGreenView = document.getElementById('torGreenView');
const torYellowView = document.getElementById('torYellowView');
const torRedView = document.getElementById('torRedView');
const baseRiskView = document.getElementById('baseRiskView');
const weekBoostView = document.getElementById('weekBoostView');

const journalForm = document.getElementById('journal-form');
const journalBody = document.getElementById('journal-body');
const clearAllBtn = document.getElementById('clear-all');

const settingsForm = document.getElementById('settings-form');
const setBaseRisk = document.getElementById('setBaseRisk');
const setWeekBoost = document.getElementById('setWeekBoost');
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

function getAppliedRiskPercent() {
  const settings = loadSettings();
  const rawRisk = Number(riskEl.value || settings.baseRisk);
  const modeBoost = modeEl.value === 'WEEK' ? settings.weekBoost : 0;
  return rawRisk + modeBoost;
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
  setBaseRisk.value = settings.baseRisk;
  setWeekBoost.value = settings.weekBoost;
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
  baseRiskView.textContent = `${Number(settings.baseRisk).toFixed(1)}%`;
  weekBoostView.textContent = `+${Number(settings.weekBoost).toFixed(1)}%`;
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

function calcPnl({ side, entry, exit, qty, fee }) {
  const diff = side === 'Long' ? exit - entry : entry - exit;
  return diff * qty - fee;
}

menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    menuButtons.forEach((b) => b.classList.toggle('active', b === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === target));
  });
});

modeEl.addEventListener('change', updateRiskPreview);
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

  const appliedRiskPercent = getAppliedRiskPercent();
  const baseRiskAmount = capital * (appliedRiskPercent / 100);
  const adjustedRiskAmount = baseRiskAmount * tor;
  const perUnitRisk = Math.abs(entry - stop);

  if (perUnitRisk <= 0) {
    calcResult.textContent = '진입가와 손절가가 같을 수 없습니다.';
    return;
  }

  const qty = adjustedRiskAmount / perUnitRisk;
  const targetPrice = entry > stop ? entry + perUnitRisk * targetR : entry - perUnitRisk * targetR;
  const expectedProfit = adjustedRiskAmount * targetR;

  calcResult.innerHTML = `
    모드: <strong>${modeEl.value}</strong><br>
    적용 리스크: <strong>${appliedRiskPercent.toFixed(2)}%</strong> (WEEK는 설정값만큼 자연 가산)<br>
    시장 신호등: <strong>${signal.toUpperCase()}</strong> · TOR <strong>${tor}</strong><br>
    TOR 적용 리스크 금액: <strong>${formatKRW(adjustedRiskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty.toFixed(4)}</strong><br>
    목표가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
    기대 수익: <strong>${formatKRW(expectedProfit.toFixed(0))}</strong>
  `;

  updateRiskPreview();
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
    baseRisk: Number(setBaseRisk.value || defaultSettings.baseRisk),
    weekBoost: Number(setWeekBoost.value || defaultSettings.weekBoost),
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
  updateRiskPreview();
  settingsStatus.textContent = '설정이 저장되었습니다.';

  if (!riskEl.value || Number(riskEl.value) <= 0) {
    riskEl.value = String(next.baseRisk);
  }
});

resetSettingsBtn.addEventListener('click', () => {
  saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  syncDashboardConfigView();
  riskEl.value = String(defaultSettings.baseRisk);
  updateRiskPreview();
  settingsStatus.textContent = '기본값으로 복원되었습니다.';
});

function init() {
  if (!localStorage.getItem(SETTINGS_KEY)) saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  syncDashboardConfigView();
  riskEl.value = String(loadSettings().baseRisk);
  updateRiskPreview();
  renderRows();
}

init();
