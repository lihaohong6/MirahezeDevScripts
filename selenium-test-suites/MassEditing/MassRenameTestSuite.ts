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
 * 1) Build gadget implementation for MassRename and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18njs
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with editing rights 
 *    (including in moving pages)
 *    Credentials to said account should be provided in .env
 * 4) Seed pages using .seeds/MassRename.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';
  const skin = args.skin || 'vector-2022';

  const testSuite = new TestSuiteClass(
    /* Test Suite ID */ 'MassRename',
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
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassRename/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until MassRename and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      window.massRenameDelay = 2000;
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassRename/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-mr').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load MassRename',
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
  const fetchRecentlyMovedPagesFromLogs = async (compareComment: string, withRedirect: boolean, limit: number) => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'logevents',
      letype: 'move',
      leaction: `move/move${withRedirect ? '_redir' : ''}`,
      leuser: process.env.SELENIUM_TESTING_WIKI_USERNAME!,
      leprop: 'title|user|comment|timestamp',
      ledir: 'older',
      /* in last 10 minutes */
      leend: new Date(new Date().valueOf() - 10*60*1000).toISOString(),
      lelimit: ''+limit
    })}`);
    const d: MwActionApiLogEvent = await res.json();
    if (d.error) {
      throw new Error(d.error.info || d.error as string);
    }
    return d.query!.logevents
      .filter(({ comment }) => comment === compareComment);
  }

  const compareRecentlyMovedPages = async (pages: string[], compareComment: string, withRedirect: boolean): Promise<boolean> => {
    const gotPages = new Set(
      (await fetchRecentlyMovedPagesFromLogs(compareComment, withRedirect, pages.length))
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
      $('#form-mass-rename form').trigger('reset');
      $('#form-mass-rename #text-error-output').empty();
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
      const navLink = await driver.findElement(By.id('t-mr'));
      assert(navLink.getText(), i18nMessages['title']);
      await clickLinkOnPowertoolsMenu(driver, 't-mr', skin);
      await driver.wait(
        until.elementLocated(By.id('form-mass-rename')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('form-mass-rename'));
      const modalTitle = await modal.findElement(
        By.css('.oo-ui-processDialog-location .oo-ui-processDialog-title')
      );
      assert(modalTitle.getText(), i18nMessages['title']);
      
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
   * Move 10 pages in one operation
   */
  const movePages = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mr', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-rename')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToMove = Array(10).fill(null).map((_, index) => `MassRename${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const newTitles = pagesToMove.map((page) => `${page} moved`);
        let sendToInput = Array(10).fill(null).map((_, index) => (
          `${pagesToMove[index].replaceAll(' ', '_')} ${newTitles[index].replaceAll(' ', '_')}\n`
        ));
        const comment = `SELENIUM TEST: Move pages without making redirect ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-rename'));
        const moveReasonInput = await modal.findElement(By.id('custom-summary'));
        await moveReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-rename'));
        await pageListInput.sendKeys(
          ...sendToInput
        );

        const initiateButton = await modal.findElement(By.id('mr1-start'));
        const pauseButton = await modal.findElement(By.id('mr1-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['nothingLeftToDo']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassRename operation',
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

        const pagesHaveBeenMoved = await compareRecentlyMovedPages(
          pagesToMove, comment, false
        );
        assert(pagesHaveBeenMoved, 'Move log does not match');
        
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
   * Move 10 pages in one operation
   */
  const movePagesWithRedirect = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mr', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-rename')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const pagesToMove = Array(10).fill(null).map((_, index) => `MassRename${withI18nJs ? ' with-i18n' : ''} ${index+11}`);
        const newTitles = pagesToMove.map((page) => `${page} moved`);
        let sendToInput = Array(10).fill(null).map((_, index) => (
          `${pagesToMove[index].replaceAll(' ', '_')} ${newTitles[index].replaceAll(' ', '_')}\n`
        ));
        const comment = `SELENIUM TEST: Move pages while making redirect ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-rename'));
        const redirectCheck = await modal.findElement(By.id('redirect-check'));
        await redirectCheck.click();
        const moveReasonInput = await modal.findElement(By.id('custom-summary'));
        await moveReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-rename'));
        await pageListInput.sendKeys(
          ...sendToInput
        );

        const initiateButton = await modal.findElement(By.id('mr1-start'));
        const pauseButton = await modal.findElement(By.id('mr1-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['nothingLeftToDo']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassRename operation',
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

        const pagesHaveBeenMoved = await compareRecentlyMovedPages(
          pagesToMove, comment, true
        );
        assert(pagesHaveBeenMoved, 'Move log does not match');
        
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
   * Move non-existent in one operation
   */
  const moveNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mr', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-rename')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const comment = `SELENIUM TEST: Move non-existent page ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-rename'));
        const moveReasonInput = await modal.findElement(By.id('custom-summary'));
        await moveReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-rename'));
        await pageListInput.sendKeys(
          'This_page_does_not_exist This_page_does_not_exist_new'
        );

        const initiateButton = await modal.findElement(By.id('mr1-start'));
        const pauseButton = await modal.findElement(By.id('mr1-pause'));
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
            i18nMessages['finished'] + " " + i18nMessages['nothingLeftToDo']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassRename operation',
          /* 500 ms */ 500
        );
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['renameFail']
              .replace('$1', 'This_page_does_not_exist')
              .replace('$2', 'This_page_does_not_exist_new')
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to get an error message',
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
    'MassRenameWithNoI18nJs',
    movePages(false)
  );
  testSuite.addTestCase(
    'MassRenameWithRedirectsWithNoI18nJs',
    movePagesWithRedirect(false)
  );
  testSuite.addTestCase(
    'RenameNonExistentPageWithNoI18nJs',
    moveNonExistentPage(false)
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
    'MassRenameWithI18nJs',
    movePages(true)
  );
  testSuite.addTestCase(
    'MassRenameWithRedirectsWithNoI18nJs',
    movePagesWithRedirect(true)
  );
  testSuite.addTestCase(
    'RenameNonExistentPageWithI18nJs',
    moveNonExistentPage(true)
  );

  return testSuite;

};