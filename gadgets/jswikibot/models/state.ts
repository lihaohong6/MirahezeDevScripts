import {Namespace} from "./namespace";
import {PageInfo} from "./page";

class Cache {
    namespaces: Namespace[] = [];
    cachedPageInfo: Record<string, PageInfo> = {};
}

export class Config {
    debug: boolean = false;
    summaryBot: string = "[[meta:User:PetraMagna/jswikibot|bot]]"
    // In seconds
    readThrottle: number = 0.2;
    writeThrottle: number = 1;
}

class State {
    cache: Cache = new Cache();
    config: Config = new Config();
}

export const state = new State();

export function isDebugMode() {
    return state.config.debug;
}

export function cachePageInfo(pageInfo: PageInfo) {
    state.cache.cachedPageInfo[pageInfo.title] = pageInfo;
}

export function getCachedPageInfo(title: string) {
    return state.cache.cachedPageInfo[title];
}

export function clearCachedPageInfo() {
    state.cache.cachedPageInfo = {};
}

