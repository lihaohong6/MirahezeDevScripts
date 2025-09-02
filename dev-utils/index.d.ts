/* 
 * Schema for gadgets-definition.yaml 
 */
interface GadgetsDefinition {
  workspace: {
    // If enable_all is set to true, Vite will include all gadgets except those in "workspace.disable"
    // If enable_all is set to false, Vite will only include gadgets listed in "workspace.enable"
    enable_all?: boolean
    enable?: string[]
    disable?: string[]
  }
  gadgets: {
    [Key: string]: GadgetDefinition
  }
}

interface GadgetDefinition {
  // Purely informational metadata
  description?: string
  authors?: string[]
  links?: string[]
  version?: string

  // Specify this parameter if the module needs other modules to be registered first
  // The required module just needs to have state=registered on mw.loader, not state=ready
  requires?: string[]

  // List of files
  scripts?: string[]
  styles?: string[]
  i18n?: string[]

  // The gadget subdirectory is automatically set as the key in the gadgets definition  
  subdir?: string

  // If set to true on the gadgets definition, then Vite will exclude this file
  // from the list of gadgets that will be served/distributed 
  disabled?: boolean
  
  // 
  resourceLoader?: ResourceLoaderConditions
}

/* 
 * Refer to https://www.mediawiki.org/wiki/Extension:Gadgets#Options 
 * for more information on what these parameters mean 
 */
interface ResourceLoaderConditions {
  dependencies?: string | string[] | null
  rights?: string | string[] | null
  skins?: string | string[] | null
  actions?: string | string[] | null
  categories?: string | string[] | null
  namespaces?: string | string[] | null
  contentModels?: string | string[] | null
}