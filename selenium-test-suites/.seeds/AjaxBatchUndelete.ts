import { Mwn } from "mwn";

import { seedPage } from "./utils.ts";

export function seedAjaxBatchUndelete(pages: Map<string, string>, callbacks: Map<string, (bot: Mwn, defaultEditSummary: string) => Promise<void>>) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      const title = `AjaxBatchUndelete${i === 0 ? '' : ' with-i18n'}`; 
      seedPage(pages, {
        title,
        n: j+1,
      });
      callbacks.set(
        title,
        async (bot, defaultEditSummary) => {
          console.log(`Deleting page ${title}`);
          bot.delete(title, defaultEditSummary);
        }
      )
    }
  }
}