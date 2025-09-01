## About
This repository sets up a Vite server that enables easier development of userscripts on a MediaWiki instance.

### Development - Workflow

```sh
npm run dev
```
Running this command will create an entrypoint file named `load.js` in the project directory. This file simply tells your local MediaWiki instance to load & implement the userscripts placed on the `gadgets/` folder, provided they have been defined in `gadgets/gadgets-definition.yaml` (Refer to [Gadgets Definition](#gadgets-definition) for more information on how to configure this file). To use the `load.js` file, add the following line of code in your User:&lt;Username&gt;/common.js on your local MediaWiki instance:
```js
mw.loader.load('https://localhost:5173/load.js');
```

You can then check if your gadgets have been loaded onto MediaWiki by running `console.log(mw.loader.getState("ext.gadget.store.<Name of gadget>"));` on the MediaWiki's Developer Console.

You should only use this command in **development** environments.

### Distribution - Workflow

```sh
npm run build
```
Running this command will generate gadgets in the folder `dist/` in the project directory. The files that will be loaded are:
 - Minified scripts & stylesheets
 - i18n.json files (served as-is without minification)
 - Rolled-up gadget implementation, in a file named `gadget-impl.js` on each gadget sub-directory

When served through a CDN like jsDelivr, you have the choice of either loading the minified scripts & stylesheets directly:
```js
mw.loader.load('https://some-cdn-domain.com/gadgets/example-gadget/code.js');
mw.loader.load('https://some-cdn-domain.com/gadgets/example-gadget/code.css', 'text/css');
```

Or loading the rolled-up gadget implementation:
```js
mw.loader.load('https://some-cdn-domain.com/gadgets/example-gadget/gadget-impl.js');
```

The pros & cons of loading the gadgets with these two methods are:
 - Loading the minified scripts & stylesheets allows segments of your whole gadget to be loaded in chunks. However, this may also lead to unexpected behaviour if some chunks of your gadget were to fail to load.
 - Loading `gadget-impl.js` registers the gadget under the name of `ext.gadget.store.<Gadget name>`. You can then check on the status of your gadget by calling `mw.loader.getState('ext.gadget.store.<Gadget name>')`.
 - By contrast, loading the minified scripts & stylesheets through `mw.loader.load` or `$.getScript` does not register the code as a MediaWiki ResourceLoader module. While this means that the gadgets will never have a namespace conflict with other modules on the wiki, it also means that the gadgets cannot be checked upon by other gadgets using `mw.loader.getState('ext.gadget.store.<Gadget name>')`, nor can they be called upon by other gadgets using `mw.loader.using`.
 - `gadget-impl.js` enables conditional loading of your gadgets, similar to gadgets defined using [Extension:Gadgets](https://www.mediawiki.org/wiki/Extension:Gadgets#Options) (Refer to [Gadgets Definition](#gadgets-definition) for more information). 

### Other commands
You can also run `npm run watch` to get the Vite server to watch changes made to the `gadgets/` folder in the project directory, rebuilding those files into the `dist/` folder each time. This may incur large overhead. 

## Gadgets Definition
The file `gadgets/gadgets-definition.yaml` defines the userscripts to be built on a MediaWiki instance. The format of `gadgets/gadgets-definition.yaml` is as follows:
```yaml
workspace:
  # Set as true if you want to load all the gadgets defined in gadgets-definition.yaml
  enable_all: true
  # This setting excludes the following gadgets from being loaded when enable_all = true
  disable: ["foo", "bar"]

  # Alternatively, these options enable only the specified gadgets
  # enable_all: false
  # enable: ["foo", "bar"]

gadgets:
  # This tells the repository to look for code files from the directory /gadgets/HelloWorld
  # The name that the gadget will be registered under is also the same as the subdirectory 
  HelloWorld:
    description: "A simple gadget configuration"
    scripts:
      - index.js    # .ts files are also supported
    styles:
      - style.css   # LESS files are also supported
    i18n:
      - i18n.json
  
  # gadgets-definition.yaml also enables userscripts to be loaded conditionally, like userscripts 
  # that are defined using Extension:Gadgets
  LoadMeConditionally:
    description: "A gadget that is loaded only on Main article pages, on action=view"
    scripts:
      - index.js
    resourceLoader:
      actions:
        - view
      namespaces: "0"
```

The full schema of a gadget object on `gadgets-definition.yaml` is as follows:
```yaml
gadgets:
  # The key of the gadget object is the same as the name of the gadget, which
  # is also the same as the gadget subdirectory
  # In other words, the repository will look for code files in the folder
  # gadgets/GadgetName
  GadgetName:     # Can also be in camelCase, kebab-case, or snake_case
    
    # The following are optional metadata properties
    description: "Some description"
    authors:
      - John Doe
    links: 
      - https://some/link/to/the/userscripts/homepage
    version: "1.0.0"

    # The "requires" property is optional
    # This property tells the repository to load the gadgets only after 
    # the userscripts listed under it have been registered first
    # Only used in development mode
    requires:
      - Dependency1
      - Dependency2

    # The files to be loaded
    scripts:
      - index.js
      - code.ts     # TypeScript is supported
    styles:
      - index.css
      - style.less  # LESS is supported
    i18n:
      - i18n.json

    # You can disable the gadget using this property
    # disabled: true
  
    # This property sets the conditions that must be met to load & register the module
    resourceLoader:
      # For each of the properties below, you can add them in one of the following ways:
      # In list form:
      #   dependencies:
      #    - ooui-js
      #    - mediawiki.util
      # In array form:
      #   dependencies: ["ooui-js", "mediawiki.util"]
      # Or in string form:
      #   dependencies: "ooui-js,mediawiki.util"

      # Loads the modules listed under it before loading the gadget.
      # Under the hood, this implements mw.loader.using
      dependencies:

      # Only users with the specified user rights may load the gadget.
      rights:

      # Only load the gadget on specific skins
      skins:

      # Only load the gadget on specific page actions, e.g. action=edit
      actions:

      # Only load the gadget on specified categories, e.g. "Archived"
      categories:

      # Only load the gadget on specified namespaces, e.g. "0,1" -> Main & Talk
      namespaces:

      # Only load the gadget on specific content models, e.g. wikitext
      contentModels:
``` 