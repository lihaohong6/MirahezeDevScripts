import {Bot, BotConfigurationDialog, BotResult} from "./bot";
import {LogSeverity} from "../utils/progress_window";
import {PageInfo} from "../models/page";
import {InputType} from "../utils/input_dialog";
import {API} from "../utils/mw_api";

interface XmlDumpState {
    pageData: PageData[];
    currentDumpIndex: number;
    currentSizeBytes: number;
}

interface XmlDumpOptions {
    pages: string[];
    fullHistory: string;
    targetSizeMB: number;
}

interface RevisionData {
    revid: number;
    parentid: number;
    timestamp: string;
    user: string;
    comment: string;
    content: string;
    contentmodel: string;
    contentformat: string;
}

interface PageData {
    title: string;
    ns: number;
    pageid: number;
    revisions: RevisionData[];
}

type ApiRevision = {
    revid: number;
    parentid?: number;
    timestamp: string;
    user?: string;
    comment?: string;
    slots?: {
        main?: {
            "*": string;
            contentmodel?: string;
            contentformat?: string;
        };
    };
};

type ApiPage = {
    pageid: number;
    ns: number;
    title: string;
    revisions?: ApiRevision[];
};

type RevisionQueryResponse = {
    query?: {
        pages: Record<string, ApiPage>;
    };
    continue?: {
        rvcontinue: string;
    };
};

function escapeXml(str: string | undefined): string {
    if (!str) {
        return "";
    }
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function formatTimestamp(timestamp: string): string {
    return timestamp.replace("Z", "+00:00");
}

function estimateXmlSize(pages: PageData[]): number {
    // Do some very inaccurate math about the size of this
    let size = 500;
    for (const page of pages) {
        size += page.title.length * 2 + 100;
        for (const rev of page.revisions) {
            size += rev.content.length + rev.user.length + rev.comment.length + 500;
        }
    }
    return size;
}

function parseRevision(rev: ApiRevision): RevisionData {
    return {
        revid: rev.revid,
        parentid: rev.parentid ?? 0,
        timestamp: rev.timestamp,
        user: rev.user ?? "",
        comment: rev.comment ?? "",
        content: rev.slots?.main?.["*"] ?? "",
        contentmodel: rev.slots?.main?.contentmodel ?? "wikitext",
        contentformat: rev.slots?.main?.contentformat ?? "text/x-wiki",
    };
}

async function fetchRevisions(pages: PageInfo[], fullHistory: boolean): Promise<PageData[]> {
    const results: PageData[] = [];

    for (const page of pages) {
        const baseParams: Record<string, string> = {
            action: "query",
            titles: page.title,
            prop: "revisions",
            rvslots: "main",
            rvprop: "ids|timestamp|user|comment|content|contentmodel|contentformat",
            rvlimit: fullHistory ? "max" : "1",
        };

        const allRevisions: RevisionData[] = [];
        let pageData: Omit<PageData, "revisions"> | undefined;
        let continueToken: string | undefined;

        do {
            const params = continueToken ? {...baseParams, rvcontinue: continueToken} : baseParams;
            const response = await API.get(params) as RevisionQueryResponse;

            if (!response.query?.pages) break;

            for (const pageKey in response.query.pages) {
                const apiPage = response.query.pages[pageKey];
                if (!apiPage.revisions?.length) continue;

                if (!pageData) {
                    pageData = {title: apiPage.title, ns: apiPage.ns, pageid: apiPage.pageid};
                }
                allRevisions.push(...apiPage.revisions.map(parseRevision));
            }

            continueToken = fullHistory ? response.continue?.rvcontinue : undefined;
        } while (continueToken);

        if (pageData && allRevisions.length > 0) {
            results.push({...pageData, revisions: allRevisions});
        }
    }

    return results;
}

function generateXml(pages: PageData[]): string {
    const encoder = new TextEncoder();
    // Header doesn't really matter. Just put something in there.
    const lines: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.mediawiki.org/xml/export-0.11/ http://www.mediawiki.org/xml/export-0.11.xsd" version="0.11" xml:lang="en">',
        "  <siteinfo>",
        "    <sitename>MediaWiki</sitename>",
        "    <dbname>wiki</dbname>",
        "    <base>Main Page</base>",
        "    <generator>jswikibot by User:PetraMagna from Miraheze</generator>",
        "  </siteinfo>",
    ];

    for (const page of pages) {
        lines.push("  <page>");
        lines.push(`    <title>${escapeXml(page.title)}</title>`);
        lines.push(`    <ns>${page.ns}</ns>`);
        lines.push(`    <id>${page.pageid}</id>`);

        for (const rev of page.revisions) {
            lines.push("    <revision>");
            lines.push(`      <id>${rev.revid}</id>`);
            if (rev.parentid) {
                lines.push(`      <parentid>${rev.parentid}</parentid>`);
            }
            lines.push(`      <timestamp>${formatTimestamp(rev.timestamp)}</timestamp>`);
            lines.push("      <contributor>");
            lines.push(`        <username>${escapeXml(rev.user)}</username>`);
            lines.push("      </contributor>");
            if (rev.comment) {
                lines.push(`      <comment>${escapeXml(rev.comment)}</comment>`);
            }
            const bytes = encoder.encode(rev.content).length;
            lines.push(`      <text xml:space="preserve" bytes="${bytes}" model="${rev.contentmodel}" format="${rev.contentformat}">${escapeXml(rev.content)}</text>`);
            lines.push("    </revision>");
        }

        lines.push("  </page>");
    }

    lines.push("</mediawiki>");
    return lines.join("\n");
}

function downloadXml(xml: string, filename: string): void {
    const blob = new Blob([xml], {type: "application/xml"});
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
}

function generateXmlDump(state: XmlDumpState): void {
    const xml = generateXml(state.pageData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    const siteName = mw.config.get("wgSiteName") || "wiki";
    const filename = `${siteName}_dump_${state.currentDumpIndex}_${timestamp}.xml`;
    downloadXml(xml, filename);
    state.pageData = [];
    state.currentDumpIndex++;
    state.currentSizeBytes = 0;
}

export const xmlDumpBot: Bot<XmlDumpOptions, XmlDumpState> = new Bot({
    name: "XmlDumpBot",
    description: "Export pages as XML dump",
    batchSize: 1,
    processBatch: async (pages: PageInfo[], options: XmlDumpOptions, state: XmlDumpState) => {
        const fullHistory = options.fullHistory === "full";
        const targetSizeMB = options.targetSizeMB;
        const targetSizeBytes = targetSizeMB * 1024 * 1024;

        const pageData = await fetchRevisions(pages, fullHistory);

        if (!state.pageData) {
            state.pageData = [];
            state.currentDumpIndex = 0;
            state.currentSizeBytes = 0;
        }
        state.pageData.push(...pageData);
        state.currentSizeBytes += estimateXmlSize(pageData);

        const result: BotResult[] = [];

        if (targetSizeBytes > 0 && state.currentSizeBytes >= targetSizeBytes) {
            const batchSize = state.pageData.length;
            generateXmlDump(state);
            result.push({
                severity: LogSeverity.SUCCESS,
                message: `Dump ${state.currentDumpIndex} downloaded (${batchSize} page(s) in batch)`,
            });
        }

        result.unshift({
            severity: LogSeverity.SUCCESS,
            message: `Fetched ${pageData.length} page(s)`,
        });

        return result;
    },
    finalizePages: async (_: XmlDumpOptions, state: XmlDumpState) => {
        if (!state.pageData || state.pageData.length === 0) {
            return;
        }
        generateXmlDump(state);
    },
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "fullHistory",
                label: "History",
                type: InputType.SELECT,
                options: [
                    {data: "latest", label: "Latest revision only"},
                    {data: "full", label: "Full history"},
                ],
                defaultValue: "latest",
            },
            {
                key: "targetSizeMB",
                label: "Target dump size (MB)",
                type: InputType.NUMBER,
                defaultValue: "100",
                help: "The bot does not precisely calculate size. This number is only a rough estimate.",
            },
        ],
    }),
});
