const calcForm = document.getElementById('calc-form');
const calcResult = document.getElementById('calc-result');

function formatKRW(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

calcForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const capital = Number(document.getElementById('capital').value);
  const riskPercent = Number(document.getElementById('riskPercent').value);
  const entry = Number(document.getElementById('entry').value);
  const stop = Number(document.getElementById('stop').value);
  const targetR = Number(document.getElementById('targetR').value || 2);

  const riskAmount = capital * (riskPercent / 100);
  const perUnitRisk = Math.abs(entry - stop);

  if (perUnitRisk <= 0) {
    calcResult.textContent = '진입가와 손절가가 같을 수 없습니다.';
    return;
  }

  const qty = riskAmount / perUnitRisk;
  const targetPrice = entry > stop ? entry + perUnitRisk * targetR : entry - perUnitRisk * targetR;
  const expectedProfit = riskAmount * targetR;

  calcResult.innerHTML = `
    허용 손실: <strong>${formatKRW(riskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty.toFixed(4)}</strong><br>
    목표가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
    기대 수익: <strong>${formatKRW(expectedProfit.toFixed(0))}</strong>
  `;
});

const STORAGE_KEY = 'trade_journal_v1';
const journalForm = document.getElementById('journal-form');
const journalBody = document.getElementById('journal-body');
const clearAllBtn = document.getElementById('clear-all');

const sTotal = document.getElementById('sTotal');
const sWin = document.getElementById('sWin');
const sPnl = document.getElementById('sPnl');
const sAvg = document.getElementById('sAvg');

const loadJournal = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const saveJournal = (rows) => localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));

function calcPnl({ side, entry, exit, qty, fee }) {
  const diff = side === 'Long' ? exit - entry : entry - exit;
  return diff * qty - fee;
}

function renderStats(rows) {
  const total = rows.length;
  const pnls = rows.map(r => r.pnl);
  const wins = pnls.filter(p => p > 0).length;
  const sum = pnls.reduce((a, b) => a + b, 0);
  const avg = total ? sum / total : 0;

  sTotal.textContent = String(total);
  sWin.textContent = `${total ? ((wins / total) * 100).toFixed(1) : 0}%`;
  sPnl.textContent = formatKRW(sum.toFixed(0));
  sPnl.className = sum >= 0 ? 'pnl-positive' : 'pnl-negative';
  sAvg.textContent = formatKRW(avg.toFixed(0));
}

function renderRows() {
  const rows = loadJournal();
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
  const rows = loadJournal();
  rows.unshift(item);
  saveJournal(rows);
  journalForm.reset();
  renderRows();
});

journalBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  const rows = loadJournal();
  rows.splice(idx, 1);
  saveJournal(rows);
  renderRows();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('저널 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderRows();
});

renderRows();
