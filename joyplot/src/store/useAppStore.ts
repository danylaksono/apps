import { create } from 'zustand';
import type { BoundaryResult } from '../services/dataService';

interface AppState {
  city: string;
  resolution: number;
  heightScale: number;
  pitch: number;
  padding: number;
  projectionScale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  clipToBoundary: boolean;
  panelMode: 'explore' | 'print';
  printMode: boolean;
  customTitle: string;
  customSubtitle: string;
  titlePosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
  mapScalePosition: 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  cityCenter: [number, number] | null;
  boundaryOverride: BoundaryResult | null;
  boundaryLabel: string;
  isLoading: boolean;
  statusMessage: string;
  setCity: (city: string) => void;
  setResolution: (res: number) => void;
  setHeightScale: (scale: number) => void;
  setPitch: (pitch: number) => void;
  setPadding: (padding: number) => void;
  setProjectionScale: (projectionScale: number) => void;
  setOffsetX: (offsetX: number) => void;
  setOffsetY: (offsetY: number) => void;
  setRotation: (rotation: number) => void;
  setClipToBoundary: (clip: boolean) => void;
  setPanelMode: (mode: 'explore' | 'print') => void;
  setCustomTitle: (title: string) => void;
  setCustomSubtitle: (subtitle: string) => void;
  setTitlePosition: (position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center') => void;
  setMapScalePosition: (position: 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void;
  setCityCenter: (center: [number, number] | null) => void;
  setBoundaryOverride: (boundary: BoundaryResult | null, label?: string) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  city: '',
  resolution: 80,
  heightScale: 5,
  pitch: 0.6,
  padding: 100,
  projectionScale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  clipToBoundary: true,
  panelMode: 'explore',
  printMode: false,
  customTitle: '',
  customSubtitle: '',
  titlePosition: 'top-left',
  mapScalePosition: 'off',
  cityCenter: null,
  boundaryOverride: null,
  boundaryLabel: '',
  isLoading: false,
  statusMessage: '',
  setCity: (city) => set({ city }),
  setResolution: (resolution) => set({ resolution }),
  setHeightScale: (heightScale) => set({ heightScale }),
  setPitch: (pitch) => set({ pitch }),
  setPadding: (padding) => set({ padding }),
  setProjectionScale: (projectionScale) => set({ projectionScale }),
  setOffsetX: (offsetX) => set({ offsetX }),
  setOffsetY: (offsetY) => set({ offsetY }),
  setRotation: (rotation) => set({ rotation }),
  setClipToBoundary: (clipToBoundary) => set({ clipToBoundary }),
  setPanelMode: (panelMode) => set({ panelMode, printMode: panelMode === 'print' }),
  setCustomTitle: (customTitle) => set({ customTitle }),
  setCustomSubtitle: (customSubtitle) => set({ customSubtitle }),
  setTitlePosition: (titlePosition) => set({ titlePosition }),
  setMapScalePosition: (mapScalePosition) => set({ mapScalePosition }),
  setCityCenter: (cityCenter) => set({ cityCenter }),
  setBoundaryOverride: (boundaryOverride, boundaryLabel = '') => set({ boundaryOverride, boundaryLabel: boundaryOverride ? boundaryLabel : '' }),
  setLoading: (isLoading, statusMessage = '') => set({ isLoading, statusMessage }),
}));
