import {ListerWrapper, QueryArguments} from "./page_lister";
import {FilterArguments, FilterWrapper} from "./page_filter";
import {isDebugMode} from "../models/state";
import {simpleAlert} from "../utils/alert_window";
import {InputDialog} from "../utils/input_dialog";
import {PageSelector} from "./page_selector";

type CallbackFunction = (l: PageSelector) => void;

export class ListerInputDialog extends OO.ui.ProcessDialog {
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
    private wrapper?: ListerWrapper | FilterWrapper;
    private callback: CallbackFunction;

    constructor(options: OO.ui.ProcessDialog.ConfigOptions, callback: CallbackFunction) {
        super(options);
        this.callback = callback;
    }

    public initialize(): this {
        super.initialize();
        return this;
    }

    public getSetupProcess(data: { wrapper: ListerWrapper | FilterWrapper }): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.wrapper = data.wrapper;

            const result = InputDialog.setUpWidgets(data.wrapper.getInputs());
            this.widgets = result.widgets;
            this.fieldset = result.fieldset;

            const panel = new OO.ui.PanelLayout({padded: true, expanded: true});
            panel.$element.append(this.fieldset.$element);
            this.$body.append(panel.$element);
        });
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save' && this.wrapper) {
            const result = InputDialog.getInputData<QueryArguments | FilterArguments>(this.wrapper.getInputs(), this.widgets);
            if (!result.ok) {
                return new OO.ui.Process(() => {
                    simpleAlert("Invalid input", result.error);
                });
            }

            const args = result.value;
            if (isDebugMode()) {
                console.log(args);
            }

            const wrapper = this.wrapper;

            if ((wrapper as FilterWrapper).validator) {
                const result = (wrapper as FilterWrapper).validator!(args as FilterArguments);
                if (!result) {
                    return new OO.ui.Process(() => {});
                }
            }

            return new OO.ui.Process(() => {
                this.callback(wrapper.construct(args as FilterArguments & QueryArguments));
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight() {
        return 500;
    }
}