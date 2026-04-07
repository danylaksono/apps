import React, { useEffect, useRef } from 'react';

interface RidgePeak {
  center: number;
  amplitude: number;
  width: number;
}

interface RidgeTrack {
  baselineY: number;
  amplitude: number;
  phase: number;
  speed: number;
  peaks: RidgePeak[];
  tint: string;
}

const TRACK_COUNT = 14;
const CYCLE_SECONDS = 7.5;

function mulberry32(seed: number) {
  let t = seed >>> 0;

  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTracks(width: number, height: number): RidgeTrack[] {
  const seed = Math.floor(width * 17 + height * 23 + TRACK_COUNT * 101);
  const random = mulberry32(seed);
  const topPadding = height * 0.025;
  const bottomPadding = height * 0.04;
  const availableHeight = Math.max(1, height - topPadding - bottomPadding);
  const step = availableHeight / TRACK_COUNT;

  return Array.from({ length: TRACK_COUNT }, (_, index) => {
    const baselineY = topPadding + index * step + step * 0.84;
    const amplitude = step * (0.32 + random() * 0.22);
    const peakCount = 3 + Math.floor(random() * 4);
    const peaks = Array.from({ length: peakCount }, () => ({
      center: 0.08 + random() * 0.84,
      amplitude: 0.45 + random() * 0.9,
      width: 0.02 + random() * 0.055,
    }));
    const tintPalette = [
      [34, 211, 238],
      [103, 232, 249],
      [125, 211, 252],
      [244, 114, 182],
    ];
    const tintBase = tintPalette[index % tintPalette.length];
    const tint = `rgba(${tintBase[0]}, ${tintBase[1]}, ${tintBase[2]}, ${0.26 + random() * 0.16})`;

    return {
      baselineY,
      amplitude,
      phase: random(),
      speed: 0.66 + random() * 0.44,
      peaks,
      tint,
    };
  });
}

const WelcomeJoyplotBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracksRef = useRef<RidgeTrack[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      tracksRef.current = buildTracks(width, height);
    };

    const sampleRidge = (track: RidgeTrack, x: number) => {
      const u = x / width;
      let ridge = 0;

      track.peaks.forEach((peak) => {
        const normalized = (u - peak.center) / peak.width;
        ridge += peak.amplitude * Math.exp(-0.5 * normalized * normalized);
      });

      ridge += 0.04 * Math.sin((u * 16 + track.phase * 8) * Math.PI * 2);
      ridge += 0.018 * Math.sin(u * 58 + track.phase * 12);

      return Math.max(0, ridge) * track.amplitude;
    };

    const draw = (time: number) => {
      const tracks = tracksRef.current;
      const elapsed = time / 1000;
      const progressBase = (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS;

      context.clearRect(0, 0, width, height);

      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#07101c');
      background.addColorStop(0.5, '#091525');
      background.addColorStop(1, '#03060d');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      const glow = context.createRadialGradient(width * 0.22, height * 0.22, 0, width * 0.22, height * 0.22, Math.max(width, height) * 0.75);
      glow.addColorStop(0, 'rgba(34, 211, 238, 0.12)');
      glow.addColorStop(0.5, 'rgba(34, 211, 238, 0.05)');
      glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const sweepGradient = context.createLinearGradient(0, 0, width, 0);
      sweepGradient.addColorStop(0, 'rgba(34, 211, 238, 0)');
      sweepGradient.addColorStop(0.34, 'rgba(34, 211, 238, 0.025)');
      sweepGradient.addColorStop(0.55, 'rgba(125, 211, 252, 0.09)');
      sweepGradient.addColorStop(0.68, 'rgba(244, 114, 182, 0.05)');
      sweepGradient.addColorStop(1, 'rgba(34, 211, 238, 0)');

      tracks.forEach((track, index) => {
        const head = ((progressBase + track.phase) * track.speed) % 1;
        const activeWidth = Math.max(1, head * width);
        const baseline = track.baselineY;
        const sampleCount = Math.max(32, Math.ceil(activeWidth / 12));
        const step = activeWidth / sampleCount;

        context.save();
        context.beginPath();
        context.moveTo(0, baseline);

        for (let i = 0; i <= sampleCount; i += 1) {
          const x = Math.min(activeWidth, i * step);
          const ridge = sampleRidge(track, x);
          const y = baseline - ridge;
          context.lineTo(x, y);
        }

        context.lineTo(activeWidth, baseline);
        context.closePath();
        context.fillStyle = index % 2 === 0 ? 'rgba(8, 15, 26, 0.34)' : 'rgba(9, 20, 34, 0.28)';
        context.fill();

        context.shadowColor = track.tint;
        context.shadowBlur = 10;
        context.lineWidth = 1.8;
        context.strokeStyle = track.tint;
        context.stroke();

        context.lineWidth = 1;
        context.shadowBlur = 0;
        context.strokeStyle = sweepGradient;
        context.stroke();

        const headX = activeWidth;
        const headRidge = sampleRidge(track, headX);
        const headY = baseline - headRidge;

        context.beginPath();
        context.arc(headX, headY, 3.4, 0, Math.PI * 2);
        context.fillStyle = 'rgba(226, 232, 240, 0.72)';
        context.shadowColor = 'rgba(34, 211, 238, 0.45)';
        context.shadowBlur = 14;
        context.fill();

        context.beginPath();
        context.moveTo(headX, baseline + 10);
        context.lineTo(headX, baseline - Math.max(14, headRidge + 18));
        context.lineWidth = 1.2;
        context.strokeStyle = 'rgba(125, 211, 252, 0.28)';
        context.shadowBlur = 6;
        context.stroke();

        context.restore();
      });

      animationFrameRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    animationFrameRef.current = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="welcome-joyplot-backdrop" aria-hidden="true" />;
};

export default WelcomeJoyplotBackdrop;