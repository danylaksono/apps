/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/klona@2.0.6/full/index.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
function e(e,r,o){"object"==typeof o.value&&(o.value=t(o.value)),o.enumerable&&!o.get&&!o.set&&o.configurable&&o.writable&&"__proto__"!==r?e[r]=o.value:Object.defineProperty(e,r,o)}function t(r){if("object"!=typeof r)return r;var o,c,n,a=0,b=Object.prototype.toString.call(r);if("[object Object]"===b?n=Object.create(r.__proto__||null):"[object Array]"===b?n=Array(r.length):"[object Set]"===b?(n=new Set,r.forEach((function(e){n.add(t(e))}))):"[object Map]"===b?(n=new Map,r.forEach((function(e,r){n.set(t(r),t(e))}))):"[object Date]"===b?n=new Date(+r):"[object RegExp]"===b?n=new RegExp(r.source,r.flags):"[object DataView]"===b?n=new r.constructor(t(r.buffer)):"[object ArrayBuffer]"===b?n=r.slice(0):"Array]"===b.slice(-6)&&(n=new r.constructor(r)),n){for(c=Object.getOwnPropertySymbols(r);a<c.length;a++)e(n,c[a],Object.getOwnPropertyDescriptor(r,c[a]));for(a=0,c=Object.getOwnPropertyNames(r);a<c.length;a++)Object.hasOwnProperty.call(n,o=c[a])&&n[o]===r[o]||e(n,o,Object.getOwnPropertyDescriptor(r,o))}return n||r}export{t as klona};export default null;
