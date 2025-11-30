import {
  autogenerateEntrypoint,
  createMwGadgetImplementation,
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
    SERVER_PREVIEW_ORIGIN: serverPreviewOrigin = 'http://localhost:4173',
  } = env;
  
  const isDev = mode === 'development';
  if (isDev) { 
    setViteServerOrigin(serverDevOrigin); 
  } else {
    setViteServerOrigin(serverPreviewOrigin);
  }
  setGadgetNamespace(gadgetNamespace);
    
  const gadgetsDefinition = await readGadgetsDefinition();
  const gadgetsToBuild = getGadgetsToBuild(gadgetsDefinition);
  const [bundleInputs, bundleAssets] = mapGadgetSourceFiles(gadgetsToBuild);

  return {
    plugins: [
      // Generate the load.js entrypoint file 
      autogenerateEntrypoint(gadgetsToBuild, customArgs['no-rollup']),
      
      // In Vite Build, copy the i18n.json files to dist/
      viteStaticCopy({
        targets: bundleAssets,
        structured: false,
      }),

      // In Vite Build, create the mw.loader.impl wrapped JS+CSS file
      !customArgs['no-rollup'] &&
        createMwGadgetImplementation(gadgetsToBuild, customArgs['no-minify']),
    ],
    build: {
      minify: !customArgs['no-minify'],
      cssMinify: !customArgs['no-minify'],
      rollupOptions: {
        input: bundleInputs,
        output: {
          // Preserve the directory structure
          entryFileNames: (chunkInfo) => {
            return chunkInfo.name + '.js';
          },
          assetFileNames: (assetInfo) => {
            // Handle CSS files
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return assetInfo.name;
            }
            return 'assets/[name][extname]';
          }
        }
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
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".yaml": "text",
          ".yml": "text"
        }
      }
    },
    preview: {
      open: '/load.js'
    }
  }
});
