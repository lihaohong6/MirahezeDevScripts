import { readFile } from 'fs/promises';
import { ResolvedConfig } from 'vite';
import { parse } from 'yaml';
import * as crypto from 'crypto';
import type { OutputChunk, OutputAsset, PluginContext } from 'rolldown';
import type { Target } from 'vite-plugin-static-copy';
import type { GadgetDefinition, GadgetsDefinition } from './types';
import { 
  resolveFileExtension,
  resolveSrcGadgetsPath,
  resolveGadgetsDefinitionManifestPath,
  resolveEntrypointFilepath,
  checkGadgetExists,
  formatOrMinifyCode,
} from './utils';

let viteServerOrigin: string;
 
/**
 * Defines the prefix of the name of the gadget/script when registered onto MW via `mw.loader.impl`
 * 
 * e.g. When this variable is set as "`ext.gadget`", a gadget named "`hello-world`" will
 *      be registered under the name "`ext.gadget.hello-world`"
 */
let namespace = 'ext.gadget.store';

/** 
 * @param _origin
 * @returns
 */
export function setViteServerOrigin(_origin: string): void {
  viteServerOrigin = _origin;
}

/** 
 * @param _gadgetNamespace
 * @returns
 */
export function setGadgetNamespace(_gadgetNamespace: string): void {
  namespace = _gadgetNamespace;
}

/**
 * Resolve the static URL to the file in the specified gadget directory.
 * 
 * Meant to be used in the development stage on `npm run serve`
 * 
 * This is mainly used in the entrypoint file (load.js). The URLs will be loaded 
 * and the scripts/stylesheets executed/applied asynchronously.
 * 
 * @param gadgetSubdir
 * @param filepath
 * @returns
 */
function getStaticUrlToFile(gadgetSubdir: string, filepath: string): string {
  filepath = resolveFileExtension(filepath);
  return encodeURI(`${viteServerOrigin!}/${gadgetSubdir}/${filepath}`);
}

/**
 * Reads and parses the contents of `/gadgets/gadgets-definition.yaml`
 * 
 * @returns
 */
export async function readGadgetsDefinition(): Promise<GadgetsDefinition> {
  const contents = await readFile(resolveGadgetsDefinitionManifestPath(), { encoding: 'utf8' });
  const gadgetsDefinition: GadgetsDefinition = parse(contents);
  return gadgetsDefinition;
}

interface GadgetPremCheck {
  name: string
  missing?: string[]
}

/**
 * Processes the parsed gadgets definition and does the following:
 *  1) It selects which gadgets to include/exclude when serving/building, based 
 *     on the "`workspace.enable_all`", "`workspace.enable`", and/or "`workspace.disable`" 
 *     properties, or on the "`gadgets.<GADGET-NAME>.disabled`" property of each gadget
 *  2) It excludes the gadgets with unresolved directories
 *  3) It sets the gadget build order so gadgets with no required dependencies are loaded first
 *  4) It excludes gadgets with unknown dependencies
 * 
 *  @param gadgetsDefinition
 *  @returns
 */
export function getGadgetsToBuild(gadgetsDefinition: GadgetsDefinition): readonly GadgetDefinition[] {
  const { 'enable_all': enableAll = false, enable: arrEnabledGs = [], disable: arDisabledGs = [] } = gadgetsDefinition?.workspace || {};
  const enabledGadgets = new Set(arrEnabledGs);
  const disabledGadgets = new Set(arDisabledGs);
  
  // Determine which gadgets to include/exclude
  let gadgetsToBuild: GadgetDefinition[] = [];
  for (const [gadgetName, gadgetDefinition] of Object.entries(gadgetsDefinition.gadgets)) {
    // Always return early (i.e. do not build the gadget) if 
    // "gadgets.<GADGET-NAME>.disabled" is set on the gadget definition 
    if (gadgetDefinition?.disabled === true) { continue; } 
    // Otherwise defer to "workspace.enable_all", "workspace.enable", "workspace.disable" 
    if (enableAll ? !disabledGadgets.has(gadgetName) : enabledGadgets.has(gadgetName)) {
      gadgetsToBuild.push({
        ...gadgetDefinition,
        name: gadgetName,
      });
    }
  }

  // Check if the gadget exists
  const nonexistentGadgets: GadgetPremCheck[] = [];
  gadgetsToBuild = gadgetsToBuild.filter(({ name }) => {
    const subdirExists = checkGadgetExists(name);
    if (!subdirExists) {
      nonexistentGadgets.push({ name });
    }
    return subdirExists;
  });
  if (nonexistentGadgets.length > 0) {
    console.log("Skipping loading the following gadgets:");
    console.error(
      nonexistentGadgets
        .map(({ name }) => {
          return ` - ${name}\tDirectory not found: ${resolveSrcGadgetsPath(name)}`
        })
        .join('\n')
    );
  }

  // Check for any missing files
  const gadgetsWithMissingFiles: GadgetPremCheck[] = [];
  gadgetsToBuild = gadgetsToBuild.filter(({ scripts, styles, name }) => {
    const missingCodeFiles = [...(scripts || []), ...(styles || [])]
      .filter((file) => !checkGadgetExists(name, file));
    if (missingCodeFiles.length > 0) {
      gadgetsWithMissingFiles.push({ 
        name,
        missing: missingCodeFiles
      });
      return false;
    }
    return true;
  });
  if (gadgetsWithMissingFiles.length > 0) {
    console.error('Found gadgets with missing files. The following gadgets will not be loaded:');
    console.error(
      gadgetsWithMissingFiles
        .map(({ name, missing = [] }) => (
          `${name}: MISSING ${missing.join(', ')}`)
        )
        .join('\n')
    );
  }
  
  // Determine gadget load order
  let gadgetsToBuildInOrder: GadgetDefinition[] = [];
  const loadedDeps: Set<string> = new Set();
  const getGadgetsWithNoMoreRequiredDependencies = (gadgetsToBuild: GadgetDefinition[], loadedDeps: Set<string>): [GadgetDefinition[], string[]] => {
    const res: GadgetDefinition[] = [];
    const depsToLoad: string[] = [];
    for (const gadgetDefinition of gadgetsToBuild) {
      if (loadedDeps.size === 0) {
        if ((gadgetDefinition?.requires || []).length === 0) {
          res.push(gadgetDefinition);
          depsToLoad.push(gadgetDefinition.name);
        }
        continue;
      }
      const allDepsLoaded = (gadgetDefinition?.requires || []).every((required) => loadedDeps.has(required));
      if (allDepsLoaded) {
        res.push(gadgetDefinition);
        depsToLoad.push(gadgetDefinition.name);
      }
    }
    return [res, depsToLoad];
  };
  while (gadgetsToBuild.length > 0) {
    const [gadgetsToLoad, depsToLoad] = getGadgetsWithNoMoreRequiredDependencies(gadgetsToBuild, loadedDeps);
    if (depsToLoad.length === 0) {
      console.error('Found gadgets with unrecognized dependencies in gadgets-definition.yaml. The following gadgets will not be loaded:');
      console.error(
        gadgetsToBuild
          .map(({ requires = [], name }) => {
            const deps = requires.filter(dep => !loadedDeps.has(dep));
            return ` - ${name}\tRequires: ${deps.join(', ')}`
          })
          .join('\n')
      );
      break;
    }
    depsToLoad.forEach(dep => loadedDeps.add(dep));
    gadgetsToBuild = gadgetsToBuild.filter(({ name }) => !loadedDeps.has(name));
    gadgetsToBuildInOrder.push(...gadgetsToLoad);
  }

  return gadgetsToBuildInOrder;
}

/**
 * 
 * @param gadget 
 * @returns 
 */
export function createScriptLoadingStatement(gadgetName: string, asSharedDep: boolean = false) {
  return `${asSharedDep ? 'importScriptURI' : 'mw.loader.load'}("${getStaticUrlToFile(gadgetName, 'gadget-impl.js')}");`;
}

/**
 * Builds the entrypoint file (`load.js`) to be served by the Vite server and to be 
 * loaded on the MediaWiki client.
 * 
 * @param pluginContext
 * @param gadgetsToBuild
 * @param useRolledUpImplementation 
 * If set to true, then `load.js` will load the gadget-impl.js files. 
 * Otherwise, it will lazily load and execute the individual scripts and stylesheets.
 * @returns
 */
export async function serveGadgets(pluginContext: PluginContext, gadgetsToBuild: readonly GadgetDefinition[], useRolledUpImplementation: boolean): Promise<void> {
  const sb: string[] = [];
  try {
    if (useRolledUpImplementation) {
      /*
       * The `dist` pipeline (i.e. the default workflow that is run when 
       * `npm run build` is run) generates a load.js that lists (and loads) each 
       * gadget that is built.
       */
      const writeScriptLoadingStatement = (gadget: GadgetDefinition) => {
        return sb.push(createScriptLoadingStatement(gadget.name));
      }
      gadgetsToBuild.forEach(writeScriptLoadingStatement);
    } else {
      /*
       * This block is only called when `npm run build -- -- --no-rollup` is called.
       * 
       * This block is run when you want to make a load.js file that invokes each 
       * part of the gadget separately, e.g. call code.js and apply style.css 
       * separately. 
       * 
       * The `dist` pipeline does not execute this block.
       */
      // Async generator implementation
      async function* createGadgetImplementations() {
        for (const gadget of gadgetsToBuild) {
          yield await createRolledUpGadgetImplementationByLazyLoading(gadget);
        }
      }
      // We use $.globalEval to prevent each script from polluting the global scope
      sb.push(`{\n\nfunction loadLazily (scriptUrl) {\n\tfetch(scriptUrl)\n\t\t.then(res => res.text())\n\t\t.then(contents => { $.globalEval("(function () {" + contents + "})()"); })\n\t\t.catch(console.error);\n}\n`);
      for await (const gadgetImplementation of createGadgetImplementations()) {
        sb.push(gadgetImplementation);
      }
      sb.push(`}`);
    }

    pluginContext.emitFile({
      code: sb.join("\n"),
      fileName: 'load.js',
      type: 'prebuilt-chunk',
    });
  } catch (err) {
    console.error(err);
  }
}

/**
 * Used to simulate ResourceLoader's conditional loading
 * 
 * @param resourceLoader        conditions to load
 * @returns
 */
function generateGadgetImplementationLoadConditionsWrapperCode(
  { 
    resourceLoader: { 
      dependencies = null,
      rights = null, skins = null, 
      actions = null, categories = null, namespaces = null, 
      contentModels = null 
    } = {}, 
    requires = [],
  }: GadgetDefinition
): [string[], string[]] {
  if (
    [dependencies, rights, skins, actions, categories, namespaces, contentModels].every((v) => v === null)
    &&
    requires.length === 0
  ) {
    return [[], []];
  }
  const conditions: string[] = [];
  const normalizeVariable = (variable: string | string[]) => {
    if (typeof variable === 'string') {
      return variable.trim().split(/\s*,\s*/).filter((val) => val !== '');
    }
    return variable;
  }
  const generateCodeConditionForComparingValues = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false): string => {
    const arr = `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}]`;
    // not ES5-compliant
    return `${arr}.some(a => mw.config.get('${configKey}') === a)`;
  };
  const generateCodeConditionForComparingLists = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false): string => {
    const arr = `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}]`;
    // not ES5-compliant
    return `${arr}.some(a => (mw.config.get('${configKey}') || []).indexOf(a) > -1)`
  };

  const checkForConditions = [
    { v: rights, configIsListOfValues: true, configKey: 'wgUserGroups', valueIsNumeric: false },
    { v: skins, configIsListOfValues: false, configKey: 'skin', valueIsNumeric: false },
    { v: actions, configIsListOfValues: false, configKey: 'wgAction', valueIsNumeric: false },
    { v: categories, configIsListOfValues: true, configKey: 'wgCategories', valueIsNumeric: false },
    { v: namespaces, configIsListOfValues: false, configKey: 'wgNamespaceNumber', valueIsNumeric: true },
    { v: contentModels, configIsListOfValues: false, configKey: 'wgPageContentModel', valueIsNumeric: false },
  ];
  checkForConditions.forEach(({ v, configIsListOfValues, configKey, valueIsNumeric }) => {
    if (!!v) {
      v = normalizeVariable(v);
      const fn = (
        configIsListOfValues ? 
        generateCodeConditionForComparingLists : 
        generateCodeConditionForComparingValues
      );
      conditions.push(fn(v, configKey, valueIsNumeric));
    }
  });

  let head: string[] = [];
  let tail: string[] = [];

  if (conditions.length === 1) {
    head.push(`if (${conditions[0]}) {`);
    tail.unshift(`}`);
  } else if (conditions.length > 0) {
    head.push(`if ( ([ ${conditions.join(', ')} ]).every(Boolean) ) {`);
    tail.unshift(`}`);
  }

  requires.forEach((gadgetName) => {
    head.push(`if (!mw.loader.getState('${namespace}.${gadgetName}')) { ${
      createScriptLoadingStatement(gadgetName, true)
    } }`);
  });
    
  if (!!dependencies) {
    dependencies = normalizeVariable(dependencies);
    head.push(`mw.loader.using([ ${dependencies.map(el => `"${el}"`).join(`, `)} ], function (require) {`);
    tail.unshift(`});`);
  }

  return [head, tail];
}

/**
 * Creates an `mw.loader.impl` implementation with direct execution of each script and stylesheet.
 * 
 * @param gadgetImplementationFilePath
 * @param gadget
 * @param rolldownMinify
 * @param buildConfig
 * @param outputChunk
 * @param outputAsset
 * @returns
 */
export async function createRolledUpGadgetImplementation({ 
  gadgetImplementationFilePath, gadget,
  rolldownMinify, buildConfig, outputChunk, outputAsset 
}: {
  gadgetImplementationFilePath: string, 
  gadget: GadgetDefinition, 
  rolldownMinify: boolean | 'oxc' | 'terser',
  buildConfig: ResolvedConfig,
  outputChunk?: OutputChunk,
  outputAsset?: OutputAsset, 
}): Promise<string> {
  
  if (!checkGadgetExists(gadget.name)) {
    throw new Error(`Cannot resolve gadget ${gadget.name}`);
  }

  const hash = crypto.randomBytes(4).toString('hex');

  const [rsCondHead, rsCondTail] = generateGadgetImplementationLoadConditionsWrapperCode(gadget);

  const body = [
    `mw.loader.impl(function () {`,
    `return [`,
    `"${namespace}.${gadget.name}@${hash}",`,
    `function ($, jQuery, require, module) {`,
  ];

  if (outputChunk) {
    body.push(outputChunk.code);
  }

  body.push(`}, {"css": [`);

  if (outputAsset && outputAsset.source) {
        body.push("`");
    body.push(String(outputAsset.source).replaceAll("`", "\\`").trim());
        body.push("`");
  }

  body.push(`]},`);
  // body.push(` {}, {}, null`);
  body.push(`];`);
  body.push(`});`);

  let trf = [
      `(function (mw) {`,
      ...rsCondHead,
      ...body,
      ...rsCondTail,
      `})(mediaWiki);`,
  ].join('');
  
  trf = await formatOrMinifyCode(trf, gadgetImplementationFilePath, rolldownMinify, buildConfig);

  return trf;
}

/**
 * Generates an `mw.loader.impl` implementation that executes code and applies stylesheets
 * by lazy loading.
 * 
 * @param gadget 
 */
export async function createRolledUpGadgetImplementationByLazyLoading(gadget: GadgetDefinition): Promise<string> {
  const { name } = gadget;
    
  if (!checkGadgetExists(name)) {
    throw new Error(`Cannot resolve gadget ${name}`);
  }

  const hash = crypto.randomBytes(4).toString('hex');

  const scriptsToLoad = gadget.scripts?.map((script) => {
    const scriptUrl = getStaticUrlToFile(name, script).replaceAll('"', '\\"');
    return `loadLazily("${scriptUrl}");`;
  }) || [];

  const stylesToLoad = gadget.styles?.map((style) => {
    const styleUrl = getStaticUrlToFile(name, style).replaceAll('"', '\\"');
    return `"${styleUrl}"`;
  }) || [];

  const codeBlock = [
    `mw.loader.impl(function () {`,
      `return [`,
        `"${namespace}.${name}@${hash}",`,
        `function() {`,
        ...scriptsToLoad,
        `}, `,
        `{"url": {"all": [${stylesToLoad.join(',')}] }},`,
        // `{}, {}, null`,
      `];`,
    `});`
  ];

  const [rsCondHead, rsCondTail] = generateGadgetImplementationLoadConditionsWrapperCode(gadget);
  return (await formatOrMinifyCode(
    [
      `(function (mw) {`,
      ...rsCondHead,
      ...codeBlock,
      ...rsCondTail,
      `})(mediaWiki);`
    ].join(''),
    resolveEntrypointFilepath(),
    false,
  ));
}

/**
 * Pass this function to `build.rolldownOptions.input` in Vite's config.
 *
 * @param gadgetsToBuild
 * @returns
 */
export function mapGadgetSourceFiles(gadgetsToBuild: readonly GadgetDefinition[]): [Record<string, string>, Target[]] {
  const entries: Record<string, string> = {};
  const assets: Target[] = [];

  gadgetsToBuild.forEach((definition) => {
    const { name: gadgetName } = definition;
    entries[gadgetName] = `virtual:gadgets-builder:${gadgetName}`;
    definition.i18n?.forEach((i18nFile) => {
      assets.push({ 
        src: resolveSrcGadgetsPath(name, i18nFile), 
        dest: name, 
        overwrite: true 
      });
    });
  });

  return [entries, assets];
}