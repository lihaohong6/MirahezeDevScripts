import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedMassRename(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 20; j++) {
      const title = `MassRename${i === 0 ? '' : ' with-i18n'} ${j+1}`; 
      seedPage(operations, {
        title,
      });
      if (j >= 10) {
        /* Delete any page that was moved */
        operations.set(
          `${title} moved`,
          {
            callbacks: [
              async (bot, pageTitle, defaultEditSummary) => {
                try {
                  await bot.delete(pageTitle, defaultEditSummary);
                  console.log(`Deleted page ${pageTitle}`);
                } catch (err) {}
              }
            ]
          }
        );
      }
    }
  }
}