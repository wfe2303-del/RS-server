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
  formatDeltaPercentPoint,
  formatKRW,
  formatPercent,
} from './utils.js';

const UNMATCHED_NAMES = new Set(['기타(미매칭)', '미매칭', '기타']);

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

function previewRecord() {
  return appState.historyRecords[appState.previewRecordId] || null;
}

function previewSnapshot() {
  return previewRecord()?.snapshot || null;
}

function currentRowsForRendering() {
  const snapshot = previewSnapshot();
  if (snapshot) {
    return snapshot.dashboard || [];
  }

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

function filteredSheetCatalog() {
  const query = appState.sheetQuery.trim().toLowerCase();
  if (!query) {
    return appState.sheetCatalog || [];
  }

  return (appState.sheetCatalog || []).filter((sheet) => String(sheet.title || '').toLowerCase().includes(query));
}

function filteredHistoryRecords() {
  const query = appState.historySearchQuery.trim().toLowerCase();
  if (!query) {
    return appState.historyList || [];
  }

  return (appState.historyList || []).filter((record) => String(record.payerSheet?.title || '').toLowerCase().includes(query));
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

function recordSelectionSummary() {
  const preview = previewRecord();
  const baseRecord = appState.historyRecords[appState.compareBaseId];
  const targetRecord = appState.historyRecords[appState.compareTargetId];
  const previewLabel = preview ? historyLabel(preview, '보기') : '미선택';
  const baseLabel = baseRecord ? historyLabel(baseRecord, '기록 A') : '미선택';
  const targetLabel = targetRecord ? historyLabel(targetRecord, '기록 B') : '미선택';
  return `보기 ${previewLabel} / A ${baseLabel} / B ${targetLabel}`;
}

function dashboardSource() {
  const snapshot = previewSnapshot();
  if (snapshot) {
    return {
      type: 'snapshot',
      snapshot,
      record: previewRecord(),
    };
  }

  return {
    type: 'live',
    results: appState.results,
    payers: appState.payers,
    sheet: selectedSheet(),
  };
}

function renderHeader() {
  document.title = APP_TITLE;

  $('refreshBtn').disabled = appState.loadingCatalog || appState.loadingSheet;
  $('dashboardPageBtn').classList.toggle('is-active', appState.pageMode === 'dashboard');
  $('comparisonPageBtn').classList.toggle('is-active', appState.pageMode === 'compare');
  $('dashboardPage').classList.toggle('hidden', appState.pageMode !== 'dashboard');
  $('comparisonPage').classList.toggle('hidden', appState.pageMode !== 'compare');

  const preview = previewRecord();
  $('previewRecordStatus').textContent = preview
    ? `저장 기록 보기: ${historyLabel(preview, '저장 기록')}`
    : '실시간 매칭 보기';
  $('clearPreviewBtn').disabled = !preview;
  $('clearCompareBtn').disabled = !appState.compareBaseId && !appState.compareTargetId;

  document.querySelectorAll('.history-sheet-link').forEach((link) => {
    link.href = HISTORY_SHEET_URL;
  });
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
  const catalog = filteredSheetCatalog();
  const sheetSearchInput = $('sheetSearchInput');
  const select = $('sheetSelect');

  if (sheetSearchInput.value !== appState.sheetQuery) {
    sheetSearchInput.value = appState.sheetQuery;
  }

  select.innerHTML = catalog.length
    ? catalog.map((sheet) => `<option value="${sheet.sheetId}">${esc(sheet.title)}</option>`).join('')
    : '<option value="">검색 결과 없음</option>';

  select.disabled = !catalog.length;

  if (catalog.some((sheet) => String(sheet.sheetId) === String(appState.selectedSheetId))) {
    select.value = String(appState.selectedSheetId);
  } else if (!appState.sheetQuery && catalog[0]) {
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
  const source = dashboardSource();

  let totalCount = 0;
  let totalAmount = 0;
  let matchedCount = 0;
  let matchedAmount = 0;
  let otherAmount = 0;

  if (source.type === 'snapshot') {
    totalCount = source.snapshot.summary?.totalPayCount || 0;
    totalAmount = source.snapshot.summary?.totalPayAmount || 0;
    matchedCount = source.snapshot.summary?.matchedCount || 0;
    matchedAmount = source.snapshot.summary?.matchedAmount || 0;
    otherAmount = source.snapshot.summary?.otherAmount || 0;
  } else {
    const payers = source.payers;
    const results = source.results;

    totalCount = results
      ? results.totalPayCount
      : payers
        ? payers.txEntries.length + (payers.missingPhoneCount || 0)
        : 0;

    totalAmount = results
      ? results.totalPayAmount
      : payers
        ? [...payers.txEntries].reduce((sum, entry) => sum + (entry.amount || 0), 0) + (payers.missingPhoneAmountSum || 0)
        : 0;

    matchedCount = results ? results.totalPayCount - results.otherCount : 0;
    matchedAmount = results ? results.totalPayAmount - results.otherAmount : 0;
    otherAmount = results ? results.otherAmount : 0;
  }

  $('summaryTotalCount').textContent = formatCount(totalCount);
  $('summaryTotalAmount').textContent = formatKRW(totalAmount);
  $('summaryMatchedCount').textContent = formatCount(matchedCount);
  $('summaryMatchedAmount').textContent = formatKRW(matchedAmount);
  $('summaryOtherAmount').textContent = formatKRW(otherAmount);
}

function renderResults() {
  const source = dashboardSource();
  const rows = currentRowsForRendering();
  const colors = colorMap(rows);

  if (source.type === 'snapshot') {
    const record = source.record;
    const snapshot = source.snapshot;

    $('resultMeta').textContent = `${record?.payerSheet?.title || ''} · ${formatDateTime(record?.savedAt)}`;
    $('summaryBadge').textContent = `저장 기록 보기 · 총액 ${formatKRW(snapshot.summary?.totalPayAmount || 0)}`;
    $('donutCaption').textContent = `유입 경로 ${formatCount(rows.length)}개`;
    $('barsCaption').textContent = '저장 기록 기준';
    $('donutTotal').textContent = formatKRW(snapshot.summary?.totalPayAmount || 0);

    $('dashTbody').innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td class="${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</td>
            <td class="num">${formatCount(row.pay || 0)}</td>
            <td class="num">${row.tracking == null ? '-' : formatCount(row.tracking)}</td>
            <td class="num">${row.rate == null ? '-' : formatPercent(row.rate)}</td>
            <td class="num">${formatKRW(row.amount || 0)}</td>
            <td class="num ${row.isOther ? 'danger-text' : ''}">${formatPercent(row.amountShare || 0)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" class="empty-row">표시할 결과가 없습니다.</td></tr>';

    drawDonut(
      $('donutCanvas'),
      rows.map((row) => ({ name: row.name, amount: row.amount || 0 })),
      snapshot.summary?.totalPayAmount || 0,
      colors,
    );

    $('donutLegend').innerHTML = rows.length
      ? rows.map((row) => `
          <div class="legend-item">
            <span class="legend-swatch" style="background:${colors.get(row.name) || '#475569'}"></span>
            <span class="legend-name ${row.isOther ? 'danger-text' : ''}">${esc(row.name)}</span>
            <span class="legend-value">${formatKRW(row.amount || 0)} (${formatPercent(row.amountShare || 0)})</span>
          </div>
        `).join('')
      : '<div class="empty-row">표시할 결과가 없습니다.</div>';

    const maxAmount = Math.max(1, ...rows.map((row) => row.amount || 0), 0);
    $('barsWrap').innerHTML = rows.length
      ? [...rows]
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
          }).join('')
      : '<div class="empty-row">표시할 결과가 없습니다.</div>';
    return;
  }

  const result = source.results;
  $('resultMeta').textContent = source.sheet?.title || '';

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
  const snapshot = previewSnapshot();
  const rows = snapshot ? (snapshot.missingPhoneRows || []) : (appState.payers?.missingPhoneRows || []);
  const amountSum = snapshot
    ? (snapshot.summary?.missingPhoneAmountSum || 0)
    : (appState.payers?.missingPhoneAmountSum || 0);

  $('missingPhoneBadge').textContent = `${formatCount(rows.length)}건`;
  $('missingPhoneSumBadge').textContent = formatKRW(amountSum);

  if (!snapshot && !appState.payers) {
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
      <td>${formatCount(row.rowNo || index + 1)}</td>
    </tr>
  `).join('');
}

function renderHistoryPanel(recordId, targetId, emptyMessage) {
  const target = $(targetId);
  const record = appState.historyRecords[recordId];

  if (!record?.snapshot) {
    target.innerHTML = `<div class="empty-row">${emptyMessage}</div>`;
    return;
  }

  const snapshot = record.snapshot;
  const rows = snapshot.dashboard || [];
  const meta = historyMeta(record);

  target.innerHTML = `
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
    $('comparisonMixBody').innerHTML = '<div class="empty-row">저장된 매칭 검색에서 A와 B 기록을 선택하면 구글, 메타, 온드미디어, 미매칭 비중 비교가 표시됩니다.</div>';
    return;
  }

  const comparison = compareSnapshots(baseRecord.snapshot, targetRecord.snapshot);
  const bucketRows = comparison?.bucketRows || [];

  $('comparisonMixBody').innerHTML = `
    <div class="history-detail-header">
      <div class="history-detail-copy">
        <h3>유입 비중 비교</h3>
        <p>${esc(historyLabel(baseRecord, '기록 A'))} vs ${esc(historyLabel(targetRecord, '기록 B'))}</p>
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

function renderHistoryModal() {
  const modal = $('historyModal');
  const searchInput = $('historySearchInput');
  const selection = $('historyModalSelection');
  const rows = filteredHistoryRecords();

  modal.classList.toggle('hidden', !appState.historyModalOpen);
  modal.setAttribute('aria-hidden', appState.historyModalOpen ? 'false' : 'true');

  if (searchInput && searchInput.value !== appState.historySearchQuery) {
    searchInput.value = appState.historySearchQuery;
  }

  selection.textContent = recordSelectionSummary();

  if (appState.loadingHistory && !rows.length) {
    $('historyModalTbody').innerHTML = '<tr><td colspan="7" class="empty-row">저장 기록을 불러오는 중입니다.</td></tr>';
    return;
  }

  if (!rows.length) {
    $('historyModalTbody').innerHTML = '<tr><td colspan="7" class="empty-row">검색 조건에 맞는 저장 기록이 없습니다.</td></tr>';
    return;
  }

  $('historyModalTbody').innerHTML = rows.map((record) => {
    const isPreview = appState.previewRecordId === record.recordId;
    const isBase = appState.compareBaseId === record.recordId;
    const isTarget = appState.compareTargetId === record.recordId;

    return `
      <tr class="${isPreview || isBase || isTarget ? 'history-row is-selected' : 'history-row'}">
        <td>${formatDateTime(record.savedAt)}</td>
        <td>${esc(record.payerSheet?.title || '-')}</td>
        <td>${esc(record.applicantsFileName || '-')}</td>
        <td>${esc(record.note || '-')}</td>
        <td class="num">${formatKRW(record.summary?.totalPayAmount || 0)}</td>
        <td class="num">${formatKRW(record.summary?.matchedAmount || 0)}</td>
        <td>
          <div class="action-row">
            <button type="button" class="btn btn-secondary btn-small" data-history-action="${isPreview ? 'clear-preview' : 'preview'}" data-record-id="${record.recordId}">
              ${isPreview ? '보기 해제' : '보기'}
            </button>
            <button type="button" class="btn btn-ghost btn-small" data-history-action="${isBase ? 'clear-base' : 'pick-base'}" data-record-id="${record.recordId}">
              ${isBase ? 'A 해제' : 'A 선택'}
            </button>
            <button type="button" class="btn btn-ghost btn-small" data-history-action="${isTarget ? 'clear-target' : 'pick-target'}" data-record-id="${record.recordId}">
              ${isTarget ? 'B 해제' : 'B 선택'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderAll() {
  renderHeader();
  renderErrorBanner();
  renderControls();
  renderSummaryCards();
  renderResults();
  renderMissingPhoneTable();
  renderHistoryPanel(
    appState.compareBaseId,
    'compareBaseBody',
    '저장된 매칭 검색에서 A 기록을 선택하면 당시 매칭 결과가 여기에 표시됩니다.',
  );
  renderMixComparison();
  renderHistoryPanel(
    appState.compareTargetId,
    'compareTargetBody',
    '저장된 매칭 검색에서 B 기록을 선택하면 당시 매칭 결과가 여기에 표시됩니다.',
  );
  renderHistoryModal();
}
