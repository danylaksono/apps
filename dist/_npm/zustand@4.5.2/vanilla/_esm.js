/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/zustand@4.5.2/esm/vanilla.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
const e=e=>{let t;const o=new Set,n=(e,n)=>{const r="function"==typeof e?e(t):e;if(!Object.is(r,t)){const e=t;t=(null!=n?n:"object"!=typeof r||null===r)?r:Object.assign({},t,r),o.forEach((o=>o(t,e)))}},r=()=>t,a={setState:n,getState:r,getInitialState:()=>s,subscribe:e=>(o.add(e),()=>o.delete(e)),destroy:()=>{"production"!==(import.meta.env?import.meta.env.MODE:void 0)&&console.warn("[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."),o.clear()}},s=t=e(n,r,a);return a},t=t=>t?e(t):e;var o=e=>("production"!==(import.meta.env?import.meta.env.MODE:void 0)&&console.warn("[DEPRECATED] Default export is deprecated. Instead use import { createStore } from 'zustand/vanilla'."),t(e));export{t as createStore,o as default};
