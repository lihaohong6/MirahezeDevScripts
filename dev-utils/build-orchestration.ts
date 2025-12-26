import { readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { OutputBundle } from 'rollup';
import { parse } from 'yaml';
import * as crypto from 'crypto';
import { Target } from 'vite-plugin-static-copy';
import { transformWithEsbuild } from 'vite';
import type { GadgetDefinition, GadgetsDefinition } from './types';
import { 
  resolveFileExtension,
  resolveSrcGadgetsPath,
  resolveGadgetsDefinitionManifestPath,
  resolveEntrypointFilepath,
  checkGadgetExists,
  resolveFilepathForBundleInputKey,
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
export function getGadgetsToBuild(gadgetsDefinition: GadgetsDefinition): GadgetDefinition[] {
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
function createScriptLoadingStatement(gadgetName: string) {
  return `mw.loader.load("${getStaticUrlToFile(gadgetName, 'gadget-impl.js')}");`;
}

/**
 * Builds the entrypoint file (`load.js`) to be served by the Vite server and to be 
 * loaded on the MediaWiki client.
 * 
 * @param gadgetsToBuild
 * @param useRolledUpImplementation If set to true, then `load.js` will load the gadget-impl.js files. 
 *                                  Otherwise, it will lazily load and execute the individual scripts and stylesheets.
 * @returns
 */
export async function serveGadgets(gadgetsToBuild: GadgetDefinition[], useRolledUpImplementation: boolean): Promise<void> {
  const entrypointFile = resolveEntrypointFilepath();
  const writeStream = createWriteStream(entrypointFile, { flags: 'w', encoding: 'utf-8'});
  try {
    if (useRolledUpImplementation) {
      const writeScriptLoadingStatement = (gadget: GadgetDefinition) => {
        return writeStream.write(createScriptLoadingStatement(gadget.name)+'\n');
      }
      gadgetsToBuild.forEach(writeScriptLoadingStatement);
    } else {
      // Async generator implementation
      async function* createGadgetImplementations() {
        for (const gadget of gadgetsToBuild) {
          yield await createRolledUpGadgetImplementationByLazyLoading(gadget);
        }
      }
      // should be ES5-compliant
      writeStream.write(`{\n\nfunction loadLazily (scriptUrl) {\n\tfetch(scriptUrl)\n\t\t.then(function (res) { return res.text(); })\n\t\t.then(function (contents) { $.globalEval("(function () {" + contents + "})()"); })\n\t\t.catch(console.error);\n}\n\n`);
      for await (const gadgetImplementation of createGadgetImplementations()) {
        writeStream.write(gadgetImplementation);
        writeStream.write('\n\n');
      }
      writeStream.write(`}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    writeStream.close();
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
      return variable.split(/\s*,\s*/);
    }
    return variable;
  }
  const generateCodeConditionForComparingValues = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false): string => {
    const arr = `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}]`;
    // should be ES5-compliant
    return `${arr}.some(function (a) { return mw.config.get('${configKey}') === a; })`;
  };
  const generateCodeConditionForComparingLists = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false): string => {
    const arr = `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}]`;
    // should be ES5-compliant
    return `${arr}.some(function (a) { return (mw.config.get('${configKey}') || []).indexOf(a) > -1; })`
  };

  const checkForConditions = [
    { v: rights, configIsListOfValues: true, configKey: 'wgUserRights', valueIsNumeric: false },
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
    head.push(`if (mw.loader.getState('${namespace}.${gadgetName}') === null) { ${
      createScriptLoadingStatement(gadgetName)
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
 * @param writeBundle
 * @param gadget
 * @param minify
 * @returns
 */
export async function createRolledUpGadgetImplementation(
  gadgetImplementationFilePath: string, 
  writeBundle: OutputBundle,
  gadget: GadgetDefinition, 
  minify: boolean
): Promise<string> {
  const { name } = gadget;
  
  if (!checkGadgetExists(name)) {
    throw new Error(`Cannot resolve gadget ${name}`);
  }

  const hash = crypto.randomBytes(4).toString('hex');

  const [rsCondHead, rsCondTail] = generateGadgetImplementationLoadConditionsWrapperCode(gadget);

  const body = [
    `mw.loader.impl(function () {`,
    `return [`,
    `"${namespace}.${name}@${hash}",`,
    `function ($, jQuery, require, module) {`,
  ];

  if (gadget?.scripts?.length) {
    gadget.scripts.forEach((script) => {
      const moduleInfo = writeBundle[`${name}/${resolveFileExtension(script)}`];
      if (moduleInfo.type === 'chunk') body.push(moduleInfo.code);
    });
  }

  body.push(`}, {"css": [`);

  if (gadget?.styles?.length) {
    gadget.styles.forEach((style) => {
      const assetInfo = writeBundle[`${name}/${resolveFileExtension(style)}`];
      if (assetInfo.type === 'asset') {
        body.push(minify ? `"` : `\``);
        (() => {
          let src = assetInfo.source;
          if (src instanceof Uint8Array) {
            src = new TextDecoder().decode(src);
          }
          src = src.trim().replaceAll(
            minify ? /(")/g : /(`)/g,
            '\\$1'
          );
          body.push(src);
        })();
        body.push(minify ? `"` : `\``);
        body.push(', ');
      }
    });
  }

  body.push(`]}, {}, {}, null];`);
  body.push(`});`);

  return (await transformWithEsbuild(
    [
      `(function (mw) {`,
      ...rsCondHead,
      ...body,
      ...rsCondTail,
      `})(mediaWiki);`,
    ].join(''), 
    gadgetImplementationFilePath, 
    { minify }
  )).code;
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
        `{}, {}, null`,
      `];`,
    `});`
  ];

  const [rsCondHead, rsCondTail] = generateGadgetImplementationLoadConditionsWrapperCode(gadget);
  return (await transformWithEsbuild(
    [
      `(function (mw) {`,
      ...rsCondHead,
      ...codeBlock,
      ...rsCondTail,
      `})(mediaWiki);`
    ].join(''),
    resolveEntrypointFilepath(),
    { minify: false }
  )).code;
}

/**
 * Pass this function to `build.rollupOptions.input` in Vite's config.
 *
 * @param gadgetsToBuild
 * @returns
 */
export function mapGadgetSourceFiles(gadgetsToBuild: GadgetDefinition[]): [{ [Key: string]: string }, Target[]] {
  const entries: { [Key: string]: string } = {};
  const assets: Target[] = [];

  gadgetsToBuild.forEach((definition) => {
    const { name } = definition;
    const loadFile = (filepath: string) => {
      const key = `${name}/${resolveFilepathForBundleInputKey(filepath)}`;
      entries[key] = resolveSrcGadgetsPath(name, filepath);
    }
    definition.styles?.forEach(loadFile);
    definition.scripts?.forEach(loadFile);
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