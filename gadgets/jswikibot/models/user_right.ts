import {state} from "./state";

export function getUserRights(): string[] | undefined {
    return state.cache.userRights;
}

let userRightsPromise: Promise<string[]> | null = null;

export async function fetchUserRights(): Promise<string[]> {
    const rights = getUserRights();
    if (rights && rights.length > 0) {
        return rights;
    }
    if (userRightsPromise !== null) {
        return userRightsPromise;
    }

    userRightsPromise = (async () => {
        const rights = await mw.user.getRights();
        state.cache.userRights = rights;
        return rights;
    })();

    return userRightsPromise;
}
