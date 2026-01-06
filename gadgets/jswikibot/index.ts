import {getAllNamespacesAsync} from "./models/namespace";
import {runBotSelector} from "./bot_selector";
import {loadConfig} from "./config";

(function() {

    async function prep() {
        const p1 = getAllNamespacesAsync();
        loadConfig();
        return Promise.all([p1]);
    }

    async function start() {
        // Don't await for faster startup. This may cause some race conditions though.
        prep();
        runBotSelector();
    }


    const specialPageName = 'jswikibot';
    if (mw.config.get('wgNamespaceNumber') === -1 && mw.config.get('wgTitle').toLowerCase() === specialPageName) {
        start();
    }
    const id = 'toolbar-jswikibot';
    mw.util.addPortletLink( 'p-tb', `/wiki/Special:${specialPageName}`, 'jswikibot', id);
    document.getElementById(id)?.addEventListener("click", async (e: PointerEvent) => {
        e.preventDefault();
        await start();
    });
})();
