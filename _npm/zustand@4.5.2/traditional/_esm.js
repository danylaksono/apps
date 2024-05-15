/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/zustand@4.5.2/esm/traditional.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import t from"../../react@18.3.1/_esm.js";import e from"../../use-sync-external-store@1.2.0/shim/with-selector.js/_esm.js";import{createStore as r}from"../vanilla/_esm.js";const{useDebugValue:n}=t,{useSyncExternalStoreWithSelector:s}=e,o=t=>t;function a(t,e=o,r){const a=s(t.subscribe,t.getState,t.getServerState||t.getInitialState,e,r);return n(a),a}const m=(t,e)=>{const n=r(t),s=(t,r=e)=>a(n,t,r);return Object.assign(s,n),s},c=(t,e)=>t?m(t,e):m;export{c as createWithEqualityFn,a as useStoreWithEqualityFn};export default null;
