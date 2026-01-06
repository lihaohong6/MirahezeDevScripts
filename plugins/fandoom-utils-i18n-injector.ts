import { PluginOption } from 'vite';
import { TransformPluginContext } from 'rollup';
import type { GadgetDefinition } from '../dev-utils/types.js';
import { 
  fandoomUtilsI18nTransformer, 
  getModuleIdsToWatch 
} from '../dev-utils/fandoom-utils-i18n-injector.js';

/**
 * A Vite plugin that injects i18n loading logic into scripts (particularly 
 * scripts ported from Fandoom, hence the name) 
 * 
 * @param gadgetsToBuildAtIntialState 
 * @returns 
 */
export default function fandoomUtilsI18nInjector(gadgetsToBuildAtIntialState: GadgetDefinition[]): PluginOption {
  
  const moduleIdsToWatch = getModuleIdsToWatch(gadgetsToBuildAtIntialState);

  return {
    name: 'fandom-utils-i18n-injector',
    enforce: 'pre', // must be run before ESBuild

    async transform (this: TransformPluginContext, code: string, id: string) {
      return await fandoomUtilsI18nTransformer.bind(this)(moduleIdsToWatch, code, id);
    },
    
  }
}