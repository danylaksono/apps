/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/@floating-ui/utils@0.2.1/dist/floating-ui.utils.dom.mjs
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
function n(n){return o(n)?(n.nodeName||"").toLowerCase():"#document"}function e(n){var e;return(null==n||null==(e=n.ownerDocument)?void 0:e.defaultView)||window}function t(n){var e;return null==(e=(o(n)?n.ownerDocument:n.document)||window.document)?void 0:e.documentElement}function o(n){return n instanceof Node||n instanceof e(n).Node}function r(n){return n instanceof Element||n instanceof e(n).Element}function c(n){return n instanceof HTMLElement||n instanceof e(n).HTMLElement}function u(n){return"undefined"!=typeof ShadowRoot&&(n instanceof ShadowRoot||n instanceof e(n).ShadowRoot)}function i(n){const{overflow:e,overflowX:t,overflowY:o,display:r}=m(n);return/auto|scroll|overlay|hidden|clip/.test(e+o+t)&&!["inline","contents"].includes(r)}function l(e){return["table","td","th"].includes(n(e))}function f(n){const e=a(),t=m(n);return"none"!==t.transform||"none"!==t.perspective||!!t.containerType&&"normal"!==t.containerType||!e&&!!t.backdropFilter&&"none"!==t.backdropFilter||!e&&!!t.filter&&"none"!==t.filter||["transform","perspective","filter"].some((n=>(t.willChange||"").includes(n)))||["paint","layout","strict","content"].some((n=>(t.contain||"").includes(n)))}function s(n){let e=w(n);for(;c(e)&&!d(e);){if(f(e))return e;e=w(e)}return null}function a(){return!("undefined"==typeof CSS||!CSS.supports)&&CSS.supports("-webkit-backdrop-filter","none")}function d(e){return["html","body","#document"].includes(n(e))}function m(n){return e(n).getComputedStyle(n)}function p(n){return r(n)?{scrollLeft:n.scrollLeft,scrollTop:n.scrollTop}:{scrollLeft:n.pageXOffset,scrollTop:n.pageYOffset}}function w(e){if("html"===n(e))return e;const o=e.assignedSlot||e.parentNode||u(e)&&e.host||t(e);return u(o)?o.host:o}function v(n){const e=w(n);return d(e)?n.ownerDocument?n.ownerDocument.body:n.body:c(e)&&i(e)?e:v(e)}function y(n,t,o){var r;void 0===t&&(t=[]),void 0===o&&(o=!0);const c=v(n),u=c===(null==(r=n.ownerDocument)?void 0:r.body),l=e(c);return u?t.concat(l,l.visualViewport||[],i(c)?c:[],l.frameElement&&o?y(l.frameElement):[]):t.concat(c,y(c,[],o))}export{m as getComputedStyle,s as getContainingBlock,t as getDocumentElement,v as getNearestOverflowAncestor,n as getNodeName,p as getNodeScroll,y as getOverflowAncestors,w as getParentNode,e as getWindow,f as isContainingBlock,r as isElement,c as isHTMLElement,d as isLastTraversableNode,o as isNode,i as isOverflowElement,u as isShadowRoot,l as isTableElement,a as isWebKit};export default null;