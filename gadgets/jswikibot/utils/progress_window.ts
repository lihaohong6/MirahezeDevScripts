import {openWindow} from "./alert_window";

export enum LogSeverity {
    SUCCESS = 0,
    INFO,
    WARNING,
    ERROR,
}

export class LogEntry {
    constructor(public readonly severity: LogSeverity,
                public readonly text: string) {
    }
}

export class ProgressWindow {
    private readonly progressBar: OO.ui.ProgressBarWidget;
    private readonly progressLabel: OO.ui.LabelWidget;
    private readonly progressDialog: OO.ui.MessageDialog;
    private readonly logLabel: OO.ui.LabelWidget;
    private readonly cancelButton: OO.ui.ButtonWidget;
    private isDone = false;
    private progress = 0;

    constructor(private readonly total: number, private readonly cancelCallback: () => void = () => {} ) {
        this.progressBar = new OO.ui.ProgressBarWidget({
            progress: 0
        });
        
        this.progressLabel = new OO.ui.LabelWidget({
            label: `Progress: 0 / ${this.total}`
        });
        
        this.logLabel = new OO.ui.LabelWidget({
            label: '',
            classes: ['progress-window-logs']
        });
        
        this.cancelButton = new OO.ui.ButtonWidget({
            label: 'Cancel',
            flags: ['destructive']
        });
        
        this.cancelButton.on('click', () => {
            this.cancelCallback();
            this.hideCancelButton();
            this.addLog(
                LogSeverity.WARNING,
                "Cancellation initiated. Note that the bot will likely perform one more operation before stopping. " +
                "Refreshing the page definitively cancels the bot.");
        });
        
        const progressAndCancelWidget = new OO.ui.Widget({
            content: [
                this.progressLabel.$element,
                this.cancelButton.$element
            ]
        });
        progressAndCancelWidget.$element.css({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const logPanelWidget = new OO.ui.Widget({
            classes: ['progress-window-log-panel'],
        });
        logPanelWidget.$element.addClass('jswikibot-log-panel');
        logPanelWidget.$element.append(this.logLabel.$element);

        const fieldsetLayout = new OO.ui.FieldsetLayout();
        fieldsetLayout.addItems([
            new OO.ui.FieldLayout(this.progressBar, {
                align: 'top'
            }),
            new OO.ui.FieldLayout(progressAndCancelWidget, {
                align: 'top'
            }),
            new OO.ui.FieldLayout(logPanelWidget, {
                align: 'top'
            })
        ]);
        
        this.progressDialog = new OO.ui.MessageDialog();
        openWindow(this.progressDialog, {
            title: 'Progress',
            message: fieldsetLayout.$element,
            actions: [
                {
                    action: 'close',
                    label: 'Close',
                    flags: ['neutral']
                }
            ],
            size: "large"
        });
    }

    setProgress(progress: number) {
        this.progress = progress;
        const progressPercent = Math.min((progress / this.total) * 100, 100);
        this.progressBar.setProgress(progressPercent);
        this.progressLabel.setLabel(`Progress: ${progress} / ${this.total}`);
        if (progress >= this.total) {
            this.done();
        }
    }

    makeProgress(progress: number) {
        this.setProgress(this.progress + progress);
    }

    private readonly logEntries: LogEntry[] = [];
    private readonly logText: JQuery = $('<div></div>');

    private formatLogSeverity(severity: LogSeverity) {
        const text = LogSeverity[severity];
        return $("<span>").text(`[${text}]`).addClass(`log-${text.toLowerCase()}`);
    }

    addLog(severity: LogSeverity, text: string) {
        this.logEntries.push(new LogEntry(severity, text));
        const logElement = $("<div></div>");
        logElement.append(this.formatLogSeverity(severity), $("<span>").text(": " + text));
        this.logText.append(logElement);
        this.logLabel.setLabel(this.logText);
    }

    hideCancelButton() {
        this.cancelButton.$element.hide();
    }

    done() {
        if (!this.isDone) {
            this.isDone = true;
            this.hideCancelButton();
        }
    }
}