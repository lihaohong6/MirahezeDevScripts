import {state} from "../models/state";
import {newErrorResult, Result} from "./result";

type UnknownApiParams = Record<
    string,
    string | number | boolean | File | string[] | number[] | undefined
>;

class ThrottleControl {
    lastRead: number = 0;
    lastWrite: number = 0;
}

class Api {

    private token?: string;
    private defaultParams: UnknownApiParams = {format: 'json'};
    private throttleControl: ThrottleControl = new ThrottleControl();

    constructor(private readonly api: mw.Api = new mw.Api()) {
    }

    async getToken(types: string | string[] = 'csrf'): Promise<string> {
        const type = typeof types === 'string' ? types : types.join('|');
        const res = await this.post({
            action: 'query',
            meta: 'tokens',
            type,
        });
        this.token = res.query.tokens;
        return this.token!;
    }

    private processParams(params: UnknownApiParams): void {
        for (const key in this.defaultParams) {
            if (key in params) {
                continue;
            }
            params[key] = this.defaultParams[key];
        }
    }

    private async throttle(read: boolean = true) {
        let sleepUntil;
        if (read) {
            sleepUntil = this.throttleControl.lastRead + state.config.readThrottle * 1000;
        } else {
            sleepUntil = this.throttleControl.lastWrite + state.config.writeThrottle * 1000;
        }
        let curTime = Date.now();
        if (sleepUntil > curTime) {
            await new Promise(r => setTimeout(r, sleepUntil - curTime));
            curTime = Date.now();
        }
        if (read) {
            this.throttleControl.lastRead = curTime;
        } else {
            this.throttleControl.lastWrite = curTime;
        }
    }

    async get(args: UnknownApiParams) {
        this.processParams(args);
        await this.throttle(true);
        return this.api.get(args);
    }

    async post(args: UnknownApiParams) {
        this.processParams(args);
        await this.throttle(false);
        return this.api.post(args);
    }

    async postWithToken(args: UnknownApiParams) {
        this.processParams(args);
        await this.throttle(false);
        args['token'] = this.token;
        return this.api.postWithToken('csrf', args)
    }
}

export const API = new Api();

export function formatSummary(summary: string, additionalParameters: Record<string, string> = {}): string {
    summary = summary.replace("$bot", state.config.summaryBot);
    for (const key in additionalParameters) {
        summary = summary.replace(`$${key}`, additionalParameters[key]);
    }
    return summary;
}

export async function purge(titles: string[],
                            api = API) {
    if (titles.length === 0) {
        return false;
    }
    if (titles.length > 50) {
        console.error("Cannot purge more than 50 pages at once");
        return false;
    }
    try {
        const result = await api.post({
            action: 'purge',
            titles: titles.join('|'),
        });
        return result.purge.length === titles.length;
    } catch (error) {
        console.error(`Failed to purge pages: ${titles} ${error}`);
        return false;
    }
}

export async function savePage(title: string,
                               text: string,
                               summary: string = "$bot: automated edit",
                               minor: boolean = true,
                               bot: boolean = true,
                               api: Api = API): Promise<boolean> {
    try {
        const result = await api.postWithToken({
            action: 'edit',
            title: title,
            text: text,
            summary: formatSummary(summary),
            minor: minor,
            bot: bot,
        });

        return result.edit?.result === 'Success';
    } catch (error) {
        console.error('Failed to save page:', title, error);
        return false;
    }
}

export async function deletePage(title: string, reason: string, deleteTalk: boolean = false, bot: boolean = true, api = API): Promise<Result<boolean>> {
    try {
        await api.postWithToken({
            action: 'delete',
            title: title,
            reason: formatSummary(reason),
            deletetalk: deleteTalk,
            bot: bot,
        });

        return {
            ok: true,
            value: true,
        }
    } catch (error) {
        console.error('Failed to delete page:', title, error);
        return newErrorResult(error.toString());
    }
}

export async function undeletePage(title: string, reason: string, undeleteTalk: boolean = false, bot: boolean = true, api = API): Promise<Result<boolean>> {
    try {
        await api.postWithToken({
            action: 'undelete',
            title: title,
            reason: formatSummary(reason),
            undeletetalk: undeleteTalk,
            bot: bot,
        });

        return {
            ok: true,
            value: true,
        }
    } catch (error) {
        console.error('Failed to undelete page:', title, error);
        return newErrorResult(error.toString());
    }
}
