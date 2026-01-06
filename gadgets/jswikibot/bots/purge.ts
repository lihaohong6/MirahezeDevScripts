import {Bot, BotConfigurationDialog, openBotConfigDialog} from "./bot";
import {purge, savePage} from "../utils/mw_api";
import {LogSeverity, ProgressWindow} from "../utils/progress_window";
import {simpleAlert} from "../utils/alert_window";
import {PageInfo} from "../models/page";

interface PurgeOptions {
    pages: string[];
    nullEdit: boolean;
}

export class PurgeDialog extends BotConfigurationDialog<PurgeOptions> {
    private nullEdit!: OO.ui.CheckboxInputWidget;

    constructor(config?: never) {
        super(config);
    }

    protected setupStep2(): void {
        this.nullEdit = new OO.ui.CheckboxInputWidget();

        this.step2 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const step2Fieldset = new OO.ui.FieldsetLayout({
            label: 'Purge Settings',
            items: [
                new OO.ui.FieldLayout(this.nullEdit, {
                    label: 'Use null edit instead of purge',
                    align: 'inline',
                    help: 'A null edit saves the page without making changes, which also refreshes the cache. Regular purge uses the purge API and is significantly faster.'
                })
            ]
        });

        this.step2.$element.append(step2Fieldset.$element);
    }

    protected getSecondStepData(): Omit<PurgeOptions, "pages"> {
        return {
            nullEdit: this.nullEdit.isSelected()
        };
    }
}

export class PurgeBot extends Bot {

    private async performPurge(options: PurgeOptions) {
        try {

            if (options.nullEdit) {
                await this.forEachPage(options.pages, async (page: PageInfo) => {
                    const pageSaveResult = await savePage(page.title, page.text!, "$bot: null edit", true, true);
                    if (pageSaveResult) {
                        this.progressWindow!.addLog(LogSeverity.INFO, `${page.title} null edited`);
                    } else {
                        this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to null edit ${page.title}`);
                    }
                }, true);
            } else {
                // Regular purge: use purge API function
                // Process in batches of 50 (max allowed by purge function)
                const batchSize = 50;
                let processed = 0;
                this.progressWindow = new ProgressWindow(options.pages.length, this.cancelCallback.bind(this));

                for (let i = 0; i < options.pages.length; i += batchSize) {
                    if (this.checkCancelled()) {
                        break;
                    }

                    const batch = options.pages.slice(i, i + batchSize);
                    const purgeResult = await purge(batch);
                    
                    if (purgeResult) {
                        this.progressWindow!.addLog(LogSeverity.INFO, `Purged ${batch.length} pages`);
                    } else {
                        this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to purge batch: ${batch.join(', ')}`);
                    }
                    
                    processed += batch.length;
                    this.progressWindow!.makeProgress(processed);
                }
            }
            this.progressWindow!.done()
        } catch (error) {
            console.error('Error during purge:', error);
            simpleAlert("Error", 'An error occurred while purging the pages. Please check the console for details.');
        }
    }

    execute(): Promise<void> {
        return openBotConfigDialog(new PurgeDialog(), this.performPurge.bind(this));
    }

    getDescription(): string {
        return "Purge pages or perform null edits";
    }
}