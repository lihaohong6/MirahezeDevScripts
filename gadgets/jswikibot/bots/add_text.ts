import {Bot, BotConfigurationDialog} from "./bot";
import {formatSummary, savePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {PageInfo} from "../models/page";
import {fetchPageText} from "../utils/page_info_fetcher";
import {InputType} from "../utils/input_dialog";
import {simpleAlert} from "../utils/alert_window";

interface AddTextOptions {
    pages: string[];
    textToAdd: string;
    position: 'top' | 'bottom';
    skipExisting: boolean;
    summary: string;
}

export const addTextBot: Bot<AddTextOptions> = new Bot({
    name: "AddTextBot",
    description: "Add text to the top or bottom of pages",
    preprocessPages: (pages) => fetchPageText(pages),
    processBatch: async (pages: PageInfo[], options) => {
        const page = pages[0];
        let newText = page.text || "";

        if (options.skipExisting && page.text!.includes(newText)) {
            return {
                severity: LogSeverity.WARNING,
                message: `Skipped ${page.title} because it already contains the text to be added.`
            };
        }

        if (options.position === 'top') {
            newText = options.textToAdd + newText.trimStart();
        } else {
            newText = newText.trimEnd() + options.textToAdd;
        }

        const summary = formatSummary(options.summary, {'text': options.textToAdd});
        const pageSaveResult = await savePage(page.title, newText, summary, true);

        if (pageSaveResult) {
            return {
                severity: LogSeverity.SUCCESS,
                message: `${page.title} saved`
            };
        }
        return {
            severity: LogSeverity.ERROR,
            message: `Failed to save ${page.title}`
        };
    },
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "textToAdd",
                label: "Text to add",
                type: InputType.MULTILINE_TEXT,
                placeholder: 'Enter the text to add to the pages...',
                rows: 5
            },
            {
                key: "position",
                label: 'Position',
                type: InputType.SELECT,
                options: [{data: 'top', label: 'Top'}, {data: 'bottom', label: 'Bottom'}],
                defaultValue: 'bottom',
            },
            {
                key: "skipExisting",
                label: 'Skip page if the text already exists',
                type: InputType.BOOLEAN
            },
            {
                key: "summary",
                label: 'Edit summary',
                type: InputType.TEXT,
                defaultValue: '$bot: batch add $text',
            }
        ],
        validator: (data: AddTextOptions) => {
            if (data.textToAdd.trim() === "") {
                simpleAlert("Invalid input", "Text to add is empty. Use the dedicated bot if you want to perform null edits.");
                return false;
            }
            return true;
        }
    })
});
