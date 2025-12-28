import { Mwn } from "mwn";

import { seedPage } from "./utils.ts";

export function seedAjaxBatchRedirect(pages: Map<string, string>, callbacks: Map<string, (bot: Mwn, defaultEditSummary: string) => Promise<void>>) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      const title = `AjaxBatchRedirect${i === 0 ? '' : ' with-i18n'}`; 
      seedPage(pages, {
        title,
        n: j+1,
      });
      const checkNewTitle = `${title} redirect ${j+1}`;
      callbacks.set(
        `${title} ${j + 1}`,
        async (bot, defaultEditSummary) => {
          try {
            await bot.delete(checkNewTitle, defaultEditSummary);
            console.log(`Deleted page ${checkNewTitle}`);
          } catch (err) {}
        }
      )
    }
  }
}