import { createRolledUpGadgetImplementation } from '../dev-utils/build-orchestration.js';
import { PluginOption } from 'vite';
import { resolveDistGadgetsPath } from '../dev-utils/utils.js';
import type { GadgetDefinition } from '../dev-utils/types.js';

/**
 * A Vite plugin that creates the gadget implementation code (i.e. scripts
 * and stylesheets wrapped in mw.loader.impl) for each gadget that has been compiled, 
 * built, and placed in the dist/ directory. 
 * 
 * @param gadgetsToBuild
 * @param minify
 * @returns
 */
export default function createMwGadgetImplementation(gadgetsToBuild: GadgetDefinition[], minify: boolean = true): PluginOption {
  
  return {
    name: 'create-mw-gadget-implementation',
    enforce: 'post',
    apply: 'build',

    async generateBundle(_, bundle) {
      for (const gadget of gadgetsToBuild) {
        const gadgetImplementationFilePath = resolveDistGadgetsPath(gadget.name, 'gadget-impl.js');
        this.emitFile({
          code: await createRolledUpGadgetImplementation(gadgetImplementationFilePath, bundle, gadget, minify),
          fileName: `gadgets/${gadget.name}/gadget-impl.js`,
          type: 'prebuilt-chunk'
        });
      }
    },
  }
}