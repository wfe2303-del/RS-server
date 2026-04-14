import { APPLICANTS_RULES, PAYERS_RULES } from './config.js';
import { colToIdx, normalizePhone, parseAmount } from './utils.js';

export function parsePayersFromGrid(grid) {
  const nameIdx = colToIdx(PAYERS_RULES.nameCol);
  const phoneIdx = colToIdx(PAYERS_RULES.phoneCol);
  const amountIdx = colToIdx(PAYERS_RULES.amountCol);

  const txEntries = [];
  const uniqPhones = [];
  const uniqSet = new Set();
  const uniqAmountByPhone = new Map();
  const missingPhoneRows = [];
  let missingPhoneAmountSum = 0;
  let missingPhoneCount = 0;

  for (let rowIndex = PAYERS_RULES.startRow - 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex] || [];
    if (!row.some((value) => value !== '' && value !== null && value !== undefined)) continue;

    const name = String(row[nameIdx] ?? '').trim();
    const phone = normalizePhone(row[phoneIdx]);
    const amount = parseAmount(row[amountIdx]);

    if (PAYERS_RULES.excludeZeroAmount && amount === 0) continue;

    if (!phone) {
      missingPhoneRows.push({
        rowNo: rowIndex + 1,
        name,
        amount,
        rawPhone: row[phoneIdx] == null ? '' : String(row[phoneIdx]),
      });
      missingPhoneAmountSum += amount;
      missingPhoneCount += 1;
      continue;
    }

    txEntries.push({ phone, amount });
    uniqAmountByPhone.set(phone, (uniqAmountByPhone.get(phone) || 0) + amount);

    if (!uniqSet.has(phone)) {
      uniqSet.add(phone);
      uniqPhones.push(phone);
    }
  }

  return {
    txEntries,
    uniqPhones,
    uniqSet,
    uniqAmountByPhone,
    missingPhoneRows,
    missingPhoneAmountSum,
    missingPhoneCount,
  };
}

export function parseApplicants(grid) {
  const mediaIdx = colToIdx(APPLICANTS_RULES.mediaCol);
  const nameIdx = colToIdx(APPLICANTS_RULES.nameCol);
  const phoneIdx = colToIdx(APPLICANTS_RULES.phoneCol);

  const mediaStats = new Map();
  const phoneAssigned = new Map();
  let totalTracking = 0;
  const allUniq = new Set();

  for (let rowIndex = APPLICANTS_RULES.startRow - 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex] || [];
    if (!row.some((value) => value !== '' && value !== null && value !== undefined)) continue;

    const phone = normalizePhone(row[phoneIdx]);
    if (!phone) continue;

    const media = String(row[mediaIdx] ?? '').trim() || '미분류';
    const name = String(row[nameIdx] ?? '').trim();

    if (!mediaStats.has(media)) {
      mediaStats.set(media, {
        trackingTotal: 0,
        uniqSet: new Set(),
        sampleNameCount: 0,
      });
    }

    const stat = mediaStats.get(media);
    stat.trackingTotal += 1;
    stat.uniqSet.add(phone);
    if (name) {
      stat.sampleNameCount += 1;
    }

    totalTracking += 1;
    allUniq.add(phone);

    if (!phoneAssigned.has(phone)) {
      phoneAssigned.set(phone, media);
    }
  }

  const mediaList = [...mediaStats.entries()].map(([name, stat]) => ({
    name,
    trackingTotal: stat.trackingTotal,
    trackingUniq: stat.uniqSet.size,
    uniqSet: stat.uniqSet,
  }));

  return {
    mediaStats,
    mediaList,
    phoneAssigned,
    totalTracking,
    totalUniq: allUniq.size,
  };
}

export function computeResults(payers, applicants, mode) {
  const mediaList = applicants.mediaList;
  const mediaNames = mediaList.map((item) => item.name);
  const phoneAssigned = applicants.phoneAssigned;

  const countByMedia = new Map();
  const amountByMedia = new Map();
  const trackingByMedia = new Map();

  mediaList.forEach((item) => {
    countByMedia.set(item.name, 0);
    amountByMedia.set(item.name, 0);
    trackingByMedia.set(item.name, item.trackingTotal);
  });

  let otherCount = 0;
  let otherAmount = 0;

  if (mode === 'tx') {
    payers.txEntries.forEach((entry) => {
      const matchedMedia = phoneAssigned.get(entry.phone);
      if (matchedMedia) {
        countByMedia.set(matchedMedia, (countByMedia.get(matchedMedia) || 0) + 1);
        amountByMedia.set(matchedMedia, (amountByMedia.get(matchedMedia) || 0) + entry.amount);
      } else {
        otherCount += 1;
        otherAmount += entry.amount;
      }
    });
  } else {
    payers.uniqPhones.forEach((phone) => {
      const amount = payers.uniqAmountByPhone.get(phone) || 0;
      const matchedMedia = phoneAssigned.get(phone);
      if (matchedMedia) {
        countByMedia.set(matchedMedia, (countByMedia.get(matchedMedia) || 0) + 1);
        amountByMedia.set(matchedMedia, (amountByMedia.get(matchedMedia) || 0) + amount);
      } else {
        otherCount += 1;
        otherAmount += amount;
      }
    });
  }

  otherCount += payers.missingPhoneCount || 0;
  otherAmount += payers.missingPhoneAmountSum || 0;

  const totalPayCount = [...countByMedia.values()].reduce((sum, value) => sum + value, 0) + otherCount;
  const totalPayAmount = [...amountByMedia.values()].reduce((sum, value) => sum + value, 0) + otherAmount;

  const dashboard = mediaNames
    .map((name) => {
      const pay = countByMedia.get(name) || 0;
      const amount = amountByMedia.get(name) || 0;
      const tracking = trackingByMedia.get(name) || 0;

      return {
        name,
        pay,
        tracking,
        rate: tracking ? pay / tracking : 0,
        amount,
        amountShare: totalPayAmount ? amount / totalPayAmount : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    mode,
    totalPayCount,
    totalPayAmount,
    otherCount,
    otherAmount,
    otherAmountShare: totalPayAmount ? otherAmount / totalPayAmount : 0,
    dashboard,
  };
}
