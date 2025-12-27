import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/TestSuiteClass.ts';
import { 
  clickLinkOnPowertoolsMenu, 
  isOOUIActionButtonDisabled, 
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
 * 1) Build gadget implementation for AjaxBatchUndelete and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18njs
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with delete rights
 *    Credentials to said account should be provided in .env
 * 4) Seed pages using .seeds/AjaxBatchUndelete.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';
  const skin = args.skin || 'vector-2022';

  const testSuite = new TestSuiteClass(
    /* Test Suite ID */ 'AjaxBatchUndelete',
    process.env.SELENIUM_TESTING_WIKI_ENTRYPOINT!,
    /* Navigate to page */ 'Special:BlankPage',
    /* Additional URL Params */ {
      'useskin': skin,
      'uselang': 'zh-Hans'
    },
    /* Additional config */ {
      credentials: {
        username: process.env.SELENIUM_TESTING_WIKI_USERNAME,
        password: process.env.SELENIUM_TESTING_WIKI_PASSWORD,
      }
    }
  );

  /***********************************************************************
   * 
   * FETCH EXPECTED MESSAGING
   * 
   ***********************************************************************/
  const [enI18nMessages, zhI18nMessages] = await (async () => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchUndelete/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until AjaxBatchUndelete and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchUndelete/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-bud').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load AjaxBatchDelete',
      /* 200 ms */ 200
    ));
    return true;
  };

  const reloadPageWithI18n = async (driver: WebDriver) => {
    try {
      await driver.navigate().refresh();
      if (!(await testSuite.waitForContextToLoad(driver))) {
        throw new Error('Failed to refresh context');
      }
      await driver.executeScript(`
        mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18njs/gadget-impl.js");
      `);
      await driver.sleep(200);
      if (!(await loadScripts(driver))) {
        throw new Error('Failed to load scripts');
      }
    } catch (err) {
      LogUtils.error(err);
    }
  };

  interface MwActionApiLogEvent {
    batchcomplete: string
    error?: {
      info?: string
    }
    query?: {
      logevents: {
        ns: number
        title: string
        user: string
        timestamp: string
        comment: string
      }[]
    }
  }
  const compareRecentlyUndeletedPages = async (pages: string[], compareComment: string): Promise<boolean> => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'logevents',
      letype: 'delete',
      leaction: 'delete/restore',
      leuser: process.env.SELENIUM_TESTING_WIKI_USERNAME!,
      leprop: 'title|user|comment|timestamp',
      ledir: 'older',
      /* in last 10 minutes */
      leend: new Date(new Date().valueOf() - 10*60*1000).toISOString(),
      lelimit: ''+pages.length
    })}`);
    const d: MwActionApiLogEvent = await res.json();
    if (d.error) {
      throw new Error(d.error.info || d.error as string);
    }
    const gotPages = new Set(
      d.query!.logevents
        .filter(({ comment }) => comment === compareComment)
        .map(({ title }) => title)
    );
    return pages.every((expectedPage) => gotPages.has(expectedPage));
  };

  testSuite.beforeAll = async (driver) => {
    try {
      await testSuite.login(driver);
      await preemptivelyDisableI18n(driver, gadgetNamespace);
      await loadScripts(driver);
      return true;
    } catch (err) {
      LogUtils.error(err);
      return false;
    }
  };

  testSuite.beforeEach = async (driver) => {
    /* Reset form & clear output */
    await driver.executeScript(`
      $('#form-batch-undelete form').trigger('reset');
      $('#form-batch-undelete #text-error-output').empty();
    `);
    return true;
  };

  testSuite.afterAll = async (driver) => {
    await testSuite.logout(driver);
    return true;
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
      const navLink = await driver.findElement(By.id('t-bud'));
      assert(navLink.getText(), i18nMessages['toolsTitle']);
      await clickLinkOnPowertoolsMenu(driver, 't-bud', skin);
      await driver.wait(
        until.elementLocated(By.id('form-batch-undelete')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('form-batch-undelete'));
      const modalTitle = await modal.findElement(
        By.css('.oo-ui-processDialog-location .oo-ui-processDialog-title')
      );
      assert(modalTitle.getText(), i18nMessages['modalTitle']);
      
      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await modal.findElement(
        By.css('.oo-ui-processDialog-actions-safe .oo-ui-flaggedElement-close')
      );
      await closeButton.click();
      await driver.wait(
        until.elementIsNotVisible(modal),
        /* 1 minute */ 1*60*1000,
        'Modal failed to dismiss',
        /* 250 ms */ 250
      );
    }
  );

  /**
   * Undelete 10 pages in one operation
   */
  const undeletePages = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bud', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-undelete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToUndelete = Array(10).fill(null).map((_, index) => `AjaxBatchUndelete${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const comment = `SELENIUM TEST: Undelete pages from manual user input ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-undelete'));
        const deleteReasonInput = await modal.findElement(By.id('undelete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-batch-undelete'));
        await pageListInput.sendKeys(
          ...pagesToUndelete.map(page => `${page}\n`)
        );

        const initiateButton = await modal.findElement(By.id('abu-start'));
        const pauseButton = await modal.findElement(By.id('abu-pause'));
        assert(
          !(await isOOUIActionButtonDisabled(driver, initiateButton)), 
          'Start button is disabled'
        );
        assert(
          (await isOOUIActionButtonDisabled(driver, pauseButton)), 
          'Pause button is not disabled'
        );

        await initiateButton.click();
        await driver.wait(
          async () => (
            (await isOOUIActionButtonDisabled(driver, initiateButton)) && 
            !(await isOOUIActionButtonDisabled(driver, pauseButton))
          ),
          /* 30 s */ 30*1000,
          'Start & pause buttons failed to toggle while script is running',
          /* 250 ms */ 250
        );

        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchUndelete operation',
          /* 500 ms */ 500
        );
        assert(
          !(await isOOUIActionButtonDisabled(driver, initiateButton)), 
          'Start button is disabled'
        );
        assert(
          (await isOOUIActionButtonDisabled(driver, pauseButton)), 
          'Pause button is not disabled'
        );

        const pagesHaveBeenUndeleted = await compareRecentlyUndeletedPages(
          pagesToUndelete, comment
        );
        assert(pagesHaveBeenUndeleted, 'Delete log does not match');
        
        await driver.sleep(pauseUiCheckingForHumanReview);
      
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-safe .oo-ui-flaggedElement-close')
          );
          await closeButton.click();
          await driver.wait(
            until.elementIsNotVisible(modal),
            /* 1 minute */ 1*60*1000,
            'Modal failed to dismiss',
            /* 250 ms */ 250
          );
        }
      }
    }
  );

  /**
   * Undelete non-existent page
   */
  const undeleteNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bud', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-undelete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const comment = `SELENIUM TEST: Try to delete a non-existent page ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-undelete'));
        const deleteReasonInput = await modal.findElement(By.id('undelete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-batch-undelete'));
        await pageListInput.sendKeys('This page does not exist');
        const initiateButton = await modal.findElement(By.id('abu-start'));
        await initiateButton.click();
        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchUndelete operation',
          /* 500 ms */ 500
        );
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            (i18nMessages['failure'] as string) + ' ' + 'This page does not exist'
          ),
          /* 3 minutes */ 3*60*1000,
          'Unable to fetch an error message',
          /* 500 ms */ 500
        );

        await driver.sleep(pauseUiCheckingForHumanReview);

      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-safe .oo-ui-flaggedElement-close')
          );
          await closeButton.click();
          await driver.wait(
            until.elementIsNotVisible(modal),
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
    'MassUndeleteWithNoI18nJs',
    undeletePages(false)
  );
  testSuite.addTestCase(
    'UndeleteNonExistentPageWithNoI18nJs',
    undeleteNonExistentPage(false)
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
    'MassUndeleteWithI18nJs',
    undeletePages(true)
  );
  testSuite.addTestCase(
    'UndeleteNonExistentPageWithI18nJs',
    undeleteNonExistentPage(true)
  );

  return testSuite;

};