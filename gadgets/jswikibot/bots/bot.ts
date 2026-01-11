import {PageInfo} from "../models/page";
import {LogSeverity, ProgressWindow} from "../utils/progress_window";
import {openWindow, simpleAlert, WindowResult} from "../utils/alert_window";
import {InputDialog, UserInputOption} from "../utils/input_dialog";

import {Result} from "../utils/result";
import {runPageSelector} from "../page_selector/run_page_selector";

interface BotResult {
    severity: LogSeverity,
    message: string,
}

export interface BotSetupOptions<TConfig extends {pages: string[]}, BotState = never> {
    name: string;
    description: string;
    // Default to 1
    batchSize?: number | ((config: TConfig) => number);

    createConfigDialog: () => BotConfigurationDialog<TConfig>;

    processBatch: (pages: PageInfo[], config: TConfig, state: BotState, bot: Bot<TConfig, BotState>) => Promise<BotResult | BotResult[]>;

    preprocessPages?: (pages: PageInfo[], config: TConfig) => AsyncGenerator<PageInfo> | PageInfo[];
}

export class Bot<T extends {pages: string[]}, State = never> {

    private progressWindow?: ProgressWindow;

    private cancelled: boolean = false;
    private botState = {} as State;

    public readonly name: string;
    public readonly description: string;
    private readonly batchSize: (config: T) => number;

    constructor(private readonly options: BotSetupOptions<T, State>) {
        this.name = options.name;
        this.description = options.description;
        if (typeof options.batchSize === "number") {
            this.batchSize = () => options.batchSize as number;
        } else if (options.batchSize === undefined) {
            this.batchSize = () => 1;
        } else {
            this.batchSize = options.batchSize;
        }
        if (!options.preprocessPages) {
            options.preprocessPages = this.preprocessPages;
        }
    }

    private static readonly cancelledMessage: string = "Bot cancelled.";

    private checkCancelled() {
        if (this.cancelled) {
            this.progressWindow!.addLog(LogSeverity.WARNING, Bot.cancelledMessage);
            this.progressWindow!.hideCancelButton();
            return true;
        }
        return false;
    }

    private async* preprocessPages(pages: PageInfo[]): AsyncGenerator<PageInfo> {
        for (const page of pages) {
            yield page;
        }
    }

    public cancel(): void {
        this.cancelled = true;
    }

    public fetchConfig() {
        const dialog = this.options.createConfigDialog();
        return openBotConfigDialog(dialog, this.processPages.bind(this));
    }

    public async processPages(config: T) {
        this.cancelled = false;
        // Reset state
        this.botState = {} as State;
        const pages = config.pages.map((title) => new PageInfo({title: title}));

        if (pages.length === 0) {
            simpleAlert("Error", 'No valid pages found. Please check page titles and try again.');
        }

        let batch = [];
        this.progressWindow = new ProgressWindow(pages.length, this.cancel.bind(this));
        for await (const page of this.options.preprocessPages!(pages, config)) {
            if (this.checkCancelled()) {
                return;
            }
            batch.push(page);
            if (batch.length >= this.batchSize(config)) {
                const results = await this.options.processBatch(batch, config, this.botState, this);
                let entries: BotResult[];
                if (Array.isArray(results)) {
                    entries = results as BotResult[];
                } else {
                    entries = [results as BotResult]
                }
                for (const entry of entries) {
                    this.progressWindow.addLog(entry.severity, entry.message);
                    this.progressWindow.makeProgress(batch.length);
                }
                batch = [];
            }
        }
        this.progressWindow.done();
    }
}

export async function openBotConfigDialog<T>(dialog: BotConfigurationDialog<T>, callback: (t: T) => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
        dialog.callback = callback;
        openWindow<WindowResult<T>>(dialog, {}, async () => {
            resolve();
        });
    });
}

// This is equivalent to UserInputOption[] except that keys are checked to be inside T, which prevents
// typos from causing errors.
export type InputConfig<T> = Array<
    { [K in Extract<keyof T, string>]: Omit<UserInputOption, 'key'> & { key: K } }[Extract<keyof T, string>]
>;

export interface BotConfigurationOptions<T> {
    dialogConfig?: OO.ui.Dialog.ConfigOptions,
    inputOptions: InputConfig<T>,
    validator?: (data: T) => boolean
}

export class BotConfigurationDialog<T> extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'configurebot',
        title: 'Configure bot',
        actions: [
            {action: 'next', label: 'Next', flags: ['progressive', 'primary'], modes: ['step1']},
            {action: 'back', label: 'Back', modes: ['step2']},
            {action: 'done', label: 'Start bot', flags: ['progressive', 'primary'], modes: ['step2']},
            {label: 'Cancel', flags: ['safe'], modes: ['step1', 'step2']},
        ]
    };

    private stack!: OO.ui.StackLayout;
    private step1!: OO.ui.PanelLayout;
    private step2!: OO.ui.PanelLayout;
    private step2Widgets!: Record<string, OO.ui.Widget>;
    private pages: string[] = [];
    public callback?: (t: T) => Promise<void>;

    constructor(private readonly config: BotConfigurationOptions<T>) {
        super(config.dialogConfig);
    }

    // Step 1 input
    protected manualPagesInput!: OO.ui.MultilineTextInputWidget;

    public initialize(): this {
        super.initialize();
        this.setupStep1();
        this.setupStep2();

        // --- Stack Controller ---
        this.stack = new OO.ui.StackLayout({
            items: [this.step1, this.step2]
        });

        this.$body.append(this.stack.$element);
        return this;
    }

    protected setupStep1() {
        // --- Step 1 Layout ---
        const pageSelectorButton = new OO.ui.ButtonWidget({
            label: 'Use Page Selector Tool',
            flags: ['progressive']
        });

        this.manualPagesInput = new OO.ui.MultilineTextInputWidget({
            placeholder: 'Enter page titles, one per line',
            rows: 10
        });

        pageSelectorButton.on('click', () => {
            runPageSelector().then((pageInfoList: PageInfo[]) => {
                const pageTitles = pageInfoList.map(page => page.title).join('\n');
                const existingText = this.manualPagesInput.getValue().trim();
                const newText = existingText ? existingText + '\n' + pageTitles : pageTitles;
                this.manualPagesInput.setValue(newText);
            });
        });

        this.step1 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const step1Fieldset = new OO.ui.FieldsetLayout({
            label: 'Select Pages',
            items: [
                new OO.ui.FieldLayout(pageSelectorButton, {
                    label: 'Page selector tool',
                    align: 'top'
                }),
                new OO.ui.FieldLayout(this.manualPagesInput, {
                    label: 'Page titles',
                    align: 'top',
                    help: 'Click the button above to select pages using tool, or enter page titles manually. You can edit the list after using the tool.'
                })
            ]
        });

        this.step1.$element.append(step1Fieldset.$element);
    }

    protected setupStep2() {
        const res = InputDialog.setUpWidgets(this.config.inputOptions, {label: 'Add Text Settings'});
        this.step2Widgets = res.widgets;

        this.step2 = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        this.step2.$element.append(res.fieldset.$element);
    }

    protected getSecondStepData(): Result<Omit<T, "pages">> {
        return InputDialog.getInputData(this.config.inputOptions, this.step2Widgets);
    }

    protected validate(data: T): boolean {
        if (this.config.validator) {
            return this.config.validator(data);
        }
        return true;
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'next') {
            return new OO.ui.Process(() => {
                const manualText = this.manualPagesInput.getValue().trim();
                const pages = manualText.split('\n').filter(page => page.trim());
                if (pages.length === 0) {
                    simpleAlert("Error", "At least 1 page need to be specified.");
                    return;
                }
                this.pages = Array.from(new Set(pages));
                this.stack.setItem(this.step2);
                this.actions.setMode('step2');
            });
        }

        if (action === 'back') {
            return new OO.ui.Process(() => {
                this.stack.setItem(this.step1);
                this.actions.setMode('step1');
            });
        }

        if (action === 'done') {
            return new OO.ui.Process(() => {
                const result = this.getSecondStepData();
                if (!result.ok) {
                    simpleAlert("Invalid input", result.error);
                    return;
                }
                const data = {...result.value, pages: this.pages} as T;
                if (!this.validate(data)) {
                    return;
                }
                if (this.callback) {
                    this.callback!(data as T);
                }
            });
        }

        return super.getActionProcess(action);
    }

    public getSetupProcess(data?: never): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.stack.setItem(this.step1);
            this.actions.setMode('step1');
        });
    }

    public getBodyHeight(): number {
        return 400;
    }
}