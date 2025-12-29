import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedAjaxBatchRedirect(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      const base = `AjaxBatchRedirect${i === 0 ? '' : ' with-i18n'}`;
      const title = `${base} ${j+1}`; 
      const checkNewTitle = `${base} redirect ${j+1}`;
      seedPage(operations, {
        title,
      });
      /* Delete redirects if alr created */
      operations.set(
        checkNewTitle,
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