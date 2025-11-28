(function(){const a=document.querySelectorAll(".background-image-hint"),c=window.innerWidth<window.innerHeight;function d(t){t.startsWith("//")&&(t="https:"+t);const r=new URL(t);if(!(r.protocol==="http:"||r.protocol==="https:")){mw.log.error("Invalid image URL:",t);return}const i=document.createElement("style");i.innerHTML=`
body.has-bg::before {
	background-image: linear-gradient(
		rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5)), 
		rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5))), url(${mw.html.escape(r.toString())});
}
			`,document.head.appendChild(i),document.body.classList.add("has-bg")}function n(t){let r=t.image,o=!!t.portrait;return!r||r===""||c^o?!1:(d(r),!0)}for(let t of a)if(n(t.dataset))return;const e=window.gadgetBackgroundHints;if(!(!e||!e.length)){for(let t of e)if(n(t))return}})();
