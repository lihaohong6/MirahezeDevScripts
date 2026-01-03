import { Mwn } from "mwn";

import { seedPage } from "./.utils.ts";
import type { SeedingWikipageOperations } from "./.utils.ts";
import { resolve } from "node:path";

const changeProtectionSetting = (protectionLevel: string) => (
  async (bot: Mwn, pageTitle: string, defaultEditSummary: string) => {
    try {
      const res = await bot.request({
        action: 'protect',
        title: pageTitle,
        protections: protectionLevel,
        expiry: 'infinite',
        reason: defaultEditSummary,
        token: (await bot.getCsrfToken())
      });
      console.log(`Changed protection settings of ${pageTitle} to ${protectionLevel}`);
    } catch (err) {
      console.error(err);
    }
  }
);

export function seedMassProtect(operations: SeedingWikipageOperations) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassProtect${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        /* Unprotect if needed */
        callback: 
          changeProtectionSetting('edit=all|move=all'),
      });
    }
    for (let j = 0; j < 10; j++) {
      seedPage(operations, {
        title: `MassProtect Test CategoryMember${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        additionalDescription: ` This page is a part of the category [[:Category:MassProtect Test Category${i === 0 ? '' : ' with-i18n'}]]\n\n[[Category:MassProtect Test Category${i === 0 ? '' : ' with-i18n'}]]`,
        /* Unprotect if needed */
        callback: 
          changeProtectionSetting('edit=all|move=all'),
      });
    }
    /* Unprotect pages if alr protected */
    for (let j = 0; j < 10; j++) {
      operations.set(
        `MassProtect Cannot Create${i === 0 ? '' : ' with-i18n'} ${j+1}`,
        {
          callbacks: [
            changeProtectionSetting('create=all'),
          ]
        }
      );
    }
    const exampleImgFilepath = resolve(import.meta.dirname, "./Example-image.jpg");
    for (let j = 0; j < 10; j++) {
      operations.set(
        `File:MassProtect Cannot Upload${i === 0 ? '' : ' with-i18n'} ${j+1}.jpeg`,
        {
          callbacks: [
            async (bot, currentPageTitle, defaultEditSummary) => {
              try {
                await bot.upload(exampleImgFilepath, currentPageTitle, '', {
                  comment: defaultEditSummary
                });
                console.log(`Uploaded ${currentPageTitle}`);
              } catch {}
            },
            changeProtectionSetting('upload=all'),
          ]
        }
      )
    }
    for (let j = 0; j < 10; j++) {
      const title = `MassProtect Test Remove Protection${i === 0 ? '' : ' with-i18n'} ${j+1}`;
      seedPage(operations, {
        title,
        additionalDescription: ` Try to unprotect this page!`,
        callback: 
          changeProtectionSetting('edit=sysop|move=sysop'),
      });
    }
  }
}