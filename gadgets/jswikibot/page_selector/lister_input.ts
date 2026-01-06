import {InputType, ListerWrapper, QueryArguments, ValidationResult} from "./lister";
import {FilterWrapper} from "./filter";
import {isDebugMode} from "../models/state";
import {simpleAlert} from "../utils/alert_window";
import {getNamespaces} from "../models/namespace";

type CallbackFunction = (l: ListerWrapper | FilterWrapper) => void;

export class ListerInputDialog extends OO.ui.ProcessDialog {
    static static = {
        ...super.static,
        name: 'listerInputDialog',
        title: 'Query Parameters',
        actions: [
            {action: 'save', label: 'Submit', flags: ['primary', 'progressive']},
            {label: 'Cancel', flags: ['safe']}
        ]
    };

    private fieldset!: OO.ui.FieldsetLayout;
    private widgets: Record<string, OO.ui.InputWidget> = {};
    private wrapper?: ListerWrapper | FilterWrapper;
    private callback: CallbackFunction;

    constructor(options: OO.ui.ProcessDialog.ConfigOptions, callback: CallbackFunction) {
        super(options);
        this.callback = callback;
    }

    public initialize(): this {
        super.initialize();
        this.fieldset = new OO.ui.FieldsetLayout();
        const panel = new OO.ui.PanelLayout({padded: true, expanded: true});
        panel.$element.append(this.fieldset.$element);
        // @ts-expect-error $body does exist
        this.$body.append(panel.$element);
        return this;
    }

    public getSetupProcess(data: { wrapper: ListerWrapper | FilterWrapper }): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.wrapper = data.wrapper;

            this.fieldset.clearItems();
            this.widgets = {};

            // Build dynamic fields based on the lister
            for (const inputField of this.wrapper.getInputs()) {
                let widget: OO.ui.InputWidget;
                let align: "left" | "top" | "right" | "inline" = "top";

                switch (inputField.type) {
                    case InputType.BOOLEAN:
                        widget = new OO.ui.CheckboxInputWidget({
                        });
                        align = "inline";
                        break;
                    case InputType.PAGE:
                        // @ts-expect-error mw.widgets.TitleInputWidget does exist
                        widget = new mw.widgets.TitleInputWidget({
                            value: inputField.defaultValue || "",
                            suggestions: true,
                            required: true
                        });
                        break;
                    case InputType.NAMESPACE:
                        widget = new OO.ui.ComboBoxInputWidget({
                            value: inputField.defaultValue as string || '',
                            options: getNamespaces().namespaces.map(ns => ({
                                data: ns.name,
                                label: ns.name
                            })),
                            menu: {
                                filterFromInput: true
                            }
                        });
                        break;
                    case InputType.NAMESPACES:
                        // @ts-expect-error MenuTagMultiselectWidget works here
                        widget = new OO.ui.MenuTagMultiselectWidget({
                            // Handle potential default value as an array or single string
                            selected: [],
                            options: getNamespaces().namespaces.map(ns => ({
                                data: ns.name,
                                label: ns.name
                            })),
                            allowArbitrary: true,
                            inputPosition: 'inline',
                            placeholder: 'Select namespaces...',
                            menu: {
                                filterFromInput: true
                            }
                        });
                        break;
                    default:
                        widget = new OO.ui.TextInputWidget({
                            value: inputField.defaultValue as string || ''
                        });
                }

                this.widgets[inputField.key] = widget;
                const layout = new OO.ui.FieldLayout(widget, {
                    label: inputField.label,
                    align: align,
                    help: inputField.help,
                });
                this.fieldset.addItems([layout]);

                if (inputField.depends) {
                    const prev = this.widgets[inputField.depends];
                    const toggleLayout = (selected: string | boolean) => {
                        if (selected) {
                            layout.toggle(true);
                        } else {
                            layout.toggle(false);
                        }
                    }
                    prev.on('change', toggleLayout);
                    toggleLayout(prev.getValue());
                }
            }
        });
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save' && this.wrapper) {
            const args: QueryArguments = {};
            const validationErrors: Record<string, string> = {};

            for (const inputField of this.wrapper.getInputs()) {
                const widget = this.widgets[inputField.key];
                let rawValue: string | number | boolean;

                if (widget instanceof OO.ui.CheckboxInputWidget) {
                    rawValue = widget.isSelected();
                } else if (widget instanceof OO.ui.MenuTagMultiselectWidget) {
                    rawValue = (widget.getValue() as unknown as string[]).join("|")
                } else {
                    rawValue = widget.getValue();
                }

                // Apply validation if specified
                if (inputField.validator) {
                    const result: ValidationResult = inputField.validator(rawValue);
                    if (!result.ok) {
                        validationErrors[inputField.key] = result.error;
                        continue;
                    }
                    args[inputField.key] = result.value || rawValue;
                } else {
                    args[inputField.key] = rawValue;
                }
            }

            if (Object.keys(validationErrors).length > 0) {
                return new OO.ui.Process(() => {
                    const errorMessages = Object.values(validationErrors)
                        .join('\n');
                    simpleAlert('Validation error', errorMessages);
                });
            }

            if (isDebugMode()) {
                console.log(args);
            }

            const wrapper = this.wrapper;

            return new OO.ui.Process(() => {
                wrapper.construct(args);
                this.callback(this.wrapper!);
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight() {
        return 500;
    }
}