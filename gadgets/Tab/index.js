/**
 * Author: User:PetraMagna
 * License: CC BY-SA 4.0
 */

/* eslint-disable no-console */
/* Console only used for debug mode */

( function () {

    const DEBUG_MODE = [ 'localhost:', 'safemode=', 'action=submit' ]
        .some( ( str ) => window.location.href.includes( str ) );

    const allButtons = {}, allPanels = {};

    // specifies what to do after the user clicks on a sensei reply option
    function selectTab( group, option, focusIndex ) {
        if ( DEBUG_MODE ) {
            console.log( `Group ${ group } option ${ option } selected with focus ${ focusIndex }` );
        }
        const buttons = allButtons[ group ] || [];
        for ( const { el, option: buttonOption } of buttons ) {
            el.classList.toggle( 'tab-button-selected', buttonOption === option );
            el.ariaSelected = buttonOption === option;
            el.tabIndex = buttonOption === option ? 0 : -1;
        }
        if ( focusIndex !== undefined ) {
            buttons[ focusIndex ].el.focus();
        }
        const panels = allPanels[ group ] || [];
        for ( const { el, option: panelOption } of panels ) {
            el.classList.toggle( 'tab-panel-hidden', panelOption !== option );
        }
    }

    function handleTabKeyDown( event, group, buttonIndex ) {
        const buttons = allButtons[ group ];

        function normalizeIndex( index ) {
            if ( index < 0 ) {
                return index + buttons.length;
            }
            if ( index >= buttons.length ) {
                return index - buttons.length;
            }
            return index;
        }

        let newIndex;

        switch ( event.key ) {
            case 'ArrowUp':
            case 'ArrowLeft':
                newIndex = buttonIndex - 1;
                break;

            case 'ArrowDown':
            case 'ArrowRight':
                newIndex = buttonIndex + 1;
                break;

            case 'Home':
                newIndex = 0;
                break;

            case 'End':
                newIndex = buttons.length - 1;
                break;

            default:
                break;
        }
        if ( newIndex !== undefined ) {
            if ( DEBUG_MODE ) {
                console.log( `Keypress ${ event.key } leads to new button index ${ newIndex }` );
            }
            newIndex = normalizeIndex( newIndex );
            selectTab( group, buttons[ newIndex ].option, newIndex );
            event.stopPropagation();
            event.preventDefault();
        }
    }

    function randomGroup() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array
            .from( { length: 10 }, () => chars[ Math.floor( Math.random() * chars.length ) ] )
            .join( '' );
    }

    // Get group name for a tab element, possibly inherited from a parent
    function getGroup( el ) {
        return el.dataset.group || el.closest( '[data-group]' ).dataset.group || undefined;
    }

    function initTabs() {
        let urlHash = window.location.hash;
        if ( urlHash ) {
            urlHash = decodeURIComponent( urlHash.slice( 1 ) ).replace( / /g, '_' );
        }

        // Anonymous tab groups should be assigned a random group number
        document.querySelectorAll( '.tab-group-container' ).forEach( ( container ) => {
            if ( !container.dataset.group ) {
                container.dataset.group = randomGroup();
            }
        } );

        document.querySelectorAll( '.tab-button-container, .tab-panel-container' ).forEach( ( container ) => {
            container.querySelectorAll( '.tab-button, .tab-panel' ).forEach( ( elem, index ) => {
                if ( !elem.dataset.option ) {
                    elem.dataset.option = index;
                }
            } );
        } );

        document.querySelectorAll( '.tab-button-container' ).forEach( ( container ) => {
            container.role = 'tablist';
        } );

        const defaultButtons = {};
        document.querySelectorAll( '.tab-button' ).forEach( ( button ) => {
            const group = getGroup( button );
            if ( !group ) {
                return;
            }

            const option = button.dataset.option;
            const name = button.dataset.name || button.textContent.trim();
            if ( !option ) {
                return;
            }

            if ( !allButtons[ group ] ) {
                allButtons[ group ] = [];
            }
            const buttonIndex = allButtons[ group ].length;
            allButtons[ group ].push( { option: option, el: button } );

            // Either select the first button encountered as the default
            // or use the one that matches the URL hash
            if ( !defaultButtons[ group ] ) {
                defaultButtons[ group ] = option;
            }
            if ( urlHash && name.replace( / /g, '_' ) === urlHash ) {
                defaultButtons[ group ] = option;
            }

            button.role = 'tab';
            button.tabIndex = 0;
            button.ariaSelected = 'false';

            button.addEventListener( 'keydown', ( ev ) => handleTabKeyDown( ev, group, buttonIndex ) );
            button.addEventListener( 'click', () => selectTab( group, option ) );
        } );

        document.querySelectorAll( '.tab-panel' ).forEach( ( panel ) => {
            const group = getGroup( panel );
            if ( !group ) {
                return;
            }

            const option = panel.dataset.option;
            if ( !option ) {
                return;
            }

            panel.role = 'tabpanel';
            panel.tabIndex = 0;

            if ( !allPanels[ group ] ) {
                allPanels[ group ] = [];
            }
            allPanels[ group ].push( { option: option, el: panel } );
        } );

        for ( const [ group, option ] of Object.entries( defaultButtons ) ) {
            selectTab( group, option );
        }

        if ( DEBUG_MODE ) {
            console.log( 'Found buttons: ', allButtons );
            console.log( 'Found panels: ', allPanels );
        }
    }

    initTabs();
}() );
