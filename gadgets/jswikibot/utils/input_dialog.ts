import {getNamespaces} from "../models/namespace";
import {Result} from "./result";

export enum InputType {
    PAGE,
    NAMESPACE,
    NAMESPACES,
    TEXT,
    MULTILINE_TEXT,
    SELECT,
    NUMBER,
    BOOLEAN,
}

export type ValidationResult<T = string | number | boolean> = Result<T>;

export type ValidationFunction<T = string | number | boolean> = (value: T) => ValidationResult<T>;

export interface UserInputOption {
    key: string;
    label: string;
    type: InputType;
    options?: { data: string, label: string }[]; // For SELECT types
    defaultValue?: string | boolean | number;
    placeholder?: string;
    depends?: string;
    validator?: ValidationFunction;
    help?: string | OO.ui.HtmlSnippet;
    rows?: number;
}

export class InputDialog {

    public static setUpWidgets(inputFields: UserInputOption[], fieldsetOptions?: OO.ui.FieldsetLayout.ConfigOptions) {
        const widgets: Record<string, OO.ui.Widget> = {};
        const fieldset = new OO.ui.FieldsetLayout(fieldsetOptions);
        for (const inputField of inputFields) {
            let widget: OO.ui.Widget;
            let align: "left" | "top" | "right" | "inline" = "top";

            switch (inputField.type) {
                case InputType.BOOLEAN:
                    widget = new OO.ui.CheckboxInputWidget({selected: (inputField.defaultValue || false) as boolean});
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
                case InputType.MULTILINE_TEXT:
                    widget = new OO.ui.MultilineTextInputWidget({
                        value: inputField.defaultValue as string || '',
                    });
                    break;
                case InputType.SELECT: {
                    const options = inputField.options!;
                    if (options.length == 2) {
                        widget = new OO.ui.ButtonSelectWidget({
                            items: options.map((option) => new OO.ui.ButtonOptionWidget(option))
                        });
                        if (inputField.defaultValue) {
                            (widget as OO.ui.ButtonSelectWidget).selectItemByData(inputField.defaultValue as string);
                        }
                    } else if (options.length > 2) {
                        widget = new OO.ui.ComboBoxInputWidget({
                            menu: {
                                items: options.map((option) => new OO.ui.MenuOptionWidget(option)),
                                filterFromInput: true,
                                filterMode: 'substring',
                            },
                            autocomplete: true,
                        });
                    } else {
                        throw new Error();
                    }
                    break;
                }
                default:
                    widget = new OO.ui.TextInputWidget({
                        value: inputField.defaultValue as string || ''
                    });
            }

            widgets[inputField.key] = widget;
            const layout = new OO.ui.FieldLayout(widget, {
                label: inputField.label,
                align: align,
                help: inputField.help,
            });
            fieldset.addItems([layout]);

            if (inputField.depends) {
                const prev = widgets[inputField.depends];
                const toggleLayout = (selected: string | boolean) => {
                    if (selected) {
                        layout.toggle(true);
                    } else {
                        layout.toggle(false);
                    }
                }
                prev.on('change', toggleLayout);
                toggleLayout((prev as OO.ui.InputWidget).getValue());
            }
        }
        return {
            widgets: widgets,
            fieldset: fieldset
        };
    }

    public static getInputData<T>(inputFields: UserInputOption[], widgets: Record<string, OO.ui.Widget>): Result<T> {
        const args: Record<string, string | number | boolean> = {};
        const validationErrors: Record<string, string> = {};
        for (const inputField of inputFields) {
            const widget = widgets[inputField.key];
            let rawValue: string | number | boolean;

            if (widget instanceof OO.ui.CheckboxInputWidget) {
                rawValue = widget.isSelected();
            } else if (widget instanceof OO.ui.MenuTagMultiselectWidget) {
                rawValue = (widget.getValue() as unknown as string[]).join("|")
            } else if (widget instanceof OO.ui.ButtonSelectWidget) {
                rawValue = widget.getData() as string;
            } else {
                rawValue = (widget as OO.ui.InputWidget).getValue();
            }

            if (inputField.validator) {
                const validationResult = inputField.validator(rawValue);
                if (validationResult.ok) {
                    rawValue = validationResult.value;
                } else {
                    validationErrors[inputField.key] = validationResult.error;
                }
            }

            args[inputField.key] = rawValue;
        }

        if (Object.keys(validationErrors).length > 0) {
            return {
                ok: false,
                error: Object.values(validationErrors).join("\n")
            }
        }
        return {
            ok: true,
            value: args as T
        }
    }
}
