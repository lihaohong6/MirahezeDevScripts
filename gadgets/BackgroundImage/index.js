(function() {
	const hints = document.querySelectorAll(".background-image-hint");
	const portraitMode = window.innerWidth < window.innerHeight;

	function setBackground(image) {
		if (image.startsWith("//")) {
			image = "https:" + image;
		}
		const url = new URL(image);
		const valid = url.protocol === 'http:' || url.protocol === 'https:';
		if (!valid) {
			mw.log.error('Invalid image URL:', image);
			return;
		}
		const style = document.createElement('style');
		style.innerHTML = `
		body.has-bg::before {
			background-image: linear-gradient(rgba(var(--gadget-bg-color), var(--gadget-bg-opacity, 0.5))), url(${mw.html.escape(url.toString())});
			}
			`;
		document.head.appendChild(style);
		document.body.classList.add("has-bg");
	}

	function checkBackgroundHintAndSet(dataset) {
		let image = dataset.image;
		let portrait = !!dataset.portrait;
		if (!image || image === "") {
			return false;
		}
		// We shouldn't force a landscape mode background image on mobile
		// unless explicitly told that we can.
		// Similarly, we shouldn't force a portrait mode background image
		// on a desktop computer.
		if (portraitMode ^ portrait) {
			return false;
		}
		setBackground(image);
		return true;
	}

	for (let hint of hints) {
		const result = checkBackgroundHintAndSet(hint.dataset);
		if (result) {
			return;
		}
	}

	const windowHints = window.gadgetBackgroundHints;

	if (!windowHints || !windowHints.length) {
		return;
	}

	for (let hint of windowHints) {
		const result = checkBackgroundHintAndSet(hint);
		if (result) {
			return;
		}
	}

}());
