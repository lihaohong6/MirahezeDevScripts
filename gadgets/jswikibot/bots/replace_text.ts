import {Bot, BotConfigurationDialog} from "./bot";
import {formatSummary, savePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {showDiffDialog} from "../utils/diff";
import {fetchPageText} from "../utils/page_info_fetcher";
import {simpleAlert} from "../utils/alert_window";
import {InputType} from "../utils/input_dialog";
import {RegexConfigOptions, RegexHelper} from "../utils/regex_helper";

interface ReplacementConfig extends RegexConfigOptions {
    pages: string[];
    originalText: string;
    replacementText: string;
    summary: string;
}

interface ReplaceTextState {
    acceptAll?: boolean
}

export const replaceTextBot = new Bot<ReplacementConfig, ReplaceTextState>({
    name: "ReplaceTextBot",
    description: "Find and replace text",
    preprocessPages: (pages) => fetchPageText(pages),
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "originalText",
                label: "Find",
                type: InputType.MULTILINE_TEXT,
                placeholder: 'Text to find',
                rows: 5,
                help: 'When using regular expressions, input the regex itself instead of /regex/. Use \\n for newlines.'
            },
            {
                key: "replacementText",
                label: "Replace with",
                type: InputType.MULTILINE_TEXT,
                placeholder: 'Replace with',
                rows: 5,
                help: "Use the keyboard's enter key for newlines instead of \\n."
            },
            ...RegexHelper.createRegexInputGroup("useRegex", "regexFlags"),
            {
                key: "summary",
                label: "Edit summary",
                type: InputType.TEXT,
                defaultValue: '$bot: replace $original with $new'
            }
        ],
        validator: (config: ReplacementConfig) => {
            if (config.originalText === "") {
                simpleAlert("Invalid input", "Text to be replaced must be non-empty");
                return false;
            }
            return RegexHelper.regexValidator(config, config.originalText);
        }
    }),
    processBatch: async (pages, config, state, bot) => {
        const page = pages[0];
        let text;
        if (config.useRegex) {
            text = page.text!.replace(new RegExp(config.originalText, config.regexFlags), config.replacementText);
        } else {
            text = page.text!.split(config.originalText).join(config.replacementText);
        }

        if (page.text !== text) {
            if (!state.acceptAll) {
                const result = await showDiffDialog(page.title, page.text!, text);

                switch (result.action) {
                    case 'accept':
                        break;
                    case 'acceptAll':
                        state.acceptAll = true;
                        break;
                    case 'skip':
                        return {
                            severity: LogSeverity.INFO,
                            message: `Skipped ${page.title}`
                        }
                    case 'cancel':
                        bot.cancel();
                        return {
                            severity: LogSeverity.WARNING,
                            message: 'Text replacement cancelled by user'
                        };
                }
            }
            const summary = formatSummary(config.summary, {original: config.originalText, new: config.replacementText});
            const pageSaveResult = await savePage(page.title, text, summary, true);
            if (pageSaveResult) {
                return {
                    severity: LogSeverity.SUCCESS,
                    message: `${page.title} saved`
                };
            } else {
                return {
                    severity: LogSeverity.ERROR,
                    message: `Failed to save ${page.title}`
                };
            }
        } else {
            return {
                severity: LogSeverity.INFO,
                message: `Page ${page.title} not changed`
            };
        }
    },
    rights: ['edit']
})