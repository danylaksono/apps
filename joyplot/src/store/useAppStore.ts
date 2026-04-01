import { create } from 'zustand';

interface AppState {
  city: string;
  resolution: number;
  heightScale: number;
  clipToBoundary: boolean;
  panelMode: 'explore' | 'print';
  printMode: boolean;
  customTitle: string;
  customSubtitle: string;
  titlePosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
  mapScalePosition: 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  cityCenter: [number, number] | null;
  isLoading: boolean;
  statusMessage: string;
  setCity: (city: string) => void;
  setResolution: (res: number) => void;
  setHeightScale: (scale: number) => void;
  setClipToBoundary: (clip: boolean) => void;
  setPanelMode: (mode: 'explore' | 'print') => void;
  setCustomTitle: (title: string) => void;
  setCustomSubtitle: (subtitle: string) => void;
  setTitlePosition: (position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center') => void;
  setMapScalePosition: (position: 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void;
  setCityCenter: (center: [number, number] | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  city: '',
  resolution: 80,
  heightScale: 5,
  clipToBoundary: true,
  panelMode: 'explore',
  printMode: false,
  customTitle: '',
  customSubtitle: '',
  titlePosition: 'top-left',
  mapScalePosition: 'off',
  cityCenter: null,
  isLoading: false,
  statusMessage: '',
  setCity: (city) => set({ city }),
  setResolution: (resolution) => set({ resolution }),
  setHeightScale: (heightScale) => set({ heightScale }),
  setClipToBoundary: (clipToBoundary) => set({ clipToBoundary }),
  setPanelMode: (panelMode) => set({ panelMode, printMode: panelMode === 'print' }),
  setCustomTitle: (customTitle) => set({ customTitle }),
  setCustomSubtitle: (customSubtitle) => set({ customSubtitle }),
  setTitlePosition: (titlePosition) => set({ titlePosition }),
  setMapScalePosition: (mapScalePosition) => set({ mapScalePosition }),
  setCityCenter: (cityCenter) => set({ cityCenter }),
  setLoading: (isLoading, statusMessage = '') => set({ isLoading, statusMessage }),
}));
