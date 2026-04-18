import { createRolledUpGadgetImplementation } from '../dev-utils/build-orchestration.js';
import { PluginOption } from 'vite';
import type { OutputChunk, OutputAsset } from 'rolldown';
import { resolveDistGadgetsPath } from '../dev-utils/utils.js';
import type { GadgetDefinition } from '../dev-utils/types.js';

type RolldownMinifyOptions = boolean | 'esbuild' | 'oxc' | 'terser';

/**
 * A Vite plugin that creates the gadget implementation code (i.e. scripts
 * and stylesheets wrapped in mw.loader.impl) for each gadget that has been compiled, 
 * built, and placed in the dist/ directory. 
 * 
 * @param gadgetsToBuild
 * @returns
 */
export default function createMwGadgetImplementation(gadgetsToBuild: readonly GadgetDefinition[]): PluginOption {
  let rolldownMinify: RolldownMinifyOptions = false;

  return {
    name: 'create-mw-gadget-implementation',
    enforce: 'post',
    apply: 'build',

    config(config) {
      rolldownMinify = (config.build && config.build.minify) || false;
      // When `npm run build` is run without `--no-rollup` (i.e. create a gadget-impl.js file), 
      // we want to turn the JS minification off for each constituent JS & CSS
      // Minification happens later, and only for the gadget-impl.js file. 
      config.build = { ...(config.build || {}), minify: false };
    },
    async generateBundle(_, bundle) {
      for (const gadget of gadgetsToBuild) {
        const gadgetImplementationFilePath = resolveDistGadgetsPath(gadget.name, 'gadget-impl.js');
        this.emitFile({
          code: await createRolledUpGadgetImplementation({
            gadget, 
            gadgetImplementationFilePath,
            outputChunk: bundle[`${gadget.name}/index.js`] as OutputChunk | undefined,
            outputAsset: bundle[`${gadget.name}/style.css`] as OutputAsset | undefined,
            rolldownMinify,
            buildConfig: this.environment.getTopLevelConfig(),
          }),
          fileName: `${gadget.name}/gadget-impl.js`,
          type: 'prebuilt-chunk'
        });
      }
    },
  }
}