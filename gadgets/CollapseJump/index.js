(function () {

    function collapseJump() {
        function processText(original) {
            return original.trim().replace(/ /g, "_");
        }

        function jumpToLabel(label) {
            const parent = label.parentElement;
            if (!parent.classList.contains("mw-collapsible-toggle-expanded")) {
                $(parent.parentElement).data('mw-collapsible').expand();
            }
            label.scrollIntoView({behavior: 'smooth', block: 'center'});
        }

        let urlHash = window.location.hash;
        if (!urlHash) {
            return;
        }
        urlHash = decodeURIComponent(urlHash.slice(1));
        urlHash = processText(urlHash);
        const labels = document.getElementsByClassName("template-collapse-label");
        for (let label of labels) {
            let compare = []
            let hash = label.dataset.hash;
            if (hash && hash !== "") {
                compare.push(processText(hash));
            }
            compare.push(processText(label.textContent));
            if (compare.indexOf(urlHash) >= 0) {
                jumpToLabel(label);
                break;
            }
        }
    }

    mw.hook('wikipage.collapsibleContent').add(collapseJump);

    window.addEventListener('hashchange', collapseJump)
})();