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
      preloads = 3,
      undeleteModal,
      paused = true;
  var $form, 
      $undeleteReasonInput,
      $pageListInput,
      $errorOutput;
  
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
    $form = $('#form-batch-undelete');
    $undeleteReasonInput = $form.find('#undelete-reason');
    $pageListInput = $form.find('#text-batch-undelete');
    $errorOutput = $form.find('#text-error-output');
    undeleteModal.show();
  }
  
  function formHtml() {
    return $('<form>').append(
      $('<fieldset>').append(
        $('<div>', { 'class': 'edit-input-controls' }).append(
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
    undeleteModal.disableActionButtons('abu-pause');
    undeleteModal.enableActionButtons('abu-start');
  }
  
  function start() {
    if (!$undeleteReasonInput.val()) {
      alert(i18n.msg('stateReason').plain());
      return;
    }
    paused = false;
    undeleteModal.disableActionButtons('abu-start');
    undeleteModal.enableActionButtons('abu-pause');
    process();
  }
  
  function process() {
    if (paused) {
      return;
    }
    var pages = $pageListInput.val().split('\n'),	
        currentPage = pages[0];
    if (!currentPage) {
      $errorOutput.append(
        i18n.msg('endMsg').escape() +
        '<br/>'
      );
      pause();
    } else {
      undelete(currentPage, $undeleteReasonInput.val());  
    }
    pages = pages.slice(1, pages.length);
    $pageListInput.val(pages.join('\n'));
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
        $errorOutput.append(i18n.msg('failure').escape()+' '+page+': '+d.error.code+'<br/>');
      }
    })
    .fail(function() {
      console.log(i18n.msg('failure').escape()+' '+page);
      $errorOutput.append(i18n.msg('failure').escape()+' '+page+'<br/>');
    });
    setTimeout(process, window.batchUndeleteDelay || 1000);
  }
  
  mw.hook('dev.modal').add(preload);
  mw.hook('dev.powertools.placement').add(preload);
  loadMessages().then(function (messages) {
    i18n = messages;
    preload();
  });
  
  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
});