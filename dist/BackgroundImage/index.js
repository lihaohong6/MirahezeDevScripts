(function(){const a=document.querySelectorAll(".background-image-hint"),c=window.innerWidth<window.innerHeight;function d(t){t.startsWith("//")&&(t="https:"+t);const n=new URL(t);if(!(n.protocol==="http:"||n.protocol==="https:")){mw.log.error("Invalid image URL:",t);return}const i=document.createElement("style");i.innerHTML=`
		body.has-bg::before {
			background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5))), url(${mw.html.escape(n.toString())});
			}
			`,document.head.appendChild(i),document.body.classList.add("has-bg")}function r(t){let n=t.image,o=!!t.portrait;return!n||n===""||c^o?!1:(d(n),!0)}for(let t of a)if(r(t.dataset))return;const e=window.gadgetBackgroundHints;if(!(!e||!e.length)){for(let t of e)if(r(t))return}})();
