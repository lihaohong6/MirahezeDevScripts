import {PageProps} from "../models/page";
import {isDebugMode} from "../models/state";
import {API} from "../utils/mw_api";
import {getNamespaces} from "../models/namespace";

export enum InputType {
    PAGE,
    NAMESPACE,
    NAMESPACES,
    TEXT,
    BOOLEAN,
}

export type Result<T, E = string> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export function newErrorResult<E>(e: E): Result<never, E> {
    return {
        ok: false,
        error: e
    }
}

export function unwrap<T>(r: Result<T>) {
    if (r.ok) {
        return r.value;
    } else {
        throw new Error("Unable to unwrap result");
    }
}

export function flatMap<T, R, E>(result: Result<T, E>, func: (t: T) => R): Result<R, E> {
    if (result.ok) {
        return {
            ok: true as const,
            value: func(result.value)
        };
    }
    return {
        ok: false as const,
        error: result.error
    }
}

export type ValidationResult<T = string | number | boolean> = Result<T>;

export type ValidationFunction<T = string | number | boolean> = (value: T) => ValidationResult<T>;

export interface ListerUserInput {
    key: string;
    label: string;
    type: InputType;
    defaultValue?: string | number;
    depends?: string;
    validator?: ValidationFunction;
    help?: string;
}

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

export abstract class Lister<T = PageProps> {
    static readonly inputs: ListerUserInput[] = [];

    abstract getNext(api: typeof API): AsyncGenerator<T>;

    /**
     * Convenience method to fetch all results into a single flat array.
     */
    async fetchAll(api = API): Promise<T[]> {
        const allResults: T[] = [];
        for await (const page of this.getNext(api)) {
            allResults.push(page);
        }
        return allResults;
    }

    abstract getDescription(): string;
}

export abstract class ApiListQuery<T = PageProps> extends Lister<T> {

    protected constructor(
        public readonly listName: string,
        public readonly prefix: string,
        protected readonly params: QueryArguments = {}
    ) {
        super();
    }

    async* getNext(api = API): AsyncGenerator<T> {
        let continueParams: QueryArguments = {};
        const requestParams = {
            action: 'query',
            list: this.listName,
            [`${this.prefix}limit`]: 'max',
            ...this.params
        };

        do {
            const response = (await api.get({
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

export abstract class ApiPropQuery<Prop extends string, T = PageProps> extends Lister<T> {
    protected constructor(
        public readonly prop: Prop,
        public readonly prefix: string,
        protected readonly params: QueryArguments = {}
    ) {
        super();
    }

    async* getNext(api = API): AsyncGenerator<T> {
        const requestParams = {
            action: 'query',
            prop: this.prop,
            [`${this.prefix}limit`]: 'max',
            ...this.params
        };

        let continueParams: QueryArguments = {};
        do {
            const response = (await api.get({
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
    static override readonly inputs: ListerUserInput[] = [
        {key: 'cmtitle', label: 'Category:', type: InputType.PAGE, defaultValue: 'Category:'}
    ];

    constructor(args: QueryArguments) {
        super('categorymembers', 'cm', args);
    }

    getDescription(): string {
        return `All members of category ${this.params['cmtitle']}`;
    }
}

export class AllPagesQuery extends ApiListQuery {
    static override readonly inputs: ListerUserInput[] = [
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
        return `All pages in namespace ${this.params['apnamespace']}`;
    }
}

export class EmbeddedInQuery extends ApiListQuery {
    static override readonly inputs: ListerUserInput[] = [
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
        return `All pages that transclude ${this.params['eititle']}`;
    }
}

export class BacklinksQuery extends ApiListQuery {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'bltitle', label: 'Linked page name: ', type: InputType.PAGE},
    ]

    constructor(args: QueryArguments) {
        super('backlinks', 'bl', args);
    }

    getDescription(): string {
        return `All pages that link to ${this.params['bltitle']}`;
    }
}

export class PageLinksQuery extends ApiPropQuery<"links"> {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'titles', label: 'Title: ', type: InputType.PAGE},
    ]

    constructor(args: QueryArguments) {
        super("links", "pl", args);
    }

    getDescription(): string {
        return `All links on ${this.params['titles']}`;
    }
}

export class FileUsageQuery extends ApiPropQuery<"fileusage"> {
    static override readonly inputs: ListerUserInput[] = [
        {key: 'titles', label: 'File: ', type: InputType.PAGE, defaultValue: "File:"},
    ]

    constructor(args: QueryArguments) {
        super("fileusage", "fu", args);
    }

    getDescription(): string {
        return `All pages that use ${this.params['titles']}`;
    }
}

export interface QueryConstructor {
    new(args: QueryArguments): Lister;

    inputs: ListerUserInput[];
}

export class ListerWrapper {
    constructor(public readonly listerConstructor: QueryConstructor,
                public readonly description: string,
                private args?: QueryArguments,
                public lister?: Lister) {
    }

    getInputs(): ListerUserInput[] {
        return this.listerConstructor.inputs;
    }

    longDescription(): string {
        return this.lister!.getDescription();
    }

    construct(args: QueryArguments): void {
        this.args = args;
        if (isDebugMode()) {
            console.log(this.args);
        }
        this.lister = new this.listerConstructor(args);
    }
}

export const allQueryLister = [
    new ListerWrapper(CategoryMembersQuery, "All pages in category"),
    new ListerWrapper(AllPagesQuery, "All pages in namespace"),
    new ListerWrapper(EmbeddedInQuery, "All pages transcluding page X"),
    new ListerWrapper(BacklinksQuery, "All pages linking to page X"),
    new ListerWrapper(PageLinksQuery, "All links on a page"),
    new ListerWrapper(FileUsageQuery, "All pages using a file"),
];
