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
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  clipToBoundary: boolean;
  panelMode: 'explore' | 'print';
  printMode: boolean;
  printTheme: 'light' | 'dark';
  userSelected: boolean;
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
  setRotateX: (rotateX: number) => void;
  setRotateY: (rotateY: number) => void;
  setRotateZ: (rotateZ: number) => void;
  setClipToBoundary: (clip: boolean) => void;
  setPanelMode: (mode: 'explore' | 'print') => void;
  setCustomTitle: (title: string) => void;
  setCustomSubtitle: (subtitle: string) => void;
  setPrintTheme: (theme: 'light' | 'dark') => void;
  setUserSelected: (selected: boolean) => void;
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
  rotateX: 20,
  rotateY: -20,
  rotateZ: 0,
  clipToBoundary: true,
  panelMode: 'explore',
  printMode: false,
  printTheme: 'light',
  userSelected: false,
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
  setRotateX: (rotateX) => set({ rotateX }),
  setRotateY: (rotateY) => set({ rotateY }),
  setRotateZ: (rotateZ) => set({ rotateZ }),
  setClipToBoundary: (clipToBoundary) => set({ clipToBoundary }),
  setPanelMode: (panelMode) => set({ panelMode, printMode: panelMode === 'print' }),
  setCustomTitle: (customTitle) => set({ customTitle }),
  setCustomSubtitle: (customSubtitle) => set({ customSubtitle }),
  setPrintTheme: (printTheme) => set({ printTheme }),
  setUserSelected: (userSelected) => set({ userSelected }),
  setTitlePosition: (titlePosition) => set({ titlePosition }),
  setMapScalePosition: (mapScalePosition) => set({ mapScalePosition }),
  setCityCenter: (cityCenter) => set({ cityCenter }),
  setBoundaryOverride: (boundaryOverride, boundaryLabel = '') => set({ boundaryOverride, boundaryLabel: boundaryOverride ? boundaryLabel : '' }),
  setLoading: (isLoading, statusMessage = '') => set({ isLoading, statusMessage }),
}));
