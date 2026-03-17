/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/use-sync-external-store@1.2.0/shim/with-selector.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import e from"../../../react@18.2.0/_esm.js";import r from"../_esm.js";var t={exports:{}},n={},u=e,o=r;var a="function"==typeof Object.is?Object.is:function(e,r){return e===r&&(0!==e||1/e==1/r)||e!=e&&r!=r},l=o.useSyncExternalStore,i=u.useRef,s=u.useEffect,c=u.useMemo,f=u.useDebugValue;n.useSyncExternalStoreWithSelector=function(e,r,t,n,u){var o=i(null);if(null===o.current){var v={hasValue:!1,value:null};o.current=v}else v=o.current;o=c((function(){function e(e){if(!i){if(i=!0,o=e,e=n(e),void 0!==u&&v.hasValue){var r=v.value;if(u(r,e))return l=r}return l=e}if(r=l,a(o,e))return r;var t=n(e);return void 0!==u&&u(r,t)?r:(o=e,l=t)}var o,l,i=!1,s=void 0===t?null:t;return[function(){return e(r())},null===s?void 0:function(){return e(s())}]}),[r,t,n,u]);var m=l(e,o[0],o[1]);return s((function(){v.hasValue=!0,v.value=m}),[m]),f(m),m},t.exports=n;var v=t.exports,m=t.exports.useSyncExternalStoreWithSelector;export{v as default,m as useSyncExternalStoreWithSelector};
