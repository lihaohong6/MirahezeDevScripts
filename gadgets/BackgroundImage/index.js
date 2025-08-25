(function() {
	const hint = document.querySelector(".background-image-hint");
	if (!hint) {
		return;
	}
	let image = hint.dataset.image;
	if (!image || image === "") {
		return;
	}
	document.body.classList.add("has-bg");
	const style = document.createElement('style');
	style.innerHTML = `
body.has-bg::before {
	background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity))), url(${image});
}
	`;
	document.head.appendChild(style);
}());
