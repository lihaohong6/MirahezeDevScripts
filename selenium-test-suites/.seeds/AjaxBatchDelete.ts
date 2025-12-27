import { seedPage } from "./utils.ts";

export function seedAjaxBatchDelete(pages: Map<string, string>) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 20; j++) {
      seedPage(pages, {
        title: `AjaxBatchDelete${i === 0 ? '' : ' with-i18n'}`,
        n: j+1
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(pages, {
        title: `AjaxBatchDelete Category Test${i === 0 ? '' : ' with-i18n'}`,
        n: j+1,
        additionalDescription: `This page is a part of the category [[:Category:AjaxBatchDelete Test Category${i === 0 ? '' : ' with-i18n'}]].\n\n[[Category:AjaxBatchDelete Test Category${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
  }
}