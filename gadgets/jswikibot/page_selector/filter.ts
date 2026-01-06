import {InputType, ListerUserInput, unwrap} from "./lister";
import {PageInfo, PageProps} from "../models/page";
import {Namespace, parseNamespaceString} from "../models/namespace";
import {isDebugMode} from "../models/state";

export interface FilterArguments {
    namespace?: string;
    useRegex?: boolean;
    excludeMatches?: boolean;
    searchText?: string;
    regexFlags?: string;
}

export enum RequiredPageInfo {
    TEXT,
    CATEGORY,
}

export abstract class PageFilter {
    static readonly inputs: ListerUserInput[] = [];
    readonly requiredInfo: RequiredPageInfo[] = [];

    constructor(protected args: FilterArguments) {
    }

    async* filter(input: AsyncIterable<PageInfo>): AsyncGenerator<PageInfo> {
        for await (const page of input) {
            if (this.test(page)) {
                yield page;
            }
        }
    }

    public abstract test(page: PageInfo): boolean;

    public abstract description(): string;

    protected matchText(text: string): boolean {
        let match: boolean;
        if (this.args.useRegex) {
            const regex = new RegExp(String(this.args.searchText), this.args.regexFlags || "");
            match = regex.test(text);
        } else {
            match = text.includes(this.args.searchText!);
        }
        return match !== this.args.excludeMatches;
    }
}

// --- Specific Filter Implementations ---

export class NamespaceFilter extends PageFilter {
    static override readonly inputs: ListerUserInput[] = [
        {
            key: 'namespace',
            label: 'Namespace:',
            type: InputType.NAMESPACES,
            validator: (nsString) => {
                const result = parseNamespaceString(String(nsString));
                if (result.ok) {
                    return {
                        ok: true,
                        value: nsString
                    };
                }
                return result;
            }
        },
        {key: 'excludeMatches', label: 'Exclude this namespace instead', type: InputType.BOOLEAN}
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

    public description(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages in namespace ${this.namespaces!.toString()}`
    }
}

export class TitleFilter extends PageFilter {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'searchText', label: 'Title matching:', type: InputType.TEXT},
        {key: 'useRegex', label: 'Use regex', type: InputType.BOOLEAN},
        {key: 'regexFlags', label: 'Regex flags', type: InputType.TEXT, depends: 'useRegex', defaultValue: 'm'},
        {key: 'excludeMatches', label: 'Exclude pages with matching titles instead', type: InputType.BOOLEAN}
    ];

    public test(page: PageProps): boolean {
        return this.matchText(page.title);
    }

    public description(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with title matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class ContentFilter extends PageFilter {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'searchText', label: 'Content matching:', type: InputType.TEXT},
        {key: 'useRegex', label: 'Use regex', type: InputType.BOOLEAN},
        {key: 'regexFlags', label: 'Regex flags', type: InputType.TEXT, depends: 'useRegex', defaultValue: 'm'},
        {key: 'excludeMatches', label: 'Exclude pages with matching content instead: ', type: InputType.BOOLEAN}
    ];
    readonly requiredInfo: RequiredPageInfo[] = [
        RequiredPageInfo.TEXT
    ]

    public test(page: PageInfo): boolean {
        if (page.text === undefined) {
            console.log(`Text is empty for page ${page.title}`);
        }
        return this.matchText(page.text!);
    }

    public description(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with wikitext matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class InCategoryFilter extends PageFilter {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'searchText', label: 'Is in category:', type: InputType.PAGE, defaultValue: 'Category:'},
        {key: 'excludeMatches', label: 'Exclude pages in this category instead', type: InputType.BOOLEAN},
    ];
    override readonly requiredInfo: RequiredPageInfo[] = [
        RequiredPageInfo.CATEGORY
    ]

    public test(page: PageInfo): boolean {
        return page.categories.includes(this.args.searchText!) !== this.args.excludeMatches;
    }

    public description(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages in category ${this.args.searchText}`;
    }
}

export interface FilterConstructor {
    new(args: FilterArguments): PageFilter;

    inputs: ListerUserInput[];
    requiredInfo?: RequiredPageInfo[];
}

export class FilterWrapper {
    constructor(public readonly filterConstructor: FilterConstructor,
                public readonly description: string,
                private args?: FilterArguments,
                public filter?: PageFilter) {
    }

    getInputs(): ListerUserInput[] {
        return this.filterConstructor.inputs;
    }

    longDescription() {
        return this.filter!.description();
    }

    construct(args: FilterArguments): void {
        this.args = args;
        if (isDebugMode()) {
            console.log(this.args);
        }
        this.filter = new this.filterConstructor(args);
    }
}

export const allPageFilters = [
    new FilterWrapper(NamespaceFilter, 'Namespace'),
    new FilterWrapper(TitleFilter, 'Page title'),
    new FilterWrapper(ContentFilter, 'Page wikitext content'),
    new FilterWrapper(InCategoryFilter, 'Page category'),
]
