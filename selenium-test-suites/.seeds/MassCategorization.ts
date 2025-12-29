import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedMassCategorization(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassCategorization Test Add${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` Try to add a category or two using this tool!`
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassCategorization Test Remove${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` Try to remove a category using this tool!\n\n[[Category:MassCategorization Remove${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassCategorization Test Replace${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` Try to replace a category using this tool!\n\n[[Category:MassCategorization Replace${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassCategorization Test Complex Example${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` Do multiple operations!\n\n[[Category:MassCategorization Complex Remove This 1${i === 0 ? '' : ' with-i18n'}]]\n[[Category:MassCategorization Complex Remove This 2${i === 0 ? '' : ' with-i18n'}]]\n[[Category:MassCategorization Complex Replace This${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
    for (let j = 0; j < 5; j++) {
      seedPage(operations, {
        title: `Template:MassCategorization Template${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` Try to add a category that is not included in transclusions using this tool!`
      });
    }
  }
}