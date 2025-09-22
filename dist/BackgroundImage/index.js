(function(){const i=document.querySelectorAll(".background-image-hint"),a=window.innerWidth<window.innerHeight;function c(t){document.body.classList.add("has-bg");const e=document.createElement("style"),n=new URL(t);if(!(n.protocol==="http:"||n.protocol==="https:")){mw.log.error("Invalid image URL:",t);return}e.innerHTML=`
body.has-bg::before {
	background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5))), url(${mw.html.escape(n.toString())});
}
		`,document.head.appendChild(e)}function o(t){let e=t.image,n=!!t.portrait;return!e||e===""||a^n?!1:(c(e),!0)}for(let t of i)if(o(t.dataset))return;const r=window.gadgetBackgroundHints;if(!(!r||!r.length)){for(let t of r)if(o(t))return}})();
