import { APP_TITLE, OTHER_COLOR, PALETTE } from './config.js';
import { compareSnapshots } from './history.js';
import { appState, selectedSheet } from './state.js';
import { drawDonut } from './charts.js';
import {
  $,
  esc,
  formatCount,
  formatDateTime,
  formatDeltaCount,
  formatDeltaKRW,
  formatDeltaPercentPoint,
  formatKRW,
  formatPercent,
} from './utils.js';

function currentRowsForRendering() {
  if (!appState.results) return [];

  return [
    ...appState.results.dashboard,
    {
      name: '기타(미매칭)',
      pay: appState.results.otherCount,
      tracking: null,
      rate: null,
      amount: appState.results.otherAmount,
      amountShare: appState.results.otherAmountShare,
      isOther: true,
    },
  ];
}

function colorMap(rows) {
  const map = new Map();

  rows
    .filter((row) => !row.isOther)
    .forEach((row, index) => {
      map.set(row.name, PALETTE[index % PALETTE.length]);
    });

  map.set('기타(미매칭)', OTHER_COLOR);
  return map;
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

  $('saveHistoryBtn').disabled = !appState.results || appState.savingHistory;
  $('reloadHistoryBtn').disabled = appState.loadingHistory;
  $('historySaveStatus').textContent = appState.savingHistory
    ? '기록 저장 중'
    : appState.lastSavedRecordId
      ? `최근 저장 ${formatDateTime(appState.historyRecords[appState.lastSavedRecordId]?.savedAt)}`
      : '저장 전';
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
  const rows = currentRowsForRendering();
  const colors = colorMap(rows);

  $('resultMeta').textContent = selectedSheet()
    ? `${selectedSheet()?.title || '-'} 시트 결제자와 업로드한 신청자 파일을 전화번호 기준으로 비교합니다.`
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

function renderHistoryTable() {
  const rows = appState.historyList || [];

  if (appState.loadingHistory && !rows.length) {
    $('historyTbody').innerHTML = '<tr><td colspan="8" class="empty-row">저장 기록을 불러오는 중입니다.</td></tr>';
    return;
  }

  if (!rows.length) {
    $('historyTbody').innerHTML = '<tr><td colspan="8" class="empty-row">아직 저장된 매칭 기록이 없습니다.</td></tr>';
    return;
  }

  $('historyTbody').innerHTML = rows.map((record) => {
    const isActive = appState.activeHistoryId === record.recordId;
    const isBase = appState.compareBaseId === record.recordId;
    const isTarget = appState.compareTargetId === record.recordId;

    return `
      <tr class="${isActive ? 'history-row is-selected' : 'history-row'}">
        <td>${formatDateTime(record.savedAt)}</td>
        <td>
          <div class="stack-cell">
            <strong>${esc(record.payerSheet?.title || '-')}</strong>
            <span>${esc(record.applicantsFileName || '-')}</span>
          </div>
        </td>
        <td>${record.countMode === 'uniq' ? '고유 전화번호' : '결제 건수'}</td>
        <td class="num">${formatKRW(record.summary?.totalPayAmount || 0)}</td>
        <td class="num">${formatKRW(record.summary?.matchedAmount || 0)}</td>
        <td class="num">${formatKRW(record.summary?.otherAmount || 0)}</td>
        <td>${esc(record.note || '-')}</td>
        <td>
          <div class="action-row">
            <button type="button" class="btn btn-secondary btn-small" data-history-action="view" data-record-id="${record.recordId}">보기</button>
            <button type="button" class="btn btn-ghost btn-small" data-history-action="pick-base" data-record-id="${record.recordId}">
              ${isBase ? '비교 A 선택됨' : '비교 A'}
            </button>
            <button type="button" class="btn btn-ghost btn-small" data-history-action="pick-target" data-record-id="${record.recordId}">
              ${isTarget ? '비교 B 선택됨' : '비교 B'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHistoryDetail() {
  const record = appState.historyRecords[appState.activeHistoryId];

  if (!record?.snapshot) {
    $('historyDetailBody').innerHTML = '<div class="empty-row">기록 목록에서 `보기`를 누르면 저장된 매칭 결과를 다시 확인할 수 있습니다.</div>';
    return;
  }

  const snapshot = record.snapshot;
  const rows = snapshot.dashboard || [];

  $('historyDetailBody').innerHTML = `
    <div class="section-head compact-head">
      <div>
        <p class="eyebrow eyebrow-small">Saved Snapshot</p>
        <h3>${esc(record.payerSheet?.title || '-')}</h3>
        <p class="section-meta">
          저장 시각 ${formatDateTime(record.savedAt)}
          · 신청자 파일 ${esc(record.applicantsFileName || '-')}
          · 메모 ${esc(record.note || '-')}
        </p>
      </div>
      <span class="status-pill">${record.countMode === 'uniq' ? '고유 전화번호' : '결제 건수'}</span>
    </div>

    <div class="detail-summary-grid">
      <article class="mini-stat">
        <p class="mini-stat-label">총 결제금액</p>
        <strong>${formatKRW(snapshot.summary?.totalPayAmount || 0)}</strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">매칭 결제금액</p>
        <strong>${formatKRW(snapshot.summary?.matchedAmount || 0)}</strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">기타 금액</p>
        <strong>${formatKRW(snapshot.summary?.otherAmount || 0)}</strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">누락 번호 금액</p>
        <strong>${formatKRW(snapshot.summary?.missingPhoneAmountSum || 0)}</strong>
      </article>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>유입 경로</th>
            <th class="num">결제</th>
            <th class="num">트래킹</th>
            <th class="num">전환율</th>
            <th class="num">금액</th>
            <th class="num">금액 비중</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td class="${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</td>
              <td class="num">${formatCount(row.pay || 0)}</td>
              <td class="num">${row.tracking == null ? '-' : formatCount(row.tracking)}</td>
              <td class="num">${row.rate == null ? '-' : formatPercent(row.rate)}</td>
              <td class="num">${formatKRW(row.amount || 0)}</td>
              <td class="num">${formatPercent(row.amountShare || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderComparison() {
  const baseRecord = appState.historyRecords[appState.compareBaseId];
  const targetRecord = appState.historyRecords[appState.compareTargetId];

  if (!baseRecord?.snapshot || !targetRecord?.snapshot) {
    $('compareBody').innerHTML = '<div class="empty-row">기록 목록에서 `비교 A`와 `비교 B`를 각각 선택하면 차이 분석이 표시됩니다.</div>';
    return;
  }

  const comparison = compareSnapshots(baseRecord.snapshot, targetRecord.snapshot);
  const rows = comparison?.rows || [];

  $('compareBody').innerHTML = `
    <div class="section-head compact-head">
      <div>
        <p class="eyebrow eyebrow-small">Comparison</p>
        <h3>A/B 기록 비교</h3>
        <p class="section-meta">
          A: ${formatDateTime(baseRecord.savedAt)} / ${esc(baseRecord.payerSheet?.title || '-')}
          · B: ${formatDateTime(targetRecord.savedAt)} / ${esc(targetRecord.payerSheet?.title || '-')}
        </p>
      </div>
      <div class="compare-badges">
        <span class="status-pill">A ${esc(baseRecord.note || '메모 없음')}</span>
        <span class="status-pill muted">B ${esc(targetRecord.note || '메모 없음')}</span>
      </div>
    </div>

    <div class="detail-summary-grid">
      <article class="mini-stat">
        <p class="mini-stat-label">총 결제금액 차이</p>
        <strong class="${comparison.summary.totalPayAmountDiff > 0 ? 'delta-positive' : comparison.summary.totalPayAmountDiff < 0 ? 'delta-negative' : ''}">
          ${formatDeltaKRW(comparison.summary.totalPayAmountDiff)}
        </strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">총 결제건수 차이</p>
        <strong class="${comparison.summary.totalPayCountDiff > 0 ? 'delta-positive' : comparison.summary.totalPayCountDiff < 0 ? 'delta-negative' : ''}">
          ${formatDeltaCount(comparison.summary.totalPayCountDiff)}
        </strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">매칭 금액 차이</p>
        <strong class="${comparison.summary.matchedAmountDiff > 0 ? 'delta-positive' : comparison.summary.matchedAmountDiff < 0 ? 'delta-negative' : ''}">
          ${formatDeltaKRW(comparison.summary.matchedAmountDiff)}
        </strong>
      </article>
      <article class="mini-stat">
        <p class="mini-stat-label">기타 금액 차이</p>
        <strong class="${comparison.summary.otherAmountDiff > 0 ? 'delta-positive' : comparison.summary.otherAmountDiff < 0 ? 'delta-negative' : ''}">
          ${formatDeltaKRW(comparison.summary.otherAmountDiff)}
        </strong>
      </article>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th>유입 경로</th>
            <th class="num">A 금액</th>
            <th class="num">B 금액</th>
            <th class="num">차이</th>
            <th class="num">A 결제</th>
            <th class="num">B 결제</th>
            <th class="num">전환율 차이</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${esc(row.name)}</td>
              <td class="num">${formatKRW(row.baseAmount)}</td>
              <td class="num">${formatKRW(row.targetAmount)}</td>
              <td class="num ${row.amountDiff > 0 ? 'delta-positive' : row.amountDiff < 0 ? 'delta-negative' : ''}">
                ${formatDeltaKRW(row.amountDiff)}
              </td>
              <td class="num">${formatCount(row.basePay)}</td>
              <td class="num">${formatCount(row.targetPay)}</td>
              <td class="num ${row.rateDiff > 0 ? 'delta-positive' : row.rateDiff < 0 ? 'delta-negative' : ''}">
                ${row.rateDiff == null ? '-' : formatDeltaPercentPoint(row.rateDiff)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderAll() {
  renderHeader();
  renderErrorBanner();
  renderControls();
  renderSummaryCards();
  renderResults();
  renderMissingPhoneTable();
  renderHistoryTable();
  renderHistoryDetail();
  renderComparison();
}
