import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { 
  normalizePath,
  transformWithOxc, 
  minifySync as minifyFnOxc, 
  ResolvedConfig
} from "vite";
import { minify as minifyFnTerser } from 'terser';
import type { MinifyOptions, OutputOptions } from 'rolldown';

const rxFileExtension = /\.[a-zA-Z0-9]+$/;

if (global.__dirname === undefined) {
  //@ts-ignore
  global.__dirname = import.meta.dirname;
}

/**
 * Determine if a userscript code file is a script, a stylesheet, or other asset.
 * 
 * @param filename 
 * @returns
 */
export function getFileType(filename: string): "script" | "style" | "other" {
  let extension: RegExpMatchArray | null | string = filename.match(rxFileExtension);
  if (extension !== null) {
    extension = extension[0].toLowerCase();
    switch (extension) {
      case '.js':
      case '.ts':
        return "script";
      case '.css':
      case '.less':
        return "style";
    }
  }
  return "other";
}

/**
 * @param filepath 
 * @returns 
 */
export function getFileExtension(filepath: string): string {
  const m = filepath.match(rxFileExtension);
  return m === null ? '' : m[0];
}

/**
 * For a userscript code file to be included in the bundle output,
 * resolve the file extension from development stage (e.g. .ts/.less)
 * to final build (e.g. compiled .js/.css)
 * 
 * @param filepath 
 * @returns 
 */
export function resolveFileExtension(filepath: string): string {
  filepath = filepath.replace(/\.ts$/i, '.js');
  filepath = filepath.replace(/\.less$/i, '.css');
  return filepath;
}

/**
 * @param filepath 
 * @returns 
 */
export function removeFileExtension(filepath: string): string {
  return filepath.replace(rxFileExtension, '');
}

/**
 * Used to resolve the bundle input key for compiled JS/CSS
 * 
 * @param filepath 
 * @returns 
 */
export function resolveFilepathForBundleInputKey(filepath: string): string {
  const sm = filepath.match(/^(.*)\.(?:ts|js)$/i);
  if (sm !== null) {
    return sm[1];
  }
  return resolveFileExtension(filepath);
}

/**
 * Resolves the path of the `gadgets` directory. If `gadgetName`
 * is provided, then this function will resolve the path of the gadget's 
 * subdirectory.
 * 
 * @param gadgetName 
 * @param codeRelativePath
 * @returns 
 */
export function resolveSrcGadgetsPath(gadgetName?: string, codeRelativePath?: string): string {
  const gadgetsDir = resolve(__dirname, '../gadgets');
  let gadgetDir = gadgetsDir;
  for (let rel of [gadgetName, codeRelativePath]) {
    if (!rel) { break; }
    gadgetDir = resolve(gadgetDir, rel);
  }
  return normalizePath(gadgetDir);
}

/**
 * Resolves the path of `gadgets/gadgets-definitions.yaml`
 */
export function resolveGadgetsDefinitionManifestPath(): string {
  return resolveSrcGadgetsPath('gadgets-definition.yaml');
}

/**
 * Resolves the path of the `dist/` directory. If a relative filepath is given, resolve
 * the path to the given relative filepath. 
 * 
 * @returns 
 */
export function resolveDistPath(relativeFilepath?: string, treatAsFile: boolean = false): string {
  const distFolder = resolve(__dirname, '../dist');
  if (!existsSync(distFolder)) {
    mkdirSync(distFolder);
  }
  let dir = distFolder;
  if (!!relativeFilepath) {
    dir = resolve(dir, relativeFilepath);
  }
  if (!existsSync(dir) && !treatAsFile) {
    mkdirSync(dir);
  }
  return dir;
}

/**
 * Resolves the path of the `dist/gadgets` directory. If `gadgetName`
 * is provided, then this function will resolve the path of the gadget's 
 * subdirectory.
 * 
 * @param gadgetName 
 * @param codeRelativePath
 * @returns 
 */
export function resolveDistGadgetsPath(gadgetName?: string, codeRelativePath?: string): string {
  let gadgetDir = resolveDistPath();
  for (let rel of [gadgetName, codeRelativePath]) {
    if (!rel) { break; }
    gadgetDir = resolve(gadgetDir, rel);
  }
  return normalizePath(gadgetDir);
}

/**
 * Resolves the path of `dist/load.js`
 * 
 * @returns 
 */
export function resolveEntrypointFilepath(): string {
  return normalizePath(resolveDistPath('load.js', true));
}

/**
 * Check if a gadget sub-directory or a gadget code file exists
 * 
 * @param gadgetName 
 * @param codeFile 
 * @returns 
 */
export function checkGadgetExists(gadgetName: string, codeFile?: string): boolean {
  const path = resolveSrcGadgetsPath(gadgetName, codeFile);
  return existsSync(path);
}

/**
 * 
 * @param code 
 * @param filename 
 * @param rolldownMinify 
 * @param buildConfig 
 */
export async function formatOrMinifyCode(
  code: string, 
  filename: string, 
  rolldownMinify: boolean | 'oxc' | 'terser',
  buildConfig?: ResolvedConfig
): Promise<string> {

  switch (rolldownMinify) {
    case false:
      // Format using Oxc
      const tf = await transformWithOxc(code, filename);
      if (!tf.code) {
        throw new Error(tf.warnings.length > 0 ? tf.warnings.join("\n") : "Unknown Oxc parsing error");
      }
      return tf.code;
    
    case 'oxc':
      const toxc = minifyFnOxc(
        filename, code, 
        ((buildConfig!.build.rolldownOptions.output as OutputOptions).minify as MinifyOptions)
      );
      if (!toxc.code) {
        throw new Error(toxc.errors.length > 0 ? toxc.errors.join("\n") : "Unknown Oxc minification error");
      }
      return toxc.code;

    case 'terser':
    default:
      const tter = await minifyFnTerser(code, buildConfig!.build.terserOptions);
      if (!tter.code) {
        throw new Error("Unknown Terser minification error");
      }
      return tter.code;
  }
}