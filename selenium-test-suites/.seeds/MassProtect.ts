import { Mwn } from "mwn";

import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";

export function seedMassProtect(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassProtect${i === 0 ? '' : ' with-i18n'} ${j+1}`,
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassProtect Test CategoryMember${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` This page is a part of the category [[:Category:MassProtect Test Category${i === 0 ? '' : ' with-i18n'}]]\n\n[[:Category:MassProtect Test Category${i === 0 ? '' : ' with-i18n'}]]`
      });
    }
    /* Unprotect pages if alr protected */
    for (let m = 0; m < 2; m++) {
      for (let j = 0; j < 10; j++) {
        operations.set(
          m === 0 ?
          `MassProtect Cannot Create${i === 0 ? '' : ' with-i18n'} ${j+1}`
          :
          `File:MassProtect Cannot Upload${i === 0 ? '' : ' with-i18n'} ${j+1}`,
          {
            callbacks: [
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
                } catch (err) {
                  console.error(err);
                }
              }
            ]
          }
        );
      }
    }
    for (let j = 0; j < 10; j++) {
      const title = `MassProtect Test Remove Protection${i === 0 ? '' : ' with-i18n'} ${j+1}`;
      seedPage(operations, {
        title,
        additionalDescription: ` Try to unprotect this page!`,
        callback: 
          /* Protect the page pre-emptively */
          async (bot, pageTitle, defaultEditSummary) => {
            try {
              const res = await bot.request({
                action: 'protect',
                title: pageTitle,
                protections: 'edit=sysop|move=sysop',
                expiry: 'infinite',
                reason: defaultEditSummary,
                token: (await bot.getCsrfToken())
              });
              console.log(`Protected ${pageTitle}`);
            } catch (err) {
              console.error(err);
            }
          }
      });
    }
  }
}