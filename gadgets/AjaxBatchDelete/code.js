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
      preloads = 3,
      deleteModal,
      paused = true;
  var $form, 
      $deleteReasonInput,
      $pageListInput,
      $protectCheckInput,
      $errorOutput;
  
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
          id: 'abd-add-pages-in-category',
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
    $form = $('#form-batch-delete');
    $errorOutput = $form.find('#text-error-output');
    $pageListInput = $form.find('#text-mass-delete');
    $deleteReasonInput = $form.find('#ajax-delete-reason');
    $protectCheckInput = $form.find('#protect-check');
    deleteModal.show();
  }
  
  function formHtml() {
    return $('<form>').append(
      $('<fieldset>').append(
        $('<div>', { 'class': 'edit-input-controls' }).append(
          $('<div>', { 'class': 'edit-input-control' }).append(
            $('<label>', {
              'for': 'ajax-delete-reason',
              text: i18n.msg('inputReason').plain()
            }),
            $('<input>', {
              type: 'text',
              name: 'ajax-delete-reason',
              id: 'ajax-delete-reason'
            }),
          ),
          $('<div>', { 'class': 'edit-input-control' }).append(
            $('<label>', {
              'for': 'protect-check',
              text: i18n.msg('inputProtect').plain()
            }),
            $('<input>', {
              type: 'checkbox',
              id: 'protect-check',
              name: 'protect-check'
            })
          )
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
    deleteModal.disableActionButtons('abd-pause');
    deleteModal.enableActionButtons(['abd-start', 'abd-add-pages-in-category']);
  }
  
  function start() {
    if (!$deleteReasonInput.val()) {
      alert(i18n.msg('stateReason').plain());
      return;
    }
    paused = false;
    deleteModal.disableActionButtons(['abd-start', 'abd-add-pages-in-category']);
    deleteModal.enableActionButtons('abd-pause');
    process();
  }
  
  function process() {
    if (paused) {
      return;
    }
    var pages = ($pageListInput.val() || '').split('\n'),
        currentPage = pages[0];
    if (!currentPage) {
      $errorOutput.append(
        i18n.msg('endTitle').escape() + ' ' + i18n.msg('endMsg').escape() + '<br />',
      );
      pause();
    } else {
      performAction(currentPage, $deleteReasonInput.val());
    }
    pages = pages.slice(1,pages.length);
    $pageListInput.val(pages.join('\n'));
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
        $pageListInput.val(
          ($pageListInput.val() || '') +
          data.categorymembers[i].title +
          '\n'
        );
      }
    }).fail(function(code) {
      outputError('GetContents', category, code);
    });
  }
  
  function outputError(error, param1, param2) {
    $errorOutput.append(i18n.msg('error' + error, param1, param2).escape(), '<br />');
  }
  
  function performAction(page,reason) {
    api.postWithEditToken({
      action: 'delete',
      watchlist: 'preferences',
      title: page,
      reason: reason,
      bot: true
    }).done(function() {
      if ($protectCheckInput.prop('checked')) {
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
  getI18nLoader().then(function (loader) {
    i18n = prepareI18n(loader);
    preload();
  });

  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();

});