import {PageInfo, PageProps} from "../models/page";
import {Namespace, parseNamespaceString} from "../models/namespace";
import {isDebugMode} from "../models/state";
import {InputType, UserInputOption} from "../utils/input_dialog";
import {PageSelector} from "./page_selector";
import {unwrap} from "../utils/result";

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

export abstract class PageFilter extends PageSelector {
    readonly requiredInfo: RequiredPageInfo[] = [];

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

    public abstract getDescription(): string;

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

// --- Specific Filter Implementations ---

export class NamespaceFilter extends PageFilter {
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'namespace',
            label: 'Namespace:',
            type: InputType.NAMESPACES,
            validator: (value: string | number | boolean) => {
                const result = parseNamespaceString(String(value));
                if (result.ok) {
                    return {
                        ok: true,
                        value: String(value)
                    };
                }
                return {
                    ok: false,
                    error: (result as {error: string}).error
                };
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

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages in namespace ${this.namespaces!.toString()}`
    }
}

export class TitleFilter extends PageFilter {
    static override readonly inputs: UserInputOption[] = [
        {key: 'searchText', label: 'Title matching:', type: InputType.TEXT},
        {key: 'useRegex', label: 'Use regex', type: InputType.BOOLEAN},
        {key: 'regexFlags', label: 'Regex flags', type: InputType.TEXT, depends: 'useRegex', defaultValue: 'm'},
        {key: 'excludeMatches', label: 'Exclude pages with matching titles instead', type: InputType.BOOLEAN}
    ];

    public test(page: PageProps): boolean {
        return this.matchText(page.title);
    }

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with title matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class ContentFilter extends PageFilter {
    static override readonly inputs: UserInputOption[] = [
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

    public getDescription(): string {
        return `${this.args.excludeMatches ? "Exclude" : "Only include"} pages with wikitext matching${this.args.useRegex ? ' regex' : ''} ${this.args.searchText}`;
    }
}

export class InCategoryFilter extends PageFilter {
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

export interface FilterConstructor {
    new(args: FilterArguments): PageFilter;

    inputs: UserInputOption[];
    requiredInfo?: RequiredPageInfo[];
}

export class FilterWrapper {
    constructor(public readonly filterConstructor: FilterConstructor,
                public readonly description: string) {
    }

    getInputs(): UserInputOption[] {
        return this.filterConstructor.inputs;
    }

    construct(args: FilterArguments): PageFilter {
        if (isDebugMode()) {
            console.log(args);
        }
        return new this.filterConstructor(args);
    }
}

export const allPageFilters = [
    new FilterWrapper(NamespaceFilter, 'Namespace'),
    new FilterWrapper(TitleFilter, 'Page title'),
    new FilterWrapper(ContentFilter, 'Page wikitext content'),
    new FilterWrapper(InCategoryFilter, 'Page category'),
]
