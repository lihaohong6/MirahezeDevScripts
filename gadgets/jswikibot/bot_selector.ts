import {Bot} from "./bots/bot";
import {PurgeBot} from "./bots/purge";
import {ReplaceTextBot} from "./bots/replace_text";
import {DeleteBot} from "./bots/delete";
import {AddTextBot} from "./bots/add_text";
import {clearCachedPageInfo} from "./models/state";
import {SettingsDialog} from "./config";

class BotSelectorDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'botselector',
        title: 'JSWikiBot - Select a Bot',
        actions: [
            {action: 'close', label: 'Close', flags: ['safe']},
            {action: 'settings', label: 'Settings', flags: ['progressive']},
        ]
    };

    private botList: Bot[] = [];
    private mainPanel!: OO.ui.PanelLayout;

    constructor(botList: Bot[]) {
        super({});
        this.botList = botList;
    }

    public initialize(): this {
        super.initialize();
        this.setupMainPanel();
        // @ts-expect-error $body does exist
        this.$body.append(this.mainPanel.$element);
        return this;
    }

    private setupMainPanel(): void {
        this.mainPanel = new OO.ui.PanelLayout({
            padded: true,
            expanded: false
        });

        const fieldsetLayout = new OO.ui.FieldsetLayout({
            label: 'Available Bots'
        });

        this.botList.forEach((bot) => {
            const runButton = new OO.ui.ButtonWidget({
                label: 'Run',
                flags: ['progressive', 'primary']
            });

            runButton.on('click', () => {
                this.close({action: 'run', bot: bot});
            });

            const botLayout = new OO.ui.FieldLayout(runButton, {
                label: bot.getDescription(),
                align: 'inline'
            });

            fieldsetLayout.addItems([botLayout]);
        });

        this.mainPanel.$element.append(fieldsetLayout.$element);
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'settings') {
            return new OO.ui.Process(() => {
                const settingsDialog = new SettingsDialog();
                const windowManager = new OO.ui.WindowManager();
                $(document.body).append(windowManager.$element);
                windowManager.addWindows([settingsDialog]);
                windowManager.openWindow(settingsDialog);
            });
        }

        if (action === 'close') {
            return new OO.ui.Process(() => {
                this.close({action: 'close'});
            });
        }

        return super.getActionProcess(action);
    }
}

export function runBotSelector(): void {
    const availableBots: Bot[] = [
        new PurgeBot(),
        new ReplaceTextBot(),
        new DeleteBot(),
        new AddTextBot()
    ];

    const windowManager = new OO.ui.WindowManager();
    $(document.body).append(windowManager.$element);

    const botSelector = new BotSelectorDialog(availableBots);
    windowManager.addWindows([botSelector]);

    // eslint-disable-next-line
    windowManager.openWindow(botSelector).closed.then(async (result: any) => {
        windowManager.clearWindows();
        windowManager.$element.remove();

        if (result && result.action === 'run' && result.bot) {
            // Clear leftover cache from previous bot run in case stuff changed.
            clearCachedPageInfo();
            await result.bot.execute();
        }
    });
}