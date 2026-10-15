// Small shared helpers: math, formatting, seeded RNG, camera preset constructor.
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const fmt=(v,d)=>v.toFixed(d).replace('.',',');

export function rng(seed){return function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}
// One seeded stream shared by every module that scatters things (vegetation, fires, rain, ET).
// Draw order matters for reproducible scenery: see the import order in main.js.
export const rand=rng(7);

export function pctTxt(v){return Math.round(v*100)+'%';}
// Camera preset: target x,y,z, distance r, azimuth th, polar ph
export const P=(x,y,z,r,th,ph)=>({x,y,z,r,th,ph});
