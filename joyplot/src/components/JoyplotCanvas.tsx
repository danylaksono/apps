import React, { useRef, useEffect, useCallback } from 'react';
import type { JoySlice } from '../services/dataService';

interface JoyplotCanvasProps {
  slices: JoySlice[];
  bbox: number[] | null;
  geojson: any;
  maxPop: number;
  heightScale: number;
  pitch: number;
  padding: number;
  projectionScale: number;
  offsetX: number;
  offsetY: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  clipToBoundary: boolean;
  printMode: boolean;
  printTheme: 'light' | 'dark';
  city: string;
  cityCenter: [number, number] | null;
  customTitle: string;
  customSubtitle: string;
  titlePosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
  mapScalePosition: 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

const JoyplotCanvas: React.FC<JoyplotCanvasProps> = ({
  slices,
  bbox,
  geojson,
  maxPop,
  heightScale,
  clipToBoundary,
  printMode,
  printTheme,
  city,
  cityCenter,
  customTitle,
  customSubtitle,
  titlePosition,
  mapScalePosition,
  pitch,
  padding,
  projectionScale,
  offsetX,
  offsetY,
  rotateX,
  rotateY,
  rotateZ,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox || slices.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const isPrintLight = printMode && printTheme === 'light';
    const isPrintDark = printMode && printTheme === 'dark';

    // Clear background
    ctx.fillStyle = isPrintLight ? '#f8fafc' : isPrintDark ? '#020617' : '#0a0f1a';
    ctx.fillRect(0, 0, width, height);

    const [minLon, minLat, maxLon, maxLat] = bbox;
    const mapWidth = maxLon - minLon;
    const mapHeight = maxLat - minLat;

    const clampedPitch = Math.max(0.15, Math.min(1, pitch));
    const clampedPadding = Math.max(0, padding);
    const baseScale = Math.min((width - clampedPadding) / mapWidth, (height - clampedPadding) / (mapHeight * clampedPitch)) * 0.8;
    const scale = Math.max(0.05, baseScale * Math.max(0.1, projectionScale));
    
    const drawnWidth = mapWidth * scale;
    const drawnHeight = mapHeight * scale * clampedPitch;
    
    const baseOffsetX = (width - drawnWidth) / 2;
    const baseOffsetY = (height - drawnHeight) / 2 + (heightScale * 8);
    const finalOffsetX = baseOffsetX + offsetX;
    const finalOffsetY = baseOffsetY + offsetY;

    const rotateXRad = (rotateX * Math.PI) / 180;
    const rotateYRad = (rotateY * Math.PI) / 180;
    const rotateZRad = (rotateZ * Math.PI) / 180;
    const cosX = Math.cos(rotateXRad);
    const sinX = Math.sin(rotateXRad);
    const cosY = Math.cos(rotateYRad);
    const sinY = Math.sin(rotateYRad);
    const cosZ = Math.cos(rotateZRad);
    const sinZ = Math.sin(rotateZRad);
    const mapCenterX = drawnWidth / 2;
    const mapCenterY = drawnHeight / 2;

    const project = (lon: number, lat: number, pop: number) => {
      const rawX = (lon - minLon) * scale;
      const rawY = (maxLat - lat) * scale;
      const rawZ = (pop / maxPop) * (heightScale * 15);
      const pitchedY = rawY * clampedPitch;

      const cx = rawX - mapCenterX;
      const cy = pitchedY - mapCenterY;
      const cz = rawZ;

      const x1 = cx;
      const y1 = cy * cosX - cz * sinX;
      const z1 = cy * sinX + cz * cosX;

      const x2 = x1 * cosY + z1 * sinY;
      const y2 = y1;

      const x3 = x2 * cosZ - y2 * sinZ;
      const y3 = x2 * sinZ + y2 * cosZ;

      return {
        x: x3 + mapCenterX + finalOffsetX,
        y: y3 + mapCenterY + finalOffsetY,
      };
    };

    const isPointInRing = (lon: number, lat: number, ring: number[][]) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];

        const intersects = ((yi > lat) !== (yj > lat))
          && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

        if (intersects) inside = !inside;
      }
      return inside;
    };

    const isPointInBoundary = (lon: number, lat: number) => {
      if (!geojson) return true;

      const isInsidePolygon = (rings: number[][][]) => {
        if (!rings.length) return false;
        if (!isPointInRing(lon, lat, rings[0])) return false;
        for (let i = 1; i < rings.length; i++) {
          if (isPointInRing(lon, lat, rings[i])) return false;
        }
        return true;
      };

      if (geojson.type === 'Polygon') {
        return isInsidePolygon(geojson.coordinates);
      }

      if (geojson.type === 'MultiPolygon') {
        return geojson.coordinates.some((polygon: number[][][]) => isInsidePolygon(polygon));
      }

      return true;
    };

    const interpolateBoundaryPoint = (a: { lon: number; lat: number; pop: number }, b: { lon: number; lat: number; pop: number }) => {
      const aInside = isPointInBoundary(a.lon, a.lat);
      const bInside = isPointInBoundary(b.lon, b.lat);
      if (aInside === bInside) return null;

      let lo = 0;
      let hi = 1;
      let loInside = aInside;

      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        const midLon = a.lon + (b.lon - a.lon) * mid;
        const midLat = a.lat + (b.lat - a.lat) * mid;
        const midInside = isPointInBoundary(midLon, midLat);

        if (midInside === loInside) {
          lo = mid;
        } else {
          hi = mid;
          loInside = midInside;
        }
      }

      const t = (lo + hi) / 2;
      return {
        lon: a.lon + (b.lon - a.lon) * t,
        lat: a.lat + (b.lat - a.lat) * t,
        pop: a.pop + (b.pop - a.pop) * t,
      };
    };

    const traceBoundaryPath = () => {
      if (!geojson) return;

      const traceRing = (ring: number[][]) => {
        ring.forEach((coord, i) => {
          const { x, y } = project(coord[0], coord[1], 0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      };

      ctx.beginPath();
      if (geojson.type === 'Polygon') {
        geojson.coordinates.forEach(traceRing);
      } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach((polygon: number[][][]) => {
          polygon.forEach(traceRing);
        });
      }
    };

    // 1. Draw Boundary
    if (geojson) {
      ctx.strokeStyle = isPrintLight
        ? 'rgba(15, 23, 42, 0.25)'
        : isPrintDark
          ? 'rgba(255, 255, 255, 0.12)'
          : 'rgba(255, 255, 255, 0.08)';
      ctx.fillStyle = isPrintLight
        ? 'rgba(15, 23, 42, 0.03)'
        : isPrintDark
          ? 'rgba(255, 255, 255, 0.03)'
          : 'rgba(255, 255, 255, 0.01)';
      ctx.lineWidth = 1;

      traceBoundaryPath();
      ctx.fill('evenodd');
      ctx.stroke();
    }

    // 2. Render Joyplot Slices (Back to Front)
    slices.forEach((slice, index) => {
      if (slice.points.length === 0) return;

      const segments = !clipToBoundary || !geojson
        ? [slice.points]
        : (() => {
            const result: typeof slice.points[] = [];
            let current: typeof slice.points = [];

            if (slice.points.length === 0) return result;

            const first = slice.points[0];
            if (isPointInBoundary(first.lon, first.lat)) {
              current.push(first);
            }

            for (let i = 1; i < slice.points.length; i++) {
              const prev = slice.points[i - 1];
              const next = slice.points[i];
              const prevInside = isPointInBoundary(prev.lon, prev.lat);
              const nextInside = isPointInBoundary(next.lon, next.lat);

              if (prevInside && nextInside) {
                if (current.length === 0) {
                  current.push(prev);
                }
                current.push(next);
                continue;
              }

              if (prevInside !== nextInside) {
                const edgePoint = interpolateBoundaryPoint(prev, next);

                if (prevInside) {
                  if (edgePoint) {
                    current.push(edgePoint);
                  }
                  if (current.length > 1) {
                    result.push(current);
                  }
                  current = [];
                } else {
                  current = [];
                  if (edgePoint) {
                    current.push(edgePoint);
                  }
                  current.push(next);
                }
              }
            }

            if (current.length > 1) {
              result.push(current);
            }

            return result;
          })();

      if (segments.length === 0) return;

      const t = index / slices.length;
      const r = Math.round(0 * (1 - t) + 255 * t);
      const g = Math.round(212 * (1 - t) + 0 * t);
      const b = Math.round(255 * (1 - t) + 128 * t);

      segments.forEach((segment) => {
        const startPt = project(segment[0].lon, segment[0].lat, 0);
        const endPt = project(segment[segment.length - 1].lon, segment[segment.length - 1].lat, 0);

        ctx.beginPath();
        ctx.moveTo(startPt.x, startPt.y);

        segment.forEach((pt) => {
          const { x, y } = project(pt.lon, pt.lat, pt.pop);
          ctx.lineTo(x, y);
        });

        ctx.lineTo(endPt.x, endPt.y);
        ctx.lineTo(startPt.x, startPt.y);
        ctx.fillStyle = isPrintLight ? 'rgba(148, 163, 184, 0.22)' : '#0f172a';
        ctx.fill();

        ctx.beginPath();
        segment.forEach((pt, i) => {
          const { x, y } = project(pt.lon, pt.lat, pt.pop);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });

        const strokeColor = isPrintLight
          ? `rgba(${Math.round(20 + r * 0.5)}, ${Math.round(30 + g * 0.3)}, ${Math.round(40 + b * 0.2)}, 0.95)`
          : `rgba(${r}, ${g}, ${b}, 0.95)`;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

    if (printMode) {
      const defaultTitle = city.trim() ? city.trim() : 'Joyplot Map';
      const title = customTitle.trim() || defaultTitle;
      const subtitle = customSubtitle.trim() || 'Population ridgeline map';

      const centerLat = (minLat + maxLat) / 2;
      const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
      const groundWidthMeters = Math.max(1, mapWidth * metersPerDegreeLon);
      const mapOnScreenMeters = drawnWidth / 96 * 0.0254;
      const approxScale = Math.max(1, Math.round(groundWidthMeters / Math.max(mapOnScreenMeters, 0.001)));

      ctx.textBaseline = 'top';
      ctx.font = '700 34px "Georgia", "Times New Roman", serif';
      const titleWidth = ctx.measureText(title).width;
      ctx.font = '500 16px "Segoe UI", sans-serif';
      const subtitleWidth = ctx.measureText(subtitle).width;

      const blockWidth = Math.max(titleWidth, subtitleWidth, 240);
      const blockHeight = 96;
      const margin = 48;

      let anchorX = margin;
      let anchorY = 36;

      if (titlePosition === 'top-right') {
        anchorX = width - margin - blockWidth;
        anchorY = 36;
      }
      if (titlePosition === 'top-center') {
        anchorX = (width - blockWidth) / 2;
        anchorY = 36;
      }
      if (titlePosition === 'bottom-left') {
        anchorX = margin;
        anchorY = height - margin - blockHeight;
      }
      if (titlePosition === 'bottom-right') {
        anchorX = width - margin - blockWidth;
        anchorY = height - margin - blockHeight;
      }
      if (titlePosition === 'bottom-center') {
        anchorX = (width - blockWidth) / 2;
        anchorY = height - margin - blockHeight;
      }
      if (titlePosition === 'center') {
        anchorX = (width - blockWidth) / 2;
        anchorY = (height - blockHeight) / 2;
      }

      const clampTitleAnchor = () => {
        anchorX = Math.min(Math.max(24, anchorX), width - blockWidth - 24);
        anchorY = Math.min(Math.max(24, anchorY), height - blockHeight - 24);
      };

      clampTitleAnchor();

      let scalePlacement: { x: number; y: number; width: number; height: number } | null = null;

      if (mapScalePosition !== 'off') {
        const scaleWidth = 240;
        const scaleHeight = 28;
        let scaleX = 48;
        let scaleY = 48;

        if (mapScalePosition === 'top-left') {
          scaleX = 48;
          scaleY = 48;
        }
        if (mapScalePosition === 'top-center') {
          scaleX = (width - scaleWidth) / 2;
          scaleY = 48;
        }
        if (mapScalePosition === 'top-right') {
          scaleX = width - 48 - scaleWidth;
          scaleY = 48;
        }
        if (mapScalePosition === 'bottom-left') {
          scaleX = 48;
          scaleY = height - 48 - scaleHeight;
        }
        if (mapScalePosition === 'bottom-center') {
          scaleX = (width - scaleWidth) / 2;
          scaleY = height - 48 - scaleHeight;
        }
        if (mapScalePosition === 'bottom-right') {
          scaleX = width - 48 - scaleWidth;
          scaleY = height - 48 - scaleHeight;
        }

        scaleX = Math.max(24, Math.min(scaleX, width - scaleWidth - 24));
        scaleY = Math.max(24, Math.min(scaleY, height - scaleHeight - 24));

        scalePlacement = { x: scaleX, y: scaleY, width: scaleWidth, height: scaleHeight };
      }

      if (scalePlacement) {
        const intersects = (
          a: { x: number; y: number; width: number; height: number },
          b: { x: number; y: number; width: number; height: number },
        ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

        const titleRect = { x: anchorX, y: anchorY, width: blockWidth, height: blockHeight };
        const scaleRect = {
          x: scalePlacement.x - 6,
          y: scalePlacement.y - 10,
          width: scalePlacement.width,
          height: scalePlacement.height + 18,
        };

        if (intersects(titleRect, scaleRect)) {
          scalePlacement.y = titleRect.y + titleRect.height + 16;
          scalePlacement.y = Math.max(24, Math.min(scalePlacement.y, height - scalePlacement.height - 24));
        }
      }

      ctx.fillStyle = isPrintLight ? '#0f172a' : '#f8fafc';
      ctx.font = '700 34px "Georgia", "Times New Roman", serif';
      ctx.fillText(title, anchorX, anchorY);

      ctx.fillStyle = isPrintLight ? '#475569' : '#cbd5e1';
      ctx.font = '500 16px "Segoe UI", sans-serif';
      ctx.fillText(subtitle, anchorX, anchorY + 42);

      ctx.strokeStyle = isPrintLight ? 'rgba(15, 23, 42, 0.22)' : 'rgba(248, 250, 252, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY + 72);
      ctx.lineTo(anchorX + Math.min(blockWidth, 320), anchorY + 72);
      ctx.stroke();

      if (mapScalePosition !== 'off') {
        const scaleBarPx = 160;
        const scaleBarMeters = groundWidthMeters * (scaleBarPx / drawnWidth);
        const scaleLabel = scaleBarMeters >= 1000
          ? `${(scaleBarMeters / 1000).toFixed(1)} km`
          : `${Math.round(scaleBarMeters)} m`;

        const scaleX = scalePlacement?.x ?? 48;
        const scaleY = scalePlacement?.y ?? 48;

        ctx.strokeStyle = isPrintLight ? '#0f172a' : '#f8fafc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(scaleX, scaleY);
        ctx.lineTo(scaleX + scaleBarPx, scaleY);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(scaleX, scaleY - 6);
        ctx.lineTo(scaleX, scaleY + 6);
        ctx.moveTo(scaleX + scaleBarPx, scaleY - 6);
        ctx.lineTo(scaleX + scaleBarPx, scaleY + 6);
        ctx.stroke();

        ctx.fillStyle = isPrintLight ? '#334155' : '#e2e8f0';
        ctx.font = '500 14px "Segoe UI", sans-serif';
        ctx.fillText(`${scaleLabel}  |  1:${approxScale.toLocaleString()}`, scaleX, scaleY + 10);
      }
    }
  }, [bbox, slices, maxPop, heightScale, pitch, padding, projectionScale, offsetX, offsetY, rotateX, rotateY, rotateZ, printTheme, geojson, clipToBoundary, printMode, city, cityCenter, customTitle, customSubtitle, titlePosition, mapScalePosition]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        drawCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCanvas]);

  return (
    <canvas 
      ref={canvasRef} 
      className="joyplot-canvas absolute inset-0 w-full h-full block"
    />
  );
};

export default JoyplotCanvas;
