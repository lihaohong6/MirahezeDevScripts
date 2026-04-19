import { serveGadgets } from '../dev-utils/build-orchestration.js';
import type { PluginOption } from 'vite';
import type { PluginContext } from 'rolldown';
import type { GadgetDefinition } from '../dev-utils/types.js';

/**
 * A Vite plugin that automatically generates the entrypoint (dist/load.js) 
 * to be loaded on the MediaWiki client.
 * 
 * @param gadgetsToBuildAtIntialState 
 * @param rollup
 * @returns 
 */
export default function autogenerateEntrypoint(gadgetsToBuildAtIntialState: readonly GadgetDefinition[], rollup: boolean = false): PluginOption {
  
  return {
    name: 'autogenerate-entrypoint',
    enforce: 'post', // Enforce after Vite build plugins

    buildEnd(this: PluginContext) {
      const startTime = Date.now();
      this.info('Creating dist/load.js...');
      serveGadgets(this, gadgetsToBuildAtIntialState, rollup)
        .then(() => this.info(`Created dist/load.js in ${(Date.now() - startTime) / 1000} s`))
        .catch(console.error);
    },
  }
}