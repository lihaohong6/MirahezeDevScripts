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
  useContentLang?: boolean
  useUserLang?: boolean
}

/**
 * The options object instance to pass to `loadMessages` (`FandoomUtilsI18njs`) 
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
  
  const fallbackMessages: { [key: string]: string } = {};
  Object.entries(i18nMessages.en).forEach(([messageKey, message]) => {
    fallbackMessages[`${name}__${messageKey}`] = message as string;
  });

  return [
    `function loadMessages() {`,
      `var deferred = new $.Deferred();`,
      `if (mw.loader.getState('${gadgetNamespace}.FandoomUtilsI18njs')) {`,
        `mw.loader.load('${gadgetNamespace}.FandoomUtilsI18njs');`,
        `mw.hook('dev.i18n').add(function (i18n) {`,
          `i18n.loadMessages('${name}'${i18nOptions && `, ${JSON.stringify(i18nOptions)}`})`,
            `.done(function (messages) {`,
              `if (!messages) {`,
                `deferred.resolve(loadFallbackMessages());`,
                `return;`,
              `}`,
              loadOptions?.useContentLang ? `messages.useContentLang();` : '',
              loadOptions?.useUserLang ? `messages.useUserLang();` : '',
              `deferred.resolve(messages);`,
            `});`,
        `});`,
        `return deferred;`,
      `}`,
      `deferred.resolve(loadFallbackMessages());`,
      `return deferred;`,
    `}`,

    `function loadFallbackMessages() {`,
      `mw.messages.set(${JSON.stringify(fallbackMessages)});`,
      `if (mw.Message.prototype.escape === undefined) {`,
        `mw.Message.prototype.escape = mw.Message.prototype.escaped;`,
      `}`,
      `return {`,
        `msg: function () {`,
          `arguments[0] = "${name}__" + arguments[0];`,
          `return mw.message.apply(null, arguments);`,
        `}`,
      `};`,
    `}`
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