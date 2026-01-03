import { readFile } from "fs/promises";
import { PluginContext, TransformResult } from "rollup";
import { GadgetDefinition } from "./types";
import { resolveSrcGadgetsPath } from "./utils";

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
 * @param  gadgetNamespace
 * @param  gadget
 * @param  loadOptions
 * @param  i18nOptions
 * @returns 
 */
async function createI18nLoadingLogic(gadgetNamespace: string, gadget: GadgetDefinition, loadOptions?: LoadOptions, i18nOptions?: I18nOptions): Promise<string[] | null> {
  const { name, i18n } = gadget;

  const i18nMessages = JSON.parse(await readFile(resolveSrcGadgetsPath(name, i18n![0]), { encoding: 'utf-8', flag: 'r' }));
  if (i18nMessages.en === undefined) return null;
  
  const fallbackMessages: Record<string, string> = i18nMessages.en;

  const i18nLoaderGadgetName = `${gadgetNamespace}.FandoomUtilsI18nLoader`;

  return [
    /**
     * Defines the i18n object that parses the messages that will be rendered in DOM
     */
    `function prepareI18n(i18nLoader) {`,
      `var p = {`,
        `_i18nLoader: i18nLoader,`,
        `msg: function () {`,
          `var args = Array.prototype.slice.call(arguments);`,
          `if (args.length === 0) {`,
            `return;`,
          `}`,
          `var key = args.shift();`,
          `return new mw.Message(this._i18nLoader.getMessages(), key, args);`,
        `}`,
      `};`,
      `['setTempLang', 'setDefaultLang']`,
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
     * Creates a jQuery.Deferred() object that either resolves 1) the output of 
     * FandoomUtilsI18nLoader.loadMessages(), or 2) the output of 
     * getFallbackMessages() on event of failure in the process of trying to
     * call FandoomUtilsI18nLoader.loadMessages()
     */
    `function getI18nLoader() {`,
      `var deferred = new $.Deferred();`,
      `mw.loader.using('${i18nLoaderGadgetName}')`,
        `.done(function (require) {`,
          `var module = require('${i18nLoaderGadgetName}');`,
          `module.loadMessages('${name}'${i18nOptions && `, ${JSON.stringify(i18nOptions)}`})`,
            `.done(function (i18nLoader) {`,
              `if (!i18nLoader) {`,
                `deferred.resolve(getFallbackMessages());`,
                `return;`,
              `}`,
              loadOptions?.useLang ? `i18nLoader.useLang();` : '',
              loadOptions?.usePageLang ? `i18nLoader.usePageLang();` : '',
              loadOptions?.useContentLang ? `i18nLoader.useContentLang();` : '',
              loadOptions?.usePageViewLang ? `i18nLoader.usePageViewLang();` : '',
              loadOptions?.useUserLang ? `i18nLoader.useUserLang();` : '',
              `deferred.resolve(i18nLoader);`,
            `});`,
        `})`,
        `.fail(function (err) {`,
          `console.error(err);`,
          `deferred.resolve(getFallbackMessages());`,
        `});`,
      `return deferred;`,
    `}`,

    /** 
     * Create a mock object with the same API as the output of 
     * FandoomUtilsI18nLoader.loadMessages 
     * */
    `function getFallbackMessages() {`,
      `console.warn('[FandoomUtilsI18nLoader] Failed to load messages. Using fallback messages instead.');`,
      /* We inject the English i18n messages into the script/bundle as fallback messages */
      `var msgMap = new mw.Map();`,
      `msgMap.set(${JSON.stringify(fallbackMessages)});`,
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
      `['setDefaultLang', 'setTempLang', 'useLang', 'usePageLang', 'useContentLang', 'usePageViewLang', 'useUserLang']`,
        `.forEach(function (prop) {`,
          `m[prop] = $.noop;`,
        `});`,
      `['inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang']`,
        `.forEach(function (prop) {`,
          `m[prop] = function () { return this; }`,
        `});`,
      `return m;`,
    `}`,
  ]
}

/**
 * Transformer logic
 * 
 * @param gadgetNamespace
 * @param moduleIdsToWatch Only transform files that are listed in this bundle
 * @param code 
 * @param id 
 * @returns 
 */
export async function fandoomUtilsI18nTransformer(this: PluginContext, gadgetNamespace: string, moduleIdsToWatch: { [gadgetId: string]: GadgetDefinition }, code: string, id: string): Promise<TransformResult> {
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
  
  const boilerplate = await createI18nLoadingLogic(gadgetNamespace, gadget!, loadOptions, i18nOptions);
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