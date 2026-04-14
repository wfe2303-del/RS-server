import { OTHER_COLOR, PALETTE, APP_TITLE } from './config.js';
import { appState, selectedSheet } from './state.js';
import { drawDonut } from './charts.js';
import {
  $,
  esc,
  formatCount,
  formatDateTime,
  formatKRW,
  formatPercent,
} from './utils.js';

function colorMap() {
  const map = new Map();
  (appState.applicants?.mediaList || []).forEach((item, index) => {
    map.set(item.name, PALETTE[index % PALETTE.length]);
  });
  map.set('기타(미매칭)', OTHER_COLOR);
  return map;
}

function getRowsForRendering() {
  if (!appState.results) return [];

  const rows = [...appState.results.dashboard];
  rows.push({
    name: '기타(미매칭)',
    pay: appState.results.otherCount,
    tracking: null,
    rate: null,
    amount: appState.results.otherAmount,
    amountShare: appState.results.otherAmountShare,
    isOther: true,
  });
  return rows;
}

function renderHeader() {
  document.title = APP_TITLE;

  $('syncBadge').textContent = appState.generatedAt
    ? `마지막 동기화 ${formatDateTime(appState.generatedAt)}`
    : '연결 대기 중';

  $('refreshBtn').disabled = appState.loadingCatalog || appState.loadingSheet;
}

function renderErrorBanner() {
  const banner = $('errorBanner');
  if (!appState.error) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }

  banner.classList.remove('hidden');
  banner.textContent = appState.error;
}

function renderControls() {
  const select = $('sheetSelect');
  const catalog = appState.sheetCatalog || [];

  select.innerHTML = catalog.length
    ? catalog.map((sheet) => `<option value="${sheet.sheetId}">${esc(sheet.title)}</option>`).join('')
    : '<option value="">시트 없음</option>';

  if (appState.selectedSheetId) {
    select.value = String(appState.selectedSheetId);
  } else if (catalog[0]) {
    select.value = String(catalog[0].sheetId);
  }

  $('payersBadge').textContent = appState.payers
    ? `결제 ${formatCount(appState.payers.txEntries.length)}건 로드 완료`
    : appState.loadingSheet
      ? '결제자 시트 불러오는 중'
      : '결제자 시트 미선택';

  $('applicantsBadge').textContent = appState.applicants
    ? `신청자 파일 ${appState.applicantsFileName || '업로드 완료'}`
    : '신청자 파일 미업로드';
}

function renderSummaryCards() {
  const payers = appState.payers;
  const results = appState.results;

  const totalCount = results
    ? results.totalPayCount
    : payers
      ? payers.txEntries.length + (payers.missingPhoneCount || 0)
      : 0;

  const totalAmount = results
    ? results.totalPayAmount
    : payers
      ? [...payers.txEntries].reduce((sum, entry) => sum + (entry.amount || 0), 0) + (payers.missingPhoneAmountSum || 0)
      : 0;

  const matchedCount = results ? results.totalPayCount - results.otherCount : 0;
  const matchedAmount = results ? results.totalPayAmount - results.otherAmount : 0;
  const otherAmount = results ? results.otherAmount : 0;

  $('summaryTotalCount').textContent = formatCount(totalCount);
  $('summaryTotalAmount').textContent = formatKRW(totalAmount);
  $('summaryMatchedCount').textContent = formatCount(matchedCount);
  $('summaryMatchedAmount').textContent = formatKRW(matchedAmount);
  $('summaryOtherAmount').textContent = formatKRW(otherAmount);
}

function renderResults() {
  const result = appState.results;
  const rows = getRowsForRendering();
  const colors = colorMap();

  $('resultMeta').textContent = selectedSheet()
    ? `${selectedSheet()?.title || '-'} 시트 기준 결제자와 업로드한 신청자 파일을 전화번호로 비교합니다.`
    : '결제자 시트와 신청자 파일이 모두 준비되면 매칭 결과가 표시됩니다.';

  if (!result) {
    $('summaryBadge').textContent = '대기 중';
    $('dashTbody').innerHTML = '<tr><td colspan="6" class="empty-row">매칭 실행 후 결과가 표시됩니다.</td></tr>';
    $('donutCaption').textContent = '-';
    $('barsCaption').textContent = '-';
    $('donutTotal').textContent = '0원';
    $('donutLegend').innerHTML = '<div class="empty-row">표시할 결과가 없습니다.</div>';
    $('barsWrap').innerHTML = '<div class="empty-row">표시할 결과가 없습니다.</div>';
    drawDonut($('donutCanvas'), [], 0, colors);
    return;
  }

  $('summaryBadge').textContent = `결제 ${formatCount(result.totalPayCount)}건 / 총액 ${formatKRW(result.totalPayAmount)}`;
  $('donutCaption').textContent = `유입 경로 ${formatCount(rows.length)}개`;
  $('barsCaption').textContent = '결제 총액 기준';
  $('donutTotal').textContent = formatKRW(result.totalPayAmount);

  $('dashTbody').innerHTML = rows.map((row) => `
    <tr>
      <td class="${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</td>
      <td class="num">${formatCount(row.pay || 0)}</td>
      <td class="num">${row.tracking == null ? '-' : formatCount(row.tracking)}</td>
      <td class="num">${row.rate == null ? '-' : formatPercent(row.rate)}</td>
      <td class="num">${formatKRW(row.amount || 0)}</td>
      <td class="num ${row.isOther ? 'danger-text' : ''}">${formatPercent(row.amountShare || 0)}</td>
    </tr>
  `).join('');

  drawDonut(
    $('donutCanvas'),
    rows.map((row) => ({ name: row.name, amount: row.amount || 0 })),
    result.totalPayAmount,
    colors,
  );

  $('donutLegend').innerHTML = rows.map((row) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${colors.get(row.name) || '#475569'}"></span>
      <span class="legend-name ${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</span>
      <span class="legend-value">${formatKRW(row.amount || 0)} (${formatPercent(row.amountShare || 0)})</span>
    </div>
  `).join('');

  const maxAmount = Math.max(1, ...rows.map((row) => row.amount || 0));
  $('barsWrap').innerHTML = [...rows]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .map((row) => {
      const width = Math.max(2, Math.round(((row.amount || 0) / maxAmount) * 100));
      return `
        <div class="bar-row">
          <div class="bar-name ${row.isOther ? 'danger-text' : ''}">
            ${esc(row.name)}
            <span>${row.tracking == null ? '트래킹 없음' : `트래킹 ${formatCount(row.tracking)}`}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%;background:${colors.get(row.name) || '#475569'}"></div>
          </div>
          <div class="bar-value ${row.isOther ? 'danger-text' : ''}">${formatKRW(row.amount || 0)}</div>
        </div>
      `;
    }).join('');
}

function renderMissingPhoneTable() {
  const rows = appState.payers?.missingPhoneRows || [];
  $('missingPhoneBadge').textContent = `${formatCount(rows.length)}건`;
  $('missingPhoneSumBadge').textContent = formatKRW(appState.payers?.missingPhoneAmountSum || 0);

  if (!appState.payers) {
    $('missingPhoneTbody').innerHTML = '<tr><td colspan="5" class="empty-row">결제자 시트를 불러오면 누락 내역이 표시됩니다.</td></tr>';
    return;
  }

  if (!rows.length) {
    $('missingPhoneTbody').innerHTML = '<tr><td colspan="5" class="empty-row">전화번호 누락 결제자가 없습니다.</td></tr>';
    return;
  }

  $('missingPhoneTbody').innerHTML = rows.slice(0, 500).map((row, index) => `
    <tr>
      <td>${formatCount(index + 1)}</td>
      <td>${esc(row.name || '(이름 없음)')}</td>
      <td class="num">${formatKRW(row.amount || 0)}</td>
      <td>${esc(row.rawPhone || '')}</td>
      <td>${formatCount(row.rowNo)}</td>
    </tr>
  `).join('');
}

export function renderAll() {
  renderHeader();
  renderErrorBanner();
  renderControls();
  renderSummaryCards();
  renderResults();
  renderMissingPhoneTable();
}
