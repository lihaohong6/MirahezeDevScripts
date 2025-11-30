import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";
import { normalizePath } from "vite";

const rxFileExtension = /\.[a-zA-Z0-9]+$/;

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
 * 
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
 * 
 * @param filepath 
 * @returns 
 */
export function removeFileExtension(filepath: string): string {
  return filepath.replace(rxFileExtension, '');
}

/**
 * Used to resolve the bundle input key for compiled JS/CSS
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
 * Resolves the path of `src/gadgets/gadgets-definitions.yaml`
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
export function resolveDistPath(relativeFilepath?: string): string {
  const distFolder = resolve(__dirname, '../dist');
  if (!existsSync(distFolder)) {
    mkdirSync(distFolder);
  }
  let dir = distFolder;
  if (!!relativeFilepath) {
    dir = resolve(dir, relativeFilepath);
  }
  if (!existsSync(dir)) {
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
  const srcDirPath = resolveDistPath();
  const gadgetsDir = resolve(srcDirPath, './gadgets');
  let gadgetDir = gadgetsDir;
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
  const distFolder = resolveDistPath();
  return normalizePath(resolve(distFolder, 'load.js'));
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