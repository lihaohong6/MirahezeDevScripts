import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import { 
  clickLinkOnPowertoolsMenu, 
  LogUtils, 
  preemptivelyDisableI18n, 
} from '../.utils/utils.ts';
import assert from 'node:assert';
import { randomBytes } from 'node:crypto';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for MassNullEdit and its dependencies 
 *    FandoomUiUtilsQdmodal, PowertoolsPlacement, and FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Seed pages using .seeds/MassNullEdit.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'MassNullEdit',
    urlParams: {
      'uselang': 'zh-Hans'
    },
    config: {
      credentials: {
        username: process.env.SELENIUM_TESTING_WIKI_USERNAME,
        password: process.env.SELENIUM_TESTING_WIKI_PASSWORD,
      }
    },
    args
  });
  const skin = testSuite.config.defaultSkin!;

  /***********************************************************************
   * 
   * FETCH EXPECTED MESSAGING
   * 
   ***********************************************************************/
  const [enI18nMessages, zhI18nMessages] = await (async () => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassNullEdit/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until MassNullEdit and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsQdmodal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassNullEdit/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-mne').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load MassNullEdit',
      /* 200 ms */ 200
    ));
    return true;
  };

  interface MwActionApiLogEvent {
    batchcomplete: string
    error?: {
      info?: string
    }
    query?: {
      categorymembers: {
        pageid: number
        ns: number
        title: string
      }[]
    }
  }
  const fetchPagesInCategory = async (category: string): Promise<string[]> => {
    const res = await fetch(
      `${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmlimit: '500'
      })}`
    );
    const d: MwActionApiLogEvent = await res.json();
    if (d.error) {
      throw new Error(d.error.info || d.error as string);
    }
    const pages = d!.query!.categorymembers.map(({ title }) => title);
    return pages;
  }

  const reloadPageWithI18n = async (driver: WebDriver) => {
    try {
      if (!(await testSuite.waitForContextToLoad(driver))) {
        throw new Error('Failed to refresh context');
      }
      await driver.executeScript(`
        mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18nLoader/gadget-impl.js");
      `);
      await driver.sleep(200);
      if (!(await loadScripts(driver))) {
        throw new Error('Failed to load scripts');
      }
    } catch (err) {
      LogUtils.error(err);
    }
  };

  testSuite.beforeAll = async (driver) => {
    try {
      await preemptivelyDisableI18n(driver, gadgetNamespace);
      await loadScripts(driver);
      return true;
    } catch (err) {
      LogUtils.error(err);
      return false;
    }
  };

  /***********************************************************************
   * 
   * TEST CASE DEFINITIONS
   * 
   ***********************************************************************/

  /**
   * Check if the tool title and modal title are loaded correctly through i18n
   */
  const testIfI18nMessagesAreLoaded = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      const navLink = await driver.findElement(By.id('t-mne'));
      assert(navLink.getText(), i18nMessages['title']);
      await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
      await driver.wait(
        until.elementLocated(By.id('mne-main')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('mne-main'));
      const modalInstructions = await modal.findElement(
        By.css('section > p:first-child')
      );
      assert(modalInstructions.getText(), i18nMessages['instructions']);
      
      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await modal.findElement(
        By.css('.qdmodal-close')
      );
      await closeButton.click();
      await driver.wait(
        until.stalenessOf(modal),
        /* 1 minute */ 1*60*1000,
        'Modal failed to dismiss',
        /* 250 ms */ 250
      );
    }
  );

  /**
   * Mass null edit 20 pages
   */
  const massNullEdit = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
        await driver.wait(
          until.elementLocated(By.id('mne-main')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToNullEdit = Array(20).fill(null).map((_, index) => `MassNullEdit ${index+1}`);

        modal = await driver.findElement(By.id('mne-main'));
        
        const pageListInput = await modal.findElement(By.id('mne-input'));
        await pageListInput.sendKeys(
          ...pagesToNullEdit.map(page => `${page}\n`)
        );

        const initiateButton = await modal.findElement(By.id('mne-main-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('mne-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['notice-finished']
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 15 minutes */ 15*60*1000,
          'Failed to finish MassNullEdit operation',
          /* 500 ms */ 500
        );
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.qdmodal-close')
          );
          await closeButton.click();
          await driver.wait(
            until.stalenessOf(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );

  /**
   * Mass null edit a page that doesn't exist
   */
  const massNullEditNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
        await driver.wait(
          until.elementLocated(By.id('mne-main')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pageToNullEdit = 'This page does not exist';

        modal = await driver.findElement(By.id('mne-main'));
        
        const pageListInput = await modal.findElement(By.id('mne-input'));
        await pageListInput.sendKeys(pageToNullEdit);

        const initiateButton = await modal.findElement(By.id('mne-main-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('mne-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['notice-finished']
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassNullEdit operation',
          /* 500 ms */ 500
        );

        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['fail']
              .replace("$1", pageToNullEdit)
              .replace("$2", "missingtitle")
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to get an error response',
          /* 500 ms */ 500
        );
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.qdmodal-close')
          );
          await closeButton.click();
          await driver.wait(
            until.stalenessOf(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );

  /**
   * Mass null edit pages by clicking the "Add pages" button
   */
  const massNullEditPagesByQueryingCategory = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
        await driver.wait(
          until.elementLocated(By.id('mne-main')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
          
        modal = await driver.findElement(By.id('mne-main'));

        const addPagesButton = await modal.findElement(By.css('#mne-main-pause + .qdmodal-button'));
        await addPagesButton.click();
        await driver.wait(
          until.elementLocated(By.id('mne-addpages')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        await (async () => {
          const secondaryModal = await driver.findElement(By.id('mne-addpages'));
          const addPagesFromCategoryInputs = await secondaryModal.findElement(By.css('#mne-mode .mne-addpages-row:nth-child(5)'));
          await addPagesFromCategoryInputs.findElement(By.css('input[type="radio"]')).click();
          await addPagesFromCategoryInputs.findElement(By.css('input[type="text"]')).sendKeys(
            'MassNullEdit'
          );
          const addPagesButton = await secondaryModal.findElement(By.id('mne-addpages-start'));
          await addPagesButton.click();
          await driver.wait(
            until.stalenessOf(secondaryModal),
          /* 3 minutes */ 3*60*1000,
          'Modal failed to dismiss',
          /* 250 ms */ 250
          );
        })();

        const pagesToNullEdit = await fetchPagesInCategory('MassNullEdit');
        
        await driver.wait(
          async () => {
            const pi: string = (await driver.executeScript(`
              return ($('#mne-input').val() || '');
            `));
            return pi.includes(pagesToNullEdit.join('\n'));
          },
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 500 ms */ 500
        );

        const initiateButton = await modal.findElement(By.id('mne-main-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('mne-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['notice-finished']
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 15 minutes */ 15*60*1000,
          'Failed to finish MassNullEdit operation',
          /* 500 ms */ 500
        );
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.qdmodal-close')
          );
          await closeButton.click();
          await driver.wait(
            until.stalenessOf(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );
  
  /**
   * Mass null edit pages while on a category
   */
  const massNullEditPagesOnCategory = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const loadedPage = await testSuite.moveToAnotherPage(driver, 'Category:MassNullEdit');
      if (withI18nJs) {
        await driver.executeScript(`
          mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18nLoader/gadget-impl.js");
        `);
        await driver.sleep(200);
      }
      const loadedScripts = await loadScripts(driver);
      assert(loadedPage && loadedScripts, 'Failed to load Category:MassNullEdit');
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
        await driver.wait(
          until.elementLocated(By.id('mne-main')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToNullEdit: string[] = await fetchPagesInCategory('MassNullEdit');
          
        modal = await driver.findElement(By.id('mne-main'));
        
        await driver.wait(
          async () => {
            const pi: string = (await driver.executeScript(`
              return ($('#mne-input').val() || '');
            `));
            return pi.includes(pagesToNullEdit.join('\n'));
          },
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 500 ms */ 500
        );

        const initiateButton = await modal.findElement(By.id('mne-main-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('mne-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['notice-finished']
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 15 minutes */ 15*60*1000,
          'Failed to finish MassNullEdit operation',
          /* 500 ms */ 500
        );
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.qdmodal-close')
          );
          await closeButton.click();
          await driver.wait(
            until.stalenessOf(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );

  /**
   * Mass null edit pages while on Special:PrefixIndex
   */
  const massNullEditPagesOnSpecialPrefixIndex = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const loadedPage = await testSuite.moveToAnotherPage(driver, 'Special:PrefixIndex', {
        prefix: 'MassNullEdit',
        namespace: '0'
      });
      if (withI18nJs) {
        await driver.executeScript(`
          mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18nLoader/gadget-impl.js");
        `);
        await driver.sleep(200);
      }
      const loadedScripts = await loadScripts(driver);
      assert(loadedPage && loadedScripts, 'Failed to load Special:PrefixIndex');
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mne', skin);
        await driver.wait(
          until.elementLocated(By.id('mne-main')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToNullEdit: string[] = await driver.executeScript(`
          const arr = [];
          $('.mw-prefixindex-body .mw-prefixindex-list li').each(function () {
              arr.push($(this).text());
          });
          return arr;
        `);
          
        modal = await driver.findElement(By.id('mne-main'));
        
        await driver.wait(
          async () => {
            const pi: string = (await driver.executeScript(`
              return ($('#mne-input').val() || '');
            `));
            return pi.includes(pagesToNullEdit.join('\n'));
          },
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 500 ms */ 500
        );

        const initiateButton = await modal.findElement(By.id('mne-main-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('mne-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['notice-finished']
              .replaceAll(/\u003C\/?b\u003E/g, '')
          ),
          /* 15 minutes */ 15*60*1000,
          'Failed to finish MassNullEdit operation',
          /* 500 ms */ 500
        );
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.qdmodal-close')
          );
          await closeButton.click();
          await driver.wait(
            until.stalenessOf(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );

  /***********************************************************************
   * 
   * REGISTER TEST CASE & RUN
   * 
   ***********************************************************************/

  testSuite.addTestCase(
    'TestIfFallbackI18nLoadedCorrectly',
    testIfI18nMessagesAreLoaded(false)
  );
  testSuite.addTestCase(
    'MassNullEditWithNoI18nJs',
    massNullEdit(false)
  );
  testSuite.addTestCase(
    'NullEditNonExistentPageWithNoI18nJs',
    massNullEditNonExistentPage(false)
  );
  testSuite.addTestCase(
    'NullEditPagesByQueryingCategoryMembersFromApiWithNoI18nJs',
    massNullEditPagesByQueryingCategory(false)
  );
  testSuite.addTestCase(
    'NullEditOnCategoryNamespaceWithNoI18nJs',
    massNullEditPagesOnCategory(false)
  );
  testSuite.addTestCase(
    'NullEditOnSpecialPrefixIndexWithNoI18nJs',
    massNullEditPagesOnSpecialPrefixIndex(false)
  );
  testSuite.addTestCase(
    'ReloadContext',
    reloadPageWithI18n,
    {
      /* Stop further test cases if failed */ 
      stopFurtherTestsOnFailure: true 
    }
  );
  testSuite.addTestCase(
    'TestI18nMessages',
    testIfI18nMessagesAreLoaded(true),
    {
      /* Stop further test cases if failed */ 
      stopFurtherTestsOnFailure: true 
    }
  );
  testSuite.addTestCase(
    'MassNullEditWithI18nJs',
    massNullEdit(true)
  );
  testSuite.addTestCase(
    'NullEditNonExistentPageWithI18nJs',
    massNullEditNonExistentPage(true)
  );
  testSuite.addTestCase(
    'NullEditPagesByQueryingCategoryMembersFromApiWithI18nJs',
    massNullEditPagesByQueryingCategory(true)
  );
  testSuite.addTestCase(
    'NullEditOnCategoryNamespaceWithI18nJs',
    massNullEditPagesOnCategory(true)
  );
  testSuite.addTestCase(
    'NullEditOnSpecialPrefixIndexWithI18nJs',
    massNullEditPagesOnSpecialPrefixIndex(true)
  );

  return testSuite;

};