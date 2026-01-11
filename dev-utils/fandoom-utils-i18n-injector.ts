import { readFile } from "fs/promises";
import type { PluginContext, TransformResult } from "rollup";
import type { GadgetDefinition } from "./types.ts";
//@ts-ignore
import { resolveSrcGadgetsPath } from "./utils.ts";

/**
 * Get the injector plugin to replace this expression
 */
const REGEX_ID = /INJECT_FANDOM_UTILS_I18N\s*\(([^\)]*)\)\s*;?/;

/**
 * Get the module IDs of scripts with included i18n files and thus might need a code injection 
 *  
 * @param gadgets 
 * @returns 
 */
export function getModuleIdsToWatch(gadgets: GadgetDefinition[]): { [gadgetId: string]: GadgetDefinition } {
  const moduleIdsToWatch: { [gadgetId: string]: GadgetDefinition } = {};
  gadgets
    .filter((gadget) => !!gadget?.i18n?.length )
    .forEach((gadget) => {
      gadget.scripts?.forEach(script => {
        moduleIdsToWatch[resolveSrcGadgetsPath(gadget.name, script)] = gadget;
      });
    });
  return moduleIdsToWatch;
}

/**
 * Configure i18n loading
 */
interface LoadOptions {
  useLang?: boolean
  usePageLang?: boolean
  usePageViewLang?: boolean
  useContentLang?: boolean
  useUserLang?: boolean
  doNotLoadGadgetOnError?: boolean
}

/**
 * The options object instance to pass to `loadMessages` (`FandoomUtilsI18nLoader`) 
 */
interface I18nOptions {
  entrypoint?: string
  cacheAll?: string[] | boolean
  cacheVersion?: number
  language?: string
  noCache?: any 
}

/**
 * Create the boilerplate code for loading i18n messages 
 * 
 * @param  gadget
 * @param  loadOptions
 * @param  i18nOptions
 * @returns 
 */
export async function createI18nLoadingLogic(gadget: GadgetDefinition, loadOptions?: LoadOptions, i18nOptions?: I18nOptions): Promise<string[] | null> {
  const { name, i18n } = gadget;
  let fallbackMessages: Record<string, string>;

  if (!loadOptions?.doNotLoadGadgetOnError) {
    const i18nMessages = JSON.parse(await readFile(resolveSrcGadgetsPath(name, i18n![0]), { encoding: 'utf-8', flag: 'r' }));
    if (i18nMessages.en === undefined) return null;
    fallbackMessages = i18nMessages.en;
  }

  const i18nLoaderGadgetName = 'FandoomUtilsI18nLoader';

  const code = [
    /**
     * Defines the i18n object that parses the messages that will be rendered in DOM
     * @param   i18nLoader  Either the FandoomUtilsI18nLoader object loaded from the gadget or a mock 
     *                      object containing the fallback messages
     * @returns An i18n utility object sharing the same API as Fandoom Dev's i18n-js 
     */
    `function prepareI18n(i18nLoader) {`,
      `var _mwMsg = mw.Message;`,
      `_mwMsg.prototype.constructor = mw.Message.prototype.constructor;`,
      `var p = {`,
        `_i18nLoader: i18nLoader,`,
        `msg: function () {`,
          `var args = Array.prototype.slice.call(arguments);`,
          `if (args.length === 0) {`,
            `return;`,
          `}`,
          `var key = args.shift();`,
          `return new _mwMsg(this._i18nLoader.getMessages(), key, args);`,
        `}`,
      `};`,
      `['_setTempLang', '_setDefaultLang']`,
      `.forEach(function (prop) {`,
        `p[prop] = p._i18nLoader[prop].bind(p._i18nLoader)`,
      `});`,
      `['useLang', 'usePageLang', 'useContentLang', 'usePageViewLang', 'useUserLang', 'inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang']`,
      `.forEach(function (prop) {`,
        `p[prop] = p._i18nLoader[prop].bind(p)`,
      `});`,
      `return p;`,
    `}`,

    /**
     * Creates a jQuery.Deferred object that either resolves 1) the output of 
     * FandoomUtilsI18nLoader.loadMessages(), or 2) the output of 
     * getFallbackMessages() on event of failure in the process of trying to
     * call FandoomUtilsI18nLoader.loadMessages()
     * 
     * If doNotLoadGadgetOnError is passed onto the injector then the returned
     * jQuery.Deferred object will reject on failure (default behaviour is to
     * resolve with fallback messages)
     * 
     * @returns {jQuery.Deferred}
     */
    `function getI18nLoader() {`,
      `var deferred = new $.Deferred();`,
      `var waitTask = new $.Deferred();`,

      /**
       * After loading the gadget from CDN, wait for the module to be loaded using mw.loader
       * @returns {jQuery.Deferred}
       */
      `function onLoadedGadget() {`,
        `var module = $.Deferred();`,
        `mw.loader.using( MH_DEVSCRIPTS_GADGET_NAMESPACE+'.${i18nLoaderGadgetName}' )`,
          `.done(function (require) {`,
            `module.resolve( require( MH_DEVSCRIPTS_GADGET_NAMESPACE+'.${i18nLoaderGadgetName}' ) );`,
          `})`,
          `.fail(module.reject);`,
        `return module;`,
      `}`,

      /**
       * After loading the module using mw.loader, call loadMessages
       * @param   module  Resolved output from onLoadedGadget()
       * @returns {jQuery.Deferred}
       */
      `function onLoadedModule(module) {`,
        `return module.loadMessages('${name}'${i18nOptions && `, ${JSON.stringify(i18nOptions)}`});`,
      `}`,

      /**
       * Handles results of loadMessages on success
       * @param   i18nLoader  Resolved output from onLoadedModule()
       * @returns {jQuery.Deferred}
       */
      `function onLoadedMessages(i18nLoader) {`,
        loadOptions?.useLang ? `i18nLoader.useLang();` : '',
        loadOptions?.usePageLang ? `i18nLoader.usePageLang();` : '',
        loadOptions?.useContentLang ? `i18nLoader.useContentLang();` : '',
        loadOptions?.usePageViewLang ? `i18nLoader.usePageViewLang();` : '',
        loadOptions?.useUserLang ? `i18nLoader.useUserLang();` : '',
        `deferred.resolve(i18nLoader);`,
      `}`,

      /**
       * Promise chaining
       */
      `waitTask`,
        `.then(onLoadedGadget)`,
        `.then(onLoadedModule)`,
        `.then(onLoadedMessages)`,
        `.catch(function (err) {`,
          `console.error(err);`,
          (
            loadOptions?.doNotLoadGadgetOnError ? 
            'deferred.reject()' : 
            'deferred.resolve(getFallbackMessages());'
          ),
        `});`,

      /* Load and execute the FandoomUtilsI18nLoader gadget from CDN if not yet loaded */
      `if (!mw.loader.getState( MH_DEVSCRIPTS_GADGET_NAMESPACE+'.${i18nLoaderGadgetName}' )) {`,
        `$.ajax({`,
          `dataType: 'script',`,
          `cache: true,`,
          `url: MH_DEVSCRIPTS_CDN_ENTRYPOINT + "/${i18nLoaderGadgetName}/gadget-impl.js"`,
        `}).done(function () {`,
          `waitTask.resolve();`,
        `}).fail(waitTask.reject);`,
      `} else {`,
        `waitTask.resolve();`,
      `}`,

      `return deferred;`,
    `}`,
  ];

  if (!loadOptions?.doNotLoadGadgetOnError) {
    code.push(...[
      /** 
     * Create a mock object with the same API as the output of 
     * FandoomUtilsI18nLoader.loadMessages 
     * */
    `function getFallbackMessages() {`,
      `console.warn('[FandoomUtilsI18nLoader] Failed to load messages. Using fallback messages instead.');`,
      /* We inject the English i18n messages into the script/bundle as fallback messages */
      `var msgMap = new mw.Map();`,
      `msgMap.set(${JSON.stringify(fallbackMessages!)});`,
      /* We do the below to ensure backwards compatibility with Fandom's i18n-js */
      `if (mw.Message.prototype.escape === undefined) {`,
        `mw.Message.prototype.escape = mw.Message.prototype.escaped;`,
      `}`,
      /* We return a mock object */
      `var m = {`,
        `getMessages: function () {`,
          `return msgMap;`,
        `},`,
      `};`,
      `['_setDefaultLang', '_setTempLang', 'useLang', 'usePageLang', 'useContentLang', 'usePageViewLang', 'useUserLang']`,
        `.forEach(function (prop) {`,
          `m[prop] = $.noop;`,
        `});`,
      `['inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang']`,
        `.forEach(function (prop) {`,
          `m[prop] = function () { return this; }`,
        `});`,
      `return m;`,
    `}`,
    ]);
  }
  return code;
}

/**
 * Transformer logic
 * 
 * @param moduleIdsToWatch Only transform files that are listed in this bundle
 * @param code 
 * @param id 
 * @returns 
 */
export async function fandoomUtilsI18nTransformer(this: PluginContext, moduleIdsToWatch: { [gadgetId: string]: GadgetDefinition }, code: string, id: string): Promise<TransformResult> {
  const gadget: GadgetDefinition = moduleIdsToWatch[id];
  // Skip stylesheets, any gadgets that don't have i18n
  if (gadget === undefined) return;

  const foundIdToReplace = code.match(REGEX_ID);
  // No ID to replace
  if (foundIdToReplace === null) return;

  const { i18nOptions, loadOptions } = (() => {
    const rawArgs = foundIdToReplace[1].trim();
    const args = rawArgs === '' ? {} : JSON.parse(rawArgs);
    const i18nOptions: I18nOptions = {...args.options};
    delete args.options;
    return { i18nOptions, loadOptions: args }
  })();
  
  const boilerplate = await createI18nLoadingLogic(gadget!, loadOptions, i18nOptions);
  if (boilerplate === null) {
    this.error(`Failed to inject i18n loading logic: 'en' not found`);
    return;
  }

  this.info(`Injected i18n loading logic`);

  return {
    code: code.replace(
      foundIdToReplace[0],
      boilerplate.join('\n')
    ),
    map: null,
    moduleSideEffects: 'no-treeshake',
  }
}