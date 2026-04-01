import React, { useRef, useEffect, useCallback } from 'react';
import type { JoySlice } from '../services/dataService';

interface JoyplotCanvasProps {
  slices: JoySlice[];
  bbox: number[] | null;
  geojson: any;
  maxPop: number;
  heightScale: number;
}

const JoyplotCanvas: React.FC<JoyplotCanvasProps> = ({ slices, bbox, geojson, maxPop, heightScale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox || slices.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, width, height);

    const [minLon, minLat, maxLon, maxLat] = bbox;
    const mapWidth = maxLon - minLon;
    const mapHeight = maxLat - minLat;

    // Isometric projection logic
    const pitch = 0.6;
    const padding = 100;
    const scale = Math.min((width - padding) / mapWidth, (height - padding) / (mapHeight * pitch)) * 0.8;
    
    const drawnWidth = mapWidth * scale;
    const drawnHeight = mapHeight * scale * pitch;
    
    const offsetX = (width - drawnWidth) / 2;
    const offsetY = (height - drawnHeight) / 2 + (heightScale * 8);

    const project = (lon: number, lat: number, pop: number) => {
      const x = offsetX + (lon - minLon) * scale;
      const flatY = offsetY + (maxLat - lat) * scale * pitch;
      const z = (pop / maxPop) * (heightScale * 15);
      return { x, y: flatY - z };
    };

    // 1. Draw Boundary
    if (geojson) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.lineWidth = 1;

      const drawPolygon = (ring: number[][]) => {
        ctx.beginPath();
        ring.forEach((coord, i) => {
          const {x, y} = project(coord[0], coord[1], 0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      if (geojson.type === 'Polygon') {
        geojson.coordinates.forEach(drawPolygon);
      } else if (geojson.type === 'MultiPolygon') {
        geojson.coordinates.forEach((polygon: any) => {
          polygon.forEach(drawPolygon);
        });
      }
    }

    // 2. Render Joyplot Slices (Back to Front)
    slices.forEach((slice, index) => {
      if (slice.points.length === 0) return;

      ctx.beginPath();
      const startPt = project(slice.points[0].lon, slice.points[0].lat, 0);
      ctx.moveTo(startPt.x, startPt.y);

      slice.points.forEach(pt => {
        const {x, y} = project(pt.lon, pt.lat, pt.pop);
        ctx.lineTo(x, y);
      });

      const endPt = project(slice.points[slice.points.length-1].lon, slice.points[slice.points.length-1].lat, 0);
      ctx.lineTo(endPt.x, endPt.y);
      ctx.lineTo(startPt.x, startPt.y);

      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.beginPath();
      slice.points.forEach((pt, i) => {
        const {x, y} = project(pt.lon, pt.lat, pt.pop);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      const t = index / slices.length;
      const r = Math.round(0 * (1 - t) + 255 * t);
      const g = Math.round(212 * (1 - t) + 0 * t);
      const b = Math.round(255 * (1 - t) + 128 * t);

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [bbox, slices, maxPop, heightScale, geojson]);

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
      className="absolute inset-0 w-full h-full block"
    />
  );
};

export default JoyplotCanvas;
