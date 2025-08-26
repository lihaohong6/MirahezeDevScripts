#!/usr/bin/env node
// Written mostly by Claude
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'
import { exec } from "child_process";
import { tmpdir } from "os";

// Get gadget name from command line argument
const gadgetName = process.argv[2]

if (!gadgetName) {
    console.error('Usage: node test-gadget.js <gadget-name>')
    console.error('Example: node test-gadget.js BackgroundImage')
    process.exit(1)
}

exec(`npm run build`, (err) => {
    if (err) {
        console.error("Failed to build");
    } else {
        console.log("Rebuilt");
    }
});

const distPath = resolve(process.cwd(), 'dist/gadgets', gadgetName)
const jsPath = resolve(distPath, 'index.js')
const cssPath = resolve(distPath, 'style.css')

// Check if files exist
if (!existsSync(jsPath) && !existsSync(cssPath)) {
    console.error(`No built files found for gadget "${gadgetName}". Did you run "npm run build"?`)
    process.exit(1)
}

let jsContent = ''
let cssContent = ''

// Read JS file if it exists
if (existsSync(jsPath)) {
    jsContent = readFileSync(jsPath, 'utf8')
}

// Read CSS file if it exists
if (existsSync(cssPath)) {
    cssContent = readFileSync(cssPath, 'utf8')
}

// Generate the test snippet
const snippet = `
(function() {
  console.log('Loading gadget: ${gadgetName}');
  
  ${cssContent ? `
  // Inject CSS
  const style = document.createElement('style');
  style.textContent = \`${cssContent.replace(/`/g, '\\`')}\`;
  document.head.appendChild(style);
  console.log('✓ CSS loaded');
  ` : '// No CSS file found'}
  
  ${jsContent ? `
  // Inject and execute JS
  ${jsContent}
  ` : '// No JS file found'}
  
  console.log('Gadget ${gadgetName} loaded successfully');
})();
`.trim()

function copyWithWlCopy(text) {
  const tmpFile = join(tmpdir(), `clipboard-${Date.now()}.txt`);

  // Write text to temporary file
  writeFileSync(tmpFile, text, "utf8");

  // Use wl-copy to copy file contents
  exec(`wl-copy < "${tmpFile}"`, (err) => {
    if (err) {
      console.error("Failed to copy:", err);
    } else {
      console.log("Copied to clipboard!");
    }
  });
}

copyWithWlCopy(snippet);