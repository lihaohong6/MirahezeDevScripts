import {openWindow} from "./alert_window";

export enum LogSeverity {
    SUCCESS = "Success",
    INFO = "Info",
    WARNING = "Warning",
    ERROR = "Error",
}

export const ALL_SEVERITIES = [LogSeverity.SUCCESS, LogSeverity.INFO, LogSeverity.WARNING, LogSeverity.ERROR];

export class LogEntry {
    public readonly element: JQuery;

    constructor(public readonly severity: LogSeverity,
                public readonly text: string) {
        this.element = this.renderLogLine(severity, text);
    }

    private formatLogSeverity(severity: LogSeverity) {
        const text = severity;
        return $("<span>").text(`[${text}]`).addClass(`log-${text.toLowerCase()}`);
    }

    public renderLogLine(severity: LogSeverity, text: string): JQuery {
        const logElement = $("<div></div>");
        logElement.append(this.formatLogSeverity(severity), $("<span>").text(": " + text));
        return logElement;
    }
}

export class ProgressWindow {
    private readonly progressBar: OO.ui.ProgressBarWidget;
    private readonly progressLabel: OO.ui.LabelWidget;
    private readonly progressDialog: OO.ui.MessageDialog;
    private readonly logLabel: OO.ui.LabelWidget;
    private readonly cancelButton: OO.ui.ButtonWidget;
    private readonly logPanelWidget: OO.ui.Widget;
    private isDone = false;
    private progress = 0;

    constructor(private readonly total: number,
                private readonly cancelCallback: () => void = () => false) {
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

        this.severityEnabled = Object.fromEntries(
            ALL_SEVERITIES.map(severity => [severity, true])
        ) as Record<LogSeverity, boolean>;

        const toggleButtons = ALL_SEVERITIES.map(severity => {
            const btn = new OO.ui.ToggleButtonWidget({
                label: severity,
                data: severity,
                value: true,
            });

            btn.on('change', (selected) => {
                this.severityEnabled[severity] = selected;
                this.refreshLogs();
            });

            return btn;
        });

        const logFilterButtons = new OO.ui.ButtonGroupWidget({
            items: toggleButtons as unknown as OO.ui.ButtonWidget[],
            classes: ['jswikibot-log-filter-button-group']
        });

        this.logPanelWidget = new OO.ui.Widget({
            classes: ['progress-window-log-panel'],
        });
        this.logPanelWidget.$element.addClass('jswikibot-log-panel');
        this.logPanelWidget.$element.append(this.logLabel.$element);

        const fieldsetLayout = new OO.ui.FieldsetLayout();
        fieldsetLayout.addItems([
            new OO.ui.FieldLayout(this.progressBar, {
                align: 'top'
            }),
            new OO.ui.FieldLayout(progressAndCancelWidget, {
                align: 'top'
            }),
            new OO.ui.FieldLayout(logFilterButtons, {
                align: 'top',
                label: "Filter log entries"
            }),
            new OO.ui.FieldLayout(this.logPanelWidget, {
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
    private readonly severityEnabled: Record<LogSeverity, boolean>;
    private readonly logText: JQuery = $('<div></div>');

    scrollToBottom() {
        const $panel = this.logPanelWidget.$element;
        const panelElement = $panel[0];
        const elementHeight = ($panel.scrollTop() ?? 0) + ($panel.innerHeight() ?? 0);
        const scrollThreshold = panelElement.scrollHeight - 100;
        const isAtBottom = elementHeight >= scrollThreshold;
        if (isAtBottom) {
            $panel.scrollTop(panelElement.scrollHeight);
        }
    }

    addLog(severity: LogSeverity, text: string) {
        const entry = new LogEntry(severity, text);
        this.logEntries.push(entry);
        if (this.severityEnabled[severity]) {
            this.logText.append(entry.element);
            this.logLabel.setLabel(this.logText);
            this.scrollToBottom();
        }
    }

    private refreshLogs() {
        this.logText.empty();

        this.logEntries.forEach(entry => {
            if (this.severityEnabled[entry.severity]) {
                this.logText.append(entry.element);
            }
        });

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