/**
* Mass Rename
* @description Rename pages quickly.
* @author KnazO
*/
mw.loader.using('mediawiki.api', function () {
  if (
    window.MassRenameLoaded ||
    !/sysop|bureaucrat|global-admin/.test(mw.config.get('wgUserGroups').join())
  ) {
    return;
  }
  window.MassRenameLoaded = true;
  var i18n,
    placement,
    renameModal,
    preloads = 3,
    paused = false;
  /**
  * @method formHtml
  * @description Creates the modal HTML
  */
  function formHtml () {
    return $('<form>').append(
      $('<fieldset>').append(
        $('<p>', {
          text: i18n.msg('instructions').plain()
        }),
        $('<p>', {
          text: i18n.msg('instructions2').plain()
        }),
        $('<label>', {
          'for': 'redirect-check',
          text: i18n.msg('redirect').plain()
        }).append(
          $('<input>', {
            type: 'checkbox',
            id: 'redirect-check'
          })
        ),
        $('<br>'),
        $('<label>', {
          'for': 'custom-summary',
          text: i18n.msg('custom-summary').plain()
        }).append(
          $('<input>', {
            id: 'custom-summary'
          })
        ),
        $('<textarea>', {
          id: 'text-rename',
          placeholder: 'old_name new_name'
        }),
        $('<div>', {
          id: 'text-error-output',
          text: i18n.msg('outputInitial').plain(),
          append: '<br/>'
        })
      )
    ).prop('outerHTML');
  }
  /**
  * @method preload
  * @description Loads the hooks and I18n messages
  */
  function preload () {
    if (--preloads === 0) { init(); }
  }
  /**
  * @method init
  * @description Initiates the script
  */
  function init () {
    mw.libs.PowertoolsPlacement.addPortletLink(mw.config.values.skin, {
      id: 't-mr',
      href: '#',
      label: i18n.msg('title').plain(),
      onClick: click
    });
  }
  /**
  * @method click
  * @description Opens the MassRename modal
  */
  function click () {
    if (renameModal) {
      renameModal.show();
      return;
    }
    renameModal = new window.dev.modal.Modal({
      content: formHtml(),
      id: 'form-mass-rename',
      size: 'medium',
      title: i18n.msg('title').escape(),
      buttons: [
        {
          id: 'mr1-start',
          text: i18n.msg('initiate').escape(),
          primary: true,
          event: 'start'
        },
        {
          id: 'mr1-pause',
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
    renameModal.create();
    renameModal.show();
  }
  /**
  * @method pause
  * @description Pauses the operation
  */
  function pause () {
    paused = true;
    document.getElementById('mr1-pause').setAttribute('disabled', '');
    document.getElementById('mr1-start').removeAttribute('disabled');
  }
  /**
  * @method start
  * @description Starts the operation
  */
  function start () {
    paused = false;
    document.getElementById('mr1-start').setAttribute('disabled', '');
    document.getElementById('mr1-pause').removeAttribute('disabled');
    process();
  }
  /**
  * @method process
  * @description Analyzes the inputted data
  */
  function process () {
    if (paused) {
      return;
    }
    var txt = document.getElementById('text-rename'),
    pages = txt.value.split('\n'),
    page = pages[0];
    if (!page) {
      $('#text-error-output').append(
        i18n.msg('finished').escape() +
        ' ' +
        i18n.msg('nothingLeftToDo').escape() +
        '<br/>'
      );
      pause();
    } else {
      rename(page);
    }
    pages = pages.slice(1, pages.length);
    txt.value = pages.join('\n');
  }
  /**
  * @method rename
  * @description Renames the page
  * @param {String} name - The rename data
  */
  function rename (name) {
    if (name.split(' ').length !== 2) {
      $('#text-error-output').append(i18n.msg('invalidInput', name).escape() + '<br/>');
    } else {
      var oldName = name.split(' ')[0],
      newName = name.split(' ')[1],
      config = {
        action: 'move',
        from: oldName.replace('_', ' '),
        to: newName.replace('_', ' '),
        noredirect: '',
        reason:
        ($('#custom-summary')[0].value.length > 0 && $('#custom-summary')[0].value) ||
        window.massRenameSummary ||
        i18n.inContentLang().msg('summary').plain(),
        bot: true,
        token: mw.user.tokens.get('csrfToken')
      };
      if (document.getElementById('redirect-check').checked) {
        delete config.noredirect;
      }
      new mw.Api().post(config)
      .done(function (d) {
        if (!d.error) {
          console.log(i18n.msg('renameDone', oldName, newName).plain());
        } else {
          console.error(i18n.msg('renameFail', oldName, newName).escape() + ': ' + d.error.code);
          $('#text-error-output').append(i18n.msg('renameFail', oldName, newName).escape() + ': ' + d.error.code + '<br/>');
        }
      })
      .fail(function (error) {
        console.error(i18n.msg('renameFail', oldName, newName).plain() + ': ' + error);
        $('#text-error-output').append(i18n.msg('renameFail2', oldName, newName).escape() + '<br/>');
      });
    }
    setTimeout(process, window.massRenameDelay || 1000);
  }
  mw.hook('dev.modal').add(preload);
  mw.hook('dev.powertools.placement').add(preload);
  
  /**
  * @method initDependencies
  * @description Loads messages & userscript dependencies
  */
  function initDependencies() {
    var required = [MH_DEVSCRIPTS_GADGET_NAMESPACE+'.FandoomUiUtilsModal', MH_DEVSCRIPTS_GADGET_NAMESPACE+'.PowertoolsPlacement'];
    var availableModules = new Set(mw.loader.getModuleNames());
    var missing = required.filter(function (dep) {
      return !availableModules.has(dep);
    });
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
  
  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
  
  initDependencies();
});