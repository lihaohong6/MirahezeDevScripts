import {Bot, BotConfigurationDialog} from "./bot";
import {purge, savePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {PageInfo} from "../models/page";
import {InputType} from "../utils/input_dialog";
import {fetchPageText} from "../utils/page_info_fetcher";

interface PurgeOptions {
    pages: string[];
    nullEdit: boolean;
}

export const purgeBot: Bot<PurgeOptions> = new Bot({
    name: "PurgeBot", 
    description: "Purge pages or perform null edits",
    batchSize: (config: PurgeOptions) => config.nullEdit ? 1 : 50,
    preprocessPages: (pages, config) => config.nullEdit ? fetchPageText(pages) : pages,
    processBatch: async (pages: PageInfo[], options) => {
        if (options.nullEdit) {
            const page = pages[0];
            const pageSaveResult = await savePage(page.title, page.text!, "$bot: null edit", true, true);
            if (pageSaveResult) {
                return {
                    severity: LogSeverity.SUCCESS,
                    message: `${page.title} null edited`
                };
            } else {
                return {
                    severity: LogSeverity.ERROR,
                    message: `Failed to null edit ${page.title}`
                };
            }
        } else {
            const titles = pages.map((page) => page.title);
            const purgeResult = await purge(titles);
            
            if (purgeResult) {
                return {
                    severity: LogSeverity.SUCCESS,
                    message: `Purged ${titles.length} page(s)`
                };
            } else {
                return {
                    severity: LogSeverity.ERROR,
                    message: `Failed to purge batch: ${titles.join(', ')}`
                };
            }
        }
    },
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "nullEdit",
                label: "Use null edit instead of purge",
                type: InputType.BOOLEAN,
                help: 'A null edit saves the page without making changes, which also refreshes the cache. Regular purge uses the purge API and is significantly faster.'
            }
        ]
    }),
    rights: ['purge']
});