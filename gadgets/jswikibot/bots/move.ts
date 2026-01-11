import {Bot, BotConfigurationDialog} from "./bot";
import {formatSummary, movePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {InputType} from "../utils/input_dialog";
import {RegexConfigOptions, RegexHelper} from "../utils/regex_helper";
import {simpleAlert} from "../utils/alert_window";

interface MoveConfig extends RegexConfigOptions {
    pages: string[];
    manualInput: boolean;
    originalText: string;
    replacementText: string;
    targetTitles: string;
    summary: string;
    moveTalk: boolean;
    moveSubpages: boolean;
    noRedirect: boolean;
    pageMapping?: Record<string, string>;
}

export const moveBot = new Bot<MoveConfig>({
    name: "MoveBot",
    description: "Move pages in bulk",
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "manualInput",
                label: "Manually input page list instead of specifying replacement strings",
                type: InputType.BOOLEAN
            },
            {
                key: "originalText",
                label: "Find in title",
                type: InputType.TEXT,
                placeholder: 'Text to find in page title',
                depends: {key: "manualInput", invert: true},
                help: 'When using regular expressions, input the regex itself instead of /regex/.'
            },
            {
                key: "replacementText",
                label: "Replace with",
                type: InputType.TEXT,
                placeholder: 'Replacement text',
                depends: {key: "manualInput", invert: true},
            },
            ...RegexHelper.createRegexInputGroup("useRegex", "regexFlags", {extraDepends: [{key: 'manualInput', invert: true}]}),
            {
                key: "targetTitles",
                label: "Target titles",
                type: InputType.MULTILINE_TEXT,
                placeholder: 'Enter target page titles, one per line (same order as source pages)',
                rows: 10,
                depends: {key: "manualInput"},
                help: 'Enter one target title per line, in the same order as the source pages selected in step 1.'
            },
            {
                key: "moveTalk",
                label: "Move talk page",
                type: InputType.BOOLEAN,
                defaultValue: false,
            },
            {
                key: "moveSubpages",
                label: "Move subpages",
                type: InputType.BOOLEAN,
                defaultValue: true,
            },
            {
                key: "noRedirect",
                label: "Do not create a redirect (requires suppressredirect user right)",
                type: InputType.BOOLEAN,
                help: "The required user right is usually only available to wiki admins. You can check it manually with Special:ListGroupRights."
            },
            {
                key: "summary",
                label: "Summary",
                type: InputType.TEXT,
                defaultValue: '$bot: bulk move page from $from to $to'
            }
        ],
        validator: (config: MoveConfig) => {
            if (config.manualInput) {
                const targetLines = config.targetTitles.split('\n').filter(t => t.trim());
                if (targetLines.length !== config.pages.length) {
                    simpleAlert("Invalid input", `Number of target titles (${targetLines.length}) must match number of source pages (${config.pages.length})`);
                    return false;
                }
                config.pageMapping = {};
                for (let i = 0; i < config.pages.length; i++) {
                    config.pageMapping[config.pages[i]] = targetLines[i];
                }
                return true;
            } else {
                if (config.originalText === "") {
                    simpleAlert("Invalid input", "Text to find in page title must be non-empty");
                    return false;
                }
                return RegexHelper.regexValidator(config, config.originalText);
            }
        }
    }),
    processBatch: async (pages, config) => {
        const page = pages[0];
        let targetTitle: string;

        if (config.manualInput) {
            targetTitle = config.pageMapping![page.title];
        } else {
            if (config.useRegex) {
                targetTitle = page.title.replace(new RegExp(config.originalText, config.regexFlags), config.replacementText);
            } else {
                targetTitle = page.title.split(config.originalText).join(config.replacementText);
            }
        }

        if (page.title === targetTitle) {
            return {
                severity: LogSeverity.WARNING,
                message: `Skipped ${page.title} (target title is the same)`
            };
        }

        const summary = formatSummary(config.summary, {from: page.title, to: targetTitle});
        const moveOptions = {
            reason: summary,
            moveTalk: config.moveTalk,
            moveSubpages: config.moveSubpages,
            noRedirect: config.noRedirect,
            bot: true
        };
        const moveResult = await movePage(page.title, targetTitle, moveOptions);

        if (moveResult.ok) {
            return {
                severity: LogSeverity.SUCCESS,
                message: `${page.title} moved to ${targetTitle}`
            };
        } else {
            return {
                severity: LogSeverity.ERROR,
                message: `Failed to move ${page.title} to ${targetTitle}: ${moveResult.error}`
            };
        }
    }
})