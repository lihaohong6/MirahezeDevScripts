/**
 * Author: User:PetraMagna
 * License: CC BY-SA 4.0
 */

(function () {

    const DEBUG_MODE = window.location.href.includes("localhost:") || window.location.href.includes("safemode=");

    const allButtons = {}, allPanels = {};

    // specifies what to do after the user clicks on a sensei reply option
    function selectTab(group, option) {
        if (DEBUG_MODE) {
            console.log(`Group ${group} option ${option} clicked`);
        }
        const buttons = allButtons[group] || [];
        for (const {el, option: buttonOption} of buttons) {
            el.classList.toggle("tab-button-selected", buttonOption === option);
        }
        const panels = allPanels[group] || [];
        for (const {el, option: panelOption} of panels) {
            el.classList.toggle("tab-panel-hidden", panelOption !== option);
        }
    }

    function randomGroup() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array
            .from(
                {length: 10},
                () => chars[Math.floor(Math.random() * chars.length)])
            .join('');
    }

    // Get group name for a tab element, possibly inherited from a parent
    function getGroup(el) {
        return el.dataset.group || el.closest("[data-group]")?.dataset.group || null;
    }

    function initTabs() {
        const urlHash = window
            .location
            .hash
            ?.substring(1)
            ?.replaceAll(' ', '_')
            .replaceAll('%20', '_');
        // Anonymous tab groups should be assigned a random group number
        document.querySelectorAll(".tab-group-container").forEach((container) => {
            let group = container.dataset.group || randomGroup();
            // Propagate data-group to direct children if they don’t have it
            container.querySelectorAll(".tab-button, .tab-panel")
                .forEach((child) => {
                    if (!child.dataset.group) {
                        child.dataset.group = group;
                    }
                });
        });

        document.querySelectorAll(".tab-button-container, .tab-panel-container").forEach((container) => {
            container.querySelectorAll(".tab-button, .tab-panel").forEach((elem, index) => {
                if (!elem.dataset.option) {
                    elem.dataset.option = index;
                }
            });
        });

        const defaultButtons = {};
        document.querySelectorAll(".tab-button").forEach((button) => {
            const group = getGroup(button);
            if (!group) {
                return;
            }

            const option = button.dataset.option;
            const name = button.textContent.trim();
            if (!option) {
                return;
            }

            if (!allButtons[group]) {
                allButtons[group] = [];
            }
            allButtons[group].push({option: option, el: button});

            if (urlHash && name.replaceAll(" ", "_") === urlHash) {
                defaultButtons[group] = option;
            }

            button.addEventListener("click", () => selectTab(group, option));
        });

        document.querySelectorAll(".tab-panel").forEach((panel) => {
            const group = getGroup(panel);
            if (!group) {
                return;
            }

            const option = panel.dataset.option;
            if (!option) {
                return;
            }

            if (!allPanels[group]) {
                allPanels[group] = [];
            }
            allPanels[group].push({option: option, el: panel});
        });

        for (const [k, v] of Object.entries(defaultButtons)) {
            selectTab(k, v);
        }

        if (DEBUG_MODE) {
            console.log("Found buttons: ", allButtons);
            console.log("Found panels: ", allPanels);
        }
    }

    initTabs();
})();