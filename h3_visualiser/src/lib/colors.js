export const COLOR_SCALE = [
  [65, 182, 196],  // Low
  [254, 204, 92],  // Mid
  [240, 59, 32]    // High
];

// Helper to interpolate colors based on a normalized value (0.0 to 1.0)
export const interpolateColor = (val) => {
  if (val <= 0) return COLOR_SCALE[0];
  if (val >= 1) return COLOR_SCALE[2];
  
  const scaled = val * 2;
  const index = Math.floor(scaled);
  const remainder = scaled - index;
  
  const c1 = COLOR_SCALE[index];
  const c2 = COLOR_SCALE[index + 1];
  
  if (!c2) return c1;
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * remainder),
    Math.round(c1[1] + (c2[1] - c1[1]) * remainder),
    Math.round(c1[2] + (c2[2] - c1[2]) * remainder),
    255
  ];
};
