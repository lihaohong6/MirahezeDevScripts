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
    function selectTab( group, option, focus ) {
        if ( DEBUG_MODE ) {
            console.log( `Group ${ group } option ${ option } selected` );
        }
        const buttons = allButtons[ group ] || [];
        for ( const { el, option: buttonOption } of buttons ) {
            el.classList.toggle( 'tab-button-selected', buttonOption == option );
            el.ariaSelected = buttonOption == option
            el.tabIndex = buttonOption == option ? 0 : -1
            if (focus && buttonOption == option) {
                el.focus()
            }
        }
        const panels = allPanels[ group ] || [];
        for ( const { el, option: panelOption } of panels ) {
            el.classList.toggle( 'tab-panel-hidden', panelOption != option );
        }
    }

    function handleTabKeyDown(event, group, option) {
        let tgt = event.currentTarget,
        flag = false;

        // Note: When multiple buttons containers with same group,
        // focus behaviour jumps to the last button container

        // This doesn't work for non numerical IDs

        // Not very good
        const isVertical = tgt.parentElement.getAttribute('aria-orientation') === 'vertical'

        // Also not very good
        const totalOptions = tgt.parentElement.querySelectorAll('.tab-button').length-1

        switch (event.key) {
        case isVertical ? 'ArrowUp' : 'ArrowLeft':
            if ( DEBUG_MODE ) {
                console.log( `Group ${ group } roving left from option ${ option }` );
            }
            selectTab(group, option!=0 ? +option-1 : totalOptions, true)
            flag = true;
            break;

        case isVertical ? 'ArrowDown' : 'ArrowRight':
            if ( DEBUG_MODE ) {
                console.log( `Group ${ group } roving right from option ${ option }` );
            }
            selectTab(group, option!=totalOptions ? +option+1 : 0, true)
            flag = true;
            break;

        case 'Home':
            if ( DEBUG_MODE ) {
                console.log( `Group ${ group } jumping to start from option ${ option }` );
            }
            selectTab(group, 0, true)
            flag = true;
            break;

        case 'End':
            if ( DEBUG_MODE ) {
                console.log( `Group ${ group } jumping to end from option ${ option }` );
            }
            selectTab(group, totalOptions, true)
            flag = true;
            break;

        default:
            break;
        }

        if (flag) {
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
            container.role = 'tablist'
            container.id = `${container.parentElement.dataset.group}-tablist`
            // There should be an aria-label labelling the tablist
            if (container.classList.contains('tab-vertical')) {
                container.setAttribute('aria-orientation', 'vertical')
            }
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
            allButtons[ group ].push( { option: option, el: button } );

            // Either select the first button encountered as the default
            // or use the one that matches the URL hash
            if ( !defaultButtons[ group ] ) {
                defaultButtons[ group ] = option;
            }
            if ( urlHash && name.replace( / /g, '_' ) === urlHash ) {
                defaultButtons[ group ] = option;
            }

            button.id = `${group}-${option}-tab`
            button.role = 'tab'
            button.tabIndex = -1
            button.setAttribute('aria-controls', `${group}-${option}-tabpanel`)
            button.setAttribute('aria-selected', false)

            button.addEventListener( 'keydown', (ev) => handleTabKeyDown( ev, group, option ) );
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
            
            panel.role = 'tabpanel'
            panel.id = `${group}-${option}-tabpanel`
            panel.setAttribute('aria-labelledby', `${group}-${option}-tab`)

            // Not too good of a way to check if the first element after tab panel is focusable
            panel.tabIndex = 0

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
