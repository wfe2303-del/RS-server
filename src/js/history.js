const UNMATCHED_NAMES = new Set(['기타(미매칭)', '미매칭', '기타']);

function normalizeMediaName(name) {
  return String(name || '').trim().toLowerCase();
}

function bucketKeyForRow(row) {
  if (row?.isOther || UNMATCHED_NAMES.has(String(row?.name || '').trim())) {
    return 'unmatched';
  }

  const normalized = normalizeMediaName(row?.name);
  if (normalized.includes('meta') || normalized.includes('메타')) {
    return 'meta';
  }

  if (normalized.includes('google') || normalized.includes('구글')) {
    return 'google';
  }

  return 'others';
}

function emptyBucket(key, label) {
  return {
    key,
    label,
    amount: 0,
    pay: 0,
    share: 0,
  };
}

export function createHistorySnapshot({
  sheet,
  applicantsFileName,
  payers,
  applicants,
  results,
  countMode,
  note,
}) {
  if (!sheet || !results) {
    throw new Error('저장할 매칭 결과가 없습니다.');
  }

  const matchedCount = results.totalPayCount - results.otherCount;
  const matchedAmount = results.totalPayAmount - results.otherAmount;
  const dashboard = [
    ...results.dashboard.map((row) => ({
      name: row.name,
      pay: row.pay || 0,
      tracking: row.tracking ?? null,
      rate: row.rate ?? null,
      amount: row.amount || 0,
      amountShare: row.amountShare || 0,
      isOther: false,
    })),
    {
      name: '기타(미매칭)',
      pay: results.otherCount || 0,
      tracking: null,
      rate: null,
      amount: results.otherAmount || 0,
      amountShare: results.otherAmountShare || 0,
      isOther: true,
    },
  ];

  return {
    payerSheet: {
      sheetId: sheet.sheetId,
      title: sheet.title,
    },
    applicantsFileName: applicantsFileName || '',
    countMode,
    note: note || '',
    summary: {
      totalPayCount: results.totalPayCount || 0,
      totalPayAmount: results.totalPayAmount || 0,
      matchedCount,
      matchedAmount,
      otherCount: results.otherCount || 0,
      otherAmount: results.otherAmount || 0,
      missingPhoneCount: payers?.missingPhoneCount || 0,
      missingPhoneAmountSum: payers?.missingPhoneAmountSum || 0,
      totalTracking: applicants?.totalTracking || 0,
      totalTrackingUniq: applicants?.totalUniq || 0,
    },
    dashboard,
    missingPhoneRows: (payers?.missingPhoneRows || []).slice(0, 100),
  };
}

export function buildBucketSummary(snapshot) {
  const totalAmount = Number(snapshot?.summary?.totalPayAmount || 0);
  const bucketMap = new Map([
    ['google', emptyBucket('google', '구글')],
    ['meta', emptyBucket('meta', '메타')],
    ['others', emptyBucket('others', '나머지')],
    ['unmatched', emptyBucket('unmatched', '미매칭')],
  ]);

  (snapshot?.dashboard || []).forEach((row) => {
    const key = bucketKeyForRow(row);
    const bucket = bucketMap.get(key);
    bucket.amount += Number(row.amount || 0);
    bucket.pay += Number(row.pay || 0);
  });

  return [...bucketMap.values()].map((bucket) => ({
    ...bucket,
    share: totalAmount ? bucket.amount / totalAmount : 0,
  }));
}

export function compareSnapshots(baseSnapshot, targetSnapshot) {
  if (!baseSnapshot || !targetSnapshot) {
    return null;
  }

  const baseRows = new Map((baseSnapshot.dashboard || []).map((row) => [row.name, row]));
  const targetRows = new Map((targetSnapshot.dashboard || []).map((row) => [row.name, row]));
  const names = [...new Set([...baseRows.keys(), ...targetRows.keys()])];

  const rows = names.map((name) => {
    const baseRow = baseRows.get(name) || {};
    const targetRow = targetRows.get(name) || {};

    return {
      name,
      baseAmount: Number(baseRow.amount || 0),
      targetAmount: Number(targetRow.amount || 0),
      amountDiff: Number(targetRow.amount || 0) - Number(baseRow.amount || 0),
      basePay: Number(baseRow.pay || 0),
      targetPay: Number(targetRow.pay || 0),
      payDiff: Number(targetRow.pay || 0) - Number(baseRow.pay || 0),
      baseRate: baseRow.rate == null ? null : Number(baseRow.rate || 0),
      targetRate: targetRow.rate == null ? null : Number(targetRow.rate || 0),
      rateDiff:
        baseRow.rate == null || targetRow.rate == null
          ? null
          : Number(targetRow.rate || 0) - Number(baseRow.rate || 0),
    };
  }).sort((left, right) => Math.abs(right.amountDiff) - Math.abs(left.amountDiff));

  const baseBuckets = buildBucketSummary(baseSnapshot);
  const targetBuckets = buildBucketSummary(targetSnapshot);
  const targetBucketMap = new Map(targetBuckets.map((bucket) => [bucket.key, bucket]));
  const bucketRows = baseBuckets.map((bucket) => {
    const target = targetBucketMap.get(bucket.key) || emptyBucket(bucket.key, bucket.label);
    return {
      key: bucket.key,
      label: bucket.label,
      baseAmount: bucket.amount,
      targetAmount: target.amount,
      amountDiff: target.amount - bucket.amount,
      baseShare: bucket.share,
      targetShare: target.share,
      shareDiff: target.share - bucket.share,
    };
  });

  return {
    baseSnapshot,
    targetSnapshot,
    rows,
    bucketRows,
    summary: {
      totalPayCountDiff:
        Number(targetSnapshot.summary?.totalPayCount || 0) - Number(baseSnapshot.summary?.totalPayCount || 0),
      totalPayAmountDiff:
        Number(targetSnapshot.summary?.totalPayAmount || 0) - Number(baseSnapshot.summary?.totalPayAmount || 0),
      matchedAmountDiff:
        Number(targetSnapshot.summary?.matchedAmount || 0) - Number(baseSnapshot.summary?.matchedAmount || 0),
      otherAmountDiff:
        Number(targetSnapshot.summary?.otherAmount || 0) - Number(baseSnapshot.summary?.otherAmount || 0),
    },
  };
}
