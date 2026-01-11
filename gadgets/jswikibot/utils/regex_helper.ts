import {InputDepends, InputType} from "./input_dialog";
import {InputConfig} from "../bots/bot";
import {simpleAlert} from "./alert_window";

export interface RegexConfigOptions {
    useRegex: boolean;
    regexFlags: string;
}

export class RegexHelper {
    static createRegexInputGroup<T>(
        enableKey: Extract<keyof T, string>,
        flagsKey: Extract<keyof T, string>,
        defaults: {
            enableLabel?: string,
            flagsLabel?: string,
            defaultFlags?: string,
            extraDepends?: InputDepends[]
        } = {}
    ): InputConfig<T> {
        const depends: InputDepends[] = [{key: enableKey}];
        depends.push(...defaults.extraDepends || []);
        return [
            {
                key: enableKey,
                label: defaults.enableLabel || "Use regular expressions",
                type: InputType.BOOLEAN,
                depends: defaults.extraDepends || []
            },
            {
                key: flagsKey,
                label: defaults.flagsLabel || "Regex flags",
                type: InputType.TEXT,
                defaultValue: defaults.defaultFlags || "gm",
                depends: depends,
                help: new OO.ui.HtmlSnippet(
                    'Regular expression flags (e.g. <i>i</i> for case-insensitive). ' +
                    '<a href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_Expressions#advanced_searching_with_flags" target="_blank">More info</a>.'
                )
            }
        ];
    }

    static regexValidator(config: RegexConfigOptions, text: string) {
        if (config.useRegex) {
            try {
                new RegExp(text, config.regexFlags);
            } catch (e) {
                simpleAlert("Invalid regex", e.message);
                return false;
            }
        }
        return true;
    }
}