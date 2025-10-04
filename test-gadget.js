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

const distPath = resolve(process.cwd(), 'dist', gadgetName);
const implPath = resolve(distPath, "gadget-impl.js");

// Read JS file if it exists
if (!existsSync(implPath)) {
  console.error("impl path not found");
}
const snippet = readFileSync(implPath, {encoding: "utf-8"});

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