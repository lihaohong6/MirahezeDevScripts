import {API} from "../utils/mw_api";
import {Result} from "../page_selector/lister";

export class Namespace {
    constructor(public readonly name: string,
                public readonly number: number) {
    }

    toString(): string {
        return `${this.number} (${this.name})`;
    }
}

export class NamespaceList {
    private readonly index: Record<string, Namespace>;

    constructor(public readonly namespaces: Namespace[]) {
        this.index = {};
        for (const namespace of namespaces) {
            this.index[namespace.name.toLowerCase()] = namespace;
            this.index[namespace.number.toString()] = namespace;
        }
    }

    toNamespace(input: string | number): Result<Namespace> {
        input = String(input).toLowerCase();
        const result = this.index[input];
        if (result) {
            return {
                ok: true,
                value: result,
            }
        }
        return {
            ok: false,
            error: `"${input}" is not a valid namespace`,
        }
    }
}

let namespacesCache: NamespaceList | null = null;
let namespacesPromise: Promise<NamespaceList> | null = null;

export function getNamespaces(): NamespaceList {
    return namespacesCache!;
}

export function parseNamespaceString(nsString: string): Result<Namespace[]>{
    const namespaces = getNamespaces();
    const result: Namespace[] = [];
    const errors: string[] = [];
    for (const ns of nsString.split("|")) {
        const res = namespaces.toNamespace(ns);
        if (res.ok) {
            result.push(res.value);
        } else {
            errors.push(res.error);
        }
    }
    if (errors.length === 0) {
        return {
            ok: true,
            value: result
        };
    }
    return {
        ok: false,
        error: errors.join("\n")
    }
}

export async function getAllNamespacesAsync(): Promise<NamespaceList> {
    if (namespacesCache !== null) {
        return namespacesCache;
    }
    if (namespacesPromise !== null) {
        return namespacesPromise;
    }

    namespacesPromise = (async () => {
        const result = await API.get({
            action: 'query',
            meta: 'siteinfo',
            siprop: 'namespaces'
        });

        const response = result?.query?.namespaces;
        const namespaces: Namespace[] = [];

        if (response && typeof response === 'object') {
            for (const key in response) {
                const ns = response[key];
                const nsName = ns.id === 0 ? "Main" : (ns.canonical || ns['*']);
                namespaces.push(new Namespace(nsName, ns.id));
            }
        }

        namespacesCache = new NamespaceList(namespaces);
        namespacesPromise = null;

        return namespacesCache;
    })();

    return namespacesPromise;
}
