const JOURNAL_KEY = 'trade_journal_v6';
const SETTINGS_KEY = 'trade_settings_v4';
const POSITIONS_KEY = 'trade_positions_v3';

const defaultSettings = {
  dayRisk: 1.0,
  weekRisk: 2.5,
  signalRisk: { green: 5.0, yellow: 3.0, red: 1.0 },
  accent: '#7c8bff',
};

let lastCalc = null;

const menuButtons = [...document.querySelectorAll('.menu-btn')];
const views = [...document.querySelectorAll('.view')];

const modeEl = document.getElementById('mode');
const signalEl = document.getElementById('signal');
const riskModeEl = document.getElementById('riskMode');
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

const dTotal = document.getElementById('dTotal');
const dWin = document.getElementById('dWin');
const dPnlR = document.getElementById('dPnlR');
const dAvgR = document.getElementById('dAvgR');
const dayRiskView = document.getElementById('dayRiskView');
const weekRiskView = document.getElementById('weekRiskView');
const torValue = document.getElementById('torValue');
const stepCumR = document.getElementById('stepCumR');
const stepLevel = document.getElementById('stepLevel');
const nextRiskScale = document.getElementById('nextRiskScale');

const journalForm = document.getElementById('journal-form');
const journalBody = document.getElementById('journal-body');
const clearAllBtn = document.getElementById('clear-all');

const positionsBody = document.getElementById('positions-body');
const clearPositionsBtn = document.getElementById('clear-positions');
const closeDialog = document.getElementById('close-dialog');
const closeDialogInfo = document.getElementById('close-dialog-info');
const closeExitPriceEl = document.getElementById('close-exit-price');
const closeDialogCloseBtn = document.getElementById('close-close-dialog');
const closeRatioButtons = [...document.querySelectorAll('[data-close-ratio]')];

let activeCloseIndex = null;

const settingsForm = document.getElementById('settings-form');
const setDayRisk = document.getElementById('setDayRisk');
const setWeekRisk = document.getElementById('setWeekRisk');
const setGreenRisk = document.getElementById('setGreenRisk');
const setYellowRisk = document.getElementById('setYellowRisk');
const setRedRisk = document.getElementById('setRedRisk');
const setAccent = document.getElementById('setAccent');
const resetSettingsBtn = document.getElementById('reset-settings');
const exportDataBtn = document.getElementById('export-data');
const importDataBtn = document.getElementById('import-data');
const importFileEl = document.getElementById('import-file');
const settingsStatus = document.getElementById('settings-status');

function formatKRW(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function loadSettings() {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  return {
    ...defaultSettings,
    ...saved,
    signalRisk: { ...defaultSettings.signalRisk, ...(saved.signalRisk || {}) },
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

function getStepLevel(cumulativeR) {
  if (cumulativeR >= 0) return Math.floor(cumulativeR / 10);
  return Math.ceil(cumulativeR / 10);
}

function getRiskScaleByCumulativeR(cumulativeR) {
  const step = getStepLevel(cumulativeR);
  return Math.max(0.1, 1 + step * 0.1);
}

function getCumulativeR() {
  return loadRows().reduce((sum, row) => sum + Number(row.rMultiple || 0), 0);
}

function applyRiskPreset() {
  if (riskModeEl.value === 'mode') {
    riskEl.value = String(getModeDefaultRisk(modeEl.value));
  }
}

function getAppliedRiskPercent() {
  const baseRisk = Number(riskEl.value || 0);
  const scale = getRiskScaleByCumulativeR(getCumulativeR());
  return baseRisk * scale;
}

function updateRiskPreview() {
  const cumR = getCumulativeR();
  const scale = getRiskScaleByCumulativeR(cumR);
  appliedRiskBadge.textContent = `적용 리스크 ${getAppliedRiskPercent().toFixed(2)}%`;
  dashModeBadge.textContent = `${modeEl.value} 모드`;
  stepCumR.textContent = `${cumR.toFixed(2)}R`;
  stepLevel.textContent = String(getStepLevel(cumR));
  nextRiskScale.textContent = `${scale.toFixed(2)}x`;
}

function applyThemeFromSettings() {
  const settings = loadSettings();
  document.documentElement.style.setProperty('--accent', settings.accent);
}

function fillSettingsForm() {
  const settings = loadSettings();
  setDayRisk.value = settings.dayRisk;
  setWeekRisk.value = settings.weekRisk;
  setGreenRisk.value = settings.signalRisk.green;
  setYellowRisk.value = settings.signalRisk.yellow;
  setRedRisk.value = settings.signalRisk.red;
  setAccent.value = settings.accent;
}

function syncDashboardConfigView() {
  const settings = loadSettings();
  dayRiskView.textContent = `${Number(settings.dayRisk).toFixed(1)}%`;
  weekRiskView.textContent = `${Number(settings.weekRisk).toFixed(1)}%`;
  const totalOpenRisk = loadPositions().reduce((sum, row) => sum + Number(row.riskAmount || 0), 0);
  torValue.textContent = formatKRW(totalOpenRisk.toFixed(0));
}

function calcRMultiple(entry, stop, exit) {
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return 0;
  return (exit - entry) / risk;
}

function renderStats(rows) {
  const total = rows.length;
  const rValues = rows.map((r) => Number(r.rMultiple || 0));
  const wins = rValues.filter((r) => r > 0).length;
  const sumR = rValues.reduce((a, b) => a + b, 0);
  const avgR = total ? sumR / total : 0;

  dTotal.textContent = String(total);
  dWin.textContent = `${total ? ((wins / total) * 100).toFixed(1) : 0}%`;
  dPnlR.textContent = `${sumR.toFixed(2)}R`;
  dPnlR.className = sumR >= 0 ? 'pnl-positive' : 'pnl-negative';
  dAvgR.textContent = `${avgR.toFixed(2)}R`;
}

function renderRows() {
  const rows = loadRows();
  journalBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    const rClass = row.rMultiple >= 0 ? 'pnl-positive' : 'pnl-negative';
    const pnlClass = row.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.symbol}</td>
      <td class="${rClass}">${Number(row.rMultiple).toFixed(2)}R</td>
      <td class="${pnlClass}">${formatKRW(row.pnl.toFixed(0))}</td>
      <td class="muted">${row.tag || '-'}</td>
      <td class="muted">${row.note || '-'}</td>
      <td><button class="small-btn btn-ghost" data-remove="${idx}">삭제</button></td>
    `;
    journalBody.appendChild(tr);
  });

  renderStats(rows);
}


function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function renderPositions() {
  const rows = loadPositions();
  positionsBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.entryDate}</td>
      <td>${row.sellDate}</td>
      <td>${row.symbol}</td>
      <td>${Math.floor(row.qty)}</td>
      <td>${row.entry.toFixed(2)}</td>
      <td>${row.stop.toFixed(2)}</td>
      <td>
        <button class="small-btn btn-primary" data-pos-close="${idx}">청산</button>
        <button class="small-btn btn-ghost" data-pos-remove="${idx}">삭제</button>
      </td>
    `;
    positionsBody.appendChild(tr);
  });
}

function calcPnl({ entry, exit, qty, fee }) {
  return (exit - entry) * qty - fee;
}

function getTargetPrice(entry, stop, r) {
  const perUnitRisk = Math.abs(entry - stop);
  return entry > stop ? entry + perUnitRisk * r : entry - perUnitRisk * r;
}

function renderRangePopup(calc) {
  rangeBody.innerHTML = '';
  for (let r = 1; r <= 10; r += 1) {
    const targetPrice = getTargetPrice(calc.entry, calc.stop, r);
    const expectedProfit = calc.riskAmount * r;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r}R</td>
      <td>${targetPrice.toFixed(2)}</td>
      <td>${formatKRW(expectedProfit.toFixed(0))}</td>
    `;
    rangeBody.appendChild(tr);
  }
}

function exportAllData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    journal: loadRows(),
    positions: loadPositions(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chuse-trend-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importAllData(payload) {
  if (payload.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload.settings));
  if (payload.journal) localStorage.setItem(JOURNAL_KEY, JSON.stringify(payload.journal));
  if (payload.positions) localStorage.setItem(POSITIONS_KEY, JSON.stringify(payload.positions));

  fillSettingsForm();
  applyThemeFromSettings();
  syncDashboardConfigView();
  applyRiskPreset();
  updateRiskPreview();
  renderRows();
  renderPositions();
}

function syncAllViews() {
  syncDashboardConfigView();
  renderRows();
  renderPositions();
  updateRiskPreview();
}

menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    menuButtons.forEach((b) => b.classList.toggle('active', b === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === target));
  });
});

modeEl.addEventListener('change', () => {
  applyRiskPreset();
  updateRiskPreview();
});

signalEl.addEventListener('change', updateRiskPreview);

riskModeEl.addEventListener('change', () => {
  applyRiskPreset();
  updateRiskPreview();
});

riskEl.addEventListener('input', updateRiskPreview);

calcForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const capitalMillion = Number(document.getElementById('capital').value);
  const capital = capitalMillion * 1000000;
  const entry = Number(document.getElementById('entry').value);
  const stop = Number(document.getElementById('stop').value);
  const targetR = Number(document.getElementById('targetR').value || 2);

  const appliedRiskPercent = getAppliedRiskPercent();
  const riskAmount = capital * (appliedRiskPercent / 100);
  const perUnitRisk = Math.abs(entry - stop);

  if (perUnitRisk <= 0) {
    calcResult.textContent = '진입가와 손절가가 같을 수 없습니다.';
    return;
  }

  const qtyRaw = riskAmount / perUnitRisk;
  const qty = Math.floor(qtyRaw);
  const positionAmount = qty * entry;
  if (qty < 1) {
    calcResult.textContent = "리스크 기준으로 계산된 수량이 1 미만입니다. 리스크 또는 손절폭을 조정해주세요.";
    return;
  }

  const lossWidthPercent = entry ? (perUnitRisk / entry) * 100 : 0;
  const targetPrice = getTargetPrice(entry, stop, targetR);
  const expectedProfit = riskAmount * targetR;

  lastCalc = {
    symbol: calcSymbolEl.value.trim().toUpperCase(),
    mode: modeEl.value,
    signal: signalEl.value,
    appliedRiskPercent,
    capital,
    entry,
    stop,
    targetR,
    perUnitRisk,
    lossWidthPercent,
    riskAmount,
    qty,
    qtyRaw,
    positionAmount,
  };

  calcResult.innerHTML = `
    모드: <strong>${modeEl.value}</strong> · 신호등: <strong>${signalEl.value.toUpperCase()}</strong><br>
    적용 리스크: <strong>${appliedRiskPercent.toFixed(2)}%</strong><br>
    손실폭(가격차): <strong>${perUnitRisk.toFixed(2)}</strong> (${lossWidthPercent.toFixed(2)}%)<br>
    최대 손실금액: <strong>${formatKRW(riskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty}</strong> <span class="muted">(금액: ${formatKRW(positionAmount.toFixed(0))})</span><br>
    도달가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
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
  const entryDate = toDateString(new Date());
  rows.unshift({
    createdAt: new Date().toLocaleString('ko-KR'),
    entryDate,
    sellDate: addDays(entryDate, 5),
    symbol: lastCalc.symbol || '-',
    qty: Math.floor(lastCalc.qty),
    entry: lastCalc.entry,
    stop: lastCalc.stop,
    riskAmount: lastCalc.riskAmount,
  });
  savePositions(rows);
  renderPositions();
  alert('포지션이 추가되었습니다.');
});

positionsBody.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-pos-close]');
  if (closeBtn) {
    activeCloseIndex = Number(closeBtn.dataset.posClose);
    const rows = loadPositions();
    const row = rows[activeCloseIndex];
    if (!row) return;
    closeDialogInfo.textContent = `${row.symbol} · 보유수량 ${Math.floor(row.qty)} · 진입가 ${row.entry.toFixed(2)}`;
    closeExitPriceEl.value = '';
    closeDialog.showModal();
    return;
  }

  const delBtn = e.target.closest('[data-pos-remove]');
  if (!delBtn) return;
  const idx = Number(delBtn.dataset.posRemove);
  const rows = loadPositions();
  rows.splice(idx, 1);
  savePositions(rows);
  renderPositions();
});


closeDialogCloseBtn.addEventListener('click', () => closeDialog.close());

closeRatioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (activeCloseIndex === null) return;
    const ratio = Number(btn.dataset.closeRatio);
    const exitPrice = Number(closeExitPriceEl.value);
    if (!exitPrice || exitPrice <= 0) {
      alert('청산가를 입력해주세요.');
      return;
    }

    const positions = loadPositions();
    const pos = positions[activeCloseIndex];
    if (!pos) return;

    const closeQty = ratio === 1 ? Math.floor(pos.qty) : Math.max(1, Math.floor(pos.qty * ratio));
    const safeCloseQty = Math.min(Math.floor(pos.qty), closeQty);

    const journal = loadRows();
    const item = {
      date: toDateString(new Date()),
      symbol: pos.symbol,
      entry: pos.entry,
      stop: pos.stop,
      exit: exitPrice,
      qty: safeCloseQty,
      fee: 0,
      tag: `포지션청산 ${Math.round(ratio * 100)}%`,
      note: '포지션 메뉴에서 청산 처리',
    };
    item.pnl = calcPnl(item);
    item.rMultiple = calcRMultiple(item.entry, item.stop, item.exit);
    journal.unshift(item);
    saveRows(journal);

    pos.qty = Math.floor(pos.qty) - safeCloseQty;
    if (pos.qty <= 0) {
      positions.splice(activeCloseIndex, 1);
    } else {
      positions[activeCloseIndex] = pos;
    }
    savePositions(positions);

    closeDialog.close();
    activeCloseIndex = null;
    syncAllViews();
  });
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
    entry: Number(document.getElementById('jEntry').value),
    stop: Number(document.getElementById('jStop').value),
    exit: Number(document.getElementById('jExit').value),
    qty: Math.floor(Number(document.getElementById('jQty').value)),
    fee: Number(document.getElementById('jFee').value || 0),
    tag: document.getElementById('jTag').value.trim(),
    note: document.getElementById('jNote').value.trim(),
  };

  item.pnl = calcPnl(item);
  item.rMultiple = calcRMultiple(item.entry, item.stop, item.exit);

  const rows = loadRows();
  rows.unshift(item);
  saveRows(rows);
  journalForm.reset();
  syncAllViews();
});

journalBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  const rows = loadRows();
  rows.splice(idx, 1);
  saveRows(rows);
  syncAllViews();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('저널 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(JOURNAL_KEY);
  syncAllViews();
});

settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const next = {
    dayRisk: Number(setDayRisk.value || defaultSettings.dayRisk),
    weekRisk: Number(setWeekRisk.value || defaultSettings.weekRisk),
    signalRisk: {
      green: Number(setGreenRisk.value || defaultSettings.signalRisk.green),
      yellow: Number(setYellowRisk.value || defaultSettings.signalRisk.yellow),
      red: Number(setRedRisk.value || defaultSettings.signalRisk.red),
    },
    accent: setAccent.value || defaultSettings.accent,
  };

  saveSettings(next);
  applyThemeFromSettings();
  applyRiskPreset();
  syncAllViews();
  settingsStatus.textContent = '설정이 저장되었습니다.';
});

resetSettingsBtn.addEventListener('click', () => {
  saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  applyRiskPreset();
  syncAllViews();
  settingsStatus.textContent = '기본값으로 복원되었습니다.';
});

exportDataBtn.addEventListener('click', () => {
  exportAllData();
  settingsStatus.textContent = '데이터를 내보냈습니다.';
});

importDataBtn.addEventListener('click', () => importFileEl.click());

importFileEl.addEventListener('change', async () => {
  const file = importFileEl.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    importAllData(parsed);
    settingsStatus.textContent = '데이터를 불러왔습니다.';
  } catch {
    settingsStatus.textContent = '불러오기 실패: JSON 파일을 확인해주세요.';
  } finally {
    importFileEl.value = '';
  }
});

function init() {
  if (!localStorage.getItem(SETTINGS_KEY)) saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  applyRiskPreset();
  syncAllViews();
}

init();
