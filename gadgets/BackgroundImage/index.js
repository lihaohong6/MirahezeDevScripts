(function(){const t=document.querySelector(".background-image-hint");if(!t)return;let e=t.dataset.image;if(!e||e==="")return;document.body.classList.add("has-bg");const a=document.createElement("style");a.innerHTML=`
body.has-bg::before {
	background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity))), url(${e});
}
	`,document.head.appendChild(a)})();
