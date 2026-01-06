import { PluginOption } from 'vite';
import type { GadgetDefinition } from '../dev-utils/types.js';
import { buildOverviewPageHtml } from '../dev-utils/info-lister.js';

/**
 * A Vite plugin that automatically generates an overview page showing basic script 
 * metadata & information (dist/index.html) 
 * 
 * @param gadgetsToBuildAtIntialState
 * @returns 
 */
export default function buildOverviewPage(gadgetsToBuildAtIntialState: GadgetDefinition[]): PluginOption {
  
  return {
    name: 'build-overview-page',
    enforce: 'post', // Enforce after Vite build plugins

    // Build Mode
    writeBundle() {
      try {
        buildOverviewPageHtml(gadgetsToBuildAtIntialState);
      } catch (err) {
        console.error(err);
      }
    },
  }
}