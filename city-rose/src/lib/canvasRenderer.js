import { BIN_SIZE } from "./constants";
import { formatCoordinates } from "./geo";

export const THEMES = {
  light: {
    bg: "#fdfdfb", motorway: "#0f172a", secondary: "#334155", tertiary: "#94a3b8",
    title: "#0f172a", subtitle: "#64748b", latlon: "#94a3b8",
    roseBg: "rgba(255, 255, 255, 0.9)", roseStroke: "#f1f5f9", roseText: "#94a3b8"
  },
  dark: {
    bg: "#0f172a", motorway: "#f8fafc", secondary: "#cbd5e1", tertiary: "#475569",
    title: "#f8fafc", subtitle: "#94a3b8", latlon: "#64748b",
    roseBg: "rgba(15, 23, 42, 0.8)", roseStroke: "#334155", roseText: "#64748b"
  },
  blueprint: {
    bg: "#1e3a8a", motorway: "#ffffff", secondary: "#93c5fd", tertiary: "#1e40af",
    title: "#ffffff", subtitle: "#bfdbfe", latlon: "#60a5fa",
    roseBg: "rgba(30, 58, 138, 0.8)", roseStroke: "#1e40af", roseText: "#60a5fa"
  },
  monochrome: {
    bg: "#ffffff", motorway: "#000000", secondary: "#555555", tertiary: "#aaaaaa",
    title: "#000000", subtitle: "#555555", latlon: "#888888",
    roseBg: "rgba(255, 255, 255, 0.9)", roseStroke: "#e5e5e5", roseText: "#888888"
  }
};

const POSTER_SIZES = {
  portrait: { width: 1600, height: 2000 },
  landscape: { width: 2000, height: 1400 },
};

export function getPosterDimensions(orientation = "portrait") {
  return POSTER_SIZES[orientation] || POSTER_SIZES.portrait;
}

function drawMapNetwork(ctx, geometryElements, projection, theme = THEMES.light) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  geometryElements.forEach((element) => {
    if (!element.geometry || element.geometry.length < 2) {
      return;
    }

    ctx.beginPath();
    const [x0, y0] = projection(
      element.geometry[0].lat,
      element.geometry[0].lon,
    );
    ctx.moveTo(x0, y0);

    element.geometry.slice(1).forEach((point) => {
      const [x, y] = projection(point.lat, point.lon);
      ctx.lineTo(x, y);
    });

    const roadClass = element.tags?.highway || "";
    if (["motorway", "trunk", "primary"].includes(roadClass)) {
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = theme.motorway;
    } else if (["secondary", "tertiary"].includes(roadClass)) {
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = theme.secondary;
    } else {
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = theme.tertiary;
    }

    ctx.stroke();
  });
}

function drawRose(ctx, roseData, roseConfig, theme = THEMES.light) {
  const { centerX, centerY, size } = roseConfig;
  const roseRadius = size * 0.42;
  const maxValue = Math.max(...roseData, 0.0001);

  ctx.shadowColor = "rgba(0, 0, 0, 0.05)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = theme.roseBg;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = theme.roseStroke;
  ctx.lineWidth = 1.5;
  [0.33, 0.66, 1].forEach((ratio) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, roseRadius * ratio, 0, Math.PI * 2);
    ctx.stroke();
  });

  roseData.forEach((value, index) => {
    const length = (value / maxValue) * roseRadius;
    const startAngle =
      ((index * BIN_SIZE - 90 - BIN_SIZE / 2 + 0.5) * Math.PI) / 180;
    const endAngle =
      ((index * BIN_SIZE - 90 + BIN_SIZE / 2 - 0.5) * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, length, startAngle, endAngle);
    ctx.fillStyle = `hsla(${(index * BIN_SIZE) % 180}, 65%, 45%, 0.85)`;
    ctx.fill();
  });

  ctx.font = '700 12px "Space Grotesk", sans-serif';
  ctx.textAlign = "center";
  ctx.fillStyle = theme.roseText;
  ctx.fillText("N", centerX, centerY - roseRadius - 15);
  ctx.fillText("S", centerX, centerY + roseRadius + 25);
}

function drawLabels(ctx, layout, cityName, coords, margin, width, height, theme) {
  const customTitle = layout.title ? layout.title.trim() : "";
  const title = (customTitle || cityName || "").toUpperCase();
  
  const customSubtitle = layout.subtitle ? layout.subtitle.trim() : "";
  const coordString = formatCoordinates(coords.lat, coords.lon);
  const subtitle = (customSubtitle || coordString).toUpperCase();

  ctx.textAlign = "left";
  
  const titleSize = Math.floor(width * 0.045);
  ctx.fillStyle = theme.title;
  ctx.font = `900 ${titleSize}px "Space Grotesk", sans-serif`;
  ctx.fillText(title, margin, height - margin - titleSize * 1.2);

  const subSize = Math.floor(width * 0.016);
  ctx.fillStyle = theme.subtitle;
  ctx.font = `600 ${subSize}px "Space Grotesk", sans-serif`;
  ctx.fillText(subtitle, margin, height - margin);

  // We only draw latlon separately if they provided a custom subtitle to replace it
  if (customSubtitle) {
    const latlonSize = Math.floor(width * 0.012);
    ctx.font = `500 ${latlonSize}px monospace`;
    ctx.fillStyle = theme.latlon;
    ctx.fillText(coordString, margin, height - margin - titleSize * 0.6);
  }
}

function getRoseCenterCoords(position, orientation, width, height) {
  const isLandscape = orientation === "landscape";
  let x = 0.78;
  let y = 0.76;

  switch (position) {
    case "bottom-right":
      x = isLandscape ? 0.82 : 0.78;
      y = isLandscape ? 0.75 : 0.76;
      break;
    case "bottom-left":
      x = isLandscape ? 0.18 : 0.22;
      y = isLandscape ? 0.75 : 0.76;
      break;
    case "top-right":
      x = isLandscape ? 0.82 : 0.78;
      y = isLandscape ? 0.25 : 0.24;
      break;
    case "top-left":
      x = isLandscape ? 0.18 : 0.22;
      y = isLandscape ? 0.25 : 0.24;
      break;
    case "center":
      x = 0.5;
      y = 0.5;
      break;
  }
  return { centerX: x * width, centerY: y * height };
}

function createProjection(bbox, width, height, mapConfig) {
  const [latMin, latMax, lonMin, lonMax] = bbox;
  const mapZoom = mapConfig.mapZoom ?? 1;
  const mapShiftX = mapConfig.mapShiftX ?? 0;
  const mapShiftY = mapConfig.mapShiftY ?? 0;
  const margin = mapConfig.margin ?? 80;

  const baseScale = Math.min(
    (width - margin * 2) / (lonMax - lonMin),
    (height - margin * 2) / (latMax - latMin),
  );

  const scale = baseScale * mapZoom;
  const offsetX =
    (width - (lonMax - lonMin) * scale) / 2 + mapShiftX * width * 0.25;
  const offsetY =
    (height - (latMax - latMin) * scale) / 2 + mapShiftY * height * 0.25;

  return (lat, lon) => [
    offsetX + (lon - lonMin) * scale,
    offsetY + (latMax - lat) * scale,
  ];
}

export function drawExploreMap(canvas, options) {
  if (!canvas) {
    return;
  }

  const {
    bbox,
    osmElements,
    mapZoom = 1.05,
    mapShiftX = 0,
    mapShiftY = 0,
  } = options;
  if (!bbox || !osmElements || !osmElements.length) {
    return;
  }

  const width = 1200;
  const height = 1200;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);

  const projection = createProjection(bbox, width, height, {
    mapZoom,
    mapShiftX,
    mapShiftY,
    margin: 90,
  });

  drawMapNetwork(context, osmElements, projection);
}

export function drawExploreRose(canvas, options) {
  if (!canvas) {
    return;
  }

  const { roseData } = options;
  if (!roseData) {
    return;
  }

  const width = 900;
  const height = 900;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);

  drawRose(context, roseData, {
    centerX: width / 2,
    centerY: height / 2,
    size: Math.min(width, height) * 0.72,
  });
}

export function drawPoster(canvas, options) {
  if (!canvas) {
    return;
  }

  const {
    bbox,
    cityName,
    coords,
    osmElements,
    roseData,
    layout = {},
  } = options;
  if (!bbox || !roseData || !osmElements || !osmElements.length) {
    return;
  }

  const orientation = layout.orientation || "portrait";
  const { width, height } = getPosterDimensions(orientation);
  const theme = THEMES[layout.theme] || THEMES.light;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  context.fillStyle = theme.bg;
  context.fillRect(0, 0, width, height);

  const margin = orientation === "landscape" ? 100 : 80;
  const projection = createProjection(bbox, width, height, {
    mapZoom: layout.mapZoom ?? 1,
    mapShiftX: layout.mapShiftX ?? 0,
    mapShiftY: layout.mapShiftY ?? 0,
    margin,
  });

  drawMapNetwork(context, osmElements, projection, theme);

  if (layout.rosePosition !== "hidden") {
    const roseSize = (layout.roseSizePercent ?? 34) * (Math.min(width, height) / 100);
    const center = getRoseCenterCoords(layout.rosePosition || "bottom-right", orientation, width, height);
    drawRose(context, roseData, { ...center, size: roseSize }, theme);
  }

  drawLabels(
    context,
    layout,
    cityName,
    coords,
    margin,
    width,
    height,
    theme
  );
}
