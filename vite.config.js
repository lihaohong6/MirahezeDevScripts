/**
 * Mostly written by Claude.
 */
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'

// Function to discover all gadgets and their entry points
function getGadgetEntries() {
  const gadgetsDir = resolve(__dirname, 'gadgets')
  const entries = {}
  
  if (!existsSync(gadgetsDir)) {
    return entries
  }
  
  const gadgetDirs = readdirSync(gadgetsDir).filter(dir => 
    statSync(resolve(gadgetsDir, dir)).isDirectory()
  )
  
  gadgetDirs.forEach(gadgetName => {
    const gadgetPath = resolve(gadgetsDir, gadgetName)
    
    // Check for JS/TS files
    const jsFiles = ['index.js', 'index.ts'].find(file => 
      existsSync(resolve(gadgetPath, file))
    )
    if (jsFiles) {
      entries[`${gadgetName}/index`] = resolve(gadgetPath, jsFiles)
    }
    
    // Check for CSS files
    const cssFiles = ['style.css', 'style.less'].find(file => 
      existsSync(resolve(gadgetPath, file))
    )
    if (cssFiles) {
      entries[`${gadgetName}/style`] = resolve(gadgetPath, cssFiles)
    }
  })
  
  return entries
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: getGadgetEntries(),
      output: {
        // Preserve the directory structure
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name + '.js'
        },
        assetFileNames: (assetInfo) => {
          // Handle CSS files
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return assetInfo.name
          }
          return 'assets/[name][extname]'
        }
      }
    },
    outDir: 'dist/gadgets',
    emptyOutDir: true
  },
  css: {
    preprocessorOptions: {
      less: {
        // Add any Less-specific options here
      }
    }
  }
})
