/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/react-style-singleton@2.2.1/dist/es2015/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import*as e from"../react@16.14.0/_esm.js";import{getNonce as t}from"../get-nonce@1.0.1/_esm.js";var n=function(){var e=0,n=null;return{add:function(r){var u,o;0==e&&(n=function(){if(!document)return null;var e=document.createElement("style");e.type="text/css";var n=t();return n&&e.setAttribute("nonce",n),e}())&&(o=r,(u=n).styleSheet?u.styleSheet.cssText=o:u.appendChild(document.createTextNode(o)),function(e){(document.head||document.getElementsByTagName("head")[0]).appendChild(e)}(n)),e++},remove:function(){! --e&&n&&(n.parentNode&&n.parentNode.removeChild(n),n=null)}}},r=function(){var t=n();return function(n,r){e.useEffect((function(){return t.add(n),function(){t.remove()}}),[n&&r])}},u=function(){var e=r();return function(t){var n=t.styles,r=t.dynamic;return e(n,r),null}};export{r as styleHookSingleton,u as styleSingleton,n as stylesheetSingleton};export default null;
