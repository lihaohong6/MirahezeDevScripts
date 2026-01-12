import {PageInfo, PageProps} from "../models/page";
import {Namespace, parseNamespaceString} from "../models/namespace";
import {InputType, UserInputOption} from "../utils/input_dialog";
import {PageSelector, SelectorConfig} from "./page_selector";
import {unwrap} from "../utils/result";
import {RegexConfigOptions, RegexHelper} from "../utils/regex_helper";

export interface FilterArguments extends RegexConfigOptions{
    namespace?: string;
    excludeMatches?: boolean;
    searchText?: string;
}

export enum RequiredPageInfo {
    TEXT,
    CATEGORY,
}

export abstract class PageFilter extends PageSelector {
    readonly requiredInfo: RequiredPageInfo[] = [];
    static readonly validator?: (args: FilterArguments) => boolean;

    constructor(protected readonly args: FilterArguments) {
        super();
    }

    async* filter(input: AsyncIterable<PageInfo>): AsyncGenerator<PageInfo> {
        for await (const page of input) {
            if (this.test(page)) {
                yield page;
            }
        }
    }

    public abstract test(page: PageInfo): boolean;

    protected matchText(text: string): boolean {
        let match: boolean;
        if (this.args.useRegex) {
            const regex = new RegExp(this.args.searchText!, this.args.regexFlags || "");
            match = regex.test(text);
        } else {
            match = text.includes(this.args.searchText!);
        }
        return match !== this.args.excludeMatches;
    }
}

export class NamespaceFilter extends PageFilter {
    static readonly description = "Namespace";
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'namespace',
            label: 'Namespace:',
            type: InputType.NAMESPACES
        },
        {
            key: 'excludeMatches',
            label: 'Exclude this namespace instead',
            type: InputType.BOOLEAN
        }
    ];

    private namespaces: Namespace[];

    constructor(args: FilterArguments) {
        super(args);
        const result = parseNamespaceString(args.namespace!);
        this.namespaces = unwrap(result);
    }

    public test(page: PageInfo): boolean {
        const namespaceMatch = (this.namespaces.filter((ns) => ns.number === page.ns)).length > 0;
        return namespaceMatch !== this.args.excludeMatches;
    }

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages in namespace ${this.namespaces!.toString()}`
    }
}

export class TitleFilter extends PageFilter {
    static readonly description = "Page title";
    static override readonly inputs: UserInputOption[] = [
        {key: 'searchText', label: 'Title matching:', type: InputType.TEXT},
        ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags', {defaultFlags: 'm'}),
        {key: 'excludeMatches', label: 'Exclude pages with matching titles instead', type: InputType.BOOLEAN}
    ];

    static override readonly validator = (args: FilterArguments) => {
        return RegexHelper.regexValidator(args, args.searchText!);
    }

    public test(page: PageProps): boolean {
        return this.matchText(page.title);
    }

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with title matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class ContentFilter extends PageFilter {
    static readonly description = "Page wikitext content";
    static override readonly inputs: UserInputOption[] = [
        {key: 'searchText', label: 'Content matching:', type: InputType.TEXT},
        ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags', {defaultFlags: 'm'}),
        {key: 'excludeMatches', label: 'Exclude pages with matching content instead: ', type: InputType.BOOLEAN}
    ];
    readonly requiredInfo: RequiredPageInfo[] = [
        RequiredPageInfo.TEXT
    ]

    static override readonly validator = (args: FilterArguments) => {
        return RegexHelper.regexValidator(args, args.searchText || "");
    }

    public test(page: PageInfo): boolean {
        return this.matchText(page.text!);
    }

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with wikitext matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class InCategoryFilter extends PageFilter {
    static readonly description = "Page category";
    static override readonly inputs: UserInputOption[] = [
        {key: 'searchText', label: 'Is in category:', type: InputType.PAGE, defaultValue: 'Category:'},
        {key: 'excludeMatches', label: 'Exclude pages in this category instead', type: InputType.BOOLEAN},
    ];
    override readonly requiredInfo: RequiredPageInfo[] = [
        RequiredPageInfo.CATEGORY
    ]

    public test(page: PageInfo): boolean {
        return page.categories.includes(this.args.searchText!) !== this.args.excludeMatches;
    }

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages in category ${this.args.searchText}`;
    }
}

export interface FilterConstructor extends SelectorConfig<FilterArguments> {
    new(args: FilterArguments): PageFilter;

    requiredInfo?: RequiredPageInfo[];
}

export const allPageFilters: FilterConstructor[] = [
    NamespaceFilter,
    TitleFilter,
    ContentFilter,
    InCategoryFilter,
]
