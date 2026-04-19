import type { PluginOption } from 'vite';
import { prefixRegex } from '@rolldown/pluginutils';

import type { GadgetDefinition } from '../dev-utils/types';
import { resolveSrcGadgetsPath } from '../dev-utils/utils';

/**
 * Uses virtual modules to load one or more scripts into one entrypoint file with
 * the output path `/dist/<gadget name>/index.js` (handled by the `resolveId` and `load` 
 * hooks). Thus the JS and CSS components are combined into one chunk that is part of the bundle
 * passed during the `generateBundle` hook. 
 * 
 * @param gadgetsBundle 
 * @returns 
 */
export default function gadgetModuleResolver(gadgetsToBuild: readonly GadgetDefinition[]): PluginOption {
  const virtualModuleId = 'virtual:gadgets-builder:';
  const magic = "\0";
  const resolvedPrefix = magic + virtualModuleId;

  const gadgetsBundle = new Map<string, GadgetDefinition>(
    gadgetsToBuild.map((gadget) => [gadget.name, gadget])
  );

  return {
    name: 'gadget-module-resolver',
    enforce: 'pre',
    apply: 'build',

    resolveId: {
      filter: { id: prefixRegex(virtualModuleId) },
      handler(id) {
        return magic + id;
      },
    },
    load: {
      filter: { id: prefixRegex(resolvedPrefix) },
      async handler(id) {
        const gadgetName = id.slice(resolvedPrefix.length);
        const info = gadgetsBundle.get(gadgetName)!;

        const sb: string[] = [];

        const importFile = (path: string) => `import "${resolveSrcGadgetsPath(gadgetName, path).replaceAll('"', '\\"')}";`;

        // combine all scripts into one entry file
        sb.push(...Object.values(info.scripts || []).map(importFile));
        // include the gadget's CSS as part of bundle 
        sb.push(...Object.values(info.styles || []).map(importFile));

        return sb.join("\n");
      },
    },
  }
}