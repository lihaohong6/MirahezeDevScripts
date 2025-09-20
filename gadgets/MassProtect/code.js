/**
 * @Name            MassProtect
 * @Version         v2.3
 * @Author          KnazO
 * @Author          TheGoldenPatrik1
 * @Description     Protect listed pages.
 */
mw.loader.using([
    'mediawiki.api',
    'mediawiki.user'
], function () {
    if (
        !/sysop|bureaucrat|global-admin/.test(mw.config.get('wgUserGroups').join()) ||
        window.MassProtectLoaded
    ) {
      return;
    }
    window.MassProtectLoaded = true;
    var Api = new mw.Api(),
        i18n,
        placement,
        preloads = 3,
        protectModal,
        paused = true;
    /**
     * @method generateElement
     * @description Creates a select dropdown menu.
     * @parama {String} type - The protection type.
     */
    function generateElement (type) {
        return  $('<p>', {
            text: i18n.msg(type).plain()
        }).append(
            $('<select>', {
                id: 'protect-' + type
            }).append(
                $('<option>', {
                    value: '',
                    text: i18n.msg('unset').plain()
                }),
                $('<option>', {
                    value: type + '=all',
                    text: i18n.msg('all').plain()
                }),
                $('<option>', {
                    value: type + '=autoconfirmed',
                    text: i18n.msg('autoconfirmed').plain()
                }),
                $('<option>', {
                    value: type + '=sysop',
                    text: i18n.msg('sysop').plain()
                })
            )
        );
    }
    /**
     * @method formHtml
     * @description The modal's HTML.
     */
    function formHtml () {
        return $('<form>').append(
            $('<fieldset>').append(
                $('<p>', {
                    text: i18n.msg('protection').plain(),
                    id: 'protection-bold'
                }),
                generateElement('edit'),
                generateElement('move'),
                generateElement('upload'),
                generateElement('create'),
                generateElement('comment'),
                $('<hr/>'),
                $('<p>', {
                    text: i18n.msg('expiry').plain(),
                    id: 'protection-bold'
                }).append(
                    $('<input>', {
                        type: 'text',
                        id: 'protect-expiry',
                        placeholder: 'indefinite'
                    })
                ),
                $('<hr/>'),
                $('<p>', {
                    text: i18n.msg('reason').plain(),
                    id: 'protection-bold'
                }).append(
                    $('<input>', {
                        type: 'text',
                        id: 'protect-reason'
                    })
                ),
                $('<hr/>'),
                $('<p>', {
                    text: i18n.msg('instructions').plain()
                }),
                $('<textarea/>', {
                    id: 'text-mass-protect'
                }),
                $('<hr/>'),
                $('<div>', {
                    id: 'text-error-output',
                    text: i18n.msg('error').plain()
                }).append(
                    $('<br/>')
                )
            )
        ).prop('outerHTML');
    }
    /**
     * @method preload
     * @description Preloads the script and the hooks.
     */
    function preload () {
        if (--preloads === 0) { init(); }
    }
    /**
     * @method init
     * @description Initiates the script and adds the button.
     */
    function init () {
    	mw.libs.PowertoolsPlacement.addPortletLink(mw.config.values.skin, {
        	id: 't-mp',
        	href: '#',
            cssClasses: 'custom',
        	label: i18n.msg('title').plain(),
        	onClick: click
        });
    }
    /**
     * @method click
     * @description Shows the MassProtect modal.
     */
    function click () {
        if (protectModal) {
            protectModal.show();
            return;
        }
        protectModal = new window.dev.modal.Modal({
            content: formHtml(),
            id: 'form-mass-protect',
            size: 'medium',
            title: i18n.msg('title').escape(),
            buttons: [
                {
                    id: 'mp-start',
                    text: i18n.msg('initiate').escape(),
                    primary: true,
                    event: 'start'
                },
                {
                    id: 'mp-pause',
                    text: i18n.msg('pause').escape(),
                    primary: true,
                    event: 'pause',
                    disabled: true
                },
                {
                    text: i18n.msg('addCategory').escape(),
                    primary: true,
                    event: 'addCategoryContents'
                },
                {
                    text: i18n.msg('cancel').escape(),
                    event: 'close'
                }
            ],
            events: {
                addCategoryContents: addCategoryContents,
                pause: pause,
                start: start
            }
        });
        protectModal.create();
        protectModal.show();
    }
    /**
     * @method pause
     * @description Pauses the operation.
     */
    function pause () {
        paused = true;
        document.getElementById('mp-pause').setAttribute('disabled', '');
        document.getElementById('mp-start').removeAttribute('disabled');
    }
    /**
     * @method start
     * @description Initiates the operation.
     */
    function start () {
        paused = false;
        document.getElementById('mp-start').setAttribute('disabled', '');
        document.getElementById('mp-pause').removeAttribute('disabled');
        process();
    }
    /**
     * @method process
     * @description Performs the process.
     */
    function process () {
        if (paused) {
            return;
        }
        var txt = document.getElementById('text-mass-protect'),
            pages = txt.value.split('\n'),
            currentPage = pages[0];
        if (!currentPage) {
            pause();
            $('#text-error-output').append(
                i18n.msg('finished').escape() +
                ' ' +
                i18n.msg('done').escape() +
                '<br/>'
            );
        } else {
            protectPage(currentPage);
        }
        pages = pages.slice(1, pages.length);
        txt.value = pages.join('\n');
    }
    /**
     * @method addCategoryContents
     * @description Inputs the contents of a category.
     */
    function addCategoryContents () {
        var category = prompt(i18n.msg('categoryPrompt').plain());
        if (!category) {
            return;
        }
        Api.get({
            action: 'query',
            list: 'categorymembers',
            cmtitle: 'Category:' + category,
            cmlimit: 'max'
        })
        .done(function (d) {
            var data = d.query;
            for (var i in data.categorymembers) {
                var currTitles = $('#text-mass-protect').val();
                $('#text-mass-protect').val(currTitles + data.categorymembers[i].title + '\n');
            }
        })
        .fail(function (code) {
            $('#text-error-output').append(i18n.msg('categoryFail').escape() + category + ' : ' + code + '<br/>');
        });
    }
    /**
     * @method protectPage
     * @description Performs the protection.
     * @param {String} page - The page to protect.
     */
    function protectPage (page) {
        Api.post({
            action: 'protect',
            expiry: $('#protect-expiry').val() || $('#protect-expiry').attr('placeholder'),
            protections: $('#protect-create').val() || [$('#protect-edit').val(), $('#protect-move').val(), $('#protect-upload').val(), $('#protect-comment').val()].filter(Boolean).join('|'),
            watchlist: 'preferences',
            title: page,
            reason: $('#protect-reason').val(),
            token: mw.user.tokens.get('csrfToken')
        })
        .done(function (d) {
            console.log(i18n.msg('success', page).plain());
        })
        .fail(function (code) {
            console.log(i18n.msg('fail').escape() + page + ': ' + code);
            $('#text-error-output').append(i18n.msg('fail').escape() + page + ': ' + code + '<br/>');
        });
        setTimeout(process, window.massProtectDelay || 1000);
    }
    mw.hook('dev.modal').add(preload);
    mw.hook('dev.powertools.placement').add(preload);
    
    function initDependencies() {
    	var required = ['ext.gadget.fandoom-ui-utils-modal', 'ext.gadget.powertools-placement'];
    	var missing = required.filter(function (dep) { return mw.loader.getState(dep) === null; });
    	if (missing.length > 0) {
    		for (var i = 0; i < missing.length; i++) {
    			console.error('Missing dependency: ' + missing[i] + ' must be loaded to use MassProtect');
    		}
    		return;
    	}
    	$.when(
			loadMessages(),
			mw.loader.using(required)
		).then(function (messages) {
			i18n = messages;
			preload();
		});
    }
    function loadMessages() {
		var deferred = new $.Deferred();
		if (mw.loader.getState('ext.gadget.i18n-js')) {
			mw.loader.load('ext.gadget.i18n-js');
			mw.hook('dev.i18n').add(function (i18n) {
				i18n.loadMessages('MediaWiki:MassProtect', { apiEntrypoint: 'self' })
					.done(function (messages) {
						deferred.resolve(messages || loadFallbackMessages()); 
					});
			});
			return deferred;
		}
		deferred.resolve(loadFallbackMessages());
		return deferred;
	}
	function loadFallbackMessages() {
		mw.messages.set({
			"MassProtect__unset": "Unset",
			"MassProtect__all": "Allow all users",
			"MassProtect__autoconfirmed": "Block new users and unregistered users",
			"MassProtect__sysop": "Administrators and Content Moderators only",
			"MassProtect__title": "Mass Protect",
			"MassProtect__edit": "Edit:",
			"MassProtect__move": "Move:",
			"MassProtect__upload": "Upload:",
			"MassProtect__create": "Create:",
			"MassProtect__cancel": "Cancel",
			"MassProtect__addCategory": "Add Category Contents",
			"MassProtect__initiate": "Initiate",
			"MassProtect__finished": "Finished!",
			"MassProtect__done": "Nothing left to do, or next line is blank.",
			"MassProtect__close": "Close",
			"MassProtect__categoryPrompt": "Enter the category name (no category prefix):",
			"MassProtect__categoryFail": "Failed to get contents of ",
			"MassProtect__success": "Protection of $1 successful!",
			"MassProtect__fail": "Failed to protect ",
			"MassProtect__protection": "Protection:",
			"MassProtect__expiry": "Expiry time:",
			"MassProtect__reason": "Reason:",
			"MassProtect__instructions": "Put the name of each page you want to protect on a separate line.",
			"MassProtect__error": "Any errors encountered will appear below",
			"MassProtect__pause": "Pause",
			"MassProtect__comment": "Comment:"
		});
		return {
			msg: function () {
				arguments[0] = "MassProtect__" + arguments[0];
				return mw.message.apply(this, arguments);
			}
		};
	}
    initDependencies();
});