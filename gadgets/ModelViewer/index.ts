/**
 * ModelViewer: turns a `.model-viewer` div emitted by wikitext into an
 * interactive 3D viewer.
 *
 * All that runs on an ordinary page view, so keep it small. three.js and its
 * loaders come from a CDN import map, fetched only when a viewer is about to be
 * shown; see ./three-cdn.ts.
 */

import { Viewer, ViewerOptions, ShadingMode } from './viewer';
import { button, ControlPanels, ensureCodexStyles } from './controls';
import { UnsupportedBrowserError } from './three-cdn';
import { resolveModelEntries } from './models';

declare global {
    interface HTMLElement {
        /**
         * The live `Viewer`, so other scripts can drive it:
         * `container.modelViewer?.setAutoRotate(true)`.
         */
        modelViewer?: Viewer;
    }
}

const DEBUG_MODE =
    ['localhost:', 'safemode=', 'action=submit']
    .some((str) => window.location.href.includes(str));

function bool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === '') {
        return fallback;
    }
    return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return value !== undefined && value !== '' && !Number.isNaN(parsed) ? parsed : fallback;
}

/** `data-labels="anim=Animation,speed=Rate"` */
function parseLabels(value: string | undefined): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const pair of (value || '').split(',')) {
        const at = pair.indexOf('=');
        if (at > 0) {
            labels[pair.slice(0, at).trim().toLowerCase()] = pair.slice(at + 1).trim();
        }
    }
    return labels;
}

function parseCamera(value: string | undefined): [number, number, number] | null {
    const parts = (value || '').split(',').map(Number);
    return parts.length === 3 && parts.every((part) => !Number.isNaN(part))
        ? [parts[0], parts[1], parts[2]]
        : null;
}

const SHADING_MODES: ShadingMode[] = ['shaded', 'unlit', 'wireframe'];

function parseShading(value: string | undefined): ShadingMode {
    const normalized = (value || '').trim().toLowerCase();
    return (SHADING_MODES as string[]).includes(normalized)
        ? normalized as ShadingMode
        : 'shaded';
}

function readOptions(element: HTMLElement): ViewerOptions {
    const data = element.dataset;
    return {
        src: (data.src || '').trim(),
        format: data.format || null,
        mtl: data.mtl || null,
        anim: data.anim || null,
        models: data.models || null,
        modelAnim: data.modelAnim || null,
        modelDefault: data.modelDefault || null,
        hideParts: data.hideParts || null,
        background: data.background || null,
        environment: (data.environment || 'neutral').toLowerCase(),
        toneMapping: (data.toneMapping || 'aces').toLowerCase(),
        exposure: num(data.exposure, 1),
        fov: num(data.fov, 35),
        camera: parseCamera(data.camera),
        autorotate: bool(data.autorotate, false),
        grid: bool(data.grid, false),
        shading: parseShading(data.shading),
        autoplay: bool(data.autoplay, true),
        animDefault: data.animDefault || null,
        loop: bool(data.loop, true),
        speed: num(data.speed, 100),
        outline: {
            enabled: bool(data.outline, false),
            width: num(data.outlineWidth, 100),
            color: data.outlineColor || '#000000',
        },
    };
}

/** Numbers mean pixels; anything else is passed through as a CSS length. */
function cssLength(value: string | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }
    return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value.trim();
}

function build(element: HTMLElement): void {
    const options = readOptions(element);
    ensureCodexStyles();

    // On the container rather than the stage, so the control rows wrap to the
    // same measure; `max-width: 100%` keeps an over-wide figure on the page.
    const width = cssLength(element.dataset.width, '');
    if (width) {
        element.style.width = width;
    }

    const stage = document.createElement('div');
    stage.className = 'model-viewer-stage';
    stage.style.height = cssLength(element.dataset.height, '400px');

    const canvas = document.createElement('canvas');
    canvas.className = 'model-viewer-canvas';
    stage.appendChild(canvas);

    const message = document.createElement('div');
    message.className = 'model-viewer-message';
    message.hidden = true;
    const caption = document.createElement('div');
    message.appendChild(caption);

    // Codex's progress bar reads its fill from a custom property, so a
    // determinate bar needs no other declaration.
    const progress = document.createElement('div');
    progress.className = 'cdx-progress-bar model-viewer-progress';
    progress.setAttribute('role', 'progressbar');
    progress.hidden = true;
    const bar = document.createElement('div');
    bar.className = 'cdx-progress-bar__bar';
    progress.appendChild(bar);
    message.appendChild(progress);

    stage.appendChild(message);

    // Control divs come from wikitext in their authored order; the stage goes first.
    element.insertBefore(stage, element.firstChild);

    const setStatus = (text: string, kind: 'info' | 'error' | 'none'): void => {
        caption.textContent = text;
        message.hidden = kind === 'none';
        message.classList.toggle('model-viewer-message-error', kind === 'error');
        if (kind !== 'info') {
            progress.hidden = true;
        }
        // Lets a downstream script watch load state without polling the Viewer.
        mw.hook('modelViewer.statusChange').fire(kind, text, element);
    };

    // Resolve, not just check: a malformed `data-models` should report this
    // error instead of leaving the viewer stuck loading.
    if (!options.src && (!options.models || !resolveModelEntries(options.models).length)) {
        setStatus('No model file was given (data-src and data-models are both empty).', 'error');
        return;
    }

    const viewer = new Viewer(element, canvas, options);
    element.modelViewer = viewer;
    const panels = new ControlPanels(
        viewer,
        Array.from(element.querySelectorAll<HTMLElement>('.model-viewer-controls')),
        parseLabels(element.dataset.labels),
    );
    viewer.onStatus = setStatus;
    viewer.onProgress = (fraction) => {
        progress.hidden = false;
        bar.classList.toggle('cdx-progress-bar__bar--determinate', fraction !== null);
        if (fraction === null) {
            progress.removeAttribute('aria-valuenow');
            return;
        }
        const percent = Math.round(fraction * 100);
        bar.style.setProperty('--cdx-progress-value', String(percent));
        progress.setAttribute('aria-valuenow', String(percent));
    };
    viewer.onReady = () => mw.hook('modelViewer.ready').fire(viewer, element);
    viewer.onFrame = () => panels.frame();
    viewer.onAnimChange = (index) => mw.hook('modelViewer.animChange').fire(viewer, index, element);
    // Every model load, including the first, unlike onReady. A switch rebuilds
    // the animation controller, so the widgets reflecting it follow.
    viewer.onModelChange = (index) => {
        panels.ready();
        mw.hook('modelViewer.modelChange').fire(viewer, index, element);
    };

    let mounted = false;
    const mount = (): void => {
        if (mounted) {
            return;
        }
        mounted = true;
        viewer.mount().catch((error: Error) => {
            if (error instanceof UnsupportedBrowserError) {
                setStatus(
                    'This browser cannot display 3D models. '
                    + 'Please use a current version of Chrome, Firefox, Edge or Safari.',
                    'error');
            } else if (!message.textContent) {
                setStatus(`Could not display the model: ${error.message}`, 'error');
            }
            if (DEBUG_MODE) {
                mw.log.error('[ModelViewer]', error);
            }
        });
    };

    const preload = (element.dataset.preload || 'visible').toLowerCase();
    if (preload === 'eager') {
        mount();
        return;
    }
    if (preload === 'click') {
        const load = button(stage,
            'cdx-button--action-progressive', 'cdx-button--weight-primary',
            'model-viewer-load');
        load.textContent = 'Load 3D model';
        load.addEventListener('click', () => {
            load.remove();
            mount();
        });
        return;
    }

    // Default: no fetch and no WebGL context until the viewer is on screen.
    // Browsers cap contexts at about sixteen per page.
    const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
            mount();
            viewer.start();
        } else if (mounted) {
            viewer.stop();
        }
    }, { rootMargin: '200px' });
    observer.observe(stage);
}

function init(content: JQuery | HTMLElement): void {
    const root = (content as JQuery).jquery ? (content as JQuery)[0] : content as HTMLElement;
    if (!root) {
        return;
    }
    const containers = Array.from(
        root.querySelectorAll<HTMLElement>('.model-viewer:not([data-mv-init])'));
    for (const container of containers) {
        container.dataset.mvInit = '1';
        try {
            build(container);
        } catch (error) {
            if (DEBUG_MODE) {
                mw.log.error('[ModelViewer]', error);
            }
        }
    }
    if (DEBUG_MODE && containers.length) {
        mw.log(`[ModelViewer] initialised ${containers.length} viewer(s)`);
    }
}

mw.hook('wikipage.content').add(init);
