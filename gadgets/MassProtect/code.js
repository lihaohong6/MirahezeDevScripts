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
      preloads = 3,
      protectModal,
      paused = true;
  var $form,
      $pageListInput,
      $errorOutput,
      $protectExpiry,
      $protectCreate,
      $protectEdit,
      $protectMove,
      $protectUpload,
      $protectComment,
      $protectReason;
  /**
  * @method generateElement
  * @description Creates a select dropdown menu.
  * @parama {String} type - The protection type.
  */
  function generateElement (type) {
    return  $('<div>', { 'class': 'edit-input-control' }).append(
      $('<div>').text(i18n.msg(type).plain()),
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
          'class': 'protection-bold'
        }),
        generateElement('edit'),
        generateElement('move'),
        generateElement('upload'),
        generateElement('create'),
        $('<hr/>'),
        $('<div>', {
          'class': 'protection-bold edit-input-control'
        }).append(
          $('<div>').text(i18n.msg('expiry').plain()),
          $('<input>', {
            type: 'text',
            id: 'protect-expiry',
            placeholder: 'indefinite'
          })
        ),
        $('<hr/>'),
        $('<div>', {
          'class': 'protection-bold edit-input-control'
        }).append(
          $('<div>').text(i18n.msg('reason').plain()),
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
      tooltip: 'MassProtect',
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
          id: 'mp-add-pages-in-category',
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
    $form = $('#form-mass-protect');
    $pageListInput = $form.find('#text-mass-protect');
    $errorOutput = $form.find('#text-error-output');
    $protectExpiry = $form.find('#protect-expiry');
    $protectCreate = $form.find('#protect-create');
    $protectEdit = $form.find('#protect-edit');
    $protectMove = $form.find('#protect-move');
    $protectUpload = $form.find('#protect-upload');
    $protectReason = $form.find('#protect-reason');
    protectModal.show();
  }
  /**
  * @method pause
  * @description Pauses the operation.
  */
  function pause () {
    paused = true;
    protectModal.disableActionButtons('mp-pause');
    protectModal.enableActionButtons(['mp-start', 'mp-add-pages-in-category']);
  }
  /**
  * @method start
  * @description Initiates the operation.
  */
  function start () {
    paused = false;
    protectModal.disableActionButtons(['mp-start', 'mp-add-pages-in-category']);
    protectModal.enableActionButtons('mp-pause');
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
    var pages = ($pageListInput.val() || '').split('\n'),
        currentPage = pages[0];
    if (!currentPage) {
      pause();
      $errorOutput.append(
        i18n.msg('finished').escape() +
        ' ' +
        i18n.msg('done').escape() +
        '<br/>'
      );
    } else {
      protectPage(currentPage);
    }
    pages = pages.slice(1, pages.length);
    $pageListInput.val(pages.join('\n'));
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
        var currTitles = $pageListInput.val();
        $pageListInput.val(currTitles + data.categorymembers[i].title + '\n');
      }
    })
    .fail(function (code) {
      $errorOutput.append(i18n.msg('categoryFail').escape() + category + ' : ' + code + '<br/>');
    });
  }
  /**
  * @method protectPage
  * @description Performs the protection.
  * @param {String} page - The page to protect.
  */
  function protectPage (page) {
    Api.postWithEditToken({
      action: 'protect',
      expiry: $protectExpiry.val() || $protectExpiry.attr('placeholder'),
      protections: $protectCreate.val() || [$protectEdit.val(), $protectMove.val(), $protectUpload.val(), $protectComment.val()].filter(Boolean).join('|'),
      watchlist: 'preferences',
      title: page,
      reason: $protectReason.val()
    })
    .done(function (d) {
      console.log(i18n.msg('success', page).plain());
    })
    .fail(function (code) {
      console.log(i18n.msg('fail').escape() + page + ': ' + code);
      $errorOutput.append(i18n.msg('fail').escape() + page + ': ' + code + '<br/>');
    });
    setTimeout(process, window.massProtectDelay || 1000);
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