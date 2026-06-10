import { JsonEditorTrigger } from './types';
import { getByPath, JsonValue, parsePath, setByPath } from './json-path';

export interface EditorApp {
    openEditor( trigger: JsonEditorTrigger ): void;
}

type ValueType = 'string' | 'number' | 'boolean' | 'object';

export function mountEditorApp(): JQuery.Promise<EditorApp> {
    return mw.loader.using( '@wikimedia/codex' ).then( ( require ) => {
        const Vue = require( 'vue' );
        const Codex = require( '@wikimedia/codex' );

        const mountPoint = document.createElement( 'div' );
        document.body.appendChild( mountPoint );

        return Vue.createMwApp( {
            data(): {
                open: boolean;
                page: string;
                field: string;
                label: string;
                summary: string;
                pageData: JsonValue | null;
                basetimestamp: string;
                editValue: string | number | boolean;
                valueType: ValueType;
                errorMessage: string;
                saving: boolean;
            } {
                return {
                    open: false,
                    page: '',
                    field: '',
                    label: '',
                    summary: '',
                    pageData: null,
                    basetimestamp: '',
                    editValue: '',
                    valueType: 'string',
                    errorMessage: '',
                    saving: false,
                };
            },
            computed: {
                fieldLabel() {
                    if ( this.label ) {
                        return this.label;
                    }
                    return this.field;
                },
                pageUrl() {
                    return mw.util.getUrl( this.page );
                },
                primaryAction() {
                    return {
                        label: 'Save',
                        actionType: 'progressive',
                        disabled: this.saving,
                    };
                },
                defaultAction() {
                    return {
                        label: 'Cancel',
                        disabled: this.saving,
                    };
                },
            },
            methods: {
                openEditor( trigger: JsonEditorTrigger ) {
                    this.errorMessage = '';
                    this.saving = false;

                    const api = new mw.Api();
                    api.get( {
                        action: 'query',
                        titles: trigger.page,
                        prop: 'revisions',
                        rvprop: 'content|timestamp',
                        rvslots: 'main',
                        formatversion: 2,
                        format: 'json',
                    } ).then( ( response ) => {
                        const page = response.query?.pages?.[ 0 ];
                        const revision = page?.revisions?.[ 0 ];
                        if ( page?.missing || !revision ) {
                            mw.notify( `JSON Editor: page "${ trigger.page }" does not exist.`, { type: 'error' } );
                            return;
                        }

                        let data: JsonValue;
                        try {
                            data = JSON.parse( revision.slots.main.content );
                        } catch {
                            mw.notify( `JSON Editor: page "${ trigger.page }" does not contain valid JSON.`, { type: 'error' } );
                            return;
                        }

                        const path = parsePath( trigger.field );
                        const value = getByPath( data, path );
                        if ( value === undefined ) {
                            mw.notify( `JSON Editor: field "${ trigger.field }" was not found on "${ trigger.page }".`, { type: 'error' } );
                            return;
                        }

                        this.page = trigger.page;
                        this.field = trigger.field;
                        this.label = trigger.label || '';
                        this.summary = trigger.summary || '';
                        this.pageData = data;
                        this.basetimestamp = revision.timestamp;

                        if ( typeof value === 'number' ) {
                            this.valueType = 'number';
                            this.editValue = value;
                        } else if ( typeof value === 'boolean' ) {
                            this.valueType = 'boolean';
                            this.editValue = value;
                        } else if ( typeof value === 'string' ) {
                            this.valueType = 'string';
                            this.editValue = value;
                        } else {
                            this.valueType = 'object';
                            this.editValue = JSON.stringify( value, null, 2 );
                        }

                        this.open = true;
                    }, () => {
                        mw.notify( `JSON Editor: failed to load "${ trigger.page }".`, { type: 'error' } );
                    } );
                },
                buildSummary(): string {
                    let prefix = ( window as unknown as { jsonEditorSummaryPrefix?: string } ).jsonEditorSummaryPrefix;
                    prefix = prefix || '[[dev:JsonEditor|JsonEditor]]';
                    prefix = `${ prefix }: update ${ this.fieldLabel }`;
                    return this.summary ? `${ prefix } (${ this.summary })` : prefix;
                },
                onSave() {
                    if ( this.saving || this.pageData === null ) {
                        return;
                    }
                    this.errorMessage = '';

                    let newValue: JsonValue;
                    if ( this.valueType === 'number' ) {
                        const rawInput = String( this.editValue ).trim();
                        const num = Number( rawInput );
                        // Number('') gives 0. Check against that as well.
                        if ( rawInput === '' || Number.isNaN( num ) ) {
                            this.errorMessage = 'Please enter a valid number.';
                            return;
                        }
                        newValue = num;
                    } else if ( this.valueType === 'object' ) {
                        try {
                            newValue = JSON.parse( this.editValue as string );
                        } catch ( error ) {
                            this.errorMessage = `Invalid JSON: ${ error instanceof Error ? error.message : String( error ) }`;
                            return;
                        }
                    } else {
                        newValue = this.editValue as JsonValue;
                    }

                    setByPath( this.pageData, parsePath( this.field ), newValue );
                    const newText = JSON.stringify( this.pageData, null, 2 );

                    this.saving = true;
                    const api = new mw.Api();
                    api.postWithToken( 'csrf', {
                        action: 'edit',
                        title: this.page,
                        text: newText,
                        basetimestamp: this.basetimestamp,
                        summary: this.buildSummary(),
                        format: 'json',
                    } ).then( () => {
                        this.saving = false;
                        this.open = false;
                        mw.notify( 'JSON Editor: saved. The page may need to be reloaded to see the changes.', { type: 'success' } );
                        api.post( { action: 'purge', titles: mw.config.get( 'wgPageName' ) } );
                    }, ( code: string, response: { error?: { info?: string } } ) => {
                        this.saving = false;
                        if ( code === 'editconflict' ) {
                            this.errorMessage = 'This page was edited by someone else in the meantime. Please close and reopen the editor to get the latest version.';
                        } else {
                            this.errorMessage = response?.error?.info || 'Failed to save the page.';
                        }
                    } );
                },
                onCancel() {
                    this.open = false;
                },
            },
            template:`
            <cdx-dialog
                v-model:open="open"
                title="Editing JSON page"
                :primary-action="primaryAction"
                :default-action="defaultAction"
                @primary="onSave"
                @default="onCancel"
            >
                <template #header>
                    <div class="cdx-dialog__header__title-group">
                        <h2 class="cdx-dialog__header__title">Editing 
                            <a :href="pageUrl" target="_blank" rel="noopener">{{ page }}</a>
                        </h2>
                    </div>
                </template>
                <cdx-field>
                    <template #label>{{ fieldLabel }}</template>
                    <cdx-text-input v-if="valueType === 'string'" v-model="editValue" />
                    <cdx-text-input v-else-if="valueType === 'number'" v-model="editValue" input-type="number" />
                    <cdx-checkbox v-else-if="valueType === 'boolean'" v-model="editValue" />
                    <cdx-text-area v-else v-model="editValue" rows="8" />
                </cdx-field>
                <p v-if="errorMessage" class="client-json-editor-error">{{ errorMessage }}</p>
            </cdx-dialog>
            `,
        } )
            .component( 'cdx-dialog', Codex.CdxDialog )
            .component( 'cdx-field', Codex.CdxField )
            .component( 'cdx-text-input', Codex.CdxTextInput )
            .component( 'cdx-checkbox', Codex.CdxCheckbox )
            .component( 'cdx-text-area', Codex.CdxTextArea )
            .mount( mountPoint );
    } );
}
