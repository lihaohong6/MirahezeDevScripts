import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedAjaxBatchDelete(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 20; j++) {
      seedPage(operations, {
        title: `AjaxBatchDelete${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        callback: j < 10 ? undefined :
          /* Unprotect page if already protected */
          async (bot, pageTitle, defaultEditSummary) => {
            try {
              const res = await bot.request({
                action: 'protect',
                title: pageTitle,
                protections: 'create=all',
                expiry: 'infinite',
                reason: defaultEditSummary,
                token: (await bot.getCsrfToken())
              });
              console.log(`Unprotected ${pageTitle}`);
            } catch (err) {}
          }  
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `AjaxBatchDelete Category Test${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: `This page is a part of the category [[:Category:AjaxBatchDelete Test Category${i === 0 ? '' : ' with-i18n'}]].\n\n[[Category:AjaxBatchDelete Test Category${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
  }
}