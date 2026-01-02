//<pre>
/**
* View Source
*
* © Peter Coester 2013 [[User_talk:Pecoes|Pecoes]]
*
* Original code:
* https://dev.fandom.com/wiki/MediaWiki:View_Source/code.js?oldid=207789
* 
* documentation and examples at:
* https://dev.fandom.com/wiki/View_Source
*/

/*jshint jquery:true, browser:true, es5:true, devel:true, camelcase:true, curly:false, undef:true, unused:true, bitwise:true, eqeqeq:true, forin:true, immed:true, latedef:true, newcap:true, noarg:true, regexp:false, strict:true, trailing:true, maxcomplexity:10 */
/* eslint-disable no-useless-escape */
(function (module, mw, $) {
  
  'use strict';
  
  if (module.loadSource) return;
  
  var config = mw.config.get([
    'wgAction',
    'wgArticleId',
    'wgArticlePath',
    'wgContentLanguage',
    'wgCurRevisionId',
    'wgFormattedNamespaces',
    'wgNamespaceIds',
    'wgPageContentModel',
    'wgPageName',
    'wgUserLanguage',
    'wgVersion',
    'skin'
  ]),
  parserFunctions, parserTags, interwikiMap,
  preloads = 3,
  i18n, $content, $source, $a, $toc, headers = [];
  
  // Return if content model is not wikitext, not on view mode, or if article doesn't exist 
  if (
    config.wgPageContentModel !== 'wikitext' ||
    config.wgAction !== 'view' || 
    config.wgArticleId === 0
  ) {
    return;
  }
  
  function preload () {
    if (--preloads === 0) { init(); }
  }
  
  function init () {
    $content = $('#mw-content-text');
    if ($content.length) {
      addButton(config.skin);
      if (mw.util.getParamValue('view') === 'source') {
        module.loadSource();
      }
    }
  }
  
  /* 
  * Possible to customize the appearance of the 'View Source' button in this function
  */
  function addButton (skin) {
    if ($('#ca-view-source').length) return;
    var portlet = getAvailablePortlet(skin);
    if (portlet.length === 0) {
      console.error('view-source: skin ' + skin + ' is unsupported');
      return;
    }
    mw.util.addPortletLink(portlet.attr('id'), '', 'View Source', 'ca-view-source');
    $a = $('#ca-view-source > a, #ca-view-source > span').first();
    $a
    .text(i18n.msg('viewSource').plain())
    .attr("href", null)
    .attr("title", i18n.msg('tooltip').plain())
    .data('source', false)
    .on('click', function (e) {
      module[$a.data('source') ? 'hideSource' : 'loadSource']();
      e.preventDefault();
    });
  }
  function getAvailablePortlet (skin) {
    var portlet = null;
    switch (skin) {
      case 'minerva':
        portlet = $('#p-tb');
        break;
      case 'cosmos':
        portlet = $('#cosmos-actionsList-list');
        break;
      default:
        portlet = $('#p-cactions');
        if (portlet.length === 0) {
          // If the Actions portlet is not found, then try to find the portlet 
          // containing the Purge, Watch, Delete, or Move button
          portlet = $('#ca-purge, #ca-watch, #ca-delete, #ca-move').parents('.mw-portlet').last();
        }
    }
    return portlet;
  }
  
  function joinHrefParts (parts) {
    for (var i = 0; i < parts.length; i++) {
      parts[i] = encodeURIComponent(parts[i]);
    }
    return parts.join(':').replace(/ /g, '_');
  }
  
  function createHref (link) {
    
    var parts, hash = '';
    
    if (link.indexOf('#') !== -1) {
      parts = link.split(/\#/);
      link = parts.shift();
      if (!link.length) link = config.wgPageName;
      hash = '#' + parts.pop();
    }
    
    if (link[0] === '/') link = config.wgPageName + link;
    
    parts = link.split(/\:/);
    
    /*if ( parts.length > 2 && parts[0] === 'w' && parts[1] === 'c') {
    parts = parts.slice(2);
    return '//' + parts.shift() + '.wikia.com/wiki/' + joinHrefParts(parts) + hash;
    } else*/ if (parts.length > 1 && interwikiMap[parts[0].toLowerCase()]) {
      return interwikiMap[parts.shift().toLowerCase()].replace(/\$1/, joinHrefParts(parts) + hash);
    }
    return config.wgArticlePath.replace('$1', joinHrefParts(parts) + hash);
  }
  
  function replaceTag (all, delim, tag) {
    if (!parserTags[tag])
      if (/\//g.test(all)) return '&lt;/' + tag;
    else return '&lt;' + tag;
    return delim + '<a href="' + mw.html.escape(parserTags[tag]) + '">' + tag + '</a>';
  }
  
  function replaceHeaders (m) {
    headers.push(m);
    return '<a name="h' + (headers.length-1) + '"></a>' + m;
  }
  
  function replaceWikiLink (all, link, title) {
    title = title || '';
    return '[[<a href="' + mw.html.escape(createHref(link)) + '">' + link + '</a>'+ title + ']]';
  }
  
  function replaceTemplates (all, delim, name) {
    var href, m = name.match(/^(\#?)(\w+)(\:.*)/),
    fn = m && parserFunctions[m[1] + m[2]];
    if (fn) {
      return delim + m[1] + '<a href="https://www.mediawiki.org/wiki/' + fn + '">' + m[2] + '</a>' + m[3];
    }
    // remove <!--.*--> from template name. otherwise .match will failed
    name = name.replace(/&lt;\!\-\-[\s\S]*\-\-&gt;/, '');
    m = name.match(/^(\s*)(.+)(\s*)$/);
    if (m === null) {
      return all;
    }
    if (m[2][0] === ':') {
      href = m[2].substring(1);
    } else if(m[2].indexOf('w:') === 0) {
      href = 'w:' + (m[2][2] === ':' ?
        m[2].substring(3) :
        'Template:' + m[2].substring(2));
      console.log(href);
    } else if (m[2][0] === '/') {
      href = mw.config.values.wgPageName + m[2];
    } else {
      var templ = config.wgFormattedNamespaces[10] + ':';
        
      if(m[2].indexOf(':') !== -1) {
          
        var pagenamePrefix = m[2].split(':')[0];
        if (config.wgNamespaceIds[pagenamePrefix.toLowerCase()] !== undefined) {
          href = m[2];
        } else {
          href = templ + m[2];
        }
          
      } else {
        href = templ + m[2];
      }
    }
    return delim + m[1] + '<a href="' + mw.html.escape(createHref(href)) + '">' + m[2] + '</a>' + m[3];
  }
    
  function replaceRegularLinks (all, link, title) {
    title = title || '';
    return '[<a href="' + mw.html.escape(link) + '">' + link + '</a>'+ title + ']';
  }
  
  function replaceModules (all, prefix, title, postfix) {
    // experimental stuff. doesn't recognize {{#invoke:module{{{var}}}}}
    // /({{#invoke:)([\s\S]*?)(\||})/igm
    var page = config.wgFormattedNamespaces[828] + ':' + title.trim();
    return (prefix + '<a href="' + mw.html.escape(createHref(page)) + '">' + title.trim() + '</a>' + postfix);
  }
  
  module.loadSource = function () {
    $a.text(i18n.msg('viewArticle').plain())
    .data('source', true);
    if ($source) {
      $source.show();
      $content.hide();
      if ($toc) $toc.show();
    } else {
      $.get(mw.util.getUrl(config.wgPageName, {
        action: 'raw',
        maxage: '0',
        smaxage: '0',
        oldid: mw.util.getParamValue('diff') || mw.util.getParamValue('oldid') || config.wgCurRevisionId
      }))
      .done(function (wikitext) {
        $source = $('<pre id="source-code">' +
          wikitext
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;' )
          .replace(/>/g, '&gt;' )
          .replace(/({{#invoke:)([\s\S]*?)(\||})/igm, replaceModules)
          .replace(/(&lt;\/?)([\w\:\-]+)/g, replaceTag)
          .replace(/^((=+)[^\[\]\{\}]+?\2)/gm, replaceHeaders)
          .replace(/\[{2}([^\[\]\{\}\|]+)(\|[^\]]+)?\]{2}/g, replaceWikiLink)
          .replace(/\[(https?:\/\/[^ \]]+)([^\]]*)\]/g, replaceRegularLinks)
          .replace(/((?:^|[^\{])\{\{)([^\{\|\}]+)/g, replaceTemplates)
          .replace(/\r\n|\r|\n/g, '<br />') +
          '</pre>')
          .insertBefore($content.css('display', 'none'));
        });
    }
  };
      
  module.hideSource = function () {
    if (!$source) return;
    $a.text(i18n.msg('viewSource').plain())
    .data('source', false);
    $source.hide();
    $content.show();
    if ($toc) $toc.hide();
  };
      
  /* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
  INJECT_FANDOM_UTILS_I18N();
  
  mw.hook( 'userjs.view-source.definitions' ).add(function ( definitions ) {
    parserFunctions = definitions.parserFunctions;
    parserTags = definitions.parserTags;
    interwikiMap = definitions.interwikiMap;
    preload();
  } );
  $.when(
    getI18nLoader(),
    mw.loader.using('mediawiki.util')
  ).then(function (i18nLoader) {
    i18n = prepareI18n(i18nLoader);
    preload();
  });
  mw.hook('wikipage.content').add(preload);
  
}((window.dev = window.dev || {}).viewSource = window.dev.viewSource || {}, mediaWiki, jQuery));