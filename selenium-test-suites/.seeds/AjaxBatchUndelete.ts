import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedAjaxBatchUndelete(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      let title = `AjaxBatchUndelete${i === 0 ? '' : ' with-i18n'} ${j+1}`; 
      seedPage(operations, {
        title,
        callback: 
          /* Delete the page it just created */
          async (bot, pageTitle, defaultEditSummary) => {
            await bot.delete(pageTitle, defaultEditSummary);
            console.log(`Deleted page ${pageTitle}`);
          }
      });
    }
  }
}