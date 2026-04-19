/**
 * Schema for gadgets-definition.yaml 
 */
export interface GadgetsDefinition {
  workspace: {
    // If enable_all is set to true, Vite will include all gadgets except those in "workspace.disable"
    // If enable_all is set to false, Vite will only include gadgets listed in "workspace.enable"
    enable_all?: boolean
    enable?: string[]
    disable?: string[]
  }
  gadgets: {
    [GadgetName: string]: GadgetDefinition
  }
}

/**
 * Basic schema for one gadget
 */
export interface GadgetDefinition {
  /**
   * Purely informational metadata 
   */ 
  description?: string
  /**
   * Purely informational metadata 
   */ 
  authors?: string[]
  /**
   * Purely informational metadata 
   */ 
  links?: string[]
  /**
   * Purely informational metadata 
   */ 
  version?: string

  /**
   * Specify this parameter if the module needs other modules on this project to be registered first.
   * The required module just needs to have `state=registered` on `mw.loader`, not `state=ready`
   */ 
  requires?: string[]

  /**
   * List of JS scripts
   */
  scripts?: string[]
  /**
   * List of CSS stylesheets
   */
  styles?: string[]

  /**
   * List of i18n messages.
   */
  i18n?: string[]

  /**
   * The gadget name is automatically set during the build process
   */ 
  name: string

  /**
   * If set to true on the gadgets definition, then Vite will exclude this file
   * from the list of gadgets that will be served/distributed 
   */
  disabled?: boolean
  
  /**
   * Specify specific loading conditions. Used to emulate MediaWiki's ResourceLoader.
   */
  resourceLoader?: ResourceLoaderConditions
}

/**
 * Refer to https://www.mediawiki.org/wiki/Extension:Gadgets#Options 
 * for more information on what these parameters mean 
 */
export interface ResourceLoaderConditions {
  dependencies?: string | string[] | null
  rights?: string | string[] | null
  skins?: string | string[] | null
  actions?: string | string[] | null
  categories?: string | string[] | null
  namespaces?: string | string[] | null
  contentModels?: string | string[] | null
}