import {InputDialog, UserInputOption} from "../utils/input_dialog";
import {QueryArguments} from "./page_lister";
import {FilterArguments} from "./page_filter";
import {simpleAlert} from "../utils/alert_window";
import {isDebugMode} from "../models/state";

export abstract class PageSelector {
    static readonly inputs: UserInputOption[] = [];

    abstract getDescription(): string;
}

export interface SelectorConfig<T = unknown> {
    description: string;
    inputs: UserInputOption[];
    validator?(args: T): boolean;
    new (args: T): PageSelector;
}

type CallbackFunction = (l: PageSelector) => void;

export class PageSelectorDialog extends OO.ui.ProcessDialog {
    static static = {
        ...super.static,
        name: 'listerInputDialog',
        title: 'Page selection arguments',
        actions: [
            {action: 'save', label: 'Done', flags: ['primary', 'progressive']},
            {label: 'Cancel', flags: ['safe']}
        ]
    };

    private fieldset!: OO.ui.FieldsetLayout;
    private widgets: Record<string, OO.ui.Widget> = {};
    private selectorClass?: SelectorConfig;
    private callback: CallbackFunction;

    constructor(options: OO.ui.ProcessDialog.ConfigOptions, callback: CallbackFunction) {
        super(options);
        this.callback = callback;
    }

    public initialize(): this {
        super.initialize();
        return this;
    }

    public getSetupProcess(data: { selectorClass: SelectorConfig }): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.selectorClass = data.selectorClass;

            const result = InputDialog.setUpWidgets(data.selectorClass.inputs);
            this.widgets = result.widgets;
            this.fieldset = result.fieldset;

            const panel = new OO.ui.PanelLayout({padded: true, expanded: true});
            panel.$element.append(this.fieldset.$element);
            this.$body.append(panel.$element);
        });
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save' && this.selectorClass) {
            const SelectorClass = this.selectorClass;

            const result = InputDialog.getInputData<QueryArguments | FilterArguments>(SelectorClass.inputs, this.widgets);
            if (!result.ok) {
                return new OO.ui.Process(() => {
                    simpleAlert("Invalid input", result.error);
                });
            }

            const args = result.value;
            if (isDebugMode()) {
                console.log(args);
            }

            if (SelectorClass.validator) {
                const isValid = SelectorClass.validator(args as QueryArguments | FilterArguments);
                if (!isValid) {
                    return new OO.ui.Process(() => {
                    });
                }
            }

            return new OO.ui.Process(() => {
                this.callback(new SelectorClass(args as QueryArguments & FilterArguments));
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight() {
        return 500;
    }
}