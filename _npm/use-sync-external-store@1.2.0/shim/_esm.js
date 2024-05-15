/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/use-sync-external-store@1.2.0/shim/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import t from"../../react@18.3.1/_esm.js";var e={exports:{}},n={},r=t;var o="function"==typeof Object.is?Object.is:function(t,e){return t===e&&(0!==t||1/t==1/e)||t!=t&&e!=e},u=r.useState,a=r.useEffect,s=r.useLayoutEffect,i=r.useDebugValue;function c(t){var e=t.getSnapshot;t=t.value;try{var n=e();return!o(t,n)}catch(t){return!0}}var f="undefined"==typeof window||void 0===window.document||void 0===window.document.createElement?function(t,e){return e()}:function(t,e){var n=e(),r=u({inst:{value:n,getSnapshot:e}}),o=r[0].inst,f=r[1];return s((function(){o.value=n,o.getSnapshot=e,c(o)&&f({inst:o})}),[t,n,e]),a((function(){return c(o)&&f({inst:o}),t((function(){c(o)&&f({inst:o})}))}),[t]),i(n),n};n.useSyncExternalStore=void 0!==r.useSyncExternalStore?r.useSyncExternalStore:f,e.exports=n;var v=e.exports,p=e.exports.useSyncExternalStore;export{v as default,p as useSyncExternalStore};
