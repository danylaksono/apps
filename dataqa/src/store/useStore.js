import { create } from 'zustand';

const useStore = create((set, get) => ({
  theme: (() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' ? 'dark' : 'light';
  })(),

  toggleTheme: () => set(state => {
    const next = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    return { theme: next };
  }),

  files: {},
  addFiles: (newFiles) => set(state => {
    const files = { ...state.files };
    newFiles.forEach(f => { files[f.name] = f; });
    return { files };
  }),
  removeFile: (name) => set(state => {
    const files = { ...state.files };
    delete files[name];
    return { files };
  }),
  clearFiles: () => set({ files: {} }),

  sentinel: '-123456',
  setSentinel: (v) => set({ sentinel: v }),

  isAnalyzing: false,
  progress: 0,
  results: [],

  logs: [],
  addLog: (msg, type = '') => set(state => ({
    logs: [...state.logs, { id: Date.now() + Math.random(), msg, type }]
  })),

  activeTab: 'stats',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeLayer: null,
  setActiveLayer: (layer) => set({ activeLayer: layer }),

  spatialData: null, // { geojson, columns, propsList, featureCount }

  toast: null,
  showToast: (msg, error = false) => {
    set({ toast: { msg, error } });
    clearTimeout(get()._toastTimer);
    const timer = setTimeout(() => set({ toast: null }), 3000);
    set({ _toastTimer: timer });
  },

  _toastTimer: null,

  clearAll: () => set({
    files: {},
    results: [],
    activeLayer: null,
    spatialData: null,
    activeTab: 'stats',
    logs: [],
  }),
}));

export default useStore;
