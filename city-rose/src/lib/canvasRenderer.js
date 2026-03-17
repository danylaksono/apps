import { BIN_SIZE } from './constants';
import { formatCoordinates } from './geo';

function drawMapNetwork(ctx, geometryElements, projection) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  geometryElements.forEach((element) => {
    if (!element.geometry || element.geometry.length < 2) {
      return;
    }

    ctx.beginPath();
    const [x0, y0] = projection(element.geometry[0].lat, element.geometry[0].lon);
    ctx.moveTo(x0, y0);

    element.geometry.slice(1).forEach((point) => {
      const [x, y] = projection(point.lat, point.lon);
      ctx.lineTo(x, y);
    });

    const roadClass = element.tags?.highway || '';
    if (['motorway', 'trunk', 'primary'].includes(roadClass)) {
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#0f172a';
    } else if (['secondary', 'tertiary'].includes(roadClass)) {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#334155';
    } else {
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = '#94a3b8';
    }

    ctx.stroke();
  });
}

function drawRose(ctx, roseData, width, height) {
  const roseSize = 340;
  const roseX = width - roseSize / 2 - 80;
  const roseY = height - roseSize / 2 - 120;
  const roseRadius = roseSize * 0.42;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 40;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(roseX, roseY, roseSize * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1.5;
  [0.33, 0.66, 1].forEach((ratio) => {
    ctx.beginPath();
    ctx.arc(roseX, roseY, roseRadius * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });

  const maxValue = Math.max(...roseData);
  roseData.forEach((value, index) => {
    const length = (value / maxValue) * roseRadius;
    const startAngle = ((index * BIN_SIZE - 90 - BIN_SIZE / 2 + 0.5) * Math.PI) / 180;
    const endAngle = ((index * BIN_SIZE - 90 + BIN_SIZE / 2 - 0.5) * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(roseX, roseY);
    ctx.arc(roseX, roseY, length, startAngle, endAngle);
    ctx.fillStyle = `hsla(${(index * BIN_SIZE) % 180}, 65%, 45%, 0.85)`;
    ctx.fill();
  });

  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('N', roseX, roseY - roseRadius - 15);
  ctx.fillText('S', roseX, roseY + roseRadius + 25);
}

function drawLabels(ctx, cityName, coords, margin, height) {
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.font = '900 64px "Space Grotesk", sans-serif';
  ctx.fillText(cityName.toUpperCase(), margin, height - 140);

  ctx.font = '600 16px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('STREET ORIENTATION FINGERPRINT', margin, height - 110);

  ctx.font = '500 14px monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(formatCoordinates(coords.lat, coords.lon), margin, height - 85);
}

export function drawPoster(canvas, options) {
  if (!canvas) {
    return;
  }

  const { bbox, cityName, coords, osmElements, roseData } = options;
  if (!bbox || !roseData || !osmElements || !osmElements.length) {
    return;
  }

  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  context.fillStyle = '#fdfdfb';
  context.fillRect(0, 0, width, height);

  const margin = 80;
  const [latMin, latMax, lonMin, lonMax] = bbox;
  const scale = Math.min(
    (width - margin * 2) / (lonMax - lonMin),
    (height - margin * 2) / (latMax - latMin)
  );
  const offsetX = (width - (lonMax - lonMin) * scale) / 2;
  const offsetY = (height - (latMax - latMin) * scale) / 2;

  const project = (lat, lon) => [offsetX + (lon - lonMin) * scale, offsetY + (latMax - lat) * scale];

  drawMapNetwork(context, osmElements, project);
  drawRose(context, roseData, width, height);
  drawLabels(context, cityName, coords, margin, height);
}
