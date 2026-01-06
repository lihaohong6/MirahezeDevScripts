import {Bot, BotConfigurationDialog} from "./bot";
import {deletePage, undeletePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {PageInfo} from "../models/page";
import {InputType} from "../utils/input_dialog";

interface DeleteOptions {
    pages: string[];
    delete: boolean;
    reason: string;
    deleteTalk: boolean;
}

export const deleteBot: Bot<DeleteOptions> = new Bot({
    name: "DeleteBot",
    description: "Delete/undelete pages in bulk",
    batchSize: 1,
    processBatch: async (pages: PageInfo[], options) => {
        const page = pages[0];
        let result;
        
        if (options.delete) {
            result = await deletePage(page.title, options.reason, options.deleteTalk);
            if (result.ok) {
                return {
                    severity: LogSeverity.SUCCESS,
                    message: `${page.title} deleted`
                };
            } else {
                return {
                    severity: LogSeverity.ERROR,
                    message: `Failed to delete ${page.title} due to ${result.error}`
                };
            }
        } else {
            result = await undeletePage(page.title, options.reason, options.deleteTalk);
            if (result.ok) {
                return {
                    severity: LogSeverity.SUCCESS,
                    message: `${page.title} restored`
                };
            } else {
                return {
                    severity: LogSeverity.ERROR,
                    message: `Failed to undelete ${page.title} due to ${result.error}`
                };
            }
        }
    },
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "delete",
                label: "Delete page (uncheck to undelete)",
                type: InputType.BOOLEAN,
                defaultValue: true
            },
            {
                key: "reason",
                label: "Deletion/undeletion Reason",
                type: InputType.TEXT,
                defaultValue: '$bot: delete pages in bulk',
                placeholder: 'Reason for deletion'
            },
            {
                key: "deleteTalk",
                label: "Delete/undelete talk page",
                type: InputType.BOOLEAN
            }
        ]
    })
});