/*
* Ajax Batch Undelete
* @description unDelete listed multiple pages
* @author KnazO of AjaxBatchDelete
* modified by Noreplyz & Nerfmaster8
*/
 
mw.loader.using('mediawiki.api', function() {
    'use strict';
 
  if (
    window.AjaxBatchUndeleteLoaded ||
    !/sysop|bureaucrat|global-admin/.test(mw.config.get('wgUserGroups').join())
    ) {
        return;
  }
  window.AjaxBatchUndeleteLoaded = true;
 
    var i18n,
        placement,
        preloads = 3,
        undeleteModal,
        paused = true;
        
    function preload() {
        if (--preloads === 0) { init(); }
    }
 
    function init() {
    	mw.libs.PowertoolsPlacement.addPortletLink(mw.config.values.skin, {
        	id: 't-bud',
        	href: '#',
        	label: i18n.msg('toolsTitle').plain(),
        	onClick: click
        });
    }
    
    function click() {
        if (undeleteModal) {
            undeleteModal.show();
            return;
        }
        undeleteModal = new window.dev.modal.Modal({
            content: formHtml(),
            id: 'form-batch-undelete',
            size: 'medium',
            title: i18n.msg('modalTitle').escape(),
            buttons: [
                {
                    id: 'abu-start',
                    text: i18n.msg('initiate').escape(),
                    primary: true,
                    event: 'start'
                },
                {
                    id: 'abu-pause',
                    text: i18n.msg('pause').escape(),
                    primary: true,
                    event: 'pause',
                    disabled: true
                },
                {
                    text: i18n.msg('close').escape(),
                    event: 'close'
                }
            ],
            events: {
                pause: pause,
                start: start
            }
        });
        undeleteModal.create();
        undeleteModal.show();
    }
    
    function formHtml() {
        return $('<form>', {
            'class': 'WikiaForm'
        }).append(
            $('<fieldset>').append(
                $('<p>').append(
                    $('<label>', {
                        'for': 'undelete-reason',
                        text: i18n.msg('inputReason').plain()
                    }),
                    $('<input>', {
                        type: 'text',
                        name: 'undelete-reason',
                        id: 'undelete-reason'
                    })
                ),
                $('<p>', {
                    text: i18n.msg('inputPages').plain() + ':'
                }),
                $('<textarea>', {
                    id: 'text-batch-undelete'
                }),
                $('<p>', {
                    text: i18n.msg('errorsForm').plain()
                }),
                $('<div>', {
                    id: 'text-error-output'
                })
            )
        ).prop('outerHTML');
    }
 
    function pause() {
        paused = true;
        document.getElementById('abu-pause').setAttribute('disabled', '');
        document.getElementById('abu-start').removeAttribute('disabled');
    }
 
    function start() {
        if (!document.getElementById('undelete-reason').value) {
            alert(i18n.msg('stateReason').plain());
            return;
        }
        paused = false;
        document.getElementById('abu-start').setAttribute('disabled', '');
        document.getElementById('abu-pause').removeAttribute('disabled');
        process();
    }
 
    function process() {
        if (paused) {
            return;
        }
        var txt = document.getElementById('text-batch-undelete'),
            pages = txt.value.split('\n'),	
            currentPage = pages[0];
        if (!currentPage) {
            $('#text-error-output').append(
                i18n.msg('endMsg').escape() +
                '<br/>'
            );
            pause();
        } else {
            undelete(currentPage, document.getElementById('undelete-reason').value);  
        }
        pages = pages.slice(1, pages.length);
        txt.value = pages.join('\n');
   }
 
    function undelete(page, reason) {
        new mw.Api().post({
            format: 'json',
            action: 'undelete',
            watchlist: 'preferences',
            timestamps: '',
            title: page,
            reason: reason,
            token: mw.user.tokens.get('csrfToken')
        }).done(function(d) { 
            if (!d.error) {
                console.log(i18n.msg('success', page).escape());
            } else {
                console.log(i18n.msg('failure').escape()+' '+page+': '+ d.error.code);
                $('#text-error-output').append(i18n.msg('failure').escape()+' '+page+': '+d.error.code+'<br/>');
            }
        })
        .fail(function() {
            console.log(i18n.msg('failure').escape()+' '+page);
            $('#text-error-output').append(i18n.msg('failure').escape()+' '+page+'<br/>');
        });
        setTimeout(process, window.batchUndeleteDelay || 1000);
    }
    
    mw.hook('dev.modal').add(preload);
    mw.hook('dev.powertools.placement').add(preload);
    
    function initDependencies() {
    	var required = ['ext.gadget.fandoom-ui-utils-modal', 'ext.gadget.powertools-placement'];
    	var missing = required.filter(function (dep) { return mw.loader.getState(dep) === null; });
    	if (missing.length > 0) {
    		for (var i = 0; i < missing.length; i++) {
    			console.error('Missing dependency: ' + missing[i] + ' must be loaded to use AjaxBatchUndelete');
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
				i18n.loadMessages('MediaWiki:AjaxBatchUndelete', { apiEntrypoint: 'self' })
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
			"AjaxBatchUndelete__modalTitle": "Ajax Batch Undelete",
			"AjaxBatchUndelete__endMsg": "Done! Nothing left to do, or next line is blank.",
			"AjaxBatchUndelete__inputReason": "Reason for recovery:",
			"AjaxBatchUndelete__inputPages": "Put the name of each page you want to undelete on a separate line",
			"AjaxBatchUndelete__errorsForm": "Any errors encountered will appear below:",
			"AjaxBatchUndelete__close": "Close",
			"AjaxBatchUndelete__initiate": "Initiate",
			"AjaxBatchUndelete__stateReason": "Please state a reason!",
			"AjaxBatchUndelete__success": "Recovery of $1 successful!",
			"AjaxBatchUndelete__failure": "Failed to recover",
			"AjaxBatchUndelete__toolsTitle": "Batch Undelete",
			"AjaxBatchUndelete__pause": "Pause"
		});
		return {
			msg: function () {
				arguments[0] = "AjaxBatchUndelete__" + arguments[0];
				return mw.message.apply(this, arguments);
			}
		};
	}
    initDependencies();
});