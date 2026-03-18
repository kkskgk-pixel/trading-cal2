// ===== 로컬스토리지 키 (LocalStorage Keys) =====
const JOURNAL_KEY = 'trade_journal_v6';
const SETTINGS_KEY = 'trade_settings_v4';
const POSITIONS_KEY = 'trade_positions_v3';

// ===== 기본 설정값 (Default Settings) =====
const defaultSettings = {
  dayRisk: 1.0,
  weekRisk: 2.5,
  signalRisk: { green: 5.0, yellow: 3.0, red: 1.0 },
  accent: '#7c8bff',
};

// ===== 상태 변수 (State Variables) =====
let lastCalc = null;
let activeCloseIndex = null;
let equityChart = null; // Chart.js 차트 인스턴스

// ===== DOM 요소 선택 (DOM Element References) =====
const menuButtons = [...document.querySelectorAll('.menu-btn')];
const views = [...document.querySelectorAll('.view')];

const modeEl = document.getElementById('mode');
const signalEl = document.getElementById('signal');
const riskModeEl = document.getElementById('riskMode');
const riskEl = document.getElementById('riskPercent');
const calcForm = document.getElementById('calc-form');
const calcResult = document.getElementById('calc-result');
const appliedRiskBadge = document.getElementById('appliedRiskBadge');
const addPositionBtn = document.getElementById('add-position');
const openRangeBtn = document.getElementById('open-range');
const rangeDialog = document.getElementById('range-dialog');
const closeRangeBtn = document.getElementById('close-range');
const rangeBody = document.getElementById('range-body');
const calcSymbolEl = document.getElementById('calcSymbol');
const calcSellDateEl = document.getElementById('calcSellDate');

const dTotal = document.getElementById('dTotal');
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

const toastContainer = document.getElementById('toast-container');
const bestTagEl = document.getElementById('bestTag');
const mddValueEl = document.getElementById('mddValue');
const positionForm = document.getElementById('position-form'); // 포지션 직접 추가 폼


// ===== 유틸리티 함수 (Utility Functions) =====

/** 원화 형식으로 숫자를 포맷 */
function formatKRW(n) {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

/** 날짜를 YYYY-MM-DD 문자열로 변환 */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

/** 날짜 문자열에 일수 추가 */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}


// ===== 토스트 알림 (Toast Notification) =====

/** 부드러운 토스트 메시지를 하단에 표시 (alert 대체) */
function showToast(message, type = 'default') {
  const toast = document.createElement('div');
  toast.className = 'toast';

  // 메시지 유형에 따라 아이콘 추가
  const icon = type === 'success' ? '✅ ' : type === 'error' ? '❌ ' : 'ℹ️ ';
  toast.textContent = icon + message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-fadeout');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2800);
}


// ===== 로컬스토리지 입출력 (LocalStorage I/O) =====

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


// ===== 리스크 계산 로직 (Risk Calculation Logic) =====

function getModeDefaultRisk(mode) {
  const settings = loadSettings();
  return mode === 'WEEK' ? Number(settings.weekRisk) : Number(settings.dayRisk);
}

/** 누적 R에 따른 스텝 레벨 계산 (+10R마다 레벨 증가) */
function getStepLevel(cumulativeR) {
  if (cumulativeR >= 0) return Math.floor(cumulativeR / 10);
  return Math.ceil(cumulativeR / 10);
}

/** 스텝 레벨에 따른 리스크 배율 계산 (최소 0.1배) */
function getRiskScaleByCumulativeR(cumulativeR) {
  const step = getStepLevel(cumulativeR);
  return Math.max(0.1, 1 + step * 0.1);
}

/** 저널에서 총 누적 R 계산 */
function getCumulativeR() {
  return loadRows().reduce((sum, row) => sum + Number(row.rMultiple || 0), 0);
}

/** 모드 또는 수동 설정에 따라 리스크 퍼센트 입력란 업데이트 */
function applyRiskPreset() {
  if (riskModeEl.value === 'mode') {
    riskEl.value = String(getModeDefaultRisk(modeEl.value));
  }
}

/** 누적 R 배율이 적용된 최종 리스크 퍼센트 반환 */
function getAppliedRiskPercent() {
  const baseRisk = Number(riskEl.value || 0);
  const scale = getRiskScaleByCumulativeR(getCumulativeR());
  return baseRisk * scale;
}


// ===== UI 업데이트 함수 (UI Update Functions) =====

/** 계산기 배지 및 대시보드 스텝 정보 업데이트 */
function updateRiskPreview() {
  const cumR = getCumulativeR();
  const scale = getRiskScaleByCumulativeR(cumR);
  appliedRiskBadge.textContent = `적용 리스크 ${getAppliedRiskPercent().toFixed(2)}%`;
  // DAY/WEEK 모드 토글 버튼 동기화
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === modeEl.value);
  });
  stepCumR.textContent = `${cumR.toFixed(2)}R`;
  stepLevel.textContent = String(getStepLevel(cumR));
  nextRiskScale.textContent = `${scale.toFixed(2)}x`;
}

/** CSS 커스텀 프로퍼티를 통해 강조색 테마 적용 */
function applyThemeFromSettings() {
  const settings = loadSettings();
  document.documentElement.style.setProperty('--accent', settings.accent);
}

/** 설정 폼에 저장된 값 채우기 */
function fillSettingsForm() {
  const settings = loadSettings();
  setDayRisk.value = settings.dayRisk;
  setWeekRisk.value = settings.weekRisk;
  setGreenRisk.value = settings.signalRisk.green;
  setYellowRisk.value = settings.signalRisk.yellow;
  setRedRisk.value = settings.signalRisk.red;
  setAccent.value = settings.accent;
}

/** 대시보드 설정 정보(리스크%, TOR) 업데이트 */
function syncDashboardConfigView() {
  const settings = loadSettings();
  dayRiskView.textContent = `${Number(settings.dayRisk).toFixed(1)}%`;
  weekRiskView.textContent = `${Number(settings.weekRisk).toFixed(1)}%`;
  // TOR 계산: 포지션별로 |진입가 - 손절가| × 수량 합산
  // riskAmount가 있으면 우선 사용, 없으면 직접 계산
  const totalOpenRisk = loadPositions().reduce((sum, row) => {
    const directRisk = Math.abs(Number(row.entry || 0) - Number(row.stop || 0)) * Number(row.qty || 0);
    return sum + (directRisk > 0 ? directRisk : Number(row.riskAmount || 0));
  }, 0);
  torValue.textContent = formatKRW(totalOpenRisk.toFixed(0));
}


// ===== 차트 및 고급 분석 (Chart & Advanced Analytics) =====

/** 저널 데이터를 기반으로 누적 수익 곡선 차트 업데이트 */
function updateChart(rows) {
  const ctx = document.getElementById('equityChart').getContext('2d');
  // 저장 순서가 최신 → 과거이므로 역순 정렬
  const sortedRows = [...rows].reverse();

  let cumEquity = 0;
  const labels = ['시작'];
  const data = [0];
  const pointColors = ['rgba(124, 139, 255, 0.5)'];

  sortedRows.forEach((row, i) => {
    cumEquity += Number(row.rMultiple || 0);
    labels.push(`#${i + 1}`);
    data.push(Number(cumEquity.toFixed(2)));
    // 수익/손실에 따라 포인트 색상 분류
    pointColors.push(Number(row.rMultiple || 0) >= 0 ? '#16c784' : '#ff5f7e');
  });

  // 기존 차트 인스턴스가 있으면 제거 후 재생성
  if (equityChart) {
    equityChart.destroy();
  }

  equityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '누적 R',
        data,
        borderColor: 'var(--accent, #7c8bff)',
        backgroundColor: 'rgba(124, 139, 255, 0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: pointColors,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 51, 0.9)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          titleColor: '#9ba9cd',
          bodyColor: '#eaf0ff',
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toFixed(2)}R`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ba9cd', font: { size: 11 }, maxTicksLimit: 10 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#9ba9cd', font: { size: 11 }, callback: (v) => `${v}R` },
        },
      },
    },
  });
}

/** MDD(최대 낙폭) 및 전략 태그별 성과 분석 */
function analyzePerformance(rows) {
  if (rows.length === 0) {
    if (bestTagEl) bestTagEl.textContent = '-';
    if (mddValueEl) mddValueEl.textContent = '0.00R';
    return;
  }

  // --- 전략별 수익 집계 ---
  const strategyStats = {};
  rows.forEach(row => {
    if (!row.tag) return;
    // 쉼표로 구분된 복수 태그 지원
    const tags = row.tag.split(',').map(s => s.trim()).filter(Boolean);
    tags.forEach(tag => {
      if (!strategyStats[tag]) strategyStats[tag] = { count: 0, sumR: 0, wins: 0 };
      strategyStats[tag].count++;
      const r = Number(row.rMultiple || 0);
      strategyStats[tag].sumR += r;
      if (r > 0) strategyStats[tag].wins++;
    });
  });

  let bestTag = '-';
  let maxR = -Infinity;
  for (const tag in strategyStats) {
    if (strategyStats[tag].sumR > maxR) {
      maxR = strategyStats[tag].sumR;
      const winRate = ((strategyStats[tag].wins / strategyStats[tag].count) * 100).toFixed(0);
      bestTag = `${tag} (${maxR.toFixed(1)}R, 승률 ${winRate}%)`;
    }
  }
  if (bestTagEl) bestTagEl.textContent = bestTag;

  // --- MDD(Maximum Drawdown) 계산 ---
  let peak = 0;
  let mdd = 0;
  let cumPnl = 0;
  // 시간순 정렬(오래된 것부터)
  [...rows].reverse().forEach(row => {
    cumPnl += Number(row.rMultiple || 0);
    if (cumPnl > peak) peak = cumPnl;
    const drawdown = peak - cumPnl;
    if (drawdown > mdd) mdd = drawdown;
  });
  if (mddValueEl) mddValueEl.textContent = `${mdd.toFixed(2)}R`;
}


// ===== 손익 계산 (PnL Calculation) =====

/** 포지션 손익 계산 (수수료 포함) */
function calcPnl({ entry, exit, qty, fee }) {
  return (exit - entry) * qty - fee;
}

/** R-Multiple 계산 */
function calcRMultiple(entry, stop, exit) {
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return 0;
  return (exit - entry) / risk;
}

/** 목표 R배수에 해당하는 목표가 계산 */
function getTargetPrice(entry, stop, r) {
  const perUnitRisk = Math.abs(entry - stop);
  return entry > stop ? entry + perUnitRisk * r : entry - perUnitRisk * r;
}


// ===== 대시보드 통계 렌더링 (Dashboard Stats) =====

function renderStats(rows) {
  const total = rows.length;
  const rValues = rows.map((r) => Number(r.rMultiple || 0));
  const sumR = rValues.reduce((a, b) => a + b, 0);
  const avgR = total ? sumR / total : 0;

  dTotal.textContent = String(total);
  dPnlR.textContent = `${sumR.toFixed(2)}R`;
  dPnlR.className = sumR >= 0 ? 'pnl-positive' : 'pnl-negative';
  dAvgR.textContent = `${avgR.toFixed(2)}R`;
}


// ===== 저널 테이블 렌더링 (Journal Table) =====

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


// ===== 포지션 테이블 렌더링 (Position Table) =====

function renderPositions() {
  const rows = loadPositions();
  positionsBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    const mode = row.mode || 'DAY';
    const modeLabel = mode === 'WEEK' ? '주봉' : '일봉';
    const modeCls = mode === 'WEEK' ? 'badge-week' : 'badge-day';
    tr.innerHTML = `
      <td>${row.entryDate}</td>
      <td><input class="tbl-input tbl-date" type="date" value="${row.sellDate || ''}" data-field="sellDate" data-idx="${idx}" /></td>
      <td>${row.symbol}</td>
      <td><input class="tbl-input tbl-num" type="number" min="1" step="1" value="${Math.floor(row.qty)}" data-field="qty" data-idx="${idx}" /></td>
      <td><input class="tbl-input tbl-num" type="number" value="${Math.round(row.entry)}" data-field="entry" data-idx="${idx}" /></td>
      <td><input class="tbl-input tbl-num" type="number" value="${Math.round(row.stop)}" data-field="stop" data-idx="${idx}" /></td>
      <td><span class="${modeCls}">${modeLabel}</span></td>
      <td>
        <button class="small-btn btn-primary" data-pos-close="${idx}">청산</button>
        <button class="small-btn btn-ghost" data-pos-remove="${idx}">삭제</button>
      </td>
    `;
    positionsBody.appendChild(tr);
  });
}


// ===== R 범위 팝업 렌더링 (R Range Popup) =====

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


// ===== 데이터 내보내기/불러오기 (Export / Import) =====

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
  syncAllViews();
}


// ===== 전체 뷰 동기화 (Sync All Views) =====

/** 모든 화면 요소를 최신 데이터로 한 번에 새로고침 */
function syncAllViews() {
  const rows = loadRows();

  syncDashboardConfigView();
  renderRows();
  renderPositions();
  updateRiskPreview();
  updateChart(rows);
  analyzePerformance(rows);
}


// ===== 이벤트 리스너 (Event Listeners) =====

// --- 네비게이션 메뉴 ---
menuButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    menuButtons.forEach((b) => b.classList.toggle('active', b === btn));
    views.forEach((v) => v.classList.toggle('active', v.id === target));
  });
});

// --- DAY/WEEK 모드 토글 (대시보드) ---
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    modeEl.value = btn.dataset.mode; // 쪼럼레이터 select와 동기화
    applyRiskPreset();
    updateRiskPreview();
    showToast(`${btn.dataset.mode} 모드로 전환되었습니다.`, 'success');
  });
});

// --- 계산기 입력 변경 ---
modeEl.addEventListener('change', () => {
  // 대시보드 동기화
  document.querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === modeEl.value);
  });
  applyRiskPreset();
  updateRiskPreview();
});
// 시장 신호등(signal)과 리스크 기준(riskMode)은 UI에서 제거됨
// 기존 코드 호환성을 위해 hidden 상태로 유지
riskEl.addEventListener('input', updateRiskPreview);

// --- 포지션 사이징 계산 ---
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
    calcResult.textContent = '리스크 기준으로 계산된 수량이 1 미만입니다. 리스크 또는 손절폭을 조정해주세요.';
    return;
  }

  const lossWidthPercent = entry ? (perUnitRisk / entry) * 100 : 0;
  const targetPrice = getTargetPrice(entry, stop, targetR);
  const expectedProfit = riskAmount * targetR;

  lastCalc = {
    symbol: calcSymbolEl.value.trim().toUpperCase(),
    mode: modeEl.value,
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
    모드: <strong>${modeEl.value}</strong><br>
    적용 리스크: <strong>${appliedRiskPercent.toFixed(2)}%</strong><br>
    손실폭(가격차): <strong>${perUnitRisk.toFixed(2)}</strong> (${lossWidthPercent.toFixed(2)}%)<br>
    최대 손실금액: <strong>${formatKRW(riskAmount.toFixed(0))}</strong><br>
    추천 수량: <strong>${qty}</strong> <span class="muted">(금액: ${formatKRW(positionAmount.toFixed(0))})</span><br>
    도달가(${targetR}R): <strong>${targetPrice.toFixed(2)}</strong><br>
    기대 수익: <strong>${formatKRW(expectedProfit.toFixed(0))}</strong>
  `;

  updateRiskPreview();
});

// --- 1R~10R 도달가 팝업 ---
openRangeBtn.addEventListener('click', () => {
  if (!lastCalc) {
    showToast('먼저 계산을 실행해주세요.', 'error');
    return;
  }
  renderRangePopup(lastCalc);
  rangeDialog.showModal();
});
closeRangeBtn.addEventListener('click', () => rangeDialog.close());

// --- 포지션 추가 (계산기에서) ---
addPositionBtn.addEventListener('click', () => {
  if (!lastCalc) {
    showToast('먼저 계산을 실행해주세요.', 'error');
    return;
  }

  const rows = loadPositions();
  const entryDate = toDateString(new Date());
  const currentMode = modeEl.value;
  // 매도예정일: 달력에서 직접 선택한 값 우선, 없으면 D+5(일봉)/D+7(주봉) 자동 계산
  const userSellDate = calcSellDateEl ? calcSellDateEl.value : '';
  const autoSellDate = addDays(entryDate, currentMode === 'WEEK' ? 7 : 5);
  rows.unshift({
    createdAt: new Date().toLocaleString('ko-KR'),
    entryDate,
    sellDate: userSellDate || autoSellDate,
    symbol: lastCalc.symbol || '-',
    qty: Math.floor(lastCalc.qty),
    entry: Math.round(lastCalc.entry),
    stop: Math.round(lastCalc.stop),
    riskAmount: lastCalc.riskAmount,
    mode: currentMode,
  });
  savePositions(rows);
  renderPositions();
  syncDashboardConfigView();
  showToast(`${lastCalc.symbol || '포지션'}이 추가되었습니다.`, 'success');
});

// --- 포지션 직접 추가 폼 ---
positionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const entryDate = document.getElementById('pEntryDate').value;
  const pSellDateVal = document.getElementById('pSellDate').value;
  const mode = document.getElementById('pMode').value;
  const symbol = document.getElementById('pSymbol').value.trim().toUpperCase();
  // 매도일: 직접 입력했으면 사용, 없으면 주봉 7일/일봉 5일 자동계산
  const sellDate = pSellDateVal || addDays(entryDate, mode === 'WEEK' ? 7 : 5);
  const positions = loadPositions();
  positions.unshift({
    createdAt: new Date().toLocaleString('ko-KR'),
    entryDate,
    sellDate,
    symbol,
    qty: Math.floor(Number(document.getElementById('pQty').value)),
    entry: Math.round(Number(document.getElementById('pEntry').value)),
    stop: Math.round(Number(document.getElementById('pStop').value)),
    riskAmount: 0,
    mode,
  });
  savePositions(positions);
  positionForm.reset();
  // 리셋 후 날짜/모드 기본값 복원
  document.getElementById('pEntryDate').value = toDateString(new Date());
  document.getElementById('pSellDate').value = addDays(toDateString(new Date()), mode === 'WEEK' ? 7 : 5);
  document.getElementById('pMode').value = mode;
  renderPositions();
  syncDashboardConfigView();
  showToast(`포지션 추가: ${symbol}`, 'success');
});

// --- 포지션 인라인 편집 자동저장 (매도일·진입가·손절가·수량 변경 시) ---
positionsBody.addEventListener('change', (e) => {
  const input = e.target.closest('[data-field][data-idx]');
  if (!input) return;
  const idx = Number(input.dataset.idx);
  const field = input.dataset.field;
  const positions = loadPositions();
  if (!positions[idx]) return;
  if (field === 'sellDate') {
    positions[idx].sellDate = input.value;
  } else if (field === 'entry' || field === 'stop') {
    positions[idx][field] = Math.round(Number(input.value));
  } else if (field === 'qty') {
    // 수량 수정: 최소 1 이상으로 저장
    const newQty = Math.max(1, Math.floor(Number(input.value)));
    positions[idx].qty = newQty;
    input.value = newQty; // 입력창도 정수로 보정
  }
  savePositions(positions);
  // 수량/진입가/손절가 변경 시 TOR 재계산
  syncDashboardConfigView();
  showToast('포지션이 수정되었습니다.', 'success');
});

// --- 포지션 청산 및 삭제 (이벤트 위임) ---
positionsBody.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-pos-close]');
  if (closeBtn) {
    activeCloseIndex = Number(closeBtn.dataset.posClose);
    const rows = loadPositions();
    const row = rows[activeCloseIndex];
    if (!row) return;
    closeDialogInfo.textContent = `${row.symbol} · 보유수량 ${Math.floor(row.qty)} · 진입가 ${Math.round(row.entry)}`;
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
  syncDashboardConfigView();
  showToast('포지션이 삭제되었습니다.');
});

// --- 청산 다이얼로그 닫기 ---
closeDialogCloseBtn.addEventListener('click', () => closeDialog.close());

// --- 청산 비율 버튼 처리 ---
closeRatioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (activeCloseIndex === null) return;
    const ratio = Number(btn.dataset.closeRatio);
    const exitPrice = Number(closeExitPriceEl.value);
    if (!exitPrice || exitPrice <= 0) {
      showToast('청산가를 입력해주세요.', 'error');
      return;
    }

    const positions = loadPositions();
    const pos = positions[activeCloseIndex];
    if (!pos) return;

    const closeQty = ratio === 1 ? Math.floor(pos.qty) : Math.max(1, Math.floor(pos.qty * ratio));
    const safeCloseQty = Math.min(Math.floor(pos.qty), closeQty);

    // 저널에 청산 내역 자동 기록
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

    // 남은 수량 업데이트 또는 포지션 제거
    pos.qty = Math.floor(pos.qty) - safeCloseQty;
    if (pos.qty <= 0) {
      positions.splice(activeCloseIndex, 1);
    } else {
      positions[activeCloseIndex] = pos;
    }
    savePositions(positions);

    closeDialog.close();
    activeCloseIndex = null;

    const rLabel = item.rMultiple >= 0 ? `+${item.rMultiple.toFixed(2)}R` : `${item.rMultiple.toFixed(2)}R`;
    showToast(`청산 완료: ${pos.symbol} ${rLabel}`, item.rMultiple >= 0 ? 'success' : 'default');
    syncAllViews();
  });
});

// --- 포지션 전체 삭제 ---
clearPositionsBtn.addEventListener('click', () => {
  if (!confirm('포지션 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(POSITIONS_KEY);
  renderPositions();
  syncDashboardConfigView();
  showToast('포지션 데이터가 삭제되었습니다.');
});

// --- 저널 저장 ---
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

  const rLabel = item.rMultiple >= 0 ? `+${item.rMultiple.toFixed(2)}R` : `${item.rMultiple.toFixed(2)}R`;
  showToast(`저널 저장: ${item.symbol} ${rLabel}`, item.rMultiple >= 0 ? 'success' : 'default');
  syncAllViews();
});

// --- 저널 행 삭제 (이벤트 위임) ---
journalBody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const idx = Number(btn.dataset.remove);
  const rows = loadRows();
  rows.splice(idx, 1);
  saveRows(rows);
  showToast('저널 항목이 삭제되었습니다.');
  syncAllViews();
});

// --- 저널 전체 삭제 ---
clearAllBtn.addEventListener('click', () => {
  if (!confirm('저널 데이터를 모두 삭제할까요?')) return;
  localStorage.removeItem(JOURNAL_KEY);
  showToast('저널 데이터가 삭제되었습니다.');
  syncAllViews();
});

// --- 설정 저장 ---
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
  showToast('설정이 저장되었습니다.', 'success');
});

// --- 설정 기본값 복원 ---
resetSettingsBtn.addEventListener('click', () => {
  saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  applyRiskPreset();
  syncAllViews();
  settingsStatus.textContent = '기본값으로 복원되었습니다.';
  showToast('기본값으로 복원되었습니다.');
});

// --- 데이터 내보내기 ---
exportDataBtn.addEventListener('click', () => {
  exportAllData();
  settingsStatus.textContent = '데이터를 내보냈습니다.';
  showToast('데이터 내보내기 완료!', 'success');
});

// --- 데이터 불러오기 ---
importDataBtn.addEventListener('click', () => importFileEl.click());

importFileEl.addEventListener('change', async () => {
  const file = importFileEl.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    importAllData(parsed);
    settingsStatus.textContent = '데이터를 불러왔습니다.';
    showToast('데이터 불러오기 완료!', 'success');
  } catch {
    settingsStatus.textContent = '불러오기 실패: JSON 파일을 확인해주세요.';
    showToast('불러오기 실패: 올바른 JSON 파일인지 확인해주세요.', 'error');
  } finally {
    importFileEl.value = '';
  }
});


// ===== 초기화 (Initialization) =====

function init() {
  // 설정이 없으면 기본값으로 저장
  if (!localStorage.getItem(SETTINGS_KEY)) saveSettings(defaultSettings);
  fillSettingsForm();
  applyThemeFromSettings();
  applyRiskPreset();
  // 포지션 직접 추가 폼 기본값 설정
  const today = toDateString(new Date());
  const pEntryDateEl = document.getElementById('pEntryDate');
  if (pEntryDateEl) pEntryDateEl.value = today;
  const pSellDateEl = document.getElementById('pSellDate');
  if (pSellDateEl) pSellDateEl.value = addDays(today, 5);
  const pModeEl = document.getElementById('pMode');
  if (pModeEl) pModeEl.value = modeEl.value;
  // 계산기 내 매도예정일 달력 기본값 설정 (D+5)
  if (calcSellDateEl) calcSellDateEl.value = addDays(today, 5);
  syncAllViews();
}

init();
