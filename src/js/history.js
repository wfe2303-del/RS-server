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
      baseTracking: baseRow.tracking == null ? null : Number(baseRow.tracking || 0),
      targetTracking: targetRow.tracking == null ? null : Number(targetRow.tracking || 0),
      baseRate: baseRow.rate == null ? null : Number(baseRow.rate || 0),
      targetRate: targetRow.rate == null ? null : Number(targetRow.rate || 0),
      rateDiff:
        baseRow.rate == null || targetRow.rate == null
          ? null
          : Number(targetRow.rate || 0) - Number(baseRow.rate || 0),
    };
  }).sort((left, right) => Math.abs(right.amountDiff) - Math.abs(left.amountDiff));

  return {
    baseSnapshot,
    targetSnapshot,
    rows,
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
