import {Config, state} from "./models/state";

const LOCAL_STORAGE_KEY = 'jswikibot-config';

export function saveConfig() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.config));
}

export function loadConfig() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Merge into a new instance to maintain defaults for any new/missing keys
            state.config = Object.assign(new Config(), parsed);
        } catch (e) {
            console.error("JSWikiBot: Failed to load configuration", e);
        }
    }
}

export class SettingsDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'settings',
        title: 'JSWikiBot - Settings',
        actions: [
            { action: 'save', label: 'Save', flags: ['primary', 'progressive'] },
            { label: 'Cancel', flags: ['safe'] }
        ]
    };

    private debugInput!: OO.ui.CheckboxInputWidget;
    private summaryInput!: OO.ui.TextInputWidget;
    private readThrottleInput!: OO.ui.NumberInputWidget;
    private writeThrottleInput!: OO.ui.NumberInputWidget;

    public initialize(): this {
        super.initialize();

        // Initialize widgets with current state.config values
        this.debugInput = new OO.ui.CheckboxInputWidget({ selected: state.config.debug });
        this.summaryInput = new OO.ui.TextInputWidget({ value: state.config.summaryBot });
        this.readThrottleInput = new OO.ui.NumberInputWidget({
            value: state.config.readThrottle.toString(),
            min: 0.1,
            max: 10
        });
        this.writeThrottleInput = new OO.ui.NumberInputWidget({
            value: state.config.writeThrottle.toString(),
            min: 0.5,
            max: 20
        });

        const fieldset = new OO.ui.FieldsetLayout({ label: 'Global Bot Configuration' });
        fieldset.addItems([
            new OO.ui.FieldLayout(this.debugInput, { label: 'Debug mode', align: 'inline' }),
            new OO.ui.FieldLayout(this.summaryInput, { label: 'Bot summary ("$bot" will be replaced by this)', align: 'top' }),
            // @ts-expect-error This works as a widget
            new OO.ui.FieldLayout(this.readThrottleInput, { label: 'Read throttle (0.1s to 10s)', align: 'top' }),
            // @ts-expect-error This works as a widget
            new OO.ui.FieldLayout(this.writeThrottleInput, { label: 'Write throttle (0.5s to 20s)', align: 'top' }),
        ]);

        const mainPanel = new OO.ui.PanelLayout({ padded: true, expanded: false });
        mainPanel.$element.append(fieldset.$element);
        this.$body.append(mainPanel.$element);
        return this;
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save') {
            return new OO.ui.Process(() => {
                // Update the state object
                state.config.debug = this.debugInput.isSelected();
                state.config.summaryBot = this.summaryInput.getValue();
                state.config.readThrottle = Number(this.readThrottleInput.getValue());
                state.config.writeThrottle = Number(this.writeThrottleInput.getValue());

                // Persist to local storage
                saveConfig();
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight(): number {
        return 350;
    }
}