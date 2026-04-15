import {
  APP_TITLE,
  BUCKET_COLORS,
  HISTORY_SHEET_URL,
  OTHER_COLOR,
  PALETTE,
} from './config.js';
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

const UNMATCHED_NAMES = new Set(['기타(미매칭)', '미매칭', '기타']);

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

function countModeLabel(mode) {
  return mode === 'uniq' ? '고유 전화번호' : '결제 건수';
}

function deltaClass(value) {
  if (value > 0) return 'delta-positive';
  if (value < 0) return 'delta-negative';
  return '';
}

function historyLabel(record, fallback) {
  return record?.note?.trim() || record?.payerSheet?.title || fallback;
}

function historyMeta(record) {
  return [
    record?.payerSheet?.title || '',
    record?.applicantsFileName || '',
    record?.savedAt ? formatDateTime(record.savedAt) : '',
  ].filter(Boolean);
}

function preferredColorForRow(row) {
  if (row?.isOther || UNMATCHED_NAMES.has(String(row?.name || '').trim())) {
    return OTHER_COLOR;
  }

  const normalized = String(row?.name || '').trim().toLowerCase();
  if (normalized.includes('google') || normalized.includes('구글')) {
    return BUCKET_COLORS.google;
  }

  if (normalized.includes('meta') || normalized.includes('메타')) {
    return BUCKET_COLORS.meta;
  }

  return '';
}

function fallbackColor(index) {
  if (PALETTE[index]) {
    return PALETTE[index];
  }

  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 68% 48%)`;
}

function colorMap(rows) {
  const map = new Map();
  const usedColors = new Set();
  let fallbackIndex = 0;

  rows.forEach((row) => {
    const preferred = preferredColorForRow(row);
    if (preferred) {
      map.set(row.name, preferred);
      usedColors.add(preferred);
    }
  });

  rows
    .filter((row) => !map.has(row.name))
    .forEach((row) => {
      let color = fallbackColor(fallbackIndex);

      while (usedColors.has(color)) {
        fallbackIndex += 1;
        color = fallbackColor(fallbackIndex);
      }

      map.set(row.name, color);
      usedColors.add(color);
      fallbackIndex += 1;
    });

  return map;
}

function shareWidth(value) {
  return `${Math.max(0, Math.min(100, Number(value || 0) * 100)).toFixed(1)}%`;
}

function renderHeader() {
  document.title = APP_TITLE;

  const refreshButton = $('refreshBtn');
  if (refreshButton) {
    refreshButton.disabled = appState.loadingCatalog || appState.loadingSheet;
  }

  const historySheetLink = $('historySheetLink');
  if (historySheetLink) {
    historySheetLink.href = HISTORY_SHEET_URL;
  }
}

function renderErrorBanner() {
  const banner = $('errorBanner');
  if (!banner) return;

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

  if (select) {
    select.innerHTML = catalog.length
      ? catalog.map((sheet) => `<option value="${sheet.sheetId}">${esc(sheet.title)}</option>`).join('')
      : '<option value="">시트 없음</option>';

    if (appState.selectedSheetId) {
      select.value = String(appState.selectedSheetId);
    } else if (catalog[0]) {
      select.value = String(catalog[0].sheetId);
    }
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

  $('resultMeta').textContent = selectedSheet()?.title || '';

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
    .sort((left, right) => (right.amount || 0) - (left.amount || 0))
    .map((row) => {
      const width = Math.max(2, Math.round(((row.amount || 0) / maxAmount) * 100));
      return `
        <div class="bar-row">
          <div class="bar-name ${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</div>
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
        <td>${countModeLabel(record.countMode)}</td>
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
    $('historyDetailBody').innerHTML = '<div class="empty-row">기록 목록에서 보기 버튼을 누르면 저장된 매칭 결과를 다시 확인할 수 있습니다.</div>';
    return;
  }

  const snapshot = record.snapshot;
  const rows = snapshot.dashboard || [];
  const meta = historyMeta(record);

  $('historyDetailBody').innerHTML = `
    <div class="history-detail-header">
      <div class="history-detail-copy">
        <h3>${esc(historyLabel(record, '저장 기록'))}</h3>
        <p>${esc(meta.join(' · '))}</p>
      </div>
      <div class="compare-badges">
        <span class="status-pill">${countModeLabel(record.countMode)}</span>
      </div>
    </div>

    <div class="history-stat-grid">
      <article class="history-stat">
        <p class="mini-stat-label">총 결제금액</p>
        <strong>${formatKRW(snapshot.summary?.totalPayAmount || 0)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">매칭 결제금액</p>
        <strong>${formatKRW(snapshot.summary?.matchedAmount || 0)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">기타 금액</p>
        <strong>${formatKRW(snapshot.summary?.otherAmount || 0)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">번호 누락 금액</p>
        <strong>${formatKRW(snapshot.summary?.missingPhoneAmountSum || 0)}</strong>
      </article>
    </div>

    <div class="table-card compact-table">
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

function renderMixComparison() {
  const baseRecord = appState.historyRecords[appState.compareBaseId];
  const targetRecord = appState.historyRecords[appState.compareTargetId];

  if (!baseRecord?.snapshot || !targetRecord?.snapshot) {
    $('comparisonMixBody').innerHTML = '<div class="empty-row">기록 목록에서 비교 A와 비교 B를 선택하면 구글, 메타, 나머지, 미매칭 4개 비중 비교가 표시됩니다.</div>';
    return;
  }

  const comparison = compareSnapshots(baseRecord.snapshot, targetRecord.snapshot);
  const bucketRows = comparison?.bucketRows || [];

  $('comparisonMixBody').innerHTML = `
    <div class="history-detail-header">
      <div class="history-detail-copy">
        <h3>4개 묶음 비중 비교</h3>
        <p>구글 · 메타 · 나머지 · 미매칭</p>
      </div>
      <div class="compare-badges">
        <span class="status-pill">A ${esc(historyLabel(baseRecord, '기록 A'))}</span>
        <span class="status-pill muted">B ${esc(historyLabel(targetRecord, '기록 B'))}</span>
      </div>
    </div>

    <div class="bucket-compare-list">
      ${bucketRows.map((row) => {
        const color = BUCKET_COLORS[row.key] || BUCKET_COLORS.others;
        return `
          <article class="bucket-compare-row">
            <div class="bucket-compare-meta">
              <span class="bucket-label">${esc(row.label)}</span>
              <div class="bucket-values">
                <span>A ${formatPercent(row.baseShare)} · ${formatKRW(row.baseAmount)}</span>
                <span>B ${formatPercent(row.targetShare)} · ${formatKRW(row.targetAmount)}</span>
              </div>
              <span class="bucket-diff ${deltaClass(row.shareDiff)}">${formatDeltaPercentPoint(row.shareDiff)}</span>
            </div>

            <div class="bucket-track-stack">
              <div class="bucket-track-line">
                <span class="bucket-track-caption">A</span>
                <div class="bucket-track">
                  <div class="bucket-fill bucket-fill-base" style="width:${shareWidth(row.baseShare)};background:${color}"></div>
                </div>
              </div>

              <div class="bucket-track-line">
                <span class="bucket-track-caption muted">B</span>
                <div class="bucket-track">
                  <div class="bucket-fill bucket-fill-target" style="width:${shareWidth(row.targetShare)};background:${color}"></div>
                </div>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderComparison() {
  const baseRecord = appState.historyRecords[appState.compareBaseId];
  const targetRecord = appState.historyRecords[appState.compareTargetId];

  if (!baseRecord?.snapshot || !targetRecord?.snapshot) {
    $('compareBody').innerHTML = '<div class="empty-row">기록 목록에서 비교 A와 비교 B를 각각 선택하면 차이 분석이 표시됩니다.</div>';
    return;
  }

  const comparison = compareSnapshots(baseRecord.snapshot, targetRecord.snapshot);
  const rows = comparison?.rows || [];

  $('compareBody').innerHTML = `
    <div class="history-detail-header">
      <div class="history-detail-copy">
        <h3>A/B 기록 비교</h3>
        <p>${esc(historyLabel(baseRecord, '기록 A'))} vs ${esc(historyLabel(targetRecord, '기록 B'))}</p>
      </div>
      <div class="compare-badges">
        <span class="status-pill">A ${countModeLabel(baseRecord.countMode)}</span>
        <span class="status-pill muted">B ${countModeLabel(targetRecord.countMode)}</span>
      </div>
    </div>

    <div class="history-stat-grid">
      <article class="history-stat">
        <p class="mini-stat-label">총 결제금액 차이</p>
        <strong class="${deltaClass(comparison.summary.totalPayAmountDiff)}">${formatDeltaKRW(comparison.summary.totalPayAmountDiff)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">총 결제건수 차이</p>
        <strong class="${deltaClass(comparison.summary.totalPayCountDiff)}">${formatDeltaCount(comparison.summary.totalPayCountDiff)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">매칭 금액 차이</p>
        <strong class="${deltaClass(comparison.summary.matchedAmountDiff)}">${formatDeltaKRW(comparison.summary.matchedAmountDiff)}</strong>
      </article>
      <article class="history-stat">
        <p class="mini-stat-label">기타 금액 차이</p>
        <strong class="${deltaClass(comparison.summary.otherAmountDiff)}">${formatDeltaKRW(comparison.summary.otherAmountDiff)}</strong>
      </article>
    </div>

    <div class="table-card compact-table">
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
              <td class="num ${deltaClass(row.amountDiff)}">${formatDeltaKRW(row.amountDiff)}</td>
              <td class="num">${formatCount(row.basePay)}</td>
              <td class="num">${formatCount(row.targetPay)}</td>
              <td class="num ${deltaClass(row.rateDiff || 0)}">${row.rateDiff == null ? '-' : formatDeltaPercentPoint(row.rateDiff)}</td>
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
  renderMixComparison();
  renderComparison();
}
