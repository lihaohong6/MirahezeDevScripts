import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedPreloadTemplates(operations: SeedingWikipageOperations) {
  const pages = {
    'Template:PreloadTemplates A/preload': `<includeonly>
{{Template 1
| parameter A   = 
| parameter B   = 
| parameter C   = 
}}</includeonly>
<noinclude>
Stuff that should not be preloaded.
</noinclude>`,
    'Template:PreloadTemplates B/preload': `{{Template 2|foo|bar|baz}}`,
    'Template:PreloadTemplates C/preload': `<noinc<includeonly>lude>
Lorem ipsum dolor sit amet
</noinc<includeonly/>lude>`,
    'MediaWiki:PreloadTemplates/primary': `Generic templates:
* PreloadTemplates A | Template A (an infobox)
* PreloadTemplates B
* PreloadTemplates C`,
    'MediaWiki:PreloadTemplates/secondary': `Generic templates:
* PreloadTemplates A | Template A (an infobox)
* PreloadTemplates B
* PreloadTemplates C

Other templates:
* PreloadTemplates A
* PreloadTemplates B
* PreloadTemplates C`,
  };
  Object.entries(pages).forEach(([title, contents]) => {
    operations.set(
      title,
      {
        contents,
        callbacks: []
      }
    );
  });
}