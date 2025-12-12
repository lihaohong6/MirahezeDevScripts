(function ($, mw) {
  var skin = mw.config.values.skin;
  
  var POWER_EDITOR_TOOLBOX_PORTLET_ID = 'p-power-editor-tools';
  var POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT;
  var versionString = '20250821';
  
  if (mw.libs.PowertoolsPlacement !== undefined && mw.libs.PowertoolsPlacement.versionString >= versionString) {
    return;
  }
  if ($(POWER_EDITOR_TOOLBOX_PORTLET_ID).length > 0) {
    return;
  }
  
  var i18n = {
    "ab": "Мои инструменты",
    "ace": "Alat saya",
    "af": "My hulpmiddels",
    "als": "Werkzeugkasten",
    "an": "Mis herramientas",
    "ar": "أدواتي",
    "arn": "Mis herramientas",
    "arz": "أدواتي",
    "av": "Мои инструменты",
    "ay": "Mis herramientas",
    "ba": "Мои инструменты",
    "bar": "Werkzeugkasten",
    "bat-smg": "Mano įrankiai",
    "bcc": "ابزارهای من",
    "bg": "Моите инструменти",
    "bjn": "Alat saya",
    "bm": "Mes outils",
    "bqi": "ابزارهای من",
    "br": "Ma ostilhoù",
    "bug": "Alat saya",
    "ca": "Les meves Eines",
    "cbk-zam": "Mis herramientas",
    "ce": "Мои инструменты",
    "ckb": "ئامرازەکانم",
    "crh-cyrl": "Мои инструменты",
    "cs": "Moje nástroje",
    "csb": "Moje narzędzia",
    "cv": "Мои инструменты",
    "de": "Werkzeugkasten",
    "dsb": "Werkzeugkasten",
    "dtp": "Alatan Saya",
    "eml": "I miei strumenti",
    "el": "Τα εργαλεία μου",
    "en": "My Tools",
    "es": "Mis herramientas",
    "fa": "ابزارهای من",
    "ff": "Mes outils",
    "fi": "Omat työkalut",
    "fr": "Mes outils",
    "frp": "Mes outils",
    "frr": "Werkzeugkasten",
    "fur": "I miei strumenti",
    "gan": "我的工具",
    "gan-hans": "我的工具",
    "gan-hant": "我的工具",
    "gl": "As miñas ferramentas",
    "glk": "ابزارهای من",
    "gn": "Mis herramientas",
    "gsw": "Werkzeugkasten",
    "he": "הכלים שלי",
    "hsb": "Werkzeugkasten",
    "ht": "Mes outils",
    "hu": "Saját eszközök",
    "ia": "Mi utensiles",
    "id": "Alat saya",
    "ii": "我的工具",
    "inh": "Мои инструменты",
    "it": "I miei strumenti",
    "ja": "マイツール",
    "jv": "Alat saya",
    "ko": "내 도구",
    "ko-kp": "내 도구",
    "koi": "Мои инструменты",
    "krc": "Мои инструменты",
    "ksh": "Werkzeugkasten",
    "ku-arab": "ئامرازەکانم",
    "kv": "Мои инструменты",
    "lad": "Mis herramientas",
    "lb": "Werkzeugkasten",
    "lbe": "Мои инструменты",
    "lez": "Мои инструменты",
    "lij": "I miei strumenti",
    "lmo": "I miei strumenti",
    "ln": "Mes outils",
    "lt": "Mano įrankiai",
    "map-bms": "Alat saya",
    "mg": "Mes outils",
    "mhr": "Мои инструменты",
    "min": "Alat saya",
    "mk": "Мои алатки",
    "ml": "എന്റെ ഉപകരണങ്ങൾ",
    "mrj": "Мои инструменты",
    "ms": "Alatan Saya",
    "mwl": "Minhas ferramentas",
    "my": "ကိရိယာများ",
    "myv": "Мои инструменты",
    "mzn": "ابزارهای من",
    "nah": "Mis herramientas",
    "nap": "I miei strumenti",
    "nb": "Mine verktøy",
    "nds": "Werkzeugkasten",
    "no": "Mine verktøy",
    "os": "Мои инструменты",
    "pcd": "Mes outils",
    "pdc": "Werkzeugkasten",
    "pdt": "Werkzeugkasten",
    "pfl": "Werkzeugkasten",
    "pl": "Moje narzędzia",
    "pms": "I miei strumenti",
    "ps": "زما اوزارونه",
    "pt": "Minhas ferramentas",
    "pt-br": "Minhas ferramentas",
    "qu": "Mis herramientas",
    "qug": "Mis herramientas",
    "rgn": "I miei strumenti",
    "ru": "Мои инструменты",
    "rue": "Мої інструменти",
    "ruq-cyrl": "Мои алатки",
    "sah": "Мои инструменты",
    "scn": "I miei strumenti",
    "sg": "Mes outils",
    "sgs": "Mano įrankiai",
    "shi": "أدواتي",
    "sli": "Werkzeugkasten",
    "sr": "Алатке",
    "sr-ec": "Алатке",
    "stq": "Werkzeugkasten",
    "su": "Alat saya",
    "sv": "Mina Verktyg",
    "szl": "Moje narzędzia",
    "te": "నా పనిముట్లు",
    "tl": "Mga Kasangkapan Ko",
    "tr": "Araçlarım",
    "tt": "Минем коралларым",
    "tt-cyrl": "Минем коралларым",
    "ty": "Mes outils",
    "udm": "Мои инструменты",
    "uk": "Мої інструменти",
    "vec": "I miei strumenti",
    "vi": "Công cụ của tôi",
    "vmf": "Werkzeugkasten",
    "vot": "Omat työkalut",
    "wa": "Mes outils",
    "wo": "Mes outils",
    "wuu": "我的工具",
    "xal": "Мои инструменты",
    "yi": "הכלים שלי",
    "za": "我的工具",
    "zh": "我的工具",
    "zh-cn": "我的工具",
    "zh-hans": "我的工具",
    "zh-hant": "我的工具",
    "zh-hk": "我的工具",
    "zh-mo": "我的工具",
    "zh-my": "我的工具",
    "zh-sg": "我的工具",
    "zh-tw": "我的工具"
  };
  var lang = mw.config.get('wgUserLanguage');
  POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT = i18n[lang] || i18n[lang.split('-')[0]] || i18n.en;
  
  /*
  * Utility function.
  * 
  * @param {jQuery.Element} insert
  * @param {jQuery.Element} atNode
  * 
  * @return {jQuery.Element | null}
  */
  function placeAfterNode(insert, atNode) {
    if (atNode.length === 0) {
      return null;
    }
    atNode.after(insert);
    return insert;
  }
  
  /*
  * Creates a toolbox for power editing of wikis.
  *
  * @param {string} skin The name of the wiki skin, taken from mw.config
  *
  * @return {jQuery.Element}
  */
  function addPowerEditorToolboxPortlet(skin) {
    if ($('#'+POWER_EDITOR_TOOLBOX_PORTLET_ID).length) {
      return $('#'+POWER_EDITOR_TOOLBOX_PORTLET_ID).first();
    }
    var portlet = null;
    switch (skin) {
      case 'vector':
      case 'vector-2022':
      case 'monobook':
      case 'modern':
      case 'timeless':
        portlet = $(mw.util.addPortlet( POWER_EDITOR_TOOLBOX_PORTLET_ID, POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT, '#p-tb' ));
        break;
      case 'minerva':
        portlet = createPowerEditorToolboxPortletForMinerva();
        break;
      case 'gamepress':
        portlet = createPowerEditorToolboxPortletForGamepress();
        break;
      case 'medik':
        portlet = createPowerEditorToolboxPortletForMedik();
        break;
      case 'citizen':
        portlet = createPowerEditorToolboxPortletForCitizen();
        break;
      case 'cosmos':
        // In the case of Cosmos, use the manually-created floating portlet that is also used for unsupported skins 
        portlet = createFloatingMenuPowerEditorToolboxPortlet();
        mw.loader.addStyleTag("#"+POWER_EDITOR_TOOLBOX_PORTLET_ID + ".floating{--powertools-portlet-position-bottom:60px !important}");
        break;
      default:
        portlet = createFloatingMenuPowerEditorToolboxPortlet();
        break;
    }
    return portlet;
  }
  
  /*
  * A modular function used to create a portlet for MinervaNeue
  * This should only be called by addPowerEditorToolboxPortlet()
  *
  * @return {jQuery.Element}
  */
  function createPowerEditorToolboxPortletForMinerva() {
    var portlet = $('<ul>', { 
      'id': POWER_EDITOR_TOOLBOX_PORTLET_ID,
      'class': 'toggle-list__list'
    });
    portlet = placeAfterNode(portlet, $('#p-interaction, #p-navigation').last());
    return portlet;
  }
  
  /*
  * A modular function used to create a portlet for Gamepress
  * This should only be called by addPowerEditorToolboxPortlet()
  *
  * @return {jQuery.Element}
  */
  function createPowerEditorToolboxPortletForGamepress() {
    var portlet = $('<div>', {
      'class': 'portlet widget',
      'id': POWER_EDITOR_TOOLBOX_PORTLET_ID,
      'role': 'navigation'
    }).append(
      $('<h3>', { 'class': 'widget-title' })
        .text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT),
      $('<ul>')
    );
    portlet = placeAfterNode(portlet, $('#p-tb'));
    return portlet;
  }

  /*
  * A modular function used to create a portlet for Medik
  * This should only be called by addPowerEditorToolboxPortlet()
  *
  * @return {jQuery.Element}
  */
  function createPowerEditorToolboxPortletForMedik() {
    var newMenu = $('<div>', { 'class': 'dropdown' })
      .append(
        $('<a>', { 
          'class': 'dropdown-toggle', 
          'role': 'button', 
          'data-bs-toggle': 'dropdown', 
          'data-bs-display': 'static', 
          'aria-haspopup': 'true', 
          'aria-expanded': 'false' 
        })
          .text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT),

        $('<div>', { 'class': 'dropdown-menu dropdown-menu-end' }).append(
          $('<div>', { 
            'role': 'navigation',
            'id': POWER_EDITOR_TOOLBOX_PORTLET_ID,
            'aria-labelledby': POWER_EDITOR_TOOLBOX_PORTLET_ID+'-label',
            'class': 'mw-portlet' 
          }).append(

            $('<a>', { 
              id: POWER_EDITOR_TOOLBOX_PORTLET_ID+'-label',
              'class': 'nav-link disabled',
              href: '#',
              role: 'button'
            }).text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT),

            $('<div>', { 'class': 'mw-portlet-body' }).append(
              $('<ul>', { lang: lang || 'en' })
            )

          )
        )
    );
    newMenu = placeAfterNode(newMenu, $('div.dropdown:has(#p-tb)'));
    return newMenu.find('#'+POWER_EDITOR_TOOLBOX_PORTLET_ID);
  }
      
  /*
  * A modular function used to create a portlet for Citizen
  * This should only be called by addPowerEditorToolboxPortlet()
  *
  * @return {jQuery.Element}
  */
  function createPowerEditorToolboxPortletForCitizen() {
    var newMenu = $('<div>', { 'class': 'citizen-header__item citizen-dropdown' })
      .append(
        $('<details>', { 
          id: 'citizen-powertools-portlet-container-details', 
          'class': 'citizen-dropdown-details' 
        }).append(
          $('<summary>', { 
            'class': 'citizen-dropdown-summary', 
            title: POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT, 
            'aria-details': 'citizen-powertools-portlet-container__card' 
          }).append(
            $('<span>', { 'class': 'citizen-ui-icon mw-ui-icon-edit mw-ui-icon-wikimedia-edit' }),
            $('<span>').text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT)
          )
        ),
        
        $('<div>', { 
          id: 'citizen-powertools-portlet-container__card', 
          'class': 'citizen-menu__card' 
        }).append(
          $('<div>', { 'class': 'citizen-menu__card-content' })
            .append(
              $('<div>', { 
                id: 'citizen-powertools-portlet-container-content', 
                'class': 'citizen-powertools-portlet-container-content' 
              }).append(
                $('<div>', { 
                  'class': 'mw-portlet mw-portlet-skin-client-prefs-citizen-feature-custom-font-size mw-portlet-js citizen-menu', 
                  id: 'p-power-editor-tools' 
                }).append(
                  $('<div>', { 'class': 'citizen-menu__heading' }).text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT),
                  $('<div>', { 'class': 'citizen-menu__content' })
                    .append($('<ul>', { 'class': 'citizen-menu__content-list' }))
                )
              )
            )
        )
      );
    $('.citizen-header__start').append(newMenu);
    $('body').on('click', function () {
      if ($('#citizen-powertools-portlet-container-details').attr('open')) {
        $('#citizen-powertools-portlet-container-details').attr('open', null);
      }
    });
    return newMenu.find('#'+POWER_EDITOR_TOOLBOX_PORTLET_ID);
  }
      
  /*
  * A modular function used to create a floating menu that acts as a portlet
  * This should only be called by addPowerEditorToolboxPortlet()
  *
  * @return {jQuery.Element}
  */
  function createFloatingMenuPowerEditorToolboxPortlet() {
    var portlet = $('<div>', { id: POWER_EDITOR_TOOLBOX_PORTLET_ID, 'class': 'floating' })
      .append(
        $('<div>', { 'class': 'powertools-portlet-menu-label' })
        .append(
          $('<img>', { src: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Codex_icon_edit_color-placeholder.svg' }),
          $('<span>').text(POWER_EDITOR_TOOLBOX_PORTLET_HEADING_TEXT),
          $('<span>', { 'class': 'powertools-portlet-arrow-icon' })
            .append(
              $('<svg width="14" height="14" viewBox="0 0 14 14"><path d="M 2 5 L 12 5 L 7 10 Z"></path></svg>')
            )
        )
      )
      .append(
        $('<div>', { 'class': 'powertools-portlet-body' })
        .append($('<ul>'))
      );
    portlet.click(function () { $(this).toggleClass('show'); });
    $('body').append(portlet);
    return portlet;
  }
      
  /*
  * Adds a portlet link to the Power Editors toolbox.
  *
  * @param {string} skin The name of the wiki skin, taken from mw.config
  * @param {string} config.id The HTML identifier of the link
  * @param {string} config.href The URL of the link. Defaults to '#'.
  * @param {string} config.label
  * @param {string} config.tooltip
  * @param {string} config.cssClasses
  * @param {object} config.styles e.g. {'background-color': 'red', 'color': 'yellow'}
  * @param {callback} config.onClick
  *
  * @return {jQuery.Element}
  */
  function addPortletLinkToPowerEditorToolbox(skin, config) {
    // Get or create portlet
    var portlet = $('#'+POWER_EDITOR_TOOLBOX_PORTLET_ID);
    if (portlet.length === 0) { portlet = this.addPortlet(skin); }
    if (!portlet || portlet.length === 0) {
      console.error('[Powertools Placement] Skin ' + skin + ' is not supported');
      return;
    }

    // DOM Guard
    if ($('#'+config.id).length) {
      return;
    }
    
    // Get config parameters
    var label = config.label || '[TOOL]';
    var id = config.id;
    var href = config.href || '#';
    var tooltip = config.tooltip;
    var cssClasses = config.cssClasses;
    var styles = config.styles;
    var onClick = config.onClick;
    
    // Actually create the portlet link
    var portletLink = $(mw.util.addPortletLink( POWER_EDITOR_TOOLBOX_PORTLET_ID, href, label, id, tooltip ));
    if (!!onClick) {
      if (typeof onClick === 'function') {
        portletLink.on('click', onClick);
      } else {
        console.error('[Powertools Placement] onClick is not a function');
      }
    }
    if (!!cssClasses) { portletLink.addClass(cssClasses); }
    if (!!styles) { portletLink.css(styles); }
    return portletLink;
  }
      
  mw.loader.using( [ 'mediawiki.util' ], function() {
    var module = {
      getPortletId: function () {
        return POWER_EDITOR_TOOLBOX_PORTLET_ID;
      },
      addPortlet: addPowerEditorToolboxPortlet, 
      addPortletLink: addPortletLinkToPowerEditorToolbox,
      getVersion: function () {
        return versionString;
      }
    };
    mw.libs.PowertoolsPlacement = module;
    mw.hook('dev.powertools.placement').fire(module);
  } );
      
}(jQuery, mediaWiki));