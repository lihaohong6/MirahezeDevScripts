import { EditorApp, mountEditorApp } from './editor-app';
import { JsonEditorTrigger } from './types';

( () => {
    let appPromise: JQuery.Promise<EditorApp> | undefined;

    function getApp(): JQuery.Promise<EditorApp> {
        if ( !appPromise ) {
            appPromise = mountEditorApp();
        }
        return appPromise;
    }

    function readTrigger( element: HTMLElement ): JsonEditorTrigger | undefined {
        const { jsonPage, jsonField, jsonLabel, jsonSummary } = element.dataset;
        if ( !jsonPage || !jsonField ) {
            return undefined;
        }
        return {
            page: jsonPage,
            field: jsonField,
            label: jsonLabel,
            summary: jsonSummary,
        };
    }

    function handleTrigger( element: HTMLElement ): void {
        const trigger = readTrigger( element );
        if ( !trigger ) {
            mw.notify( 'JSON Editor: trigger is missing required data-json-page/data-json-field attributes.', { type: 'error' } );
            return;
        }
        getApp().then( ( app ) => {
            app.openEditor( trigger );
        } );
    }

    mw.hook( 'wikipage.content' ).add( ( $content ) => {
        $content.find( '.client-json-editor' ).each( ( _, element ) => {
            // Guard against double entry
            if ( element.dataset.jsonEditorProcessed ) {
                return;
            }
            element.dataset.jsonEditorProcessed = 'true';

            element.role = 'button';
            element.tabIndex = 0;
            element.ariaHasPopup = 'dialog';

            element.addEventListener( 'click', () => handleTrigger( element ) );
            element.addEventListener( 'keydown', ( event ) => {
                if ( event.key === 'Enter' || event.key === ' ' ) {
                    event.preventDefault();
                    handleTrigger( element );
                }
            } );
        } );
    } );
} )();
