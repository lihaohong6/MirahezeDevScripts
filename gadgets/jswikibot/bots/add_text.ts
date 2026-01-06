import {Bot, BotConfigurationDialog, openBotConfigDialog} from "./bot";
import {formatSummary, savePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {simpleAlert} from "../utils/alert_window";
import {PageInfo} from "../models/page";

interface AddTextOptions {
    pages: string[];
    textToAdd: string;
    position: 'top' | 'bottom';
    summary: string;
}

export class AddTextDialog extends BotConfigurationDialog<AddTextOptions> {
    private textInput!: OO.ui.MultilineTextInputWidget;
    private positionInput!: OO.ui.ButtonSelectWidget;
    private summaryInput!: OO.ui.TextInputWidget;

    protected setupStep2(): void {
        this.textInput = new OO.ui.MultilineTextInputWidget({
            placeholder: 'Enter the text to add to the pages...',
            rows: 5
        });

        this.positionInput = new OO.ui.ButtonSelectWidget({
            items: [
                new OO.ui.ButtonOptionWidget({ data: 'top', label: 'Top' }),
                new OO.ui.ButtonOptionWidget({ data: 'bottom', label: 'Bottom' })
            ]
        });
        this.positionInput.selectItemByData('bottom');

        this.summaryInput = new OO.ui.TextInputWidget({
            value: '$bot: bulk add $text'
        });

        this.step2 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const step2Fieldset = new OO.ui.FieldsetLayout({
            label: 'Add Text Settings',
            items: [
                new OO.ui.FieldLayout(this.textInput, {
                    label: 'Text to add',
                    align: 'top'
                }),
                new OO.ui.FieldLayout(this.positionInput, {
                    label: 'Position',
                    align: 'top'
                }),
                new OO.ui.FieldLayout(this.summaryInput, {
                    label: 'Edit summary',
                    align: 'top'
                })
            ]
        });

        this.step2.$element.append(step2Fieldset.$element);
    }

    protected getSecondStepData(): Omit<AddTextOptions, "pages"> {
        return {
            textToAdd: this.textInput.getValue(),
            position: this.positionInput.getData() as 'top' | 'bottom',
            summary: this.summaryInput.getValue()
        };
    }
}

export class AddTextBot extends Bot {
    getDescription(): string {
        return "Add text to the top or bottom of pages";
    }

    private async performAddText(options: AddTextOptions) {
        try {
            await this.forEachPage(options.pages, async (page: PageInfo) => {
                let newText = page.text || "";

                if (options.position === 'top') {
                    newText = options.textToAdd + newText.trimStart();
                } else {
                    newText = newText.trimEnd() + options.textToAdd;
                }

                const summary = formatSummary(options.summary, {'text': options.textToAdd});
                const pageSaveResult = await savePage(page.title, newText, summary, true);

                if (pageSaveResult) {
                    this.progressWindow!.addLog(LogSeverity.INFO, `${page.title} saved`);
                } else {
                    this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to save ${page.title}`);
                }
            }, true);
        } catch (error) {
            console.error('Error during adding text:', error);
            simpleAlert("Error", 'An error occurred while adding text to pages.');
        }
    }

    execute(): Promise<void> {
        return openBotConfigDialog(new AddTextDialog(), this.performAddText.bind(this));
    }
}