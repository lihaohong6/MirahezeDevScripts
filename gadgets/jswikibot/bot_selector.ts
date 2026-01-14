import {Bot} from "./bots/bot";
import {clearCachedPageInfo} from "./models/state";
import {SettingsDialog} from "./config";
import {openWindow} from "./utils/alert_window";
import {replaceTextBot} from "./bots/replace_text";
import {purgeBot} from "./bots/purge";
import {deleteBot} from "./bots/delete";
import {addTextBot} from "./bots/add_text";
import {downloadBot} from "./bots/download";
import {moveBot} from "./bots/move";

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

    private botList: Bot<never>[] = [];
    private mainPanel!: OO.ui.PanelLayout;

    constructor(botList: Bot<never>[]) {
        super({});
        this.botList = botList;
    }

    public initialize(): this {
        super.initialize();
        this.setupMainPanel();
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

        this.botList.forEach((bot: Bot<never>) => {
            const isAvailable = bot.isAvailable();
            const runButton = new OO.ui.ButtonWidget({
                label: 'Run',
                flags: ['progressive', 'primary'],
                disabled: !isAvailable
            });

            if (isAvailable) {
                runButton.on('click', () => {
                    this.close({action: 'run', bot: bot});
                });
            }

            const botLayout = new OO.ui.FieldLayout(runButton, {
                label: bot.description,
                align: 'inline',
                help: bot.isAvailable() ? undefined : `Requires permission(s): ${bot.options.rights?.join(", ")}`,
            });

            fieldsetLayout.addItems([botLayout]);
        });

        this.mainPanel.$element.append(fieldsetLayout.$element);
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'settings') {
            return new OO.ui.Process(() => {
                const settingsDialog = new SettingsDialog();
                openWindow(settingsDialog);
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
    const allBots = [
        replaceTextBot,
        purgeBot,
        deleteBot,
        addTextBot,
        downloadBot,
        moveBot,
    ] as Bot<never>[];

    const botSelector = new BotSelectorDialog(allBots);
    openWindow(botSelector, {}, async (result: {action: string, bot: Bot<never>}) => {
        if (result && result.action === 'run' && result.bot) {
            // Clear leftover cache from previous bot run in case stuff changed.
            clearCachedPageInfo();
            return result.bot.fetchConfig();
        }
    });
}