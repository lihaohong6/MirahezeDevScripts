import { writeRolledUpGadgetImplementation } from '../dev-utils/build-orchestration.js';
import { PluginOption } from 'vite';
import { PluginContext } from 'rollup';
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
export default function createMwGadgetImplementation(gadgetsToBuild: GadgetDefinition[], noMinify: boolean = false): PluginOption {
  
  return {
    name: 'create-mw-gadget-implementation',
    enforce: 'post',
    apply: 'build',

    async writeBundle(this: PluginContext) {
      const wFn = writeRolledUpGadgetImplementation.bind(this);
      for (const gadget of gadgetsToBuild) {
        const gadgetImplementationFilePath = resolveDistGadgetsPath(gadget.name, 'gadget-impl.js');
        await wFn(gadgetImplementationFilePath, gadget, !noMinify);
        this.info(`✓ Created the MediaWiki gadget implementation ${gadget.name}/gadget-impl.js`);
      }
    },
  }
}