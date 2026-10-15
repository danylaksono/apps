// Mutable app-level state shared between modules (ES module imports are read-only bindings).
export const app={
  mode:'intro',      // 'intro' | 'story' | 'sandbox'
  sceneIdx:0,
  clock:0,           // seconds since start (animation time)
  elapsed:0,         // seconds inside the current story scene
  cutOverride:null   // user-chosen cross-section position, or null to follow the scene
};
