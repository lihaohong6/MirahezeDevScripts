(function(){const o=document.querySelectorAll(".background-image-hint"),i=window.innerWidth<window.innerHeight;function a(t){document.body.classList.add("has-bg");const e=document.createElement("style");e.innerHTML=`
body.has-bg::before {
	background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5))), url(${t});
}
		`,document.head.appendChild(e)}function r(t){let e=t.image,d=!!t.portrait;return!e||e===""||i^d?!1:(a(e),!0)}for(let t of o)if(r(t.dataset))return;const n=window.gadgetBackgroundHints;if(!(!n||!n.length)){for(let t of n)if(r(t))return}})();
