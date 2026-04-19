import {
  gadgetModuleResolver,
  autogenerateEntrypoint,
  createMwGadgetImplementation,
  buildOverviewPage,
} from './plugins';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { 
  readGadgetsDefinition, 
  getGadgetsToBuild,
  mapGadgetSourceFiles, 
  setViteServerOrigin,
  setGadgetNamespace,
} from './dev-utils/build-orchestration.js';
import { resolveCommandLineArgumentsPassedToVite } from './dev-utils/resolve-env.js';
import { 
  ConfigEnv, 
  defineConfig, 
  UserConfig, 
  loadEnv
} from 'vite';

export default defineConfig(async ({ mode }: ConfigEnv): Promise<UserConfig> => {
  const customArgs = resolveCommandLineArgumentsPassedToVite();
  const env = loadEnv(mode, process.cwd(), '');
  
  const { 
    GADGET_NAMESPACE: gadgetNamespace = 'ext.gadget.store',
    SERVER_DEV_ORIGIN: serverDevOrigin = 'http://localhost:5173',
    CDN_ENTRYPOINT: cdnEntrypoint = 'http://localhost:4173',
    SERVER_PREVIEW_ORIGIN: serverPreviewOrigin,
  } = env;
  
  const isDev = mode === 'development';
  if (isDev) { 
    setViteServerOrigin(serverDevOrigin); 
  } else {
    setViteServerOrigin(serverPreviewOrigin || cdnEntrypoint);
  }
  setGadgetNamespace(gadgetNamespace);
  
  const gadgetsToBuild = await (async () => {
    const gadgetsDefinition = await readGadgetsDefinition();
    return getGadgetsToBuild(gadgetsDefinition);
  })();
  const [bundleInputs, bundleAssets] = mapGadgetSourceFiles(gadgetsToBuild);

  const minify = !customArgs['no-minify'];
  const rollup = !customArgs['no-rollup'];
  const useOxcMinifier = customArgs['oxc-minifier'];

  return {
    plugins: [
      // This plugin is responsible for coalescing every constituent JS/CSS file
      // into one index.js/style.css file
      gadgetModuleResolver(gadgetsToBuild),

      // Generate the load.js entrypoint file 
      autogenerateEntrypoint(gadgetsToBuild, rollup),
      
      // In Vite Build, copy the i18n.json files to dist/
      viteStaticCopy({ targets: bundleAssets }),

      // In Vite Build, create the mw.loader.impl wrapped JS+CSS file
      rollup &&
        createMwGadgetImplementation(gadgetsToBuild),

      // Build dist/index.html
      buildOverviewPage(gadgetsToBuild),
    ],
    build: {
      minify: minify ? (useOxcMinifier ? 'oxc' : 'terser') : false,
      terserOptions: {
        mangle: {
          reserved: ['$', 'mw']
        }
      },
      cssMinify: minify,
      rolldownOptions: {
        input: bundleInputs,
        output: {
          // Preserve the directory structure
          entryFileNames: (chunkInfo) => {
            // Coalesce all JS files into one index.js file, 
            // located in each gadget subfolder 
            return `${chunkInfo.name}/index.js`;
          },
          assetFileNames: (assetInfo) => {
            // Coalesce all CSS files into one style.css file, 
            // located in each gadget subfolder 
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return `${assetInfo.name.slice(0, -4)}/style.css`;
            }
            // misc assets
            return 'assets/[name][extname]';
          },
          globals: {
            'jquery': '$',
            'mediawiki': 'mw',
          },
        },
        moduleTypes: {
          ".yaml": "text",
          ".yml": "text"
        },
      },
      outDir: 'dist',
      emptyOutDir: true
    },
    css: {
      preprocessorOptions: {
        less: {
          // Add any Less-specific options here
        }
      }
    },
    preview: {
      open: '/index.html'
    }
  }
});
