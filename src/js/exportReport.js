import { activeCoach } from './state.js';
import { OTHER_COLOR, PALETTE } from './config.js';
import { formatKRW } from './utils.js';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setFont(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px system-ui,-apple-system,Segoe UI,Roboto,Arial,"Noto Sans KR"`;
}

function text(ctx, value, x, y, size = 13, weight = 700, color = '#111827', align = 'left') {
  ctx.fillStyle = color;
  setFont(ctx, size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(String(value), x, y);
}

function getRows(coach) {
  const rows = [...coach.results.dashboard];
  rows.push({
    name: '기타(미매칭)',
    pay: coach.results.otherCount,
    tracking: null,
    rate: null,
    amount: coach.results.otherAmount,
    amountShare: coach.results.otherAmountShare,
    isOther: true,
  });
  return rows;
}

function colorMap(coach) {
  const map = new Map();
  (coach.applicants?.mediaList || []).forEach((item, index) => map.set(item.name, PALETTE[index % PALETTE.length]));
  map.set('기타(미매칭)', OTHER_COLOR);
  return map;
}

export function exportReportPng() {
  const coach = activeCoach();
  if (!coach?.results) {
    alert('먼저 매칭을 실행해 주세요.');
    return;
  }

  const rows = getRows(coach).sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const colors = colorMap(coach);

  const width = 1400;
  const height = 1450;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  text(ctx, `${coach.name} 정리표`, 40, 28, 30, 900, '#0f172a');
  const now = new Date();
  text(ctx, `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`, 40, 72, 13, 600, '#6b7280');
  text(ctx, `총 결제 ${coach.results.totalPayCount.toLocaleString()}건 · 총액 ${formatKRW(coach.results.totalPayAmount)}`, 40, 94, 14, 800);

  const tableX = 40;
  const tableY = 130;
  const tableW = width - 80;
  const headerH = 42;
  const rowH = 38;

  drawRoundRect(ctx, tableX, tableY, tableW, headerH + rows.length * rowH + 20, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e5e7eb';
  ctx.stroke();

  drawRoundRect(ctx, tableX, tableY, tableW, headerH, 14);
  ctx.fillStyle = '#f3f4f6';
  ctx.fill();

  const col = { name: 380, pay: 120, track: 140, rate: 120, amount: 250, share: 170 };
  text(ctx, '유입 경로', tableX + 14, tableY + 12, 12, 900);
  text(ctx, '결제', tableX + col.name + col.pay - 6, tableY + 12, 12, 900, '#111827', 'right');
  text(ctx, '트래킹', tableX + col.name + col.pay + col.track - 6, tableY + 12, 12, 900, '#111827', 'right');
  text(ctx, '전환율', tableX + col.name + col.pay + col.track + col.rate - 6, tableY + 12, 12, 900, '#111827', 'right');
  text(ctx, '금액 합계', tableX + col.name + col.pay + col.track + col.rate + col.amount - 6, tableY + 12, 12, 900, '#111827', 'right');
  text(ctx, '금액 비중', tableX + tableW - 16, tableY + 12, 12, 900, '#111827', 'right');

  let y = tableY + headerH;
  rows.forEach((row) => {
    ctx.beginPath();
    ctx.moveTo(tableX, y);
    ctx.lineTo(tableX + tableW, y);
    ctx.strokeStyle = '#e5e7eb';
    ctx.stroke();
    const color = row.isOther ? '#b91c1c' : '#111827';
    text(ctx, row.name, tableX + 14, y + 11, 12, 900, color);
    text(ctx, (row.pay || 0).toLocaleString(), tableX + col.name + col.pay - 6, y + 11, 12, 900, color, 'right');
    text(ctx, row.tracking == null ? '-' : row.tracking.toLocaleString(), tableX + col.name + col.pay + col.track - 6, y + 11, 12, 700, '#6b7280', 'right');
    text(ctx, row.rate == null ? '-' : `${(row.rate * 100).toFixed(1)}%`, tableX + col.name + col.pay + col.track + col.rate - 6, y + 11, 12, 700, '#6b7280', 'right');
    text(ctx, formatKRW(row.amount || 0), tableX + col.name + col.pay + col.track + col.rate + col.amount - 6, y + 11, 12, 900, color, 'right');
    text(ctx, `${((row.amountShare || 0) * 100).toFixed(1)}%`, tableX + tableW - 16, y + 11, 12, 900, color, 'right');
    y += rowH;
  });

  const chartY = tableY + headerH + rows.length * rowH + 52;
  const leftW = (tableW - 20) / 2;
  const rightX = tableX + leftW + 20;

  [tableX, rightX].forEach((x) => {
    drawRoundRect(ctx, x, chartY, leftW, 420, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.stroke();
  });

  text(ctx, '결제 비중', tableX + 14, chartY + 12, 14, 900);
  const donutCx = tableX + 220;
  const donutCy = chartY + 210;
  const outerR = 110;
  const innerR = 70;
  let start = -Math.PI / 2;
  rows.forEach((row) => {
    const slice = coach.results.totalPayAmount ? (row.amount || 0) / coach.results.totalPayAmount : 0;
    const end = start + slice * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(donutCx, donutCy);
    ctx.arc(donutCx, donutCy, outerR, start, end);
    ctx.closePath();
    ctx.fillStyle = colors.get(row.name) || '#0f172a';
    ctx.fill();
    start = end;
  });
  ctx.beginPath();
  ctx.arc(donutCx, donutCy, innerR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  text(ctx, '총액', donutCx, donutCy - 16, 12, 700, '#6b7280', 'center');
  text(ctx, formatKRW(coach.results.totalPayAmount), donutCx, donutCy + 4, 18, 900, '#111827', 'center');

  let legendY = chartY + 44;
  rows.slice(0, 10).forEach((row) => {
    ctx.fillStyle = colors.get(row.name) || '#0f172a';
    ctx.fillRect(tableX + 380, legendY + 4, 10, 10);
    text(ctx, row.name, tableX + 398, legendY, 12, 700, row.isOther ? '#b91c1c' : '#111827');
    const pct = coach.results.totalPayAmount ? ((row.amount || 0) / coach.results.totalPayAmount * 100).toFixed(1) : '0.0';
    text(ctx, `${formatKRW(row.amount || 0)} (${pct}%)`, tableX + leftW - 16, legendY, 12, 600, '#6b7280', 'right');
    legendY += 18;
  });

  text(ctx, '분석표', rightX + 14, chartY + 12, 14, 900);
  const maxAmount = Math.max(1, ...rows.map((row) => row.amount || 0));
  let barY = chartY + 50;
  rows.slice(0, 10).forEach((row) => {
    text(ctx, row.name, rightX + 14, barY, 12, 800, row.isOther ? '#b91c1c' : '#111827');
    drawRoundRect(ctx, rightX + 170, barY + 6, 360, 12, 999);
    ctx.strokeStyle = '#e5e7eb';
    ctx.stroke();
    drawRoundRect(ctx, rightX + 170, barY + 6, Math.max(2, 360 * ((row.amount || 0) / maxAmount)), 12, 999);
    ctx.fillStyle = colors.get(row.name) || '#0f172a';
    ctx.fill();
    text(ctx, formatKRW(row.amount || 0), rightX + leftW - 16, barY, 12, 800, '#111827', 'right');
    barY += 28;
  });

  const missY = chartY + 450;
  const missRows = (coach.payers?.missingPhoneRows || []).slice(0, 16);
  drawRoundRect(ctx, tableX, missY, tableW, 240, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e5e7eb';
  ctx.stroke();
  text(ctx, `전화번호 누락 명단 · ${missRows.length}건 표시`, tableX + 14, missY + 12, 14, 900);
  let missTextY = missY + 44;
  missRows.forEach((row, index) => {
    text(ctx, `${index + 1}. ${row.name || '(이름 없음)'}`, tableX + 18, missTextY, 12, 800);
    text(ctx, formatKRW(row.amount || 0), tableX + 600, missTextY, 12, 800, '#111827', 'right');
    text(ctx, `행 ${row.rowNo}`, tableX + 690, missTextY, 12, 600, '#6b7280', 'right');
    text(ctx, row.rawPhone || '', tableX + 840, missTextY, 12, 600, '#6b7280');
    missTextY += 12;
    missTextY += 10;
  });

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${coach.name}_정리표_${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
