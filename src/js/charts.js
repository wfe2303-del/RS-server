import { EMPTY_DONUT_COLOR } from './config.js';

export function drawDonut(canvas, items, total, colorByName) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fffdf9';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) * 0.42;
  const innerRadius = outerRadius * 0.62;

  if (!total) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = EMPTY_DONUT_COLOR;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf9';
    ctx.fill();
    return;
  }

  let start = -Math.PI / 2;

  items.forEach((item) => {
    const amount = Math.max(0, Number(item.amount || 0));
    const end = start + (amount / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, outerRadius, start, end);
    ctx.closePath();
    ctx.fillStyle = colorByName.get(item.name) || '#475569';
    ctx.fill();

    start = end;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#fffdf9';
  ctx.fill();
}
