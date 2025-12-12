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
      tooltip: 'AjaxBatchUndelete',
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
    var required = [MH_DEVSCRIPTS_GADGET_NAMESPACE+'.FandoomUiUtilsModal', MH_DEVSCRIPTS_GADGET_NAMESPACE+'.PowertoolsPlacement'];
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
  
  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
  
  initDependencies();
});