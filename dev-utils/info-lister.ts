import { JSDOM } from "jsdom";
import { createScriptLoadingStatement } from "./build-orchestration";
import { GadgetDefinition } from "./types";
import { resolveDistPath } from "./utils";
import { writeFileSync } from "node:fs";

/**
 * Build a simple HTML overview page containing the script info
 * 
 * @param gadgets 
 * @returns 
 */
export function buildOverviewPageHtml(gadgets: GadgetDefinition[]): void {
  const dom = new JSDOM(`<!DOCTYPE html><html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body></body></html>`);
  const doc = dom.window.document;
  const title = doc.createElement('title');
  title.textContent = 'MirahezeDevScripts';
  doc.head.appendChild(title);
  appendStyles(doc);

  buildInfoOverview(doc);
  buildListOfGadgets(doc, gadgets);

  appendScript(doc);

  writeFileSync(
    resolveDistPath('index.html', true),
    dom.serialize(),
    { flag: 'w+', encoding: 'utf-8' }
  );
}

/**
 * @param doc 
 */
function appendStyles(doc: HTMLDocument): void {
  const urls = ['https://cdn.simplecss.org/simple.min.css'];
  const styles = urls.map((url) => {
    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', url);
    return link;
  });

  const styleTag = doc.createElement('style');
  styleTag.setAttribute('type', 'text/css');
  styleTag.textContent = `
    body {
      grid-template-columns: none;
      margin: 0 10em;
    }
    table {
      width: 100%;
      overflow-x: scroll;
      display: block;
    }
    td {
      word-break: break-word;
    }
    th:nth-child(2) {
      min-width: 180px;
    }
    th:nth-child(3) {
      min-width: 220px;
    }
    th:nth-child(4) {
      min-width: 320px;
    } 
    th:nth-child(5) {
      min-width: 200px;
    }
    @media (min-width:768px) and (max-width:1200px) {
      body {
        margin: 0 5em;
      }
    }
    @media (min-width:501px) and (max-width:767px) {
      body {
        margin: 0 2em;
      }
    }
    @media (max-width:500px) {
      body {
        margin: 0 20px;
      }
      table, thead, tbody, tr, th, td {
        display: block;
        width: 100%;
      }
      th, td {
        border-top: none;
        border-bottom: none;
      }
      th {
        display: none;
        min-width: none;
      }
      td:first-child {
        border-top: solid 1px;
      }
      td:last-child {
        border-bottom: solid 1px;
      }
      td a {
        word-break: break-all;
      }
      td::before {
        font-style: italic;
        text-decoration: underline;
      }
      td:nth-child(3)::before {
        content: 'Authors';
      }
      td:nth-child(4)::before {
        content: 'Description';
      }
      td:nth-child(5)::before {
        content: 'Restrictions';
      }
      td:nth-child(6)::before {
        content: 'Load';
      }
    }

    .code-block {
      position: relative;
      margin: 1.5rem 0;
    }
    .code-block pre {
      padding: 1rem;
      padding-top: 2.5rem;
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 6px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.9rem;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      left: 8px;
      padding: 4px 8px;
      font-size: 0.75rem;
      background: #333;
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.8;
    }
    .copy-btn:hover {
      opacity: 1;
    }
    .copy-btn.copied {
      background: #2ea043;
    }
  `
  .trim()
  .replaceAll(/(?<=\}|\{|;)\s*/g, '')
  .replaceAll(/\s*(?=\{)/g, '')
  .replaceAll(/(;(?=\})|(?<=:) )/g, '');  // ad-hoc minification

  doc.head.append(...styles, styleTag);
}

/**
 * @param doc 
 */
function appendScript(doc: HTMLDocument): void {
  const script = doc.createElement('script');
  script.textContent = `
  document.querySelectorAll(".copy-btn").forEach(button => {
    button.addEventListener("click", () => {
      const code = button.nextElementSibling.innerText;

      navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("copied");

        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("copied");
        }, 1500);
      });
    });
  });
  `.trim()
  .replaceAll(/(?<=\{|;)\s*(?=[a-zA-Z]|\})\s*/g, ''); // ad-hoc minification
  doc.body.appendChild(script);
}

/**
 * @param doc 
 */
function buildInfoOverview(doc: HTMLDocument): void {
  const heading = doc.createElement('h2');
  heading.textContent = 'Miraheze Dev Scripts';
  const instructions = doc.createElement('p');
  const formatWikipageSpan = (title: string) => {
    const code = doc.createElement('span');
    code.style.whiteSpace = 'nowrap';
    code.textContent = title;
    return code;
  } 
  instructions.append(
    'To use one of these scripts, copy the line of code listed below (',
    (() => {
      const code = doc.createElement('code');
      code.textContent = 'mw.loader.load(...)';
      return code;
    })(),
    ') to either your ',
    formatWikipageSpan('User:<username>/common.js'),
    ' page (single-user installation) or ', 
    formatWikipageSpan('MediaWiki:Common.js'), 
    ' (site-wide installation) page on your wiki.'
  );
  const disclaimer = doc.createElement('p');
  disclaimer.append(
    'The state of these scripts is tentative and may change at any time. Always verify the code that you are executing on your wiki or userpage.'
  );
  const copyrightNotice = doc.createElement('p');
  copyrightNotice.append(
    'The contents of the scripts listed here are originally listed under the ',
    (() => {
      const a = doc.createElement('a');
      a.setAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/deed.en');
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noreferrer');
      a.textContent = 'Creative Commons Attribution-Share Alike License 3.0 (Unported) (CC BY-SA) license';
      return a;
    })(),
    '. Be sure that you are not violating any terms of the license when you are reusing, modifying, or redistributing the scripts listed below.'
  );
  doc.body.append(
    heading,
    instructions,
    disclaimer,
    copyrightNotice
  );
}

/**
 * @param doc 
 * @param gadgets 
 */
function buildListOfGadgets(doc: HTMLDocument, gadgets: GadgetDefinition[]): void {
  const heading = doc.createElement('h2');
  heading.textContent = 'List of Scripts';
  
  const table = doc.createElement('table');
  const thead = doc.createElement('thead');
  buildGadgetListTableHeader(doc, thead);
  const tbody = doc.createElement('tbody');
  gadgets.forEach((gadget, idx) => {
    buildGadgetListTableRow(doc, tbody, gadget, idx+1);
  });
  
  table.append(thead, tbody);
  doc.body.append(table);
}

/**
 * Utility function - build HTML table cell
 * 
 * @param doc 
 * @param tagName 
 * @param contents 
 * @returns 
 */
function buildTableCell(doc: HTMLDocument, tagName: 'th' | 'td', contents: Text | HTMLElement): HTMLTableCellElement {
  const tcell = doc.createElement(tagName);
  tcell.appendChild(contents);
  return tcell;
}

/**
 * Utility function - build gadget list table headers 
 * 
 * @param doc 
 * @param thead 
 */
function buildGadgetListTableHeader(doc: HTMLDocument, thead: HTMLTableSectionElement): void {
  const theadRow = doc.createElement('tr');
  const tableHeaderColumnLabels = [
    'No', 'Name', 'Authors', 'Description', 'Restrictions', 'Load Script'
  ];
  const thCells = tableHeaderColumnLabels.map((label) => {
    const textNode = doc.createTextNode(label);
    return buildTableCell(doc, 'th', textNode);
  });
  theadRow.append(...thCells);
  thead.append(theadRow);
}

/**
 * Utility function - build gadget list table row 
 * 
 * @param doc 
 * @param tbody 
 * @param gadget 
 * @param rowIdx 
 */
function buildGadgetListTableRow(doc: HTMLDocument, tbody: HTMLTableSectionElement, gadget: GadgetDefinition, rowIdx: number): void {
  const tRow = doc.createElement('tr');
  const _buildTableCell: (contents: Text | HTMLElement) => HTMLTableSectionElement = buildTableCell.bind(null, doc, 'td');
  const tCells = [
    _buildTableCell(doc.createTextNode(''+rowIdx)),
    _buildTableCell(buildGadgetName(doc, gadget)),
    _buildTableCell(buildGadgetAuthorsInfo(doc, gadget)),
    _buildTableCell(buildGadgetDescription(doc, gadget)),
    _buildTableCell(buildGadgetLoadingRestrictionsOverview(doc, gadget)),
    _buildTableCell(buildGadgetLoadingCode(doc, gadget)),
  ];
  tRow.append(...tCells);
  tbody.append(tRow);
}

/**
 * Utility function - build gadget name table cell
 * 
 * @param doc 
 * @param param1 
 * @returns 
 */
function buildGadgetName(doc: HTMLDocument, { name, version }: GadgetDefinition): HTMLElement {
  const div = doc.createElement('div');

  const spanName = doc.createElement('div');
  spanName.textContent = name;
  div.appendChild(spanName);

  if (version) {
    const spanVersion = doc.createElement('div');
    const iTag = doc.createElement('i');
    iTag.textContent = 'v '+version;
    spanVersion.appendChild(iTag);
    div.appendChild(spanVersion);
  }

  return div;
}

/**
 * Utility function - build gadget name author metadata table cell
 * 
 * @param doc 
 * @param param1 
 * @returns 
 */
function buildGadgetAuthorsInfo(doc: HTMLDocument, { authors }: GadgetDefinition): HTMLElement {
  if (!authors) {
    const iTag = doc.createElement('i');
    iTag.textContent = 'No authors listed';
    return iTag;
  }

  const ul = doc.createElement('ul');
  ul.append(
    ...authors
      .map((author) => {
        const li = doc.createElement('li');
        li.textContent = author;
        return li;
      })
  );
  return ul;
}

/**
 * Utility function - build gadget description table cell
 * 
 * @param doc 
 * @param param1 
 * @returns 
 */
function buildGadgetDescription(doc: HTMLDocument, { description, links }: GadgetDefinition): HTMLElement {
  if (!description) {
    const iTag = doc.createElement('i');
    iTag.textContent = 'No description available';
    return iTag;
  }

  const div = doc.createElement('div');

  const divDesc = doc.createElement('div');
  divDesc.textContent = description;

  const divLinks = doc.createElement('div');
  if (links && links.length > 0) {
    const ul = doc.createElement('ul');
    const lis = links.map((link) => {
      const li = doc.createElement('li');
      const a = doc.createElement('a');
      a.setAttribute('href', link);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noreferrer');
      a.textContent = link;
      li.appendChild(a);
      return li;
    });
    ul.append(...lis);
    divLinks.appendChild(ul);
  }

  div.append(divDesc, divLinks);
  
  return div;
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
 * Utility function - build gadget loading restrictions table cell
 * 
 * @param doc 
 * @param param1 
 * @returns 
 */
function buildGadgetLoadingRestrictionsOverview(doc: HTMLDocument, { resourceLoader }: GadgetDefinition): HTMLElement {
  const masterDiv = doc.createElement('div');

  const p = doc.createElement('p');  
  
  if (!resourceLoader) {
    resourceLoader = {};
  }
  const props = ['rights', 'skins', 'actions', 'categories', 'namespaces', 'contentModels'];
  const _mapper = (prop: 'rights' | 'skins' | 'actions' | 'categories' | 'namespaces' | 'contentModels') => {
    let values = (resourceLoader[prop]);
    if (!values) {
      return { key: prop, values: null };
    }
    values = normalizeYamlListVariable(values);
    if (values.length === 0) {
      return { key: prop, values: null };
    }
    // Special case: namespaces
    if (prop === 'namespaces') {
      values = values.map(value => {
        if (!DICT_NAMESPACES.has(value)) {
          return value;
        }
        return DICT_NAMESPACES.get(value)!;
      });
    }
    return { key: prop, values };
  }
  const conditions = props.map(_mapper).filter(({ values }) => values !== null);

  if (conditions.length === 0) {
    const iTag = doc.createElement('i');
    iTag.textContent = 'None';
    p.appendChild(iTag);
  } else {
    p.textContent = 'Restricted to the following pages/user groups:';
  }
  
  const conditionsRendered = conditions.map(({ key, values }) => {
    const d = doc.createElement('div');
    const h = doc.createElement('p');
    const ul = doc.createElement('ul');
    // Capital case
    h.textContent = key[0].toUpperCase() + key.slice(1, key.length);
    ul.append(
      ...values!.map((value) => {
        const li = doc.createElement('li');
        li.textContent = value;
        return li;
      })
    );
    d.append(h, ul);
    return d;
  });
  masterDiv.appendChild(p);
  masterDiv.append(...conditionsRendered);

  return masterDiv;
}

/**
 * Utility function - build gadget table cell containing line of code to load the cell
 * 
 * @param doc 
 * @param param1 
 * @returns 
 */
function buildGadgetLoadingCode(doc: HTMLDocument, { name }: GadgetDefinition): HTMLElement {
  const divBlock = doc.createElement('div');
  divBlock.classList.add('code-block');
  
  const button = doc.createElement('button');
  button.setAttribute('type', 'button');
  button.classList.add('copy-btn');
  button.setAttribute('aria-label', 'Copy code');
  button.textContent = 'Copy';
  
  const pre = doc.createElement('pre');
  pre.textContent = createScriptLoadingStatement(name);

  divBlock.append(
    button,
    pre
  );

  return divBlock;
}