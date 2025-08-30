import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { resolve, join } from 'path';
import { parse } from 'yaml';
import * as crypto from 'crypto';
import { normalizePath } from 'vite';
import { Target } from 'vite-plugin-static-copy';

let gadgetsDir: string;
resolveGadgetsDirectory();

let viteServerOrigin: string;

// Defines the prefix of the name of the gadget/script when registered onto MW via mw.loader.impl 
// e.g. When this variable is set as "ext.gadget", a gadget named "hello-world" will
//      be registered under the name "ext.gadget.hello-world" 
const namespace = 'ext.gadget.store';

/** 
 * Resolve the path to the gadgets directory in the Vite project.
 * 
 * @returns string
 */
export function resolveGadgetsDirectory(): string {
  if (!gadgetsDir) {
    gadgetsDir = normalizePath(resolve(__dirname, '../gadgets'));
    if (!existsSync(gadgetsDir)) { mkdirSync(gadgetsDir); }
  }
  return gadgetsDir;
}

/**
 * Resolve the path to the specific sub-directory and/or file belonging
 * to the gadget in the Vite project.
 * 
 * @param gadgetName string
 * @param relativeFilepath string | undefined
 * @returns string
 */
export function resolveGadgetPath(gadgetName: string, relativeFilepath?: string): string {
  if (relativeFilepath === undefined) {
    return join(gadgetsDir, gadgetName);
  }
  return normalizePath(resolve(join(gadgetsDir, gadgetName), relativeFilepath));
}

/** 
 * Resolve the path to the load.js file to be loaded on the MediaWiki instance.
 * This load.js file contains the definitions of the gadgets that it tells
 * MediaWiki to load and register as modules (using mw.loader.impl).
 * 
 * @returns string
 */
function resolveEntrypoint(): string {
  const distFolder = resolve(__dirname, '../');
  return normalizePath(resolve(distFolder, 'load.js'));
}

/** 
 * Checks if the file exists in the specified gadget sub-directory in the Vite Project.
 * 
 * @param gadgetName string
 * @param relativeFilepath string
 * @returns boolean
 */
function fileExistsInGadgetDirectory(gadgetName: string, relativeFilepath: string): boolean {
  return existsSync(resolveGadgetPath(gadgetName, relativeFilepath));
}

/**
 * Resolve the static URL to the file in the specified gadget directory.
 * This is passed in the entrypoint file (load.js) to mw.loader.impl, 
 * and is used by the MediaWiki client to load and execute/apply the JS/CSS files.
 * 
 * @param gadgetSubdir string
 * @param filepath string
 * @returns string 
 */
function getStaticUrlToFile(gadgetSubdir: string, filepath: string): string {
  // Resolve TS files
  filepath = filepath.replace(/\.ts$/, '.js');
  return encodeURI(`${viteServerOrigin!}/gadgets/${gadgetSubdir}/${filepath}`);
}

/** 
 * @param _origin string
 * @returns void
 */
export function setViteServerOrigin(_origin: string): void {
  viteServerOrigin = _origin;
}

/**
 * Reads and parses the contents of "/gadgets/gadgets-definition.yaml".
 * 
 * @returns Promise<GadgetsDefinition>
 */
export async function readGadgetsDefinition(): Promise<GadgetsDefinition> {
  const contents = await readFile(resolve(gadgetsDir, 'gadgets-definition.yaml'), { encoding: 'utf8' });
  const gadgetsDefinition = parse(contents);
  return gadgetsDefinition;
}

/**
 * Processes the parsed gadgets definition and does the following:
 *  1) It selects which gadgets to include/exclude when serving/building, based 
 *     on the "workspace.enable_all", "workspace.enable", and/or "workspace.disable" properties, or
 *     on the "gadgets.<GADGET-NAME>.disabled" property of each gadget
 *  2) It excludes the gadgets with unresolved directories
 *  3) It sets the gadget build order so gadgets with no required dependencies are loaded first
 *  4) It excludes gadgets with unknown dependencies
 * 
 *  @param gadgetsDefinition GadgetsDefinition
 *  @returns Array<GadgetDefinition>
 */
export function getGadgetsToBuild(gadgetsDefinition: GadgetsDefinition): GadgetDefinition[] {
  const { 'enable_all': enableAll = false, enable: arrEnabledGs = [], disable: arDisabledGs = [] } = gadgetsDefinition?.workspace || {};
  const enabledGadgets = new Set(arrEnabledGs);
  const disabledGadgets = new Set(arDisabledGs);
  
  // Determine which gadgets to include/exclude
  let gadgetsToBuild = Object.entries(gadgetsDefinition?.gadgets || {})
    .filter(([gadgetName, gadgetDefinition]) => {
      // Always return false (i.e. do not build the gadget) if 
      // "gadgets.<GADGET-NAME>.disabled" is set on the gadget definition 
      if (gadgetDefinition?.disabled === true) { return false; } 
      // Otherwise defer to "workspace.enable_all", "workspace.enable", "workspace.disable" 
      return enableAll ? !disabledGadgets.has(gadgetName) : enabledGadgets.has(gadgetName);
    });

  // Check if the gadget exists
  const nonexistentGadgets: string[] = [];
  gadgetsToBuild = gadgetsToBuild.filter(([gadgetName, _]) => {
    const subdirExists = existsSync(resolveGadgetPath(gadgetName));
    if (!subdirExists) { nonexistentGadgets.push(gadgetName); }
    return subdirExists;
  });
  if (nonexistentGadgets.length > 0) {
    console.log("Skipping loading the following gadgets:");
    console.error(
      nonexistentGadgets
        .map((gadgetName) => {
          return ` - ${gadgetName}\tDirectory not found: ${resolveGadgetPath(gadgetName)}`
        })
        .join('\n')
    );
  }
  
  // Determine gadget load order
  let gadgetsToBuildInOrder: [string, GadgetDefinition][] = [];
  const loadedDeps: Set<string> = new Set();
  const getGadgetsWithNoMoreRequiredDependencies = (gadgetsToBuild: [string, GadgetDefinition][], loadedDeps: Set<string>): [[string, GadgetDefinition][], string[]] => {
    const res: [string, GadgetDefinition][] = [];
    const depsToLoad: string[] = [];
    for (const [gadgetName, gadgetDefinition] of gadgetsToBuild) {
      if (loadedDeps.size === 0) {
        if ((gadgetDefinition?.requires || []).length === 0) {
          res.push([(gadgetName as string), (gadgetDefinition as GadgetDefinition)]);
          depsToLoad.push(gadgetName);
        }
        continue;
      }
      const allDepsLoaded = (gadgetDefinition?.requires || []).every((required) => loadedDeps.has(required));
      if (allDepsLoaded) {
        res.push([gadgetName, gadgetDefinition]);
        depsToLoad.push(gadgetName);
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
          .map(([gadgetName, gadgetDefinition]) => {
            const deps = (gadgetDefinition?.requires || []).filter(dep => !loadedDeps.has(dep));
            return ` - ${gadgetName}\tRequires: ${deps.join(', ')}`
          })
          .join('\n')
      );
      break;
    }
    depsToLoad.forEach(dep => loadedDeps.add(dep));
    gadgetsToBuild = gadgetsToBuild.filter(([gadgetName, _]) => !loadedDeps.has(gadgetName));
    gadgetsToBuildInOrder.push(...gadgetsToLoad);
  }
  
  // Prepare return data
  return gadgetsToBuildInOrder
    .map(([gadgetName, gadgetDefinition]) => {
      return {
        ...gadgetDefinition,
        subdir: gadgetName,
        scripts: gadgetDefinition.scripts?.filter(script => fileExistsInGadgetDirectory(gadgetName, script)),
        styles: gadgetDefinition.styles?.filter(style => fileExistsInGadgetDirectory(gadgetName, style)),
        i18n: gadgetDefinition.i18n?.filter(i18n => fileExistsInGadgetDirectory(gadgetName, i18n))
      };
    });
}

/**
 * Build the entrypoint file (load.js) to be served by the Vite server and to be 
 * loaded on the MediaWiki client. Only applicable for running on Dev Mode.
 * Each module is loaded in the MediaWiki client using mw.loader.impl.  
 * You can check on the status of each module using mw.loader.getState(moduleName).
 * You can call on each module using mw.loader.load() or mw.loader.using().
 * 
 * @param gadgetsToBuild Array<GadgetDefinition>
 * @returns Promise<void>
 */
export async function serveGadgetsForDevMode(gadgetsToBuild: GadgetDefinition[], { 
  buildAll = true
}: { rebuild?: string[], buildAll?: boolean } = {}): Promise<void> {
  const entrypointFile = resolveEntrypoint();
  // Clear entrypoint file
  await writeFile(entrypointFile, '', { flag: "w+", encoding: "utf8"});
  if (buildAll) {
    function* awaitTheseTasks() {
      for (const gadget of gadgetsToBuild) {
        yield createGadgetImplementationForDevMode(gadget);
      }
    }
    for await (const gadgetImplementation of awaitTheseTasks()) {
      await writeFile(entrypointFile, gadgetImplementation + '\n\n', { flag: "a+", encoding: "utf8" });
    }
    return;
  }
  // TODO: Make use of a build cache 
  // Likely unneeded as creating the entrypoint is not resource-intensive
  throw new Error('Unimplemented serveGadgetsForDevMode(gadgetsDefinition, { buildAll: false })');
}

/**
 * Wraps the mw.loader.impl implementation in conditional expressions
 * to simulate ResourceLoader's conditional loading
 * 
 * @param gadgetImplementation string - mw.loader.impl implementation
 * @param resourceLoader ResourceLoader
 * @param devMode boolean
 * @returns Promise<string>
 */
function addGadgetImplementationLoadConditions(gadgetImplementation: string, 
  { resourceLoader: { 
    dependencies = null, rights = null, skins = null, 
    actions = null, categories = null, namespaces = null, 
    contentModels = null 
  } = {} }: GadgetDefinition,
  devMode: boolean
) {
  if ([dependencies, rights, skins, actions, categories, namespaces, contentModels].every((v) => v === null)) {
    return gadgetImplementation;
  }
  const conditions = [];
  const normalizeVariable = (variable: string | string[]) => {
    if (typeof variable === 'string') {
      return variable.split(/\s*,\s*/);
    }
    return variable;
  }
  const generateCodeConditionForComparingValues = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false) => (
    `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}].some(function(a){return mw.config.get('${configKey}') === a;})`
  );
  const generateCodeConditionForComparingLists = (rsValues: string[], configKey: string, valueIsNumeric: boolean = false) => (
    `[${rsValues.map(el => valueIsNumeric ? el : `"${el}"`).join(',')}].some(function(a){return (mw.config.get('${configKey}') || []).indexOf(a) > -1;})`
  );
  
  if (!!rights) {
    rights = normalizeVariable(rights);
    conditions.push(generateCodeConditionForComparingLists(rights, 'wgUserRights'));
  }
  if (!!skins) {
    skins = normalizeVariable(skins);
    conditions.push(generateCodeConditionForComparingValues(skins, 'skin'));
  }
  if (!!actions) {
    actions = normalizeVariable(actions);
    conditions.push(generateCodeConditionForComparingValues(actions, 'wgAction'));
  }
  if (!!categories) {
    categories = normalizeVariable(categories);
    conditions.push(generateCodeConditionForComparingLists(categories, 'wgCategories'));
  }
  if (!!namespaces) {
    namespaces = normalizeVariable(namespaces);
    conditions.push(generateCodeConditionForComparingValues(namespaces, 'wgNamespaceNumber', true));
  }
  if (!!contentModels) {
    contentModels = normalizeVariable(contentModels);
    conditions.push(generateCodeConditionForComparingValues(contentModels, 'wgPageContentModel'));
  }

  let wrapped = gadgetImplementation;

  if (!!dependencies) {
    dependencies = normalizeVariable(dependencies);
    wrapped = `mw.loader.using([${dependencies.map(el => `"${el}"`).join(',')}],function(require){${devMode ? '\n' : ''}${wrapped}${devMode ? '\n' : ''}});`
  }
  if (conditions.length === 1) {
    wrapped = `if (${conditions[0]}){${devMode ? '\n' : ''}${wrapped}${devMode ? '\n  ' : ''}}`;
  } else if (conditions.length > 0) {
    wrapped = `if ([${conditions.join(',')}].every(function(el){ return el; })){${devMode ? '\n' : ''}${wrapped}${devMode ? '\n  ' : ''}}`;
  }

  return wrapped;
}

/**
 * Defines the implementation of each gadget.
 * Each gadget is registered on MediaWiki using mw.loader.impl.
 * The responsibility of loading the scripts & stylesheets served statically from
 * the Vite server (when on Dev Mode) lies on the MediaWiki instance 
 * (through mw.loader.impl).
 * 
 * @param subdir string - The gadget subdirectory
 * @param scripts Array<string> - The static URLs to the JS files
 * @param styles Array<string> - The static URLs to the CSS files
 * @returns Promise<string>
 */
export async function createGadgetImplementationForDevMode( 
  { subdir, scripts = [], styles = [], resourceLoader }: GadgetDefinition
): Promise<string> {
  if ((subdir || '') === '' || !existsSync(resolveGadgetPath(subdir!))) {
    console.error(`Cannot resolve gadget ${subdir || ''}`);
  }
  const name = subdir!.replaceAll(/\s+/g, '-').replaceAll(/["']/g, '');
  const hash = crypto.randomBytes(4).toString('hex');

  const scriptsToLoad = scripts
    .map((script) => {
      const scriptUrl = getStaticUrlToFile(subdir!, script.replaceAll('"', '\\"'));
      return `"${scriptUrl}"`;
    });
  
  const stylesToLoad = styles
    .map((style) => {
      const styleUrl = getStaticUrlToFile(subdir!, style.replaceAll('"', '\\"'));
      return `"${styleUrl}"`;
    });

  let snippet = `  mw.loader.impl(function (){
    return [
      "${namespace}.${name}@${hash}",
      [${scriptsToLoad.join(',')}],
      {"url":{"all":[${stylesToLoad.join(',')}]}},
      {}, {}, null
    ];
  });`;
  snippet = addGadgetImplementationLoadConditions(snippet, { resourceLoader }, true);
  snippet = `(function (mw) {\n  ${snippet}\n})(mediaWiki);`

  return snippet;
}

/**
 * Defines the implementation of each gadget.
 * Each gadget is registered on MediaWiki using mw.loader.impl.
 * The responsibility of loading the scripts & stylesheets served statically from
 * jsDelivr (when on production mode) lies on the MediaWiki instance 
 * (through mw.loader.impl).
 * 
 * @param subdir string - The gadget subdirectory
 * @param scripts Array<string> - The static URLs to the JS files
 * @param styles Array<string> - The static URLs to the CSS files
 * @returns Promise<string>
 */
export async function createGadgetImplementationForDist(
  { subdir, scripts = [], styles = [], resourceLoader }: GadgetDefinition
): Promise<string> {
  if ((subdir || '') === '' || !existsSync(resolveGadgetPath(subdir!))) {
    console.error(`Cannot resolve gadget ${subdir || ''}`);
  }
  const name = subdir!.replaceAll(/\s+/g, '-').replaceAll(/["']/g, '');
  const hash = crypto.randomBytes(4).toString('hex');

  const scriptsToLoad: string[] = [];
  const stylesToLoad: string[] = [];
  for (const script of scripts) {
    const filepath = resolve(__dirname, '../dist', subdir!, script.replace(/\.[a-zA-Z0-9]*$/, '')+'.js');
    const codeContents = await readFile(filepath, { encoding: 'utf8' });
    scriptsToLoad.push(codeContents.trim());
  }
  for (const style of styles) {
    const filepath = resolve(__dirname, '../dist', subdir!, style.replace(/\.[a-zA-Z0-9]*$/, '')+'.css');
    const codeContents = await readFile(filepath, { encoding: 'utf8' });
    stylesToLoad.push(`"${codeContents.replaceAll(/"/g, '\\"').trim()}"`);
  }

  let snippet = `
  mw.loader.impl(function(){return ["${namespace}.${name}@${hash}",function($,jQuery,require,module){${scriptsToLoad.join('\n')}},{"css":[${stylesToLoad.join(',')}]},{},{},null];});`.trim();
  snippet = addGadgetImplementationLoadConditions(snippet, { resourceLoader }, false);
  snippet = `(function(mw){${snippet}})(mediaWiki);`;
  return snippet;
}

/**
 * Pass this function to "build.rollupOptions.input" in Vite's config.
 *
 * @param gadgetsToBuild Array<GadgetDefinition>
 * @returns [Map<string, string>, Array<string>
 */
export function mapGadgetSourceFiles(gadgetsToBuild: GadgetDefinition[]): [{ [Key: string]: string }, Target[]] {
  const entries: { [Key: string]: string } = {};
  const assets: Target[] = [];
  
  for (const { subdir, scripts, styles, i18n } of gadgetsToBuild) {
    const loadFile = (filepath: string) => {
      entries[`${subdir!}/${filepath.replace(/\.[a-zA-Z0-9]*$/, '')}`] = resolveGadgetPath(subdir!, filepath);
    }
    (scripts || []).forEach(loadFile);
    (styles || []).forEach(loadFile);
    (i18n || []).forEach((i18nFile) => {
      assets.push({ src: resolveGadgetPath(subdir!, i18nFile), dest: subdir!, overwrite: true });
    });
  }
  return [entries, assets];
}