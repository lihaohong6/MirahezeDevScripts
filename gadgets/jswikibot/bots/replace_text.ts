import {Bot, BotConfigurationDialog, openBotConfigDialog} from "./bot";
import {formatSummary, savePage} from "../utils/mw_api";
import {LogSeverity} from "../utils/progress_window";
import {simpleAlert} from "../utils/alert_window";
import {PageInfo} from "../models/page";
import {showDiffDialog} from "../utils/diff";

interface ReplacementConfig {
    pages: string[];
    originalText: string;
    replacementText: string;
    useRegex: boolean;
    regexFlags: string;
    summary: string;
}

class TextReplacementDialog extends BotConfigurationDialog<ReplacementConfig> {
    private originalText!: OO.ui.MultilineTextInputWidget;
    private replacementText!: OO.ui.MultilineTextInputWidget;
    private useRegex!: OO.ui.CheckboxInputWidget;
    private regexFlags!: OO.ui.TextInputWidget;
    private editSummary: OO.ui.TextInputWidget;

    constructor(config?: never) {
        super(config);
    }

    protected setupStep2(): void {
        // --- Step 2 Layout ---
        this.originalText = new OO.ui.MultilineTextInputWidget({
            placeholder: 'Text to find'
        });

        this.replacementText = new OO.ui.MultilineTextInputWidget({
            placeholder: 'Replace with'
        });

        this.useRegex = new OO.ui.CheckboxInputWidget();
        
        this.regexFlags = new OO.ui.TextInputWidget({
            placeholder: 'gm',
            value: 'gm'
        });

        this.editSummary = new OO.ui.TextInputWidget({
            value: '$bot: replace $original with $new'
        });

        this.step2 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const regexField = new OO.ui.FieldLayout(this.regexFlags, {
            label: 'Regex flags',
            align: 'inline'
        });
        const step2Fieldset = new OO.ui.FieldsetLayout({
            label: 'Replacement Settings',
            items: [
                new OO.ui.FieldLayout(this.originalText, {
                    label: 'Find',
                    align: 'top',
                    help: 'When using regular expressions, input the regex itself instead of /regex/. Use \\n for newlines.'
                }),
                new OO.ui.FieldLayout(this.replacementText, {
                    label: 'Replace with',
                    align: 'top',
                    help: "Use the keyboard's enter key for newlines instead of \\n."
                }),
                new OO.ui.FieldLayout(this.useRegex, {
                    label: 'Use regular expressions',
                    align: 'inline'
                }),
                regexField,
                new OO.ui.FieldLayout(this.editSummary, {
                    label: 'Edit summary',
                    align: 'top'
                })
            ]
        });

        regexField.toggle(false);
        this.useRegex.on('change', (selected: string | boolean) => {
            if (selected) {
                regexField.toggle(true);
            } else {
                regexField.toggle(false);
            }
        });

        this.step2.$element.append(step2Fieldset.$element);
    }

    protected getSecondStepData(): Omit<ReplacementConfig, "pages"> {
        return {
            originalText: this.originalText.getValue(),
            replacementText: this.replacementText.getValue(),
            useRegex: this.useRegex.isSelected(),
            regexFlags: this.regexFlags.getValue(),
            summary: this.editSummary.getValue()
        };
    }
}

export class ReplaceTextBot extends Bot {
    getDescription(): string {
        return "Find and replace text";
    }

    private async performReplacement(data: ReplacementConfig) {
        try {
            let acceptAll = false;

            await this.forEachPage(data.pages, async (page: PageInfo) => {
                let text;
                if (data.useRegex) {
                    text = page.text!.replace(new RegExp(data.originalText, data.regexFlags), data.replacementText);
                } else {
                    text = page.text!.split(data.originalText).join(data.replacementText);
                }
                
                if (page.text !== text) {
                    if (!acceptAll) {
                        const result = await showDiffDialog(page.title, page.text!, text);
                        
                        switch (result.action) {
                            case 'accept':
                                break;
                            case 'acceptAll':
                                acceptAll = true;
                                break;
                            case 'skip':
                                this.progressWindow!.addLog(LogSeverity.INFO, `Skipped ${page.title}`);
                                return;
                            case 'cancel':
                                this.cancelled = true;
                                this.progressWindow!.addLog(LogSeverity.WARNING, 'Text replacement cancelled by user');
                                return;
                        }
                    }
                    const summary = formatSummary(data.summary, {original: data.originalText, new: data.replacementText});
                    const pageSaveResult = await savePage(page.title, text, summary, true);
                    if (pageSaveResult) {
                        this.progressWindow!.addLog(LogSeverity.INFO, `${page.title} saved`);
                    } else {
                        this.progressWindow!.addLog(LogSeverity.ERROR, `Failed to save ${page.title}`);
                    }
                } else {
                    this.progressWindow!.addLog(LogSeverity.INFO, `Page ${page.title} not changed`);
                }
            }, true);
        } catch (error) {
            console.error('Error during replacement:', error);
            simpleAlert("Error", 'An error occurred while processing the pages. Please check the console for details.');
        }
    }

    execute(): Promise<void> {
        return openBotConfigDialog(new TextReplacementDialog(), this.performReplacement.bind(this));
    }
}