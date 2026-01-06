import {PageInfo} from "../models/page";
import {openWindow, simpleAlert} from "../utils/alert_window";
import {allPageFilters, FilterWrapper, PageFilter, RequiredPageInfo} from "./page_filter";
import {API} from "../utils/mw_api";
import {fetchPageCategories, fetchPageText} from "../utils/page_info_fetcher";
import {allQueryLister, ListerWrapper, PageLister} from "./page_lister";
import {ListerInputDialog} from "./lister_input";
import {cachePageInfo, isDebugMode} from "../models/state";
import {PageSelector} from "./page_selector";

type WrapperItem = ListerWrapper | FilterWrapper;
type CallbackFunction = (lst: PageInfo[]) => void;

class PageSelectionDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'pageSelectionDialog',
        title: 'Page selection criteria',
        actions: [
            {action: 'save', label: 'Done', flags: ['primary', 'progressive']},
            {label: 'Cancel', flags: ['safe']}
        ]
    };

    private indexLayout!: OO.ui.IndexLayout;
    private selectionContainer!: OO.ui.FieldsetLayout;
    private addedItems: PageSelector[] = [];
    private readonly callback: CallbackFunction;

    constructor(options: OO.ui.ProcessDialog.ConfigOptions, callback: CallbackFunction) {
        super(options);
        this.callback = callback;
    }

    public initialize(): this {
        super.initialize();

        const panel = new OO.ui.PanelLayout({padded: true, expanded: false});

        this.indexLayout = new OO.ui.IndexLayout({expanded: false});

        const tab1 = new OO.ui.TabPanelLayout('tab1', {label: 'Page listers', expanded: false});
        const tab2 = new OO.ui.TabPanelLayout('tab2', {label: 'Page filters', expanded: false});

        tab1.$element.append(this.createActionRows(allQueryLister).map(f => f.$element));

        tab2.$element.append(this.createActionRows(allPageFilters).map(f => f.$element));

        this.indexLayout.addTabPanels([tab1, tab2], 0);

        // 4. Set up the "Selected" area at the bottom
        this.selectionContainer = new OO.ui.FieldsetLayout({
            label: 'Applied page selection rules:',
            classes: ['jswikibot-selected-items-box']
        });

        const bottomPanel = new OO.ui.PanelLayout({
            padded: false,
            expanded: false,
            framed: false,
            classes: ['bottom-selection-area']
        });
        bottomPanel.$element.append(this.selectionContainer.$element);

        panel.$element.append(this.indexLayout.$element, $('<hr>'), bottomPanel.$element);
        this.$body.append(panel.$element);

        return this;
    }

    /**
     * Helper to create the row with Label and Add button
     */
    private createActionRows(items: WrapperItem[]): OO.ui.ActionFieldLayout[] {
        return items.map(item => {
            const button = new OO.ui.ButtonWidget({
                label: 'Add',
                flags: ['progressive']
            });

            button.on('click', () => this.addItem(item));

            return new OO.ui.ActionFieldLayout(
                new OO.ui.Widget({content: [new OO.ui.LabelWidget({label: item.description})]}),
                button,
                {align: 'top'}
            );
        });
    }

    private promptUserInputForLister(wrapper: WrapperItem): Promise<PageSelector> {
        return new Promise((resolve) => {
            const dialog = new ListerInputDialog({
                size: 'medium'
            }, (pageGenerator: PageSelector) => {
                resolve(pageGenerator);
            });
            openWindow(dialog, {wrapper})
        });
    }

    /**
     * Adds an item to the bottom list
     */
    private async addItem(item: WrapperItem) {
        const instance = await this.promptUserInputForLister(item);
        this.addedItems.push(instance);

        const itemWidget = new OO.ui.LabelWidget({
            label: instance.getDescription(),
            classes: ['selected-item-row']
        });

        const removeButton = new OO.ui.ButtonWidget({
            label: 'Remove',
            flags: ['destructive'],
            framed: false
        });

        const field = new OO.ui.ActionFieldLayout(
            itemWidget,
            removeButton,
            {align: 'inline'}
        );

        removeButton.on('click', () => {
            const index = this.addedItems.indexOf(instance);
            if (index > -1) {
                this.addedItems.splice(index, 1);
            }
            this.selectionContainer.removeItems([field]);
            this.updateSize();
        });

        this.selectionContainer.addItems([field]);

        this.updateSize();
    }

    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save') {
            return new OO.ui.Process(() => {
                const state = {cancelled: false};
                this.showProcessingPopup(state);

                getPageListFromSelectionCriteria(this.addedItems, state).then((pages) => {
                    if (state.cancelled) {
                        return;
                    }
                    this.closeProcessingPopup();
                    mw.notify(`Page selector done. ${pages.length} pages found.`);
                    this.callback(pages);
                    this.close();
                }, (error) => {
                    this.closeProcessingPopup();
                    console.error('Error fetching pages:', error);
                    simpleAlert("Error", `Failed to fetch pages due to ${error}`);
                });
            });
        }
        return super.getActionProcess(action);
    }

    private processingDialog: OO.ui.MessageDialog | null = null;

    private showProcessingPopup(state: { cancelled: boolean }) {
        this.processingDialog = new OO.ui.MessageDialog();
        this.processingDialog.getActionProcess = (action) => {
            if (action === 'cancel') {
                return new OO.ui.Process(() => {
                    state.cancelled = true;
                    this.closeProcessingPopup();
                });
            }
            return super.getActionProcess(action);
        }
        openWindow(this.processingDialog, {
            title: 'Fetching Pages',
            message: 'Please wait while we fetch the page list based on your criteria...',
            actions: [
                {
                    action: 'cancel',
                    label: 'Cancel',
                    flags: ['safe']
                }
            ]
        });
    }

    private closeProcessingPopup() {
        if (this.processingDialog) {
            this.processingDialog.close();
        }
    }

    public getBodyHeight() {
        return 800;
    }
}

async function fetchRequiredInfo(pages: PageInfo[], info: RequiredPageInfo[], state: {
    cancelled: boolean
}, api = API): Promise<void> {
    if (pages.length === 0) return;

    const needsText = info.includes(RequiredPageInfo.TEXT);
    const needsCategories = info.includes(RequiredPageInfo.CATEGORY);

    if (needsText) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of fetchPageText(pages, api)) {
            if (state.cancelled) {
                return;
            }
        }
    }

    if (needsCategories) {
        await fetchPageCategories(pages, api);
    }
}

async function getPageListFromSelectionCriteria(selectedItems: PageSelector[], state: { cancelled: boolean }) {
    const debugMode = isDebugMode();
    if (debugMode) {
        console.log("Selected page generators:");
        console.log(selectedItems);
    }

    const listers: PageLister[] = [];
    const filters: PageFilter[] = [];
    for (const item of selectedItems) {
        if (item instanceof PageLister) {
            listers.push(item);
        } else {
            filters.push(item as PageFilter);
        }
    }
    if (debugMode) {
        console.log("Listers and filters:");
        console.log(listers);
        console.log(filters);
    }
    let allPages: PageInfo[] = [];
    for (const lister of listers) {
        for await (const prop of lister.getNext()) {
            if (state.cancelled) {
                return allPages;
            }
            const info = new PageInfo(prop);
            allPages.push(info);
            cachePageInfo(info);
        }
    }
    if (debugMode) {
        console.log("All listers applied");
        console.log(allPages);
    }
    const simpleFilters = filters.filter((f) => f.requiredInfo.length === 0);
    for (const filter of simpleFilters) {
        allPages = allPages.filter((page) => filter.test(page));
    }
    if (debugMode) {
        console.log("Simple filters applied");
        console.log(allPages);
    }
    const complexFilters = filters.filter((f) => f.requiredInfo.length !== 0);
    const requiredInfo: Set<RequiredPageInfo> = new Set();
    for (const filter of complexFilters) {
        for (const info of filter.requiredInfo) {
            requiredInfo.add(info);
        }
    }
    if (debugMode) {
        console.log("Fetching required info: ", requiredInfo);
    }
    await fetchRequiredInfo(allPages, Array.from(requiredInfo.keys()), state);
    if (state.cancelled) {
        return allPages;
    }
    if (debugMode) {
        console.log("Required info fetched");
        console.log(allPages);
    }
    for (const filter of complexFilters) {
        allPages = allPages.filter((page) => filter.test(page));
    }

    return allPages;
}

export function runPageSelector(): Promise<PageInfo[]> {
    return new Promise<PageInfo[]>((resolve) => {
        const dialog = new PageSelectionDialog({
            size: 'medium',
            classes: ['jswikibot-page-selector'],
        }, async (pages) => {
            resolve(pages);
        });
        openWindow(dialog);
    });
}