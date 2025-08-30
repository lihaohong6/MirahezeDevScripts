import { resolve, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { createGadgetImplementationForDist } from '../dev-utils/build-orchestration.js';
import { PluginOption } from 'vite';

/**
 * A Vite plugin that creates the gadget implementation code (i.e. scripts
 * and stylesheets wrapped in mw.loader.impl) for each gadget that has been compiled, 
 * built, and placed in the dist/ directory. 
 * 
 * @returns PluginOption
 */
export default function createMwGadgetImplementation(gadgetsToBuild: GadgetDefinition[]): PluginOption {
  
  return {
    name: 'createMwGadgetImplementation',
    enforce: 'post', // Enforce after Vite build plugins
    apply: 'build', // Only on Dev Mode

    async writeBundle() {
      for (const gadget of gadgetsToBuild) {
        const gadgetImplementation = await createGadgetImplementationForDist(gadget);
        const folderPath = resolve(join(__dirname, '../dist', gadget.subdir!));
        if (!existsSync(folderPath)) { mkdirSync(folderPath); }
        const filepath = resolve(join(folderPath, 'gadget-impl.js'));
        await writeFile(filepath, gadgetImplementation, { encoding: 'utf8', flag: 'w'});
        console.log(`✓ Created the MediaWiki gadget implementation ${join(gadget.subdir!, 'gadget-impl.js')}`)
      }
    },
  }
}