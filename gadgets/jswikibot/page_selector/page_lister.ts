import {PageProps} from "../models/page";
import {isDebugMode} from "../models/state";
import {API} from "../utils/mw_api";
import {getNamespaces, Namespace} from "../models/namespace";
import {InputType, UserInputOption} from "../utils/input_dialog";
import {PageSelector} from "./page_selector";
import {flatMap} from "../utils/result";

export type QueryArguments = Record<string, string | number | boolean>;

export interface ApiQueryListResponse<T = PageProps> {
    continue?: Record<string, string>;
    query?: {
        [listName: string]: T[];
    };
    batchcomplete?: string;
}

export interface ApiQueryPropResponse<Prop extends string, T> {
    continue?: Record<string, string>;
    query?: {
        pages: Record<string, {
            pageid: number,
            ns: number,
            title: string,
        } & {
            [K in Prop]: T[]
        }>
    };
}

export abstract class PageLister<T = PageProps> extends PageSelector {
    static readonly inputs: UserInputOption[] = [];

    protected constructor(protected readonly args: QueryArguments) {
        super()
    }

    api = API;

    abstract getNext(): AsyncGenerator<T>;

    /**
     * Convenience method to fetch all results into a single flat array.
     */
    async fetchAll(): Promise<T[]> {
        const allResults: T[] = [];
        for await (const page of this.getNext()) {
            allResults.push(page);
        }
        return allResults;
    }

    abstract getDescription(): string;
}

export abstract class ApiListQuery<T = PageProps> extends PageLister<T> {

    protected constructor(
        public readonly listName: string,
        public readonly prefix: string,
        params: QueryArguments = {}
    ) {
        super(params);
    }

    async* getNext(): AsyncGenerator<T> {
        let continueParams: QueryArguments = {};
        const requestParams = {
            action: 'query',
            list: this.listName,
            [`${this.prefix}limit`]: 'max',
            ...this.args
        };

        do {
            const response = (await this.api.get({
                ...requestParams,
                ...continueParams,
            })) as ApiQueryListResponse<T>;

            const results = response.query?.[this.listName];
            if (Array.isArray(results)) {
                for (const result of results) {
                    yield result;
                }
            }
            continueParams = response.continue || {};
        } while (Object.keys(continueParams).length > 0);
    }
}

export abstract class ApiPropQuery<Prop extends string, T = PageProps> extends PageLister<T> {
    protected constructor(
        public readonly prop: Prop,
        public readonly prefix: string,
        protected readonly params: QueryArguments = {}
    ) {
        super(params);
    }

    async* getNext(): AsyncGenerator<T> {
        const requestParams = {
            action: 'query',
            prop: this.prop,
            [`${this.prefix}limit`]: 'max',
            ...this.args
        };

        let continueParams: QueryArguments = {};
        do {
            const response = (await this.api.get({
                ...requestParams,
                ...continueParams,
            })) as ApiQueryPropResponse<Prop, T>;

            const pages = response.query?.pages
            if (!pages) {
                break;
            }
            const page = pages[Object.keys(pages)[0]];
            const results = page[this.prop];
            if (Array.isArray(results)) {
                for (const result of results) {
                    yield result;
                }
            }
            continueParams = response.continue || {};
        } while (Object.keys(continueParams).length > 0);
    }
}

export class CategoryMembersQuery extends ApiListQuery {
    static override readonly inputs: UserInputOption[] = [
        {key: 'cmtitle', label: 'Category:', type: InputType.PAGE, defaultValue: 'Category:'}
    ];

    constructor(args: QueryArguments) {
        super('categorymembers', 'cm', args);
    }

    getDescription(): string {
        return `All members of category ${this.args['cmtitle']}`;
    }
}

export class AllPagesQuery extends ApiListQuery {
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'apnamespace',
            label: 'Namespace name or number (only one allowed)',
            type: InputType.NAMESPACE,
            defaultValue: "Main",
            validator: (nsString) => {
                const result = getNamespaces().toNamespace(String(nsString));
                return flatMap(result, (ns) => ns.number.toString());
            }
        },
    ]

    constructor(args: QueryArguments) {
        super('allpages', 'ap', args);
    }

    getDescription(): string {
        const ns = getNamespaces().toNamespace(this.args['apnamespace'] as string) as {ok: true, value: Namespace};
        return `All pages in namespace ${ns.value.toString()}`;
    }
}

export class EmbeddedInQuery extends ApiListQuery {
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'eititle',
            label: 'Transcluded page name: ',
            type: InputType.PAGE,
            defaultValue: "Template:",
            help: "Usually templates are transcluded, though it is also possible to list transcluded pages"
        },
    ]

    constructor(args: QueryArguments) {
        super('embeddedin', 'ei', args);
    }

    getDescription(): string {
        return `All pages that transclude ${this.args['eititle']}`;
    }
}

export class BacklinksQuery extends ApiListQuery {
    static override readonly inputs: UserInputOption[] = [
        {key: 'bltitle', label: 'Linked page name: ', type: InputType.PAGE},
    ]

    constructor(args: QueryArguments) {
        super('backlinks', 'bl', args);
    }

    getDescription(): string {
        return `All pages that link to ${this.args['bltitle']}`;
    }
}

export class PageLinksQuery extends ApiPropQuery<"links"> {
    static override readonly inputs: UserInputOption[] = [
        {key: 'titles', label: 'Title: ', type: InputType.PAGE},
    ]

    constructor(args: QueryArguments) {
        super("links", "pl", args);
    }

    getDescription(): string {
        return `All links on ${this.args['titles']}`;
    }
}

export class PageImagesQuery extends ApiPropQuery<"images"> {
    static override readonly inputs: UserInputOption[] = [
        {key: 'titles', label: 'Page: ', type: InputType.PAGE},
    ];

    constructor(args: QueryArguments) {
        super("images", "im", args);
    }

    getDescription(): string {
        return `All files used on ${this.args.titles}`;
    }
}

export class FileUsageQuery extends ApiPropQuery<"fileusage"> {
    static override readonly inputs: UserInputOption[] = [
        {key: 'titles', label: 'File: ', type: InputType.PAGE, defaultValue: "File:"},
    ]

    constructor(args: QueryArguments) {
        super("fileusage", "fu", args);
    }

    getDescription(): string {
        return `All pages that use ${this.args['titles']}`;
    }
}

export interface QueryConstructor {
    new(args: QueryArguments): PageLister;

    inputs: UserInputOption[];
}

export class ListerWrapper {
    constructor(public readonly listerConstructor: QueryConstructor,
                public readonly description: string) {
    }

    getInputs(): UserInputOption[] {
        return this.listerConstructor.inputs;
    }

    construct(args: QueryArguments): PageLister {
        if (isDebugMode()) {
            console.log(args);
        }
        return new this.listerConstructor(args);
    }
}

export const allQueryLister = [
    new ListerWrapper(CategoryMembersQuery, "All pages in category"),
    new ListerWrapper(AllPagesQuery, "All pages in namespace"),
    new ListerWrapper(EmbeddedInQuery, "All pages transcluding page X"),
    new ListerWrapper(BacklinksQuery, "All pages linking to page X"),
    new ListerWrapper(PageLinksQuery, "All links on a page"),
    new ListerWrapper(FileUsageQuery, "All pages using a file"),
    new ListerWrapper(PageImagesQuery, "All files on a page"),
];
