import {runPageSelector} from "../page_selector/page_selector";
import {PageInfo} from "../models/page";
import {LogSeverity, ProgressWindow} from "../utils/progress_window";
import {simpleAlert, WindowResult} from "../utils/alert_window";
import {fetchPageText} from "../utils/page_info_fetcher";
import {isDebugMode} from "../models/state";

export abstract class Bot {

    protected progressWindow?: ProgressWindow;

    protected cancelled: boolean = false;

    protected cancelCallback() {
        this.cancelled = true;
    }

    protected static readonly cancelledMessage: string = "Bot cancelled.";

    protected checkCancelled() {
        if (this.cancelled) {
            this.progressWindow!.addLog(LogSeverity.WARNING, Bot.cancelledMessage)
            return true;
        }
        return false;
    }

    protected pageListEmpty(pages: PageInfo[]): boolean {
        if (pages.length === 0) {
            simpleAlert("Error", 'No valid pages found. Please check page titles and try again.');
            return true;
        }
        return false;
    }

    protected async forEachPage(
        pages: string[],
        callback: (page: PageInfo) => Promise<void>,
        fetchText: boolean = false
    ) {
        const pageInfoList = pages.map(title => new PageInfo({title: title}));

        if (this.pageListEmpty(pageInfoList)) {
            return;
        }

        if (isDebugMode()) {
            console.log('Valid pages found:', pageInfoList.map(p => p.title));
        }

        this.progressWindow = new ProgressWindow(pageInfoList.length, this.cancelCallback.bind(this));
        let counter = 0;
        const source = fetchText ?
            fetchPageText(pageInfoList) :
            pageInfoList;
        for await (const page of source) {
            if (this.checkCancelled()) break;
            await callback(page);
            this.progressWindow.makeProgress(++counter);
        }
        this.progressWindow.done();
    }

    abstract execute(): Promise<void>;

    abstract getDescription(): string;
}

export async function openBotConfigDialog<T>(dialog: OO.ui.ProcessDialog, callback: (t: T) => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
        const windowManager = new OO.ui.WindowManager();
        $(document.body).append(windowManager.$element);

        windowManager.addWindows([dialog]);

        windowManager.openWindow(dialog).closed.then(async (r: never) => {
            windowManager.clearWindows();
            windowManager.$element.remove();

            const result = r as WindowResult<T>
            // Perform replacement if user clicked "Done"
            if (result && result.action === 'done' && result.data) {
                await callback(result.data);
            }

            resolve();
        });
    });
}

export abstract class BotConfigurationDialog<T> extends OO.ui.ProcessDialog {
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

    protected stack!: OO.ui.StackLayout;
    protected step1!: OO.ui.PanelLayout;
    protected step2!: OO.ui.PanelLayout;
    protected pages: string[] = [];

    // Step 1 input
    protected manualPagesInput!: OO.ui.MultilineTextInputWidget;

    public constructor(config?: OO.ui.Dialog.ConfigOptions) {
        super(config);
    }

    public initialize(): this {
        super.initialize();
        this.setupStep1();
        this.setupStep2();

        // --- Stack Controller ---
        this.stack = new OO.ui.StackLayout({
            items: [this.step1, this.step2]
        });

        // @ts-expect-error $body does exist
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

    protected abstract setupStep2(): void;

    protected abstract getSecondStepData(): Omit<T, "pages">;

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
                // @ts-expect-error actions does exist
                this.actions.setMode('step2');
            });
        }

        if (action === 'back') {
            return new OO.ui.Process(() => {
                this.stack.setItem(this.step1);
                // @ts-expect-error actions does exist
                this.actions.setMode('step1');
            });
        }

        if (action === 'done') {
            return new OO.ui.Process(() => {
                const data = this.getSecondStepData();
                this.close({action: 'done', data: {...data, pages: this.pages}});
            });
        }

        return super.getActionProcess(action);
    }

    public getSetupProcess(data?: never): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.stack.setItem(this.step1);
            // @ts-expect-error actions does exist
            this.actions.setMode('step1');
        });
    }

    public getBodyHeight(): number {
        return 400;
    }
}