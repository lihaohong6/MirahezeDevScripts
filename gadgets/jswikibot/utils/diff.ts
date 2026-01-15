import {API} from "./mw_api";
import {openWindow} from "./alert_window";

interface DiffResult {
    action: 'accept' | 'acceptAll' | 'skip' | 'cancel';
}

interface ApiCompareResponse {
    compare: {
        '*': string;
    };
}

function formatDiff(diffResult: string) {
    const diffMarker = '<colgroup><col class="diff-marker"><col class="diff-content"><col class="diff-marker"><col class="diff-content"></colgroup>';
    return $(`<table class="jswikibot-diff" data-mw="interface" />`).append(
        diffResult && diffMarker,
        $('<tbody />').append(
            diffResult || '<tr><td colspan="2" class="diff-notice"><div class="mw-diff-empty">(no difference)</div></td></tr>',
        ),
    );
}

const compare = async (original: string, modified: string, title: string) => {
    const res = await API.post({
        action: 'compare',
        fromslots: 'main',
        "fromtext-main": original,
        toslots: 'main',
        "totext-main": modified,
        prop: 'diff',
        fromtitle: title,
    }) as ApiCompareResponse;
    return formatDiff(res.compare['*']);
};

class DiffDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'diffDialog',
        title: 'Text Replacement Preview',
        tagName: 'div',
        actions: []
    };

    private cancelButton!: OO.ui.ButtonWidget;
    private acceptAllButton!: OO.ui.ButtonWidget;
    private acceptButton!: OO.ui.ButtonWidget;
    private skipButton!: OO.ui.ButtonWidget;
    private diffContent!: OO.ui.PanelLayout;

    constructor(private readonly pageTitle: string,
                private readonly originalText: string,
                private readonly newText: string) {
        super({size: 'large'});
    }

    private initializeButtons(): void {
        this.cancelButton = new OO.ui.ButtonWidget({label: 'Cancel', flags: ['destructive']});
        this.acceptAllButton = new OO.ui.ButtonWidget({label: 'Accept All', flags: ['progressive']});
        this.acceptButton = new OO.ui.ButtonWidget({label: 'Accept', flags: ['primary', 'progressive']});
        this.skipButton = new OO.ui.ButtonWidget({label: 'Skip'});

        const $footerContainer = $('<div>').css({
            'display': 'flex',
            'justify-content': 'space-between',
            'padding': '12px'
        }).append(
            this.cancelButton.$element,
            $('<div>').append(this.skipButton.$element, this.acceptButton.$element, this.acceptAllButton.$element)
        );

        this.$foot.append($footerContainer);

        this.cancelButton.on('click', () => this.executeAction('cancel'));
        this.skipButton.on('click', () => this.executeAction('skip'));
        this.acceptButton.on('click', () => this.executeAction('accept'));
        this.acceptAllButton.on('click', () => this.executeAction('acceptAll'));
    }

    public initialize(): this {
        super.initialize();

        this.diffContent = new OO.ui.PanelLayout({padded: true, expanded: false});
        const titleElement = $('<h3>').css('margin-top', '0').text(`Page: ${this.pageTitle}`);

        const loadingElement = $('<div>').text('Loading diff...');
        const diffContainer = $('<div>')
            .css({
                'max-height': '400px',
                'overflow': 'auto'
            })
            .append(loadingElement);

        this.diffContent.$element.append(titleElement, diffContainer);
        this.$body.append(this.diffContent.$element);

        this.initializeButtons();

        // Load diff asynchronously
        compare(this.originalText, this.newText, this.pageTitle).then(diffElement => {
            loadingElement.replaceWith(diffElement);
        });

        return this;
    }

    public getBodyHeight(): number {
        return 500;
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (['accept', 'acceptAll', 'skip', 'cancel'].includes(action)) {
            return new OO.ui.Process(() => {
                this.close({action} as DiffResult);
            });
        }
        return super.getActionProcess(action);
    }
}

export function showDiffDialog(pageTitle: string, originalText: string, newText: string): Promise<DiffResult> {
    return new Promise((resolve) => {
        const dialog = new DiffDialog(pageTitle, originalText, newText);
        openWindow(dialog, {}, (data: DiffResult) => resolve(data));
    });
}