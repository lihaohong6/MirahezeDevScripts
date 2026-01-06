import {Bot, BotConfigurationDialog, openBotConfigDialog} from "./bot";
import {deletePage, undeletePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {simpleAlert} from "../utils/alert_window";
import {PageInfo} from "../models/page";

interface DeleteOptions {
    pages: string[];
    delete: boolean;
    reason: string;
    deleteTalk: boolean;
}

export class DeleteDialog extends BotConfigurationDialog<DeleteOptions> {
    private deleteInput!: OO.ui.CheckboxInputWidget;
    private reasonInput!: OO.ui.TextInputWidget;
    private deleteTalkInput!: OO.ui.CheckboxInputWidget;

    constructor(config?: never) {
        super(config);
    }

    protected setupStep2(): void {
        this.reasonInput = new OO.ui.TextInputWidget({
            placeholder: 'Reason for deletion',
            value: '$bot: delete pages in bulk'
        });

        this.deleteTalkInput = new OO.ui.CheckboxInputWidget({
            selected: false,
        });

        this.deleteInput = new OO.ui.CheckboxInputWidget({
            selected: true,
        });

        this.step2 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const step2Fieldset = new OO.ui.FieldsetLayout({
            label: 'Deletion Settings',
            items: [
                new OO.ui.FieldLayout(this.deleteInput, {
                    label: 'Delete page (uncheck to undelete)',
                    align: 'inline',
                }),
                new OO.ui.FieldLayout(this.reasonInput, {
                    label: 'Deletion/undeletion Reason',
                    align: 'top',
                }),
                new OO.ui.FieldLayout(this.deleteTalkInput, {
                    label: 'Delete/undelete talk page',
                    align: 'inline',
                })
            ]
        });

        this.step2.$element.append(step2Fieldset.$element);
    }

    protected getSecondStepData(): Omit<DeleteOptions, "pages"> {
        return {
            delete: this.deleteInput.isSelected(),
            reason: this.reasonInput.getValue(),
            deleteTalk: this.deleteTalkInput.isSelected(),
        };
    }
}

export class DeleteBot extends Bot {

    private async performDeletion(options: DeleteOptions) {
        try {
            if (options.delete) {
                await this.forEachPage(options.pages, async (page: PageInfo) => {
                    const result = await deletePage(page.title, options.reason, options.deleteTalk);
                    if (result.ok) {
                        this.progressWindow!.addLog(LogSeverity.INFO, `${page.title} deleted`);
                    } else {
                        this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to delete ${page.title} due to ${result.error}`);
                    }
                }, false);
            } else {

                await this.forEachPage(options.pages, async (page: PageInfo) => {
                    const result = await undeletePage(page.title, options.reason, options.deleteTalk);
                    if (result.ok) {
                        this.progressWindow!.addLog(LogSeverity.INFO, `${page.title} restored`);
                    } else {
                        this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to undelete ${page.title} due to ${result.error}`);
                    }
                }, false);
            }

        } catch (error) {
            console.error('Error during deletion:', error);
            simpleAlert("Error", 'An error occurred while deleting the pages.');
        }
    }

    execute(): Promise<void> {
        return openBotConfigDialog(new DeleteDialog(), this.performDeletion.bind(this));
    }

    getDescription(): string {
        return "Delete/undelete pages in bulk";
    }
}