/**
* Ajax Undo links
*
* Adds an Ajax undo link next to the normal undo link on page histories
* and on diff pages
*
* @author Grunny
* @author Cqm
*
* @version 0.5
*
* Used files: [[w:c:File:24px-spinner-black.gif]]
*/

;(function ($, mw) {
  'use strict';
  if (window.AjaxUndoLoaded) {
    return;
  }
  window.AjaxUndoLoaded = true;
  
  var conf = mw.config.get([
    'wgArticlePath',
    'wgAction',
    'wgVersion',
    'wgCanonicalSpecialPageName',
  ]);
  
  var i18n, api;
  
  function msg(message) {
    return i18n.msg(message).plain();
  }
  
  function undoEdit() {
    var $this = $(this),
    url = $this.data().url,
    page = $this.data().page,
    undoId = /&undo=([^&]*)/.exec(url)[1],
    summaryPromise,
    defaultSummary = window.AjaxUndoSummary || '';
    
    if (window.AjaxUndoPrompt) {
      summaryPromise = OO.ui.prompt(msg('summaryprompt'), {
        textInput: {
          value: defaultSummary
        }
      });
    } else {
      summaryPromise = $.Deferred();
      summaryPromise.resolve(defaultSummary);
    }
    
    summaryPromise.then(function(summary) {
      if (summary === null) {
        return;
      }
      $this.html(
        $('<img>')
        .attr({
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/24px-spinner-black.gif',
          alt: msg('undoing'),
          border: '0'
        })
        .css('vertical-align', 'baseline')
      );
      return api.postWithEditToken({
        action: 'edit',
        title: page,
        undo: undoId,
        bot: '1',
        minor: window.AjaxUndoMinor ? undefined : '1',
        summary: summary === '' ? undefined : summary
      });
    }).then(function (data) {
      if (!data) {
        return;
      }
      if (data.edit && data.edit.result === 'Success') {
        $this.text( '(' + msg('undone') + ')' );
      } else {
        $this.text('(' + msg('error') + ')');
        
        alert(data.error && data.error.code === 'undofailure' ?
          data.error.info :
          msg('unknownerror')
        );
      }
    });
  }
  
  function createUndoLink(url) {
    var uri = new URL(url),
    title = uri.searchParams.get('title');
    return $('<a>', {
      href: '#ajaxundo', // For integration
      'data-url': url,
      'data-page': decodeURIComponent(title ||
        uri.pathname.substring(
          conf.wgArticlePath
          .replace('$1', '')
          .length
        )
      ),
      text: msg('buttontext'),
      click: undoEdit,
      title: msg('undotitle'),
    });
  }
  
  function init(i18nLoader) {
    i18n = prepareI18n(i18nLoader);
    api = new mw.Api();
    if (conf.wgAction === 'history' && $('.mw-history-undo > a').length) {
      $('.mw-history-undo > a').each(function () {
        var $this = $(this),
        url = $(this).prop( 'href' ),
        $link = createUndoLink(url);
        
        $this.parent().parent().after($('<span>').append($link));
      });
    } else if ($('table.diff').length && mw.util.getParamValue('diff') !== undefined) {
      const $undoLink = $('table.diff').find('.diff-ntitle .mw-diff-undo a:first'),
      url = $undoLink.prop('href'),
      $link = createUndoLink(url);
      
      $undoLink.parent().after(' (', $link, ')');
    } else if (conf.wgCanonicalSpecialPageName === 'Contributions'){
      $('.mw-contributions-list > li:has(.mw-changeslist-diff)').each(function () {
        const url = $(this).find('.mw-changeslist-diff').prop('href').replace('?diff=prev&oldid=', '?action=edit&undo=');
        const $link = createUndoLink(url);
        $(this).append($('<span>').append(' (', $link, ')'));
      });
    }
    mw.hook('quickdiff.ready').add(function() {
      const $undoLink = $('#quickdiff-modal table.diff').find('.diff-ntitle .mw-diff-undo a:first'),
      url = $undoLink.prop('href'),
      $link = createUndoLink(url);
      
      $undoLink.parent().after(' (', $link, ')');
    });
  }

  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
  
  $.when(
    getI18nLoader(),
    mw.loader.using([
      'mediawiki.api',
      'mediawiki.user',
      'mediawiki.util',
      'oojs-ui-windows'
    ])
  ).then(init);
  
}(jQuery, mediaWiki));