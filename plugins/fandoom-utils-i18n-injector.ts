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
 * @param gadgetNamespace
 * @param gadgetsToBuildAtIntialState 
 * @returns 
 */
export default function fandoomUtilsI18nInjector(gadgetNamespace: string, gadgetsToBuildAtIntialState: GadgetDefinition[]): PluginOption {
  
  const moduleIdsToWatch = getModuleIdsToWatch(gadgetsToBuildAtIntialState);

  return {
    name: 'fandom-utils-i18n-injector',
    enforce: 'pre',

    async transform (this: TransformPluginContext, code: string, id: string) {
      return await fandoomUtilsI18nTransformer.bind(this)(gadgetNamespace, moduleIdsToWatch, code, id);
    },
    
  }
}