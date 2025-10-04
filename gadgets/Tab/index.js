/**
 * Author: User:PetraMagna
 * License: CC BY-SA 4.0
 */

(function () {

    const DEBUG_MODE = window.location.href.includes("localhost:") || window.location.href.includes("safemode=");

    const allLabels = {}, allPanels = {};

    // specifies what to do after the user clicks on a sensei reply option
    function buttonClicked(group, num) {
        if (DEBUG_MODE) {
            console.log(`Group ${group} button ${num} clicked`);
        }
        const labels = allLabels[group];
        if (labels) {
            labels.forEach(l => {
                l.forEach((button, index) => {
                    if (index === num) {
                        button.classList.add("tab-button-selected");
                    } else {
                        button.classList.remove("tab-button-selected");
                    }
                });
            });
        }
        const panels = allPanels[group];
        if (panels) {
            panels.forEach(p => {
                p.forEach((panel, index) => {
                    if (index === num) {
                        panel.classList.remove("tab-panel-hidden");
                    } else {
                        panel.classList.add("tab-panel-hidden");
                    }
                });
            });
        }
    }

    function randomGroup() {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < 10; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    function tabMain() {
        const urlHash = window.location.hash;
        let defaultTab;
        if (urlHash && urlHash !== "") {
            defaultTab = urlHash.substring(1).replaceAll(' ', '_').replaceAll('%20', '_');
        }
        // Anonymous tab groups should be assigned a random group number
        document.querySelectorAll(".tab-group-container").forEach(
            (container) => {
                let group = container.dataset.group;
                if (group && group !== "") {
                    return;
                }
                group = randomGroup();
                Array.from(container.children).forEach((child, _) => {
                    child.dataset.group = group;
                });
            }
        );
        const defaultButtons = {};
        document.querySelectorAll(".tab-button-container").forEach(
            (container, _) => {
                const group = container.dataset.group;
                if (!group || group === "") {
                    console.log("Empty group found: ");
                    console.log(container);
                    return;
                }

                const buttons = [];
                container.querySelectorAll(":scope > .tab-button").forEach(
                    (button, index) => {
                        if (defaultTab && button.innerText.replaceAll(" ", "_") === defaultTab) {
                            defaultButtons[group] = index;
                        }
                        buttons.push(button);
                        button.addEventListener("click", (_) => {
                            buttonClicked(group, index);
                        });
                    }
                );

                if (!allLabels[group]) {
                    allLabels[group] = [];
                }
                allLabels[group].push(buttons);
            }
        );
        document.querySelectorAll(".tab-panel-container").forEach(
            (container, _) => {
                const group = container.dataset.group;
                if (!group || group === "") {
                    console.log("Empty group found: ");
                    console.log(container);
                    return;
                }

                const panels = [];
                container.querySelectorAll(":scope > .tab-panel").forEach(
                    (panel, _) => {
                        panels.push(panel);
                    }
                );

                if (!allPanels[group]) {
                    allPanels[group] = [];
                }
                allPanels[group].push(panels);
            }
        );

        for (const [k, v] of Object.entries(defaultButtons)) {
            buttonClicked(k, v);
        }

        if (DEBUG_MODE) {
            console.log("Found labels: ", allLabels);
            console.log("Found panels: ", allPanels);
        }
    }

    tabMain();
})();