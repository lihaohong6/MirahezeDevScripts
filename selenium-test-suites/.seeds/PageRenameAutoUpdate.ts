import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedPageRenameAutoUpdate(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    const masterTitle = `PageRenameAuto-update Test Master Page${i === 0 ? '' : ' with-i18n'}`;
    const testPagesThatLinkToMaster = [
      `== Test ==\nThis page links to [[${masterTitle}]].`,
      `== Test ==\nThis page links to [[${masterTitle}|some other page]].`,
      `== Test ==\nThis page links to [[ ${masterTitle} ]].`,
      `== Test ==\nThis page links to [[${masterTitle[0].toLowerCase() + masterTitle.slice(1, masterTitle.length)}]].`,
      `== Test ==\nThis page links to [[${masterTitle.replaceAll(' ', '_')}]].`,
      `== Test ==\nThis page is transcluding the contents. {{:${masterTitle}}}.`,
    ];
    const templateTitle = `PageRenameAuto-update links to master${i === 0 ? '' : ' with-i18n'}`;
    seedPage(operations, {
      title: masterTitle,
      callback: async (bot, _, defaultEditingSummary) => {
        const pageTitles = [
          ...Array(testPagesThatLinkToMaster.length).fill(null)
            .map((_, idx) => `PageRenameAuto-update Test Links to Master${i === 0 ? '' : ' with-i18n'} ${idx+1}`),
          `Template:${templateTitle}`,
        ];
        const transcludingTitles = Array(5).fill(null)
          .map((_, idx) => `PageRenameAuto-update Test Transcluding Template${i === 0 ? '' : ' with-i18n'} ${idx+1}`);
        const pageContents = [
          ...testPagesThatLinkToMaster,
          `I am transcluding a template that links to [[${masterTitle}]].`,
        ];
        const transcludingContents = Array(5).fill(null)
          .map((_, idx) => `== Test ==\n{{${templateTitle}}}`);

        await bot.batchOperation(
          pageTitles,
          async (pageTitle, idx) => {
            await bot.save(pageTitle, pageContents[idx], defaultEditingSummary);
            console.log(`Saved ${pageTitle}`);
          },
          /* concurrency */ 5,
          /* retries */ 3,
        );
        await bot.batchOperation(
          transcludingTitles,
          async (pageTitle, idx) => {
            await bot.save(pageTitle, transcludingContents[idx], defaultEditingSummary);
            console.log(`Saved ${pageTitle}`);
          },
          /* concurrency */ 5,
          /* retries */ 3,
        )

      }
    });
    
    /* Delete any moved page if alr moved */
    operations.set(
      `PageRenameAuto-update Test Master Page${i === 0 ? '' : ' with-i18n'} Moved`,
      {
        callbacks: [
          async (bot, pageTitle, defaultEditSummary) => {
            try {
              await bot.delete(pageTitle, defaultEditSummary);
              console.log(`Deleted ${pageTitle}`);
            } catch (err) {}
          }
        ]
      }
    );
  }
}