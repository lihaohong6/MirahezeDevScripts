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

  const minify = !customArgs['no-minify'];
  const rollup = !customArgs['no-rollup'];
  const useOxcMinifier = customArgs['oxc-minifier'];

  return {
    plugins: [
      // Generate the load.js entrypoint file 
      autogenerateEntrypoint(gadgetsToBuild, rollup),
      
      // In Vite Build, copy the i18n.json files to dist/
      viteStaticCopy({
        targets: bundleAssets,
        structured: false,
      }),

      // In Vite Build, create the mw.loader.impl wrapped JS+CSS file
      rollup &&
        createMwGadgetImplementation(gadgetsToBuild),
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
            return chunkInfo.name + '.js';
          },
          assetFileNames: (assetInfo) => {
            // Handle CSS files
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return assetInfo.name;
            }
            return 'assets/[name][extname]';
          },
          globals: {
            'jquery': '$',
            'mediawiki': 'mw',
          },
          /**
           * Turn off mangling when using Oxc as a JS minifier
           * This is because mangling with Oxc is still rather limited
           * https://oxc.rs/docs/guide/usage/minifier/mangling.html 
           */
          minify: minify ? {
            mangle: false
          } : 'dce-only',
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
    /**
     * Additional ESBuild Settings
     */
    esbuild: {
      
      // format: 'esm',

      // Set this on if you want to preserve comments in /!* */ or //! blocks 
      // legalComments: 'inline', 
      
      // Ignore annotations such as /* @__PURE__ */ when building
      // ignoreAnnotations: true,

      // Minification settings
      // minifyWhitespace: minify && true,
      // minifyIdentifiers: minify && false,
      // minifySyntax: minify && true,

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
