import {state} from "./state";
import {getSiteInfo} from "../utils/mw_api";

export interface UserGroup {
    name: string;
    rights: string[];
}

export function getAllUserGroups() {
    return state.cache.userGroups;
}

export function getAllUserRights(userGroups: UserGroup[]) {
    return new Set(userGroups.flatMap(group => group.rights));
}

let userGroupPromise: Promise<UserGroup[]> | undefined = undefined;

export async function fetchAllUserGroups() {
    if (state.cache.userGroups !== undefined) {
        return getAllUserGroups();
    }
    if (userGroupPromise !== undefined) {
        return userGroupPromise;
    }
    userGroupPromise = (async () => {
        const siteInfo = await getSiteInfo();
        const groups = siteInfo.query.usergroups;
        state.cache.userGroups = groups;
        state.cache.allUserRights = getAllUserRights(groups);
        return groups;
    })();
    return userGroupPromise;
}
