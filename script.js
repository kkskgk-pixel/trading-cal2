const JOURNAL_KEY = 'trade_journal_v2';
const TOR_KEY = 'market_tor_v1';

const defaultTor = { green: 1.2, yellow: 1.0, red: 0.7 };

const menuButtons = [...document.querySelectorAll('.menu-btn')];
const views = [...document.querySelectorAll('.view')];

const calcForm = document.getElementById('calc-form');
const modeEl = document.getElementById('mode');
const signalEl = document.getElementById('signal');
const riskEl = document.getElementById('riskPercent');
const calcResult = document.getElementById('calc-result');

const journalForm = document.getElementById('journal-form');
const journalBody = document.getElementById('journal-body');
const clearAllBtn = document.getElementById('clear-all');

const dTotal = document.getElementById('dTotal');
const dWin = document.getElementById('dWin');
const dPnl = document.getElementById('dPnl');
const dAvg = document.getElementById('dAvg');

const torGreen = document.getElementById('torGreen');
const torYellow = document.getElementById('torYellow');
const torRed = document.getElementById('torRed');
const saveTorBtn = document.getElementById('save-tor');
const torStatus = document.getElementById('tor-status');

function formatKRW(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function loadRows() {
  return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
}

function saveRows(rows) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(rows));
}

function loadTor() {
  return { ...defaultTor, ...(JSON.parse(localStorage.getItem(TOR_KEY) || '{}')) };
}

function saveTor(tor) {
  localStorage.setItem(TOR_KEY, JSON.stringify(tor));
}

function applyModeRules() {
  if (modeEl.value === 'WEEK') {
    riskEl.value = '2.5';
    riskEl.readOnly = true;
  } else {
    riskEl.readOnly = false;
    if (!riskEl.value || Number(riskEl.value) <= 0) riskEl.value = '1';
  }
}

function calcPnl({ side, entry, exit, qty, fee }) {
  const diff = side === 'Long' ? exit - entry : entry - exit;
  return diff * qty - fee;
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
      <td><button class="small-btn ghost" data-remove="${idx}">삭제</button></td>
    `;
    journalBody.appendChild(tr);
  });

  renderStats(rows);
}

function initTorUI() {
  const tor = loadTor();
  torGreen.value = tor.green;
  torYellow.value = tor.yellow;
  torRed.value = tor.red;
}

menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    menuButtons.forEach((b) => b.classList.toggle('active', b === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === target));
  });
});

saveTorBtn.addEventListener('click', () => {
  const tor = {
    green: Number(torGreen.value || 0),
    yellow: Number(torYellow.value || 0),
    red: Number(torRed.value || 0),
  };
  saveTor(tor);
  torStatus.textContent = `저장 완료 · Green ${tor.green} / Yellow ${tor.yellow} / Red ${tor.red}`;
});

modeEl.addEventListener('change', applyModeRules);

calcForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const torMap = loadTor();
  const signal = signalEl.value;
  const tor = Number(torMap[signal] || 1);

  const capital = Number(document.getElementById('capital').value);
  const riskPercent = Number(riskEl.value);
  const entry = Number(document.getElementById('entry').value);
  const stop = Number(document.getElementById('stop').value);
  const targetR = Number(document.getElementById('targetR').value || 2);

  const baseRiskAmount = capital * (riskPercent / 100);
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
    시장 신호등: <strong>${signal.toUpperCase()}</strong> · TOR <strong>${tor}</strong><br>
    기본 리스크: <strong>${riskPercent}% (${formatKRW(baseRiskAmount.toFixed(0))})</strong><br>
    TOR 적용 리스크: <strong>${formatKRW(adjustedRiskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty.toFixed(4)}</strong><br>
    목표가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
    기대 수익: <strong>${formatKRW(expectedProfit.toFixed(0))}</strong>
  `;
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

applyModeRules();
initTorUI();
renderRows();
