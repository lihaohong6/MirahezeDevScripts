import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import { randomBytes } from 'node:crypto';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/TestSuiteClass.ts';
import { 
  clickLinkOnPowertoolsMenu, 
  isOOUIActionButtonDisabled, 
  LogUtils, 
  preemptivelyDisableI18n 
} from '../.utils/utils.ts';
import assert from 'node:assert';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for AjaxBatchDelete and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18njs
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with delete rights
 *    credentials to said account should be provided in .env
 * 4) Create 20 pages on a testing wiki with the titles "AjaxBatchDelete 1" to 
 *    "AjaxBatchDelete 20" (not belonging to any category)
 * 5) Create 10 pages on a testing wiki with the titles "AjaxBatchDelete 
 *    Category Test 1" to "AjaxBatchDelete Category Test 10" 
 *    belonging to the category Category:AjaxBatchDelete_Test_Category
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';
  const skin = args.skin || 'vector-2022';

  const testSuite = new TestSuiteClass(
    /* Test Suite ID */ 'AjaxBatchDelete',
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
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchDelete/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until AjaxBatchDelete and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchDelete/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-bd').length > 0`)) === true,
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
  const compareRecentlyDeletedPages = async (pages: string[], compareComment: string): Promise<boolean> => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'logevents',
      letype: 'delete',
      leaction: 'delete/delete',
      leuser: process.env.SELENIUM_TESTING_WIKI_USERNAME!,
      leprop: 'title|user|comment|timestamp',
      ledir: 'older',
      /* in last 30 minutes */
      leend: new Date(new Date().valueOf() - 30*60*1000).toISOString(),
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

  const compareRecentlyProtectedPages = async (pages: string[], compareComment: string): Promise<boolean> => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'logevents',
      letype: 'protect',
      leaction: 'protect/protect',
      leuser: process.env.SELENIUM_TESTING_WIKI_USERNAME!,
      leprop: 'title|user|comment|timestamp',
      ledir: 'older',
      /* in last 30 minutes */
      leend: new Date(new Date().valueOf() - 30*60*1000).toISOString(),
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
      $('#form-batch-delete form').trigger('reset');
      $('#form-batch-delete #text-error-output').empty();
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
  const testIfI18nMessagesAreLoaded = (withI18nJs: boolean) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      const navLink = await driver.findElement(By.id('t-bd'));
      assert(navLink.getText(), i18nMessages['toolsTitle']);
      await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
      await driver.wait(
        until.elementLocated(By.id('form-batch-delete')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('form-batch-delete'));
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
   * Delete 10 pages in one operation
   */
  const deleteTenPagesFromManualInput = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-delete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToDelete = Array(10).fill(null).map((_, index) => `AjaxBatchDelete${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const comment = `SELENIUM TEST: Delete pages from manual user input ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-delete'));
        const deleteReasonInput = await modal.findElement(By.id('ajax-delete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-mass-delete'));
        await pageListInput.sendKeys(
          ...pagesToDelete.map((page) => `${page}\n`)
        );

        const initiateButton = await modal.findElement(By.id('abd-start'));
        const pauseButton = await modal.findElement(By.id('abd-pause'));
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
            i18nMessages['endTitle'] + ' ' + i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchDelete operation',
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
        
        const pagesHaveBeenDeleted = await compareRecentlyDeletedPages(
          pagesToDelete, comment
        );
        assert(pagesHaveBeenDeleted, 'Delete log does not match');

        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToDelete, comment
        );
        assert(!pagesHaveBeenProtected, 'Protect log does not match');

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
   * Delete pages stored in a category in one operation
   */
  const deleteTenPagesFromCategory = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-delete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const comment = `SELENIUM TEST: Delete pages that are part of a category ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-delete'));
        const deleteReasonInput = await modal.findElement(By.id('ajax-delete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        
        const addCategoryContentsButton = await modal.findElement(By.id('abd-add-pages-in-category'));
        await addCategoryContentsButton.click();
        const promptAlert = await driver.switchTo().alert();
        await promptAlert.sendKeys(`AjaxBatchDelete Test Category${withI18nJs ? ' with-i18n' : ''}`);
        await promptAlert.accept();
        await driver.wait(
          async () => (
            (await driver.executeScript(`
              return $('#form-batch-delete #text-mass-delete').val() || '';
            `)) !== ''
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 500 ms */ 500
        );
        const pagesToDelete = (await (async () => (
          await driver.executeScript(`
            return $('#form-batch-delete #text-mass-delete').val() || '';
          `)
        ))() as string).split('\n').filter((s) => s.trim() !== '');

        await modal.click();
        await driver.sleep(1000);

        const initiateButton = await modal.findElement(By.id('abd-start'));
        const pauseButton = await modal.findElement(By.id('abd-pause'));
        
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
          async () => {
            const i = await isOOUIActionButtonDisabled(driver, initiateButton);
            const p = await isOOUIActionButtonDisabled(driver, pauseButton);
            return i && !p;
          },
          /* 30 s */ 30*1000,
          'Start & pause buttons failed to toggle while script is running',
          /* 250 ms */ 250
        );

        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['endTitle'] + ' ' + i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchDelete operation',
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

        const pagesHaveBeenDeleted = await compareRecentlyDeletedPages(
          pagesToDelete, comment
        );
        assert(pagesHaveBeenDeleted, 'Delete log does not match');
        
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
   * Delete 10 pages in one operation
   */
  const deleteTenPagesAndProtectPages = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-delete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToDelete = Array(10).fill(null).map((_, index) => `AjaxBatchDelete${withI18nJs ? ' with-i18n' : ''} ${index+11}`);
        const comment = `SELENIUM TEST: Delete pages from manual user input ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-delete'));
        const deleteReasonInput = await modal.findElement(By.id('ajax-delete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-mass-delete'));
        await pageListInput.sendKeys(
          ...pagesToDelete.map((page) => `${page}\n`)
        );
        const protectCheck = await modal.findElement(By.id('protect-check'));
        await protectCheck.click();

        const initiateButton = await modal.findElement(By.id('abd-start'));
        const pauseButton = await modal.findElement(By.id('abd-pause'));
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
            i18nMessages['endTitle'] + ' ' + i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchDelete operation',
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

        const pagesHaveBeenDeleted = await compareRecentlyDeletedPages(
          pagesToDelete, comment
        );
        assert(pagesHaveBeenDeleted, 'Delete log does not match');

        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToDelete, comment
        );
        assert(pagesHaveBeenProtected, 'Protect log does not match');
        
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
   * Delete non-existent page
   */
  const deleteNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
        await driver.wait(
          until.elementLocated(By.id('form-batch-delete')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const comment = `SELENIUM TEST: Try to delete a non-existent page ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-batch-delete'));
        const deleteReasonInput = await modal.findElement(By.id('ajax-delete-reason'));
        await deleteReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-mass-delete'));
        await pageListInput.sendKeys('This page does not exist');
        const initiateButton = await modal.findElement(By.id('abd-start'));
        await initiateButton.click();
        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['endTitle'] + ' ' + i18nMessages['endMsg']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchDelete operation',
          /* 500 ms */ 500
        );
        await driver.sleep(200);

        const outputMsg = (await errorOutput.getText());
        assert(outputMsg.includes(
          (i18nMessages['errorDelete'] as string)
            .replace('$1', 'This page does not exist')
            .replace('$2', 'missingtitle')
        ));

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
    'MassDeleteWithNoI18nJs',
    deleteTenPagesFromManualInput(false)
  );
  testSuite.addTestCase(
    'MassDeletePagesInCategoryWithNoI18nJs',
    deleteTenPagesFromCategory(false)
  );
  testSuite.addTestCase(
    'MassDeleteAndProtectWithNoI18nJs',
    deleteTenPagesAndProtectPages(false)
  );
  testSuite.addTestCase(
    'DeleteNonExistentPageWithNoI18nJs',
    deleteNonExistentPage(false)
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
    'MassDeleteWithI18nJs',
    deleteTenPagesFromManualInput(true)
  );
  testSuite.addTestCase(
    'MassDeletePagesInCategoryWithI18nJs',
    deleteTenPagesFromCategory(true)
  );
  testSuite.addTestCase(
    'MassDeleteAndProtectWithI18nJs',
    deleteTenPagesAndProtectPages(true)
  );
  testSuite.addTestCase(
    'DeleteNonExistentPageWithI18nJs',
    deleteNonExistentPage(true)
  );

  return testSuite;

};