import { serveGadgets } from '../dev-utils/build-orchestration.js';
import { PluginOption } from 'vite';
import type { GadgetDefinition } from '../dev-utils/types.js';

/**
 * A Vite plugin that automatically generates the entrypoint (dist/load.js) 
 * to be loaded on the MediaWiki client.
 * 
 * @param gadgetsToBuildAtIntialState 
 * @param noRollup
 * @returns 
 */
export default function autogenerateEntrypoint(gadgetsToBuildAtIntialState: GadgetDefinition[], noRollup: boolean = false): PluginOption {
  
  return {
    name: 'autogenerate-entrypoint',
    enforce: 'post', // Enforce after Vite build plugins

    // Build Mode
    buildEnd() {
      const startTime = Date.now();
      this.info('Creating dist/load.js...');
      serveGadgets(gadgetsToBuildAtIntialState, !noRollup)
        .then(() => this.info(`Created dist/load.js in ${(Date.now() - startTime) / 1000} s`));
    },
  }
}