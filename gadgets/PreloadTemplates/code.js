//  ================================
//      Custom preload templates
//  ================================
/*  @author Grunny 
    From https://harrypotter.wikia.com/wiki/MediaWiki:Wikia.js
    edited by leviathan_89 (version 1.06 - 07/2021)
    
    Original Source Code:
    https://dev.fandom.com/wiki/MediaWiki:PreloadTemplates.js?oldid=208770

    ** Info: **
    Template list loaded by default from "MediaWiki:Custom-PreloadTemplates",
    each syntax is loaded by default from the "/preload" subpage of the
    template.
*/

(function() {
    'use strict';
	
	// =================
	//   Configuration
	// =================
	/* Default per-wiki configuration */
	var config = {
		
		// List of boilerplates to be populated into the first (primary) dropdown.
		primary: 'MediaWiki:PreloadTemplates/primary',
		// Primary dropdown placeholder text. Set as null to use default.
		placeholderPrimary: "(insert boilerplate)",
		
		// List of boilerplates to be populated into the secondary dropdown. Set as null if unneeded
		secondary: 'MediaWiki:PreloadTemplates/secondary',
		// Secondary dropdown placeholder text. Set as null if unneeded
		placeholderSecondary: "(insert template)",
		
		// Suffix of each preload template 
		subpage: 'preload',
		
		// Maximum cache age in local storage
		storageCacheAge: 15 * 60 * 1000,	// 15 minutes
		
		// Maximum cache age of response from server (when fetching list of preload templates)
		serverCacheAge: 15 * 60,	// 15 minutes
		
	};
	
	/* Individual user can choose to override */
	var userConfig = {
		primary: (window.PreloadTemplates || {}).primary,
		placeholderPrimary: (window.PreloadTemplates || {}).placeholderPrimary,
		secondary: (window.PreloadTemplates || {}).secondary,
		placeholderSecondary: (window.PreloadTemplates || {}).placeholderSecondary,
		subpage: (window.PreloadTemplates || {}).subpage,
		storageCacheAge: (window.PreloadTemplates || {}).storageCacheAge,
		serverCacheAge: (window.PreloadTemplates || {}).serverCacheAge,
	};
	
	// =================
	//   Run
	// =================
	var i18n, $main, $help;
	var mwc = mw.config.get([
			'wgAction',
			'wgFormattedNamespaces',
	]),
	$module = $('div#wpSummaryLabel'), // UCP source editors
	$moduleOld = $('div.module_content:first'); // Old Non-UCP Source Editor
	var visualEditorSelector = 'div.ve-ui-toolbar.ve-ui-positionedTargetToolbar'; // Visual Editor

	var LC_PREFIX_PLTEMPLATES_PRIMARY = 'wiki_preload_templates_data_primary',
		LC_PREFIX_PLTEMPLATES_SECONDARY = 'wiki_preload_templates_data_secondary',
		LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_PRIMARY = 'wiki_preload_templates_list-pagename_primary',
		LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_SECONDARY = 'wiki_preload_templates_list-pagename_secondary',
		LC_PREFIX_PLTEMPLATES_EXPIRATION = 'wiki_preload_templates_expiration';

	if (mwc.wgAction !== 'edit') {
		return;
	}

	// =============
	//   Functions  
	// =============

	// Get plain message from i18n
	function msg(message) {
			return i18n.msg(message).plain();
	}

	// Parse MediaWiki code to allow the use of includeonly and noninclude tags in the preload page
	function parseMW(source){
		return source.replace(/<includeonly>(\n)?|(\n)?<\/includeonly>|\s*<noinclude>[^]*?<\/noinclude>/g, '');
	}

	// Error alert
	function notFound(page){
		alert(i18n.msg('error', '"' + page + '"').plain());
	}
    
	// Save list of templates to local cache
	function saveListOfTemplatesToCache(data) {
		localStorage.setItem(LC_PREFIX_PLTEMPLATES_PRIMARY, data.list);
		localStorage.setItem(LC_PREFIX_PLTEMPLATES_SECONDARY, data.listSecondary);
		localStorage.setItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_PRIMARY, data.pagename);
		localStorage.setItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_SECONDARY, data.pagenameSecondary);
		if (config.storageCacheAge > 0) {
			localStorage.setItem(
				LC_PREFIX_PLTEMPLATES_EXPIRATION, 
				new Date(Date.now() + config.storageCacheAge).getTime()
			);
		}
	}
    
	// Clear list of templates from cache
	function clearListOfTemplatesCache() {
		localStorage.removeItem(LC_PREFIX_PLTEMPLATES_PRIMARY);
		localStorage.removeItem(LC_PREFIX_PLTEMPLATES_SECONDARY);
		localStorage.removeItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_PRIMARY);
		localStorage.removeItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_SECONDARY);
	}
	
	// Fetch list of templates to local cache
	function getListOfTemplatesFromCache(pagename, pagenameSecondary) {
		var cacheExpiredTime = localStorage.getItem(LC_PREFIX_PLTEMPLATES_EXPIRATION);
		var cachedPagename = localStorage.getItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_PRIMARY);
		var cachedPagenameSecondary = localStorage.getItem(LC_PREFIX_PLTEMPLATES_LIST_PAGENAME_SECONDARY);
		if (
			(cacheExpiredTime === null || isNaN(+cacheExpiredTime) || Date.now() > +cacheExpiredTime) ||
			(cachedPagename !== pagename || cachedPagenameSecondary !== pagenameSecondary) 
		) {
			clearListOfTemplatesCache();
			return null;
		}
		
		return [
			localStorage.getItem(LC_PREFIX_PLTEMPLATES_PRIMARY),
			localStorage.getItem(LC_PREFIX_PLTEMPLATES_SECONDARY)
		];
	}

	// Inserts text at the cursor's current position - originally from Wookieepedia
	function insertAtCursor(myField, myValue) {
		if (document.selection) {
			// IE support
			myField.focus();
			window.sel = document.selection.createRange();
			window.sel.text = myValue;
		} else if ( myField.selectionStart || myField.selectionStart === 0 ) {
			// MOZILLA/NETSCAPE support
			var startPos = myField.selectionStart,
				endPos = myField.selectionEnd;
			myField.value = myField.value.substring(0, startPos) +
				myValue +
				myField.value.substring(endPos, myField.value.length);
		} else {
			myField.value += myValue;
		}
	}

	// Get preload text and add it to the text area
	function getPreloadPage(title) {
		// check if subpage is standard or is case by case
		var namespace = (function() {
			if (typeof window.preloadTemplates_namespace == 'undefined') return mwc.wgFormattedNamespaces['10'];
			if (typeof mwc.wgFormattedNamespaces[window.preloadTemplates_namespace] != 'undefined') return mwc.wgFormattedNamespaces[window.preloadTemplates_namespace];
			for (var key in mwc.wgFormattedNamespaces) {
				if (mwc.wgFormattedNamespaces[key] == window.preloadTemplates_namespace) return mwc.wgFormattedNamespaces[key];
			}
			return mwc.wgFormattedNamespaces['10'];
		})();
		var namespacePagename = (function() {
			if (namespace) return namespace + ':';
			return '';
		})();
		var page = config.subpage === 'case-by-case' ?
			namespacePagename + title :
			namespacePagename + title + '/' + config.subpage;

		$.get(mw.util.wikiScript(), {
				title: page,
				action: 'raw',
				ctype: 'text/plain'
		}).done(function(preloadData) {
			// Parse some MediaWiki tags
			var preloadDataParsed = parseMW(preloadData);
			// Display error if no useful data is present
			if (preloadDataParsed === '') {
				notFound(page);
				return;
			}

			// Insert syntax
			var cke = document.getElementsByClassName('cke_source'),
				textbox = document.getElementById('wpTextbox1'),
				cm5 = $('.CodeMirror').get(0),
				cm6 = $('.cm-editor').get(0);
			if (window.ve && ve.init && ve.init.target && ve.init.target.active) {
				// UCP Visual Editor (Source mode)
				ve.init.target
					.getSurface()
					.getModel().
					getFragment()
					.insertContent(preloadDataParsed);
			} else if (cke.length) {
				// Visual editor
				insertAtCursor(cke[0], preloadDataParsed);
			} else if (cm5){
				// CodeMirrorV5 [legacy]: text editor with syntax highlight
				var cmEditor = cm5.CodeMirror;
				var cmdDoc = cmEditor.getDoc();
				cmdDoc.replaceRange(preloadDataParsed, cmdDoc.getCursor());
			} else if (cm6){
				// CodeMirrorV6: text editor with syntax highlight (only way to interact with editor is through a hook return)
				var cm6Edit = function(_, cmEditor) {
					var cmCursor = (cmEditor.view.state && cmEditor.view.state.selection && cmEditor.view.state.selection.ranges && cmEditor.view.state.selection.ranges[0]) || {from:0, to:0};
					cmEditor.view.dispatch({
						changes: {
							from: cmCursor.from,
							to: cmCursor.to,
							insert: preloadDataParsed
						},
						selection: {anchor: cmCursor.from}
					});
					cmEditor.view.focus();
					mw.hook('ext.CodeMirror.ready').remove(cm6Edit);
				};
				mw.hook('ext.CodeMirror.ready').add(cm6Edit);
			}
			else if(textbox) {
				insertAtCursor(textbox, preloadDataParsed);
			} else {
				console.warn('[PreloadTemplates] Could not find textbox to bind to');
			}
		}).fail(function() {
			notFound(page);
		});
	}

	function appendModule(vsEditor) {
		if (vsEditor === true) {
			$(visualEditorSelector).after($main);
		} else {
			// Appending HTML to editor
			if ( $module.length ) { 
				$module.after($main);
			} else if ( $moduleOld.length ) { 
				$moduleOld.append($main);
			}
		}
	}

	// Add selector to editor
	function preInit(i18nData) {
		i18n = i18nData;
		$main = $('<div>', { id: 'preload-templates' });
		$main.append($('<span>', {
			text: msg('preload')
		}));
		$help = $('<div>', {
			id: 'pt-help'
		}).append($('<a>', {
			target: '_blank',
			href: 'https://dev.miraheze.org/wiki/PreloadTemplates',
			title: msg('devWiki'),
			text: '?'
		}));
		appendModule();
	}
		
	function listHTML(parsed, placeholder) {
		return mw.html.element('option', {
			selected: true,
			disabled: true
		}, placeholder || msg('choose')) + parsed.split('\n').map(function(line) {
			// Ignore empty lines
			if (line.trim() === '') {
				return '';
			}
			// Text in a list is the template name
			if (line.indexOf('*') === 0) {
				var title = line.substring(1).trim();

				// Text after pipe is display name
				if (title.indexOf('|') !== -1) {
					var parts = title.split('|');
					return mw.html.element('option', {
						value: parts[0].trim()
					}, parts[1].trim());
				} else {
					return mw.html.element('option', {
						value: title
					}, title);
				}
			} else {
				// Rest are normal strings
				return mw.html.element('option', {
					disabled: true
				}, line.trim(''));
			}
		}).join();
	}

	// =================
	//   Initialization  
	// =================

	// If the initialization failed
	function initFail() {
		var primaryPlPagename = userConfig.primary || config.primary;
		$main.append(
			i18n.msg(
				'error',
				mw.html.element('a', {
					href: mw.util.getUrl(primaryPlPagename)
				}, primaryPlPagename)
			).plain(),
			$help
		);
	}
	
	function init() {
		if ($main.find('#pt-list').length > 0) {
			return; // Initialize only once
		}
		var primaryPlPagename = userConfig.primary || config.primary;
		var secondaryPlPagename = userConfig.secondary || config.secondary;
		var fetchedFromCache = getListOfTemplatesFromCache(primaryPlPagename, secondaryPlPagename);
		if (fetchedFromCache !== null) {
			populateDropdowns(fetchedFromCache[0], fetchedFromCache[1]);
			return;
		}
		$.get(mw.util.wikiScript(), {
			title: primaryPlPagename,
			action: 'raw',
			ctype: 'text/plain',
			maxage: config.serverCacheAge,
			smaxage: config.serverCacheAge
		}).done(function(listData) {
			if (!!secondaryPlPagename) {
				$.get(mw.util.wikiScript(), {
					title: secondaryPlPagename,
					action: 'raw',
					ctype: 'text/plain',
					maxage: config.serverCacheAge,
					smaxage: config.serverCacheAge
				}).done(function(listSecondary) {
					populateDropdowns(listData, listSecondary);
					saveListOfTemplatesToCache({
						list: listData, 
						listSecondary: listSecondary,
						pagename: primaryPlPagename,
						pagenameSecondary: secondaryPlPagename
					});
				}).fail(function() {
					// Continue even when failed to fetch the secondary list 
					populateDropdowns(listData, '');
				});
			} else {
				populateDropdowns(listData, '');
				saveListOfTemplatesToCache({
					list: listData, 
					listSecondary: '',
					pagename: primaryPlPagename,
					pagenameSecondary: null
				});
			}
		}).fail(initFail);
	}
	
	function populateDropdowns(listPrimary, listSecondary) {
		var parsedPrimary = parseMW(listPrimary); // Parse data for MediaWiki tags
		var parsedSecondary = parseMW(listSecondary); // Parse data for MediaWiki tags

		// Display error if no valid data is present
		if (parsedPrimary === '') {
			initFail();
			return;
		}
		
		// Create preload templates dropdown
		var dropdown = $('<select>', {
			id: 'pt-list',
			title: msg('help'),
			html: listHTML(parsedPrimary, config.placeholderPrimary)
		}).change(function() {
			var $this = $(this),
				val = $this.val();

			// Restore default option
			$this.find('option:first-child').prop('selected', true);

			// Preload the template on click
			getPreloadPage(val);
		});
		
		// Create secondaryDropdown
		var dropdownSecondary = $('<select>', {
			id: 'pt-list-secondary',
			title: msg('help'),
			html: parsedSecondary === '' ? undefined : listHTML(parsedSecondary, config.placeholderSecondary),
			style: parsedSecondary === '' ? 'display:none;' : undefined,
		}).change(function() {
			var $this = $(this),
				val = $this.val();

			// Restore default option
			$this.find('option:first-child').prop('selected', true);

			// Preload the template on click
			getPreloadPage(val);
		});

		// Append template list and messages
		$main.append(
			dropdown,
			dropdownSecondary,
			$help
		);
	}
	
	/* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
	
	$.when(
		loadMessages(),
		mw.loader.using('mediawiki.util')
	).then(function(i18nData) {
		preInit(i18nData);
		// Doesn't work for Visual Editor, disabled
		//mw.hook('ve.activationComplete').add(function () { // Visual Editor
		//appendModule(true);
		//});
		if (mwc.wgAction === 'edit') {
			mw.hook( 'wikipage.content' ).add(init);
		}
	});
})();