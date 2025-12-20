import { By, WebDriver, until } from 'selenium-webdriver';
import TestSuiteClass, { clickLinkOnPowertoolsMenu } from '../TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from "../TestSuiteClass.ts";
import assert from 'node:assert';

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for AjaxBatchUndelete and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18njs
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with delete rights
 *    Credentials to said account should be provided in .env
 * 3) Create 100 pages on a testing wiki with the titles Gadget Test Page ## 
 *    (e.g. Gadget Test Page 1, Gadget Test Page 13, etc.)
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

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

  const loadI18n = async (driver: WebDriver): Promise<void> => {
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18njs/gadget-impl.js");
    `);
    await driver.sleep(200);
  }

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until AjaxBatchUndelete and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchUndelete/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-bud').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load AjaxBatchUndelete',
      /* 200 ms */ 200
    ));
    return true;
  }

  testSuite.beforeAll = async (driver) => {
    /* Login with credentials */
    const isLoggedIn = await testSuite.login(driver);
    assert(isLoggedIn, 'Failed to login');
    /* Assert that i18njs is not loaded */
    const isI18nJsLoaded = await driver.executeScript(`return mw.loader.getState('ext.gadget.store.FandoomUtilsI18njs') !== null;`);
    assert(isI18nJsLoaded === false, 'DISABLE FandoomUtilsI18njs ON THE WIKI BEFORE RUNNING THIS TEST!!');
    /* Load scripts */
    const scriptsAreLoaded = await loadScripts(driver);
    assert(scriptsAreLoaded, 'Failed to load scripts');
    return scriptsAreLoaded;
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
  }

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
      await clickLinkOnPowertoolsMenu(driver, 't-bd', skin);
      await driver.wait(
        until.elementLocated(By.id('form-batch-undelete')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );

      const modal = await driver.findElement(By.id('form-batch-undelete'));
      const deleteReasonInput = await modal.findElement(By.id('undelete-reason'));
      await deleteReasonInput.sendKeys('SELENIUM TEST: Undelete pages from manual user input');
      const pageListInput = await modal.findElement(By.id('text-batch-undelete'));
      await pageListInput.sendKeys(
        ...Array(10).fill(null).map((_, index) => `Gadget Test Page ${index+1}\n`)
      );

      const initiateButton = await modal.findElement(By.id('abu-start'));
      const pauseButton = await modal.findElement(By.id('abu-pause'));
      assert((await initiateButton.isEnabled()), 'Start button is disabled');
      assert(!(await pauseButton.isEnabled()), 'Pause button is not disabled');

      await initiateButton.click();
      await driver.wait(
        async () => (!(await initiateButton.isEnabled()) && (await pauseButton.isEnabled())),
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
      assert((await initiateButton.isEnabled()), 'Start button is disabled');
      assert(!(await pauseButton.isEnabled()), 'Pause button is not disabled');
      
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
   * Undelete non-existent page
   */
  const undeleteNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      await clickLinkOnPowertoolsMenu(driver, 't-bud', skin);
      await driver.wait(
        until.elementLocated(By.id('form-batch-undelete')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );

      const modal = await driver.findElement(By.id('form-batch-undelete'));
      const deleteReasonInput = await modal.findElement(By.id('undelete-reason'));
      await deleteReasonInput.sendKeys('SELENIUM TEST: Try to delete a non-existent page');
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

      const outputMsg = (await errorOutput.getText());
      assert(outputMsg.includes(
        (i18nMessages['failure'] as string) + ' ' + 'This page does not exist'
      ));

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
    undeletePages(false)
  );
  testSuite.addTestCase(
    'DeleteNonExistentPageWithNoI18nJs',
    undeleteNonExistentPage(false)
  );
  testSuite.addTestCase(
    'LoadI18nJs',
    async (driver) => {
      await driver.navigate().refresh();
      await loadI18n(driver);
      const scriptsAreLoaded = await loadScripts(driver);
      if (!scriptsAreLoaded) {
        throw new Error('Failed to load scripts');
      }
    }
  );
  testSuite.addTestCase(
    'TestI18nMessages',
    testIfI18nMessagesAreLoaded(true)
  );
  testSuite.addTestCase(
    'MassDeleteWithI18nJs',
    undeletePages(true)
  );
  testSuite.addTestCase(
    'DeleteNonExistentPageWithI18nJs',
    undeleteNonExistentPage(true)
  );

  await testSuite.run();

};