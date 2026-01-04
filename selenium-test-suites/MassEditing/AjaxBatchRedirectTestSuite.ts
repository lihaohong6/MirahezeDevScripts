import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import { 
  clickLinkOnPowertoolsMenu, 
  LogUtils, 
  preemptivelyDisableI18n, 
} from '../.utils/utils.ts';
import assert from 'node:assert';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for AjaxBatchRedirect and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Seed pages using .seeds/AjaxBatchRedirect.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'AjaxBatchRedirect',
    urlParams: {
      'uselang': 'fr'
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
  const [enI18nMessages, frI18nMessages] = await (async () => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchRedirect/i18n.json`);
    const json = await res.json();
    return [json['en'], json['fr']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until AjaxBatchRedirect and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchRedirect/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-batchredirect').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load AjaxBatchRedirect',
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
      $('#batchredirect-form form').trigger('reset');
      $('#batchredirect-form #text-error-output').empty();
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
      const i18nMessages = withI18nJs ? frI18nMessages : enI18nMessages;
      const navLink = await driver.findElement(By.id('t-batchredirect'));
      assert(navLink.getText(), i18nMessages['toolsTitle']);
      await clickLinkOnPowertoolsMenu(driver, 't-batchredirect', skin);
      await driver.wait(
        until.elementLocated(By.id('batchredirect-form')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('batchredirect-form'));
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
   * Create 10 redirects in one operation
   */
  const createRedirects = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? frI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-batchredirect', skin);
        await driver.wait(
          until.elementLocated(By.id('batchredirect-form')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const redirectTargets = Array(10).fill(null)
          .map((_, index) => `AjaxBatchRedirect${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const redirectTitles = Array(10).fill(null)
          .map((_, index) => `AjaxBatchRedirect${withI18nJs ? ' with-i18n' : ''} redirect ${index+1}`);
        
        modal = await driver.findElement(By.id('batchredirect-form'));
        const redirectFromInput = await modal.findElement(By.id('text-pages-from'));
        const redirectToInput = await modal.findElement(By.id('text-pages-to'));
        await redirectFromInput.sendKeys(
          redirectTitles.join('\n')
        );
        await redirectToInput.sendKeys(
          redirectTargets.join('\n')
        );
        await driver.sleep(500);

        const initiateButton = await modal.findElement(By.id('batchredirect-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['finished']
              .replace('$1', 10)
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish AjaxBatchRedirect operation',
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
    'AjaxBatchRedirectWithNoI18nJs',
    createRedirects(false)
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
    'AjaxBatchRedirectWithI18nJs',
    createRedirects(true)
  );

  return testSuite;

};