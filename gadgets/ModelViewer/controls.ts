/**
 * Control widgets.
 *
 * The parser strips `<canvas>`, `<input>` and `<select>` out of wikitext, so the
 * wikitext names the widgets it wants in `data-controls` on an empty div and
 * they are built here, as in `Template:StatCalc/control`.
 */

import type { Viewer, ShadingMode } from './viewer';
import type { AnimEntry } from './animation';

const DEFAULT_LABELS: Record<string, string> = {
    model: 'Model',
    anim: 'Animation',
    play: 'Play',
    scrub: 'Position',
    speed: 'Speed',
    loop: 'Loop',
    outline: 'Outline',
    'outline-width': 'Outline width',
    'outline-color': 'Outline colour',
    autorotate: 'Auto-rotate',
    shading: 'Shading',
    grid: 'Grid',
    reset: 'Reset view',
    fullscreen: 'Fullscreen',
};

const SCRUB_STEPS = 1000;

/**
 * The widgets are Codex CSS-only components, so they inherit MediaWiki's own
 * light and dark palettes.
 *
 * `codex-styles` is pulled at build time, not declared as a gadget dependency:
 * the gadget is evaluated on every page view, and only pages with a viewer
 * should pay for the stylesheet. Without it the browser's own controls show.
 */
let codexStyles: Promise<unknown> | null = null;

export function ensureCodexStyles(): void {
    if (codexStyles) {
        return;
    }
    try {
        codexStyles = Promise.resolve(mw.loader.using('codex-styles'))
            .catch((error) => mw.log.warn('[ModelViewer] codex-styles unavailable', error));
    } catch (error) {
        codexStyles = Promise.resolve();
        mw.log.warn('[ModelViewer] codex-styles unavailable', error);
    }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Drawn, not typed: the transport glyphs (▶ and ❚❚) are at the mercy of
 * whichever font supplies them, and U+275A's bars come out hairline thin.
 */
const ICON_PATHS = {
    play: 'M5 3.5v13l11-6.5z',
    pause: 'M5 3.5h3.5v13H5zm6.5 0H15v13h-3.5z',
};

function icon(name: keyof typeof ICON_PATHS): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'model-viewer-icon');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    // Codex colours the button's text, so the icon follows into dark and disabled.
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', ICON_PATHS[name]);
    svg.appendChild(path);
    return svg;
}

/** A Codex CSS-only button. */
export function button(row: HTMLElement, ...modifiers: string[]): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = ['cdx-button', 'model-viewer-button', ...modifiers].join(' ');
    row.appendChild(element);
    return element;
}

interface Widget {
    /** Called once the model is in the scene. */
    ready?: () => void;
    /** Called each rendered frame. */
    frame?: () => void;
}

export class ControlPanels {
    private widgets: Widget[] = [];
    private labels: Record<string, string>;

    constructor(
        private viewer: Viewer,
        panels: HTMLElement[],
        labelOverrides: Record<string, string>,
    ) {
        this.labels = { ...DEFAULT_LABELS, ...labelOverrides };
        for (const panel of panels) {
            this.build(panel);
        }
    }

    private build(panel: HTMLElement): void {
        panel.classList.add('model-viewer-controls');
        const names = (panel.dataset.controls || '')
            .split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
        for (const name of names) {
            const builder = BUILDERS[name];
            if (!builder) {
                mw.log.warn(`[ModelViewer] unknown control "${name}"`);
                continue;
            }
            const row = document.createElement('div');
            row.className = `model-viewer-control model-viewer-control-${name}`;
            panel.appendChild(row);
            this.widgets.push(builder(row, this.viewer, this.labels[name] ?? name));
        }
    }

    ready(): void {
        for (const widget of this.widgets) {
            widget.ready?.();
        }
    }

    frame(): void {
        for (const widget of this.widgets) {
            widget.frame?.();
        }
    }
}

function addLabel(row: HTMLElement, text: string, control: HTMLElement): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'model-viewer-control-label';
    label.textContent = text;
    if (!control.id) {
        control.id = `mv-control-${Math.random().toString(36).slice(2, 9)}`;
    }
    label.htmlFor = control.id;
    row.appendChild(label);
    row.appendChild(control);
    return label;
}

/**
 * The Codex CSS-only checkbox hides the real input and paints a sibling span
 * in its place, so the nesting below is not decorative.
 */
function checkbox(
    row: HTMLElement,
    text: string,
    checked: boolean,
    onChange: (on: boolean) => void,
): HTMLInputElement {
    const field = document.createElement('span');
    field.className = 'cdx-checkbox cdx-checkbox--inline';
    const wrapper = document.createElement('span');
    wrapper.className = 'cdx-checkbox__wrapper';
    field.appendChild(wrapper);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'cdx-checkbox__input';
    input.id = `mv-control-${Math.random().toString(36).slice(2, 9)}`;
    input.checked = checked;
    input.disabled = true;
    wrapper.appendChild(input);

    const box = document.createElement('span');
    box.className = 'cdx-checkbox__icon';
    wrapper.appendChild(box);

    const labelBox = document.createElement('div');
    labelBox.className = 'cdx-checkbox__label cdx-label';
    const label = document.createElement('label');
    label.className = 'cdx-label__label';
    label.htmlFor = input.id;
    const caption = document.createElement('span');
    caption.className = 'cdx-label__label__text';
    caption.textContent = text;
    label.appendChild(caption);
    labelBox.appendChild(label);
    wrapper.appendChild(labelBox);

    row.appendChild(field);
    input.addEventListener('change', () => onChange(input.checked));
    return input;
}

/**
 * Chrome has no pseudo-element for the filled part of a range input, so the
 * stylesheet draws it as a gradient stop that this keeps in step.
 */
function paintSlider(input: HTMLInputElement): void {
    const min = Number(input.min);
    const max = Number(input.max);
    const fraction = max > min ? (Number(input.value) - min) / (max - min) : 0;
    input.style.setProperty('--mv-fill', `${(fraction * 100).toFixed(2)}%`);
}

/** Codex has no range component, so this one is styled by the gadget. */
function slider(min: number, max: number, value: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'model-viewer-slider';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.disabled = true;
    input.addEventListener('input', () => paintSlider(input));
    paintSlider(input);
    return input;
}

type Builder = (row: HTMLElement, viewer: Viewer, label: string) => Widget;

const BUILDERS: Record<string, Builder> = {
    model(row, viewer, label) {
        const select = document.createElement('select');
        select.className = 'cdx-select model-viewer-select';
        select.disabled = true;
        addLabel(row, label, select);
        const note = document.createElement('span');
        note.className = 'model-viewer-note';
        row.appendChild(note);

        select.addEventListener('change', () => {
            void viewer.loadModelEntry(Number(select.value));
        });

        function sync(): void {
            const index = String(viewer.currentModelIndex);
            if (select.value !== index) {
                select.value = index;
            }
            const status = viewer.modelLoading ? 'loading…' : '';
            if (note.textContent !== status) {
                note.textContent = status;
            }
        }

        return {
            ready() {
                // A single-model viewer has nothing to switch between.
                if (viewer.models.length < 2) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                select.replaceChildren();
                viewer.models.forEach((entry, index) => {
                    select.appendChild(option(String(index), entry.name));
                });
                select.disabled = false;
                sync();
            },
            frame: sync,
        };
    },

    anim(row, viewer, label) {
        const select = document.createElement('select');
        select.className = 'cdx-select model-viewer-select';
        select.disabled = true;
        addLabel(row, label, select);
        const note = document.createElement('span');
        note.className = 'model-viewer-note';
        row.appendChild(note);

        select.addEventListener('change', () => {
            void viewer.playAnim(Number(select.value));
            sync();
        });

        function sync(): void {
            const animation = viewer.animation;
            if (!animation) {
                return;
            }
            const index = String(animation.currentIndex);
            if (select.value !== index) {
                select.value = index;
            }
            // An external clip's duration arrives with its file, so relabel then.
            const entry = animation.entries[animation.currentIndex];
            const chosen = select.selectedOptions[0];
            if (entry && chosen && chosen.textContent !== entryLabel(entry)) {
                chosen.textContent = entryLabel(entry);
            }
            const status = animation.loading ? 'loading…' : '';
            if (note.textContent !== status) {
                note.textContent = status;
            }
        }

        return {
            ready() {
                const animation = viewer.animation;
                if (!animation?.available) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                // Rebuilt on every model switch, so the old options go first.
                select.replaceChildren();
                select.appendChild(option('-1', 'Bind pose'));
                animation.entries.forEach((entry, index) => {
                    select.appendChild(option(String(index), entryLabel(entry)));
                });
                select.disabled = false;
                sync();
            },
            frame: sync,
        };
    },

    play(row, viewer, label) {
        const control = button(row, 'cdx-button--icon-only');
        control.title = label;
        control.appendChild(icon('play'));
        control.disabled = true;
        control.addEventListener('click', () => {
            const animation = viewer.animation;
            if (!animation) {
                return;
            }
            // Nothing is loaded until a clip is chosen, so the first press starts one.
            if (!animation.active) {
                void viewer.playAnim(0);
            } else {
                animation.setPlaying(!animation.playing);
            }
            sync();
        });
        let showingPause = false;
        function sync(): void {
            const playing = !!viewer.animation?.playing;
            if (playing !== showingPause) {
                showingPause = playing;
                control.replaceChildren(icon(playing ? 'pause' : 'play'));
            }
            control.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        }
        return {
            ready() {
                if (!viewer.animation?.available) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                control.disabled = false;
                sync();
            },
            frame: sync,
        };
    },

    scrub(row, viewer, label) {
        const input = slider(0, SCRUB_STEPS, 0);
        addLabel(row, label, input);
        const time = document.createElement('span');
        time.className = 'model-viewer-readout';
        time.textContent = '0.00 s';
        row.appendChild(time);

        let dragging = false;
        input.addEventListener('pointerdown', () => {
            dragging = true;
        });
        input.addEventListener('pointerup', () => {
            dragging = false;
        });
        input.addEventListener('input', () => {
            viewer.animation?.setPlaying(false);
            viewer.animation?.seek(Number(input.value) / SCRUB_STEPS);
            update();
        });

        function update(): void {
            const animation = viewer.animation;
            if (!animation) {
                return;
            }
            time.textContent = `${animation.time.toFixed(2)} / `
                + `${animation.duration.toFixed(2)} s`;
        }
        return {
            ready() {
                if (!viewer.animation?.available) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                input.disabled = false;
                update();
            },
            frame() {
                const animation = viewer.animation;
                if (!animation?.duration || dragging) {
                    return;
                }
                input.value = String(
                    Math.round(animation.time / animation.duration * SCRUB_STEPS));
                paintSlider(input);
                update();
            },
        };
    },

    speed(row, viewer, label) {
        const input = slider(0, 200, viewer.animation?.speed ?? 100);
        addLabel(row, label, input);
        const readout = document.createElement('span');
        readout.className = 'model-viewer-readout';
        row.appendChild(readout);
        function update(): void {
            readout.textContent = `${input.value}%`;
        }
        input.addEventListener('input', () => {
            viewer.setSpeed(Number(input.value));
            update();
        });
        update();
        return {
            ready() {
                if (!viewer.animation?.available) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                input.value = String(viewer.animation.speed);
                input.disabled = false;
                paintSlider(input);
                update();
            },
        };
    },

    loop(row, viewer, label) {
        const input = checkbox(row, label, true, (on) => viewer.setLoop(on));
        return {
            ready() {
                if (!viewer.animation?.available) {
                    row.hidden = true;
                    return;
                }
                row.hidden = false;
                input.checked = viewer.animation.loop;
                input.disabled = false;
            },
        };
    },

    outline(row, viewer, label) {
        viewer.requestOutlineSupport();
        const input = checkbox(row, label, viewer.outlineSettings.enabled,
            (on) => viewer.applyOutline({ enabled: on }));
        return {
            ready() {
                input.checked = viewer.outlineSettings.enabled;
                input.disabled = false;
            },
        };
    },

    'outline-width': (row, viewer, label) => {
        viewer.requestOutlineSupport();
        const input = slider(0, 400, viewer.outlineSettings.width);
        addLabel(row, label, input);
        const readout = document.createElement('span');
        readout.className = 'model-viewer-readout';
        readout.textContent = `${input.value}%`;
        row.appendChild(readout);
        input.addEventListener('input', () => {
            viewer.applyOutline({ width: Number(input.value) });
            readout.textContent = `${input.value}%`;
        });
        return {
            ready() {
                input.disabled = false;
            },
        };
    },

    'outline-color': (row, viewer, label) => {
        viewer.requestOutlineSupport();
        const input = document.createElement('input');
        input.type = 'color';
        input.className = 'model-viewer-color';
        input.value = viewer.outlineSettings.color;
        input.disabled = true;
        addLabel(row, label, input);
        input.addEventListener('input', () => viewer.applyOutline({ color: input.value }));
        return {
            ready() {
                input.disabled = false;
            },
        };
    },

    autorotate(row, viewer, label) {
        const input = checkbox(row, label, viewer.settings.autorotate,
            (on) => viewer.setAutoRotate(on));
        return {
            ready() {
                input.checked = viewer.settings.autorotate;
                input.disabled = false;
            },
        };
    },

    shading(row, viewer, label) {
        const select = document.createElement('select');
        select.className = 'cdx-select model-viewer-select';
        select.disabled = true;
        addLabel(row, label, select);
        select.appendChild(option('shaded', 'Shaded'));
        select.appendChild(option('unlit', 'Unlit'));
        select.appendChild(option('wireframe', 'Wireframe'));
        select.addEventListener('change', () => {
            viewer.applyShading(select.value as ShadingMode);
        });
        return {
            ready() {
                select.value = viewer.settings.shading;
                select.disabled = false;
            },
        };
    },

    grid(row, viewer, label) {
        const input = checkbox(row, label, viewer.settings.grid,
            (on) => viewer.setGrid(on));
        return {
            ready() {
                input.checked = viewer.settings.grid;
                input.disabled = false;
            },
        };
    },

    reset(row, viewer, label) {
        const control = button(row);
        control.textContent = label;
        control.disabled = true;
        control.addEventListener('click', () => viewer.resetCamera());
        return {
            ready() {
                control.disabled = false;
            },
        };
    },

    fullscreen(row, _viewer, label) {
        const control = button(row);
        control.textContent = label;
        control.addEventListener('click', () => {
            const target = row.closest('.model-viewer') as HTMLElement | null;
            if (!target) {
                return;
            }
            if (document.fullscreenElement === target) {
                document.exitFullscreen();
            } else {
                target.requestFullscreen?.();
            }
        });
        return {};
    },
};

/** `103_Ready · 2.13s`, or just the name until the duration is known. */
function entryLabel(entry: AnimEntry): string {
    if (entry.failed) {
        return `${entry.name} · unavailable`;
    }
    return entry.duration ? `${entry.name} · ${entry.duration.toFixed(2)}s` : entry.name;
}

function option(value: string, text: string): HTMLOptionElement {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = text;
    return element;
}
