import {getAllNamespacesAsync} from "./models/namespace";
import {runBotSelector} from "./bot_selector";
import {loadConfig} from "./config";
import {fetchUserRights} from "./models/user_right";
import {fetchAllUserGroups} from "./models/user_group";

(function() {

    async function prep() {
        loadConfig();
        return Promise.all([getAllNamespacesAsync(), fetchUserRights(), fetchAllUserGroups()]);
    }

    async function start() {
        // Don't await for faster startup. This may cause some race conditions though.
        await prep();
        runBotSelector();
    }


    const specialPageName = 'jswikibot';
    if (mw.config.get('wgNamespaceNumber') === -1 && mw.config.get('wgTitle').toLowerCase() === specialPageName) {
        start();
    }
    const id = 'toolbar-jswikibot';
    mw.util.addPortletLink( 'p-tb', mw.util.getUrl(`Special:${specialPageName}`), 'jswikibot', id);
    document.getElementById(id)?.addEventListener("click", async (e: PointerEvent) => {
        e.preventDefault();
        await start();
    });
})();
