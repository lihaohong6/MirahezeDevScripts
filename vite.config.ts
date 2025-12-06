import {
  autogenerateEntrypoint,
  createMwGadgetImplementation,
  fandoomUtilsI18nInjector,
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
    CDN_ENTRYPOINT: cdnEntrypoint = 'http://localhost:4173',
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
        createMwGadgetImplementation(gadgetsToBuild, minify),
      
      // In Vite Build, help create boilerplate logic to load i18n
      fandoomUtilsI18nInjector(gadgetNamespace, gadgetsToBuild),
    ],
    build: {
      minify: minify,
      cssMinify: minify,
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
          },
          // generatedCode: {
          //   /**
          //    * Turn these settings off if you want to enforce ES5 compliance
          //    */
          //   arrowFunctions: true,
          //   constBindings: true,
          //   objectShorthand: true,
          // },
          globals: {
            /**
             * Pass this to ensure that Vite/Rollup does not use $ as a 
             * minification symbol
             */
            'jquery': '$',
            'mediawiki': 'mw',
          },
        },
        external: ['jquery', 'mediawiki']
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

      define: {
        /**
         * This is passed so we can replace the variable MH_DEVSCRIPTS_CDN_ENTRYPOINT 
         * used in FandoomUtilsI18njs with the actual CDN URL during
         * compilation
         */
        'MH_DEVSCRIPTS_CDN_ENTRYPOINT': `"${cdnEntrypoint}"`,

        'MH_DEVSCRIPTS_GADGET_NAMESPACE': `"${gadgetNamespace}"`,
      },

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
