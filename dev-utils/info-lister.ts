import { render } from 'mustache';
import { createScriptLoadingStatement } from "./build-orchestration";
import { GadgetDefinition, ResourceLoaderConditions } from "./types";
import { resolveDistPath } from "./utils";
import { resolve } from 'node:path';
import { writeFileSync, readFileSync } from "node:fs";

interface MustacheViewModel {
  gadgets: {
    idx: number
    name: string
    authors: string[] | null
    description: string
    resourceLoader: string
    loadScript: string
  }[]
}

/**
 * Build a simple HTML overview page containing the script info
 * 
 * @param gadgets 
 * @returns 
 */
export function buildOverviewPageHtml(gadgets: readonly GadgetDefinition[]): void {
  try {
    const vm = prepareViewModel(gadgets);
    const template = readFileSync(resolve(__dirname, "./gadget-overview.mustache"), { encoding: 'utf-8', flag: 'r' });
    const html = render(template, vm);

    writeFileSync(
      resolveDistPath('index.html', true),
      html,
      { flag: 'w+', encoding: 'utf-8' }
    );
  } catch (err) {
    console.error(err);
  }
}

/**
 * 
 * @param gadgets 
 * @returns 
 */
function prepareViewModel(gadgets: readonly GadgetDefinition[]): MustacheViewModel {
  const gadgetsVm = [...gadgets]
    .sort(({ name: a }, { name: b }) => {
      a = a.toLocaleLowerCase();
      b = b.toLocaleLowerCase();
      // sort alphabetically
      return (a < b) ? -1 : (a > b) ? 1 : 0;
    })
    .map(({ name, authors = [], description = null, links = [], resourceLoader = {} }, idx) => ({
      idx: idx+1,
      name,
      authors,
      description: createDescriptionHtmlBlock(description, links),
      resourceLoader: createResourceLoaderConditions(resourceLoader),
      loadScript: createScriptLoadingStatement(name, false),
    }));
  
  return { 
    gadgets: gadgetsVm
  };
}

/**
 * This returns a raw HTML block that will be rendered by Mustache. XSS risks should be addresed accordingly.
 * 
 * @param description 
 * @param links 
 */
function createDescriptionHtmlBlock(description: string | null, links: string[]): string {
  const sb: string[] = [];
  sb.push('<div>');
  if (!description) {
    sb.push('<i>No description available</i>');
  } else {
    sb.push('<div>');
    sb.push(escapeXml(description));
    sb.push('</div>');
  }
  if (links.length) {
    sb.push('<ul>');
    links.forEach((link) => {
      sb.push('<li>');
      link = escapeXml(link);
      sb.push(`<a href="${link}" target="_blank" rel="noreferrer">${link}</a>`);
      sb.push('</li>');
    });
    sb.push('</ul>');
  }
  sb.push('</div>');
  return sb.join('');
}

/**
 * @param variable 
 * @returns 
 */
function normalizeYamlListVariable(variable: string | string[]) {
  if (typeof variable === 'string') {
    return variable.trim().split(/\s*,\s*/).filter((val) => val !== '');
  }
  return variable;
}

/**
 * Common MediaWiki namespaces
 */
const DICT_NAMESPACES: Map<string, string> = new Map(Object.entries({
  '-2': 'Media',
  '-1': 'Special',
  0: 'Main',
  1: 'Talk',
  2: 'User',
  3: 'User talk',
  4: 'Project',
  5: 'Project talk',
  6: 'File',
  7: 'File talk',
  8: 'MediaWiki',
  9: 'MediaWiki talk',
  10: 'Template',
  11: 'Template talk',
  12: 'Help',
  13: 'Help talk',
  14: 'Category',
  15: 'Category talk',
  828: 'Module',
  829: 'Module talk',
}));

/**
 * This returns a raw HTML block that will be rendered by Mustache. XSS risks should be addresed accordingly.
 * 
 * @param resourceLoader 
 */
function createResourceLoaderConditions(resourceLoader: ResourceLoaderConditions): string {
  const sb: string[] = [];
  const props = ['rights', 'skins', 'actions', 'categories', 'namespaces', 'contentModels'] as const;

  props.forEach((prop) => {
    let values = normalizeYamlListVariable(resourceLoader[prop] || '');
    if (values.length === 0) {
      return;
    }
    // Convert namespace numeric ID to common name 
    if (prop === 'namespaces') {
      values = values.map((val) => DICT_NAMESPACES.get(val) || val);
    }
    // ul header
    // prop is one of the values 'rights', 'skins', 'actions', 'categories', 'namespaces', 'contentModels', so escaping is not necessary here
    sb.push(`<div>${prop[0].toUpperCase()}${prop.slice(1, prop.length)}</div>`);
    sb.push('<ul>');
    values.forEach((val) => {
      sb.push(`<li><code>${escapeXml(val)}</code></li>`);
    });
    sb.push('</ul>');
  });

  if (sb.length === 0) {
    sb.push(`<i>None</i>`);
  } else {
    sb.unshift(`<p><i>Restricted to the following pages/user groups:</i></p>`);
  }
  
  return sb.join('');
}

/**
 * Fast, naive way to escape XML
 * 
 * @param unsafe 
 * @returns 
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&"']/g, (c: string) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
      default: return c;
    }
  });
}
