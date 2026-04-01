import { create } from 'zustand';

interface AppState {
  city: string;
  resolution: number;
  heightScale: number;
  isLoading: boolean;
  statusMessage: string;
  setCity: (city: string) => void;
  setResolution: (res: number) => void;
  setHeightScale: (scale: number) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  city: '',
  resolution: 80,
  heightScale: 5,
  isLoading: false,
  statusMessage: '',
  setCity: (city) => set({ city }),
  setResolution: (resolution) => set({ resolution }),
  setHeightScale: (heightScale) => set({ heightScale }),
  setLoading: (isLoading, statusMessage = '') => set({ isLoading, statusMessage }),
}));
