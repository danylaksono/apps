/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/zustand@4.5.2/esm/shallow.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
function e(e,t){if(Object.is(e,t))return!0;if("object"!=typeof e||null===e||"object"!=typeof t||null===t)return!1;if(e instanceof Map&&t instanceof Map){if(e.size!==t.size)return!1;for(const[r,n]of e)if(!Object.is(n,t.get(r)))return!1;return!0}if(e instanceof Set&&t instanceof Set){if(e.size!==t.size)return!1;for(const r of e)if(!t.has(r))return!1;return!0}const r=Object.keys(e);if(r.length!==Object.keys(t).length)return!1;for(const n of r)if(!Object.prototype.hasOwnProperty.call(t,n)||!Object.is(e[n],t[n]))return!1;return!0}var t=(t,r)=>("production"!==(import.meta.env?import.meta.env.MODE:void 0)&&console.warn("[DEPRECATED] Default export is deprecated. Instead use `import { shallow } from 'zustand/shallow'`."),e(t,r));export{t as default,e as shallow};
