(function () {

    const body = document.querySelector("body.skin-vector-legacy");
    if (!body) {
        mw.log.error("The responsive vector script should only be applied to vector legacy.");
        return;
    }
    let sidebarVisible = false;
    body.classList.add("gadget-sidebar-hidden");

    function toggleSidebar() {
        if (sidebarVisible) {
            body.classList.remove("gadget-sidebar-visible");
            body.classList.add("gadget-sidebar-hidden");
        } else {
            body.classList.add("gadget-sidebar-visible");
            body.classList.remove("gadget-sidebar-hidden");
        }
        sidebarVisible = !sidebarVisible;
    }

    function createArrow() {
        const arrow = document.createElement('div');
        arrow.classList.add('arrow');
        arrow.classList.add('arrow-left');

        const arrowContainer = document.createElement('div');
        arrowContainer.classList.add('arrow-container');
        arrowContainer.appendChild(arrow);

        const panel = document.getElementById('mw-panel');
        panel.parentNode.appendChild(arrowContainer);

        arrowContainer.addEventListener("click", toggleSidebar);
    }

    createArrow();

})();