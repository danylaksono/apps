/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/react-textarea-autosize@8.5.3/dist/react-textarea-autosize.browser.esm.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import e from"../@babel/runtime@7.24.4/helpers/esm/extends/_esm.js";import t from"../@babel/runtime@7.24.4/helpers/esm/objectWithoutPropertiesLoose/_esm.js";import*as r from"../react@18.2.0/_esm.js";import n from"../use-latest@1.2.1/_esm.js";import o from"../use-composed-ref@1.3.0/_esm.js";var i={"min-height":"0","max-height":"none",height:"0",visibility:"hidden",overflow:"hidden",position:"absolute","z-index":"-1000",top:"0",right:"0"},a=function(e){Object.keys(i).forEach((function(t){e.style.setProperty(t,i[t],"important")}))},d=null,u=function(e,t){var r=e.scrollHeight;return"border-box"===t.sizingStyle.boxSizing?r+t.borderSize:r-t.paddingSize};var s=function(){},l=["borderBottomWidth","borderLeftWidth","borderRightWidth","borderTopWidth","boxSizing","fontFamily","fontSize","fontStyle","fontWeight","letterSpacing","lineHeight","paddingBottom","paddingLeft","paddingRight","paddingTop","tabSize","textIndent","textRendering","textTransform","width","wordBreak"],m=!!document.documentElement.currentStyle,p=function(e){var t=window.getComputedStyle(e);if(null===t)return null;var r,n=(r=t,l.reduce((function(e,t){return e[t]=r[t],e}),{})),o=n.boxSizing;return""===o?null:(m&&"border-box"===o&&(n.width=parseFloat(n.width)+parseFloat(n.borderRightWidth)+parseFloat(n.borderLeftWidth)+parseFloat(n.paddingRight)+parseFloat(n.paddingLeft)+"px"),{sizingStyle:n,paddingSize:parseFloat(n.paddingBottom)+parseFloat(n.paddingTop),borderSize:parseFloat(n.borderBottomWidth)+parseFloat(n.borderTopWidth)})};function h(e,t,o){var i=n(o);r.useLayoutEffect((function(){var r=function(e){return i.current(e)};if(e)return e.addEventListener(t,r),function(){return e.removeEventListener(t,r)}}),[])}var c=["cacheMeasurements","maxRows","minRows","onChange","onHeightChange"],f=function(n,i){var l=n.cacheMeasurements,m=n.maxRows,f=n.minRows,g=n.onChange,b=void 0===g?s:g,v=n.onHeightChange,x=void 0===v?s:v,S=t(n,c),y=void 0!==S.value,z=r.useRef(null),w=o(z,i),R=r.useRef(0),F=r.useRef(),W=function(){var e=z.current,t=l&&F.current?F.current:p(e);if(t){F.current=t;var r=function(e,t,r,n){void 0===r&&(r=1),void 0===n&&(n=1/0),d||((d=document.createElement("textarea")).setAttribute("tabindex","-1"),d.setAttribute("aria-hidden","true"),a(d)),null===d.parentNode&&document.body.appendChild(d);var o=e.paddingSize,i=e.borderSize,s=e.sizingStyle,l=s.boxSizing;Object.keys(s).forEach((function(e){var t=e;d.style[t]=s[t]})),a(d),d.value=t;var m=u(d,e);d.value=t,m=u(d,e),d.value="x";var p=d.scrollHeight-o,h=p*r;"border-box"===l&&(h=h+o+i),m=Math.max(h,m);var c=p*n;return"border-box"===l&&(c=c+o+i),[m=Math.min(c,m),p]}(t,e.value||e.placeholder||"x",f,m),n=r[0],o=r[1];R.current!==n&&(R.current=n,e.style.setProperty("height",n+"px","important"),x(n,{rowHeight:o}))}};return r.useLayoutEffect(W),h(window,"resize",W),function(e){h(document.fonts,"loadingdone",e)}(W),r.createElement("textarea",e({},S,{onChange:function(e){y||W(),b(e)},ref:w}))},g=r.forwardRef(f);export{g as default};