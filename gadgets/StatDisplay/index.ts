import {calculate} from '../utils/math-eval/math-eval';

(function () {

    const DEBUG_MODE =
        ['localhost:', 'safemode=', 'action=submit']
        .some((str) => window.location.href.includes(str));

    const DEFAULT_CONTROLLER_NAME = "main";

    function debounce<T extends (...args: never[]) => void>(
        func: T,
        delay: number
    ): (...args: Parameters<T>) => void {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        return function(this: never, ...args: Parameters<T>): void {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function showElementIndex(el: HTMLElement, indices: Map<string, number>) {
        const data: Map<string, string> = new Map();
        indices.forEach((index, key) => {
            for (const i of ['', '1', '2', '3', '4', '5']) {
                const attr = `data-${key}${i}-values`;
                const rawValues = el.getAttribute(attr);
                if (rawValues) {
                    const values = rawValues.split(',');
                    const val = values[index] || "";
                    data.set(key + i, val);
                }
            }
        });
        if (DEBUG_MODE) {
            console.log("Parsed data: ", data);
        }
        if (data.size == 1) {
            el.textContent = data.values().next().value;
            return;
        } else if (data.size > 1) {
            let formula = el.getAttribute("data-formula");
            if (!formula) {
                return;
            }
            const entries = Array.from(data.entries())
            const reversedEntries = entries
                .slice()
                .sort(([k1, ], [k2, ]) => k2.length - k1.length);
            for (const [k, v] of reversedEntries) {
                formula = formula?.replaceAll(k, v);
            }
            if (DEBUG_MODE) {
                console.log("Entries", entries);
                console.log("New formula", formula);
            }
            const precision = parseInt(el.getAttribute("data-precision") || "0") || 0;
            const value = calculate(formula).toFixed(precision);
            el.textContent = value.toString();
            el.title = entries
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
                + "\n" + formula;
            return;
        }
        for (const [key, index] of indices.entries()) {
            const attr = `data-${key}-children`;
            const childIndices = el.getAttribute(attr);
            if (!childIndices) {
                continue;
            }
            const values = childIndices.split(',');
            let target = parseInt(values[index]) || 0;
            target -= 1;
            const children = Array.from(el.children);
            children.forEach((child: HTMLElement, index) => {
                if (index === target) {
                    child.style.display = "";
                } else {
                    child.style.display = "none";
                }
            });
            return;
        }
    }

    const initStatDisplay = (container: HTMLElement) => {
        const selectedIndices: Map<string, number> = new Map();

        const controllers = container.querySelectorAll(".stat-controls");
        if (controllers.length === 0) {
            return;
        }
        if (DEBUG_MODE) {
            console.log("Controllers found: ", controllers);
        }
        for (const controller of controllers) {
            const levels = controller
                .getAttribute('data-levels')
                ?.split(',')
                ?.map(val => (val || "").trim())
                ?.filter(val => val && val !== "");
            if (!levels) {
                return;
            }

            const slider = document.createElement("input");
            slider.type = "range";
            slider.classList.add("stat-slider");
            slider.min = "0";
            slider.max = (levels.length - 1).toString();
            slider.value = "0";
            controller.appendChild(slider);

            const input = document.createElement("input");
            input.type = "text";
            input.classList.add("stat-input");
            controller.appendChild(input);

            const key = controller.getAttribute("data-name") || DEFAULT_CONTROLLER_NAME;

            const updateInputs = (index: number) => {
                index = Math.max(0, Math.min(index, levels.length - 1));
                selectedIndices.set(key, index);
                if (slider) {
                    slider.value = index.toString();
                }
                if (input) {
                    input.value = levels[index].toString();
                }
            };

            const indexUpdated = (index: number, doDebounce: boolean = false) => {
                updateInputs(index);
                if (doDebounce) {
                    debounce(updateUI, 5)();
                } else {
                    updateUI()
                }
            };

            slider.addEventListener('input', (e: InputEvent) => {
                const target = e.currentTarget as HTMLInputElement;
                const value = parseInt(target.value);
                // When the slider is dragged, it may introduce an excessive amount of UI updates. Throttle it if
                // the impact is significant.
                indexUpdated(value, false);
            });

            input.addEventListener('change', (e) => {
                const target = e.currentTarget as HTMLInputElement;
                const val = target.value.trim();
                const index = levels.indexOf(val);
                if (index !== -1) {
                    indexUpdated(index);
                } else {
                    indexUpdated(parseInt(slider.value));
                }
            });

            updateInputs(0);
        }

        const updates = container.querySelectorAll('.stat-value');

        function updateUI() {
            updates.forEach((el: HTMLElement) => showElementIndex(el, selectedIndices));
        }

        updateUI();
    }

    const containers = document.querySelectorAll('.stat-display');
    containers.forEach(initStatDisplay);
})();