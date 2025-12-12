/**
* Ajax Batch Delete
* @description Delete listed multiple pages
* Does not need to go to Special:BlankPage to use
* Includes the option to protect after deleting
* Includes the option to grab a whole category's contents
* @author Ozank Cx
*/
mw.loader.using('mediawiki.api', function() {
  'use strict';
  
  if (
    window.AjaxBatchDeleteLoaded ||
    !/sysop|bureaucrat|global-admin/.test(mw.config.get('wgUserGroups').join())
  ) {
    return;
  }
  window.AjaxBatchDeleteLoaded = true;
  
  var api = new mw.Api(),
  i18n,
  placement,
  preloads = 3,
  deleteModal,
  paused = true;
  
  function preload() {
    if (--preloads === 0) { init(); }
  }
  
  function init() {
    mw.libs.PowertoolsPlacement.addPortletLink(mw.config.values.skin, {
      id: 't-bd',
      href: '#',
      label: i18n.msg('toolsTitle').plain(),
      tooltip: 'AjaxBatchDelete',
      onClick: click
    });
  }
  
  function click() {
    if (deleteModal) {
      deleteModal.show();
      return;
    }
    deleteModal = new window.dev.modal.Modal({
      content: formHtml(),
      id: 'form-batch-delete',
      size: 'large',
      title: i18n.msg('modalTitle').escape(),
      buttons: [
        {
          id: 'abd-start',
          text: i18n.msg('initiate').escape(),
          primary: true,
          event: 'start'
        },
        {
          id: 'abd-pause',
          text: i18n.msg('pause').escape(),
          primary: true,
          event: 'pause',
          disabled: true
        },
        {
          text: i18n.msg('addCategoryContents').escape(),
          primary: true,
          event: 'addCategoryContents'
        }
      ],
      events: {
        addCategoryContents: addCategoryContents,
        pause: pause,
        start: start
      }
    });
    deleteModal.create();
    deleteModal.show();
  }
  
  function formHtml() {
    return $('<form>').append(
      $('<fieldset>').append(
        $('<p>').append(
          $('<label>', {
            'for': 'ajax-delete-reason',
            text: i18n.msg('inputReason').plain()
          }),
          $('<input>', {
            type: 'text',
            name: 'ajax-delete-reason',
            id: 'ajax-delete-reason'
          }),
          $('<br>'),
          $('<label>', {
            'for': 'protect-check',
            text: i18n.msg('inputProtect').plain()
          }),
          $('<input>', {
            type: 'checkbox',
            id: 'protect-check',
            name: 'protect-check'
          })
        ),
        $('<p>', {
          text: i18n.msg('inputPages').plain() + ':'
        }),
        $('<textarea>', {
          id: 'text-mass-delete'
        }),
        $('<p>', {
          text: i18n.msg('errorsForm').plain() + ':'
        }),
        $('<div>', {
          id: 'text-error-output'
        })
      )
    ).prop('outerHTML');
  }
  
  function pause() {
    paused = true;
    document.getElementById('abd-pause').setAttribute('disabled', '');
    document.getElementById('abd-start').removeAttribute('disabled');
  }
  
  function start() {
    if (!document.getElementById('ajax-delete-reason').value) {
      alert(i18n.msg('stateReason').plain());
      return;
    }
    paused = false;
    document.getElementById('abd-start').setAttribute('disabled', '');
    document.getElementById('abd-pause').removeAttribute('disabled');
    process();
  }
  
  function process() {
    if (paused) {
      return;
    }
    var txt = document.getElementById('text-mass-delete'),
    pages = txt.value.split('\n'),
    currentPage = pages[0];
    if (!currentPage) {
      $('#text-error-output').append(
        i18n.msg('endTitle').escape() + ' ' + i18n.msg('endMsg').escape() + '<br />'
      );
      pause();
    } else {
      performAction(currentPage, document.getElementById('ajax-delete-reason').value);
    }
    pages = pages.slice(1,pages.length);
    txt.value = pages.join('\n');
  }
  
  function addCategoryContents() {
    var category = prompt(i18n.msg('enterCategory').plain() + ':');
    if (!category) {
      return;
    }
    api.get({
      action: 'query',
      list: 'categorymembers',
      cmtitle: 'Category:' + category,
      cmlimit: 5000
    }).done(function(d) {
      var data = d.query;
      for (var i in data.categorymembers) {
        $('#text-mass-delete').val(
          $('#text-mass-delete').val() +
          data.categorymembers[i].title +
          '\n'
        );
      }
    }).fail(function(code) {
      outputError('GetContents', category, code);
    });
  }
  
  function outputError(error, param1, param2) {
    $('#text-error-output').append(i18n.msg('error' + error, param1, param2).escape(), '<br />');
  }
  
  function performAction(page,reason) {
    api.postWithEditToken({
      action: 'delete',
      watchlist: 'preferences',
      title: page,
      reason: reason,
      bot: true
    }).done(function(d) {
      if (document.getElementById('protect-check').checked) {
        api.postWithEditToken({
          action: 'protect',
          expiry: 'infinite',
          protections: 'create=sysop',
          watchlist: 'preferences',
          title: page,
          reason: reason
        }).fail(function() {
          outputError('Protect', page, i18n.msg('ajaxError').plain());
        });
      }
    }).fail(function(code) {
      outputError('Delete', page, code);
    });
    setTimeout(process, window.batchDeleteDelay || 1000);
  }
  
  mw.hook('dev.modal').add(preload);
  mw.hook('dev.powertools.placement').add(preload);

  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
  
  function initDependencies() {
    var required = [MH_DEVSCRIPTS_GADGET_NAMESPACE+'.FandoomUiUtilsModal', MH_DEVSCRIPTS_GADGET_NAMESPACE+'.PowertoolsPlacement'];
    var missing = required.filter(function (dep) { return mw.loader.getState(dep) === null; });
    if (missing.length > 0) {
      for (var i = 0; i < missing.length; i++) {
        console.error('Missing dependency: ' + missing[i] + ' must be loaded to use AjaxBatchDelete');
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
  
  initDependencies();
});