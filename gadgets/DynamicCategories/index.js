/**
 * Author: Canadabonk (https://meta.miraheze.org/wiki/User:Canadabonk)
 * Original URL: https://dev.miraheze.org/wiki/Dynamic_Categories/MediaWiki:Gadget-dynamiccategories.js
 * License: CC BY-SA 4.0
 */
const defaultCategoryView = 'Dynamic'; // Choose from 'Classic', 'Dynamic' or 'Gallery' — first letter capital
const galleryCatStyle = 'Compacter'; // 'Normal', 'Compact' or 'Compacter'
const catlistAlphabets = false; // Whether to show navigation alphabet menu above category list

const labels = {
	classic: 'Classic',
	dynamic: 'Dynamic',
	gallery: 'Gallery',
	prev: 'Previous',
	next: 'Next'
};

const i18n = {
	// Change "previous page" to your wiki's language if not English.
	// Check by going to a category page and adding "?pagefrom=A" to the URL.
	previouspage: 'previous page'
};

function insertWbr($span) {
	const text = $span.text();
	$span.empty();
	text.split(/([:/])/).forEach(function (part) {
		$span.append(document.createTextNode(part));
		if (/[:/]/.test(part)) {
			$span.append(document.createElement('wbr'));
		}
	});
}

$(function () {
	if (!$('body').is('.ns-14')) {
		return;
	}

	$('#mw-pages > :not(a)').appendTo($('#mw-pages').clone().empty().insertBefore('#mw-pages'));
	$('[id=mw-pages]').eq(1).attr('id', 'mw-pages-extra');

	const $mwPages = $('#mw-pages');

	if (!localStorage.categoryView) {
		localStorage.categoryView = defaultCategoryView;
	}

	$mwPages.attr('class', 'catview-' + localStorage.categoryView);

	catMagicWords('__CLASSICCAT__', 'catview-Classic');
	catMagicWords('__DYNAMICCAT__', 'catview-Dynamic');
	catMagicWords('__GALLERYCAT__', 'catview-Gallery');

	const
		iconClassic = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>',
		iconDynamic = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M40 48C26.7 48 16 58.7 16 72l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24L40 48zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM16 232l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24l0 48c0 13.3 10.7 24 24 24l48 0c13.3 0 24-10.7 24-24l0-48c0-13.3-10.7-24-24-24l-48 0z"/></svg>',
		iconGallery = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M384 96l0 128-128 0 0-128 128 0zm0 192l0 128-128 0 0-128 128 0zM192 224L64 224 64 96l128 0 0 128zM64 288l128 0 0 128L64 416l0-128zM64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32z"/></svg>',
		iconEmpty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l140.1 0L400 115.9 400 320c0 8.8-7.2 16-16 16zM192 384l192 0c35.3 0 64-28.7 64-64l0-204.1c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1L192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-32-48 0 0 32c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l32 0 0-48-32 0z"/></svg>';

	$('#mw-pages > p:first-of-type').after(`<div class="catlist-menu"><div class="catlist-selector"><span class="catbtn" data-label="${labels.classic}" title="Classic">${iconClassic}</span><span class="catbtn" data-label="${labels.dynamic}" title="Dynamic">${iconDynamic}</span><span class="catbtn" data-label="${labels.gallery}" title="Gallery">${iconGallery}</span></div></div>`);

	$mwPages.find('.catlist-menu').prepend('<div class="catlist-nav"></div>');

	if (catlistAlphabets) {
		$mwPages.find('.catlist-nav').prepend('<div class="catlist-alphabet"></div>');

		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
			alphabetlist = $mwPages.find('.catlist-alphabet');

		for (const x of alphabet) {
			alphabetlist.append($('<a>').addClass('catbtn').attr('href', '?pagefrom=' + x).text(x));
		}

		alphabetlist.prepend($('<a>').addClass('catbtn').attr('href', '?').text('#'));
	}

	if ($('#mw-pages-extra > a').length > 0) {
		$mwPages.find('.catlist-nav')
			.prepend($('<span>').addClass('catbtn catlist-prev').text(labels.prev))
			.append($('<span>').addClass('catbtn catlist-next').text(labels.next));
		$mwPages.append(
			$('<div>').addClass('catlist-nav')
				.append($('<span>').addClass('catbtn catlist-prev').text(labels.prev))
				.append($('<span>').addClass('catbtn catlist-next').text(labels.next))
		);

		const $extraLinks = $('#mw-pages-extra > a');
		const firstExtraLink = $extraLinks.eq(0);
		const secondExtraLink = $extraLinks.eq(1);

		if (firstExtraLink.text().toLowerCase() === i18n.previouspage.toLowerCase()) {
			$mwPages.find('.catlist-prev').replaceWith(
				$('<a>').addClass('catbtn catlist-prev').attr('href', firstExtraLink.attr('href')).text(labels.prev)
			);
		} else {
			$mwPages.find('.catlist-next').replaceWith(
				$('<a>').addClass('catbtn catlist-next').attr('href', firstExtraLink.attr('href')).text(labels.next)
			);
		}

		if (secondExtraLink.text() !== firstExtraLink.text()) {
			$mwPages.find('.catlist-next').replaceWith(
				$('<a>').addClass('catbtn catlist-next').attr('href', secondExtraLink.attr('href')).text(labels.next)
			);
		}
	}

	const iconPrev = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>',
		iconNext = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--!Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>';

	$mwPages.find('.catlist-prev').prepend(iconPrev);
	$mwPages.find('.catlist-next').append(iconNext);
	$('#mw-pages-extra').remove();

	$mwPages.find('.catlist-selector .catbtn[title="' + $mwPages.attr('class').slice(8) + '"]').addClass('active');

	$mwPages.find('.catlist-selector .catbtn').click($.proxy(catSelect, null));

	$mwPages.find('.mw-category').after('<div class="gallery-catlist"><ul></ul></div>');
	$mwPages.find('.mw-category li').clone().appendTo($mwPages.find('.gallery-catlist ul'));
	$mwPages.find('.mw-category').clone().removeClass().addClass('dynamic-catlist').insertAfter($mwPages.find('.mw-category'));

	switch (galleryCatStyle) {
		case 'Compact':
			$mwPages.find('.gallery-catlist').addClass('gallery-compact');
			break;
		case 'Compacter':
			$mwPages.find('.gallery-catlist').addClass('gallery-compacter');
	}

	const api = new mw.Api();
	const pages = [];
	const pageslice = [];

	$mwPages.find('.mw-category li a').each(function () {
		pages.push($(this).attr('title'));
	});

	for (let i = 0; pages.length > i * 50; i++) {
		pageslice[i] = pages.slice(i * 50, (i + 1) * 50);
	}

	Promise.all(pageslice.map(function (value) {
		const pageimagesparams = {
			action: 'query',
			format: 'json',
			prop: 'pageimages',
			pithumbsize: '200',
			titles: value
		};

		return new Promise((resolve) => {
			api.get(pageimagesparams).done(function (data) {
				resolve(Object.values(data.query.pages));
			});
		});
	}))
		.then(function (values) {
			const imageslist = values.flatMap((a) => a);
			imageslist.sort((a, b) => pages.indexOf(a.title) - pages.indexOf(b.title));

			$mwPages.find('.gallery-catlist li a').each(function (index) {
				const $a = $(this);
				$a.wrapInner('<div class="catgallery-text"><span></span></div>');
				insertWbr($a.find('span'));
				try {
					$('<img>').addClass('catgallery-thumb catgallery-img')
						.attr('src', imageslist[index].thumbnail.source)
						.prependTo(this);
				} catch {
					$a.addClass('catgallery-noimg').prepend(`<div class="catgallery-thumb">${iconEmpty}</div>`);
				}
			});

			$mwPages.find('.dynamic-catlist li a').each(function (index) {
				const $a = $(this);
				try {
					$('<a>').attr({ title: $a.attr('title'), href: $a.attr('href') })
						.append(
							$('<img>').addClass('catlink-thumb').attr('src', imageslist[index].thumbnail.source)
						)
						.insertBefore(this);
				} catch {
					$a.before(`<div class="catlink-thumb">${iconEmpty}</div>`);
				}
			});
		});

	if ($('.ext-darkmode-link').length > 0) {
		$mwPages.find('> div').addClass('mw-no-invert');
	}
});

function catSelect() {
	const $btn = $(this);
	$btn.addClass('active').siblings().removeClass('active');
	localStorage.categoryView = $btn.attr('title');
	$('#mw-pages').attr('class', 'catview-' + $btn.attr('title'));
}

function catMagicWords(magicword, addclass) {
	const $parserOutput = $('.mw-parser-output');
	const html = $parserOutput.html();
	if (html.search(magicword) > -1) {
		$parserOutput.html(html.replace(magicword, ''));
		$('#mw-pages').attr('class', addclass);
	}
}
