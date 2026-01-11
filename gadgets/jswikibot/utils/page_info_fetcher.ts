import {PageInfo, PageProps} from "../models/page";
import {QueryArguments} from "../page_selector/page_lister";
import {API} from "./mw_api";
import {cachePageInfo, getCachedPageInfo} from "../models/state";

export async function fetchPageInfo(pageTitles: string[], api = API): Promise<PageInfo[]> {
    if (pageTitles.length === 0) {
        return [];
    }

    const results: PageInfo[] = [];
    const remainingTitles: string[] = [];
    for (const title of pageTitles) {
        const cached = getCachedPageInfo(title)
        if (cached) {
            results.push(cached);
        } else {
            remainingTitles.push(title);
        }
    }

    const batchSize = 50; // Maximum API limit for normal requests

    for (let i = 0; i < remainingTitles.length; i += batchSize) {
        const batch = remainingTitles.slice(i, i + batchSize);
        const titles = batch.join('|');

        const params: QueryArguments = {
            action: 'query',
            titles: titles,
            prop: 'info',
            inprop: 'title|namespace|pageid',
        };

        try {
            const response = await api.get(params);

            if (!response.query || !response.query.pages) {
                continue;
            }

            const apiPages = response.query.pages;

            for (const [pageId, pageInfo] of Object.entries(apiPages)) {
                const info = pageInfo as PageProps;
                // Skip pages that don't exist (they have "missing" property and negative pageid)
                if ('missing' in info || parseInt(pageId) < 0) {
                    continue;
                }

                const pageInfoObj = new PageInfo({
                    title: info.title,
                    pageid: parseInt(pageId),
                    ns: info.ns,
                });

                results.push(pageInfoObj);
                cachePageInfo(pageInfoObj);
            }

        } catch (error) {
            console.error('Error fetching page info:', error);
            throw error;
        }
    }

    return results;
}

interface MwQueryResponse {
    batchcomplete: string
    query: {
        normalized?: {
            from: string,
            to: string
        }[],
        pages: Record<string, {
            pageid?: number,
            ns: number,
            missing?: string,
            title: string,

            // For revision queries
            revisions?: {
                slots: {
                    main: {
                        contentmodel: string,
                        contentformat: string,
                        "*": string,
                    }
                }
            }[],

            // For imageinfo queries
            imageinfo?: {
                url?: string;
            }[];
        }>
    }
}

interface CategoryMembersResponse {
    batchcomplete?: string
    continue?: {
        clcontinue: string,
        continue: string
    }
    query: {
        normalized?: {
            from: string,
            to: string
        }[],
        pages: Record<string, {
            pageid: number,
            ns: number,
            title: string,
            categories?: {
                ns: number,
                title: string
            }[]
        }>
    }
}
type PageProcessor = (pageInfo: PageInfo, apiResult: MwQueryResponse['query']['pages'][string]) => void;
async function* fetchPagePropBatch(
    pages: PageInfo[],
    queryParams: QueryArguments,
    processPage: PageProcessor,
    api = API,
): AsyncGenerator<PageInfo> {
    const batchSize = 50;

    for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const titles = batch.map(p => p.title).join('|');

        // Merge base params with specific titles
        const params: QueryArguments = {
            ...queryParams,
            titles: titles
        };

        const titleMap = new Map<string, PageInfo>(pages.map(p => [p.title, p]));

        try {
            const response = await api.get(params) as MwQueryResponse;

            if (!response.query || !response.query.pages) {
                continue;
            }

            if (response.query.normalized) {
                for (const norm of response.query.normalized) {
                    const original = titleMap.get(norm.from);
                    if (original) {
                        titleMap.set(norm.to, original);
                    }
                }
            }

            for (const pageKey in response.query.pages) {
                const apiPage = response.query.pages[pageKey];
                const pageInfo = titleMap.get(apiPage.title);

                if (pageInfo) {
                    pageInfo.ns = apiPage.ns;
                    processPage(pageInfo, apiPage);
                    yield pageInfo;
                }
            }
        } catch (error) {
            console.error('Error in batch fetch:', error);
            throw error;
        }
    }
}

export async function* fetchFileUrl(pages: PageInfo[], api = API): AsyncGenerator<PageInfo> {
    const params: QueryArguments = {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url',
    };

    // Use the generic function with a specific processor
    yield* fetchPagePropBatch(pages, params, (pageInfo, apiPage) => {
        if (apiPage.imageinfo && apiPage.imageinfo.length > 0) {
            const info = apiPage.imageinfo[0];
            if (info.url) {
                pageInfo.fileUrl = info.url;
            }
        }
    }, api);
}

export async function* fetchPageText(pages: PageInfo[], api = API): AsyncGenerator<PageInfo> {
    const params: QueryArguments = {
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
    };

    // Use the generic function with a specific processor
    yield* fetchPagePropBatch(pages, params, (pageInfo, apiPage) => {
        if (apiPage.revisions && apiPage.revisions.length > 0) {
            const revision = apiPage.revisions[0];
            if (revision.slots?.main) {
                pageInfo.text = revision.slots.main['*'];
            }
        } else {
            pageInfo.text = ""; // Default to empty string if missing
        }
    }, api);
}

export async function fetchPageCategories(pages: PageInfo[], api = API): Promise<void> {
    if (pages.length === 0) {
        return;
    }

    const batchSize = 50;

    for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const titles = batch.map(p => p.title).join('|');

        let continueParams: QueryArguments | null = null;

        const titleMap = new Map<string, PageInfo>(pages.map(p => [p.title, p]));

        do {
            const params: QueryArguments = {
                action: 'query',
                titles: titles,
                prop: 'categories',
                cllimit: 'max',
            };

            if (continueParams) {
                Object.assign(params, continueParams);
            }

            try {
                const response = await api.get(params) as CategoryMembersResponse;

                if (!response.query || !response.query.pages) {
                    break;
                }

                if (response.query.normalized) {
                    for (const norm of response.query.normalized) {
                        titleMap.set(norm.to, titleMap.get(norm.from)!);
                    }
                }

                for (const pageKey in response.query.pages) {
                    const page = response.query.pages[pageKey];
                    const title = page.title;
                    const pageInfo = titleMap.get(title)!;
                    pageInfo.ns = page.ns;

                    if (!page || !page.categories) {
                        continue;
                    }

                    const newCategories = page.categories.map(
                        (cat) => cat.title
                    );

                    if (pageInfo.categories.length) {
                        pageInfo.categories.push(...newCategories);
                    } else {
                        pageInfo.categories = newCategories;
                    }
                }

                continueParams = response.continue || null;

            } catch (error) {
                console.error('Error fetching page categories:', error);
                throw error;
            }

        } while (continueParams !== null);
    }
}