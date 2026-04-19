import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import { randomBytes } from 'node:crypto';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import { 
  LogUtils, 
  preemptivelyDisableI18n 
} from '../.utils/utils.ts';
import assert from 'node:assert';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for PageRenameAuto-update and its dependencies 
 *    FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with move rights
 *    Credentials to said account should be provided in .env
 * 4) Seed pages using .seeds/PageRenameAutoUpdate.ts
 * 5) Wiki content language is set in English
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'PageRenameAutoUpdate',
    navigateToPage: 'Special:BlankPage',
    urlParams: {
      'uselang': 'zh-Hans',
      'blankspecial': 'pageusageupdate',
      'pagename': 'PageRenameAuto-update Test Master Page',
      'namespace': 0
    },
    config: {
      credentials: {
        username: process.env.SELENIUM_TESTING_WIKI_USERNAME,
        password: process.env.SELENIUM_TESTING_WIKI_PASSWORD,
      }
    },
    args
  });

  /***********************************************************************
   * 
   * FETCH EXPECTED MESSAGING
   * 
   ***********************************************************************/
  const [enI18nMessages, zhI18nMessages] = await (async () => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PageRenameAuto-update/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  interface MwActionApiRecentChanges {
    batchcomplete: string
    error?: {
      info?: string
    }
    query?: {
      recentchanges: {
        ns: number
        title: string
        user: string
        timestamp: string
        comment: string
      }[]
    }
  }
  const fetchRecentlyEditedPagesFromLogs = async (compareComment: string, limit: number) => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'recentchanges',
      rcdir: 'older',
      /* in last 10 minutes */
      rcend: new Date(new Date().valueOf() - 10*60*1000).toISOString(),
      rcuser: process.env.SELENIUM_TESTING_WIKI_USERNAME!,
      rcprop: 'title|user|comment|timestamp',
      rclimit: ''+limit,
    })}`);
    const d: MwActionApiRecentChanges = await res.json();
    if (d.error) {
      throw new Error(d.error.info || d.error as string);
    }
    return d.query!.recentchanges
      .filter(({ comment }) => comment === compareComment);
  }

  const compareRecentlyEditedPages = async (pages: string[], compareComment: string): Promise<boolean> => {
    const gotPages = new Set(
      (await fetchRecentlyEditedPagesFromLogs(compareComment, pages.length))
        .map(({ title }) => title)
    );
    return pages.every((expectedPage) => gotPages.has(expectedPage));
  };

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until PageRenameAutoUpdate and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PageRenameAuto-update/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#mw-renamepage-table').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load PageRenameAutoUpdate',
      /* 200 ms */ 200
    ));
    return true;
  };

  const reloadPageWithI18n = async (driver: WebDriver) => {
    try {
      testSuite.navigateToPageUrlParams.pagename = `PageRenameAuto-update Test Master Page with-i18n`;
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
      const renderedPageContainer = await driver.findElement(By.id('bodyContent'));
      const label = await renderedPageContainer.findElement(By.css('fieldset > legend'));
      const labelText = await label.getText();
      const outputDiv = await renderedPageContainer.findElement(By.id('PRAFailedLog'));
      const outputDivText = await outputDiv.getText();
      assert(labelText === i18nMessages['fieldTitle'], 'Label does not match');
      assert(outputDivText === i18nMessages['failedItemsInfo'], 'Failed log info does not match');
    }
  );

  /**
   * Rename a page and edit pages that link to that page automatically
   */
  const autoRenamePage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      const inputTable = await driver.findElement(By.id('mw-renamepage-table'));
      const oldTitle = await inputTable.findElement(By.css('tr:nth-child(1) > td.mw-input')).getText();
      assert(oldTitle === `PageRenameAuto-update Test Master Page${withI18nJs ? ' with-i18n' : ''}`, 'Old titles do not match');
      const newTitle = `PageRenameAuto-update Test Master Page${withI18nJs ? ' with-i18n' : ''} Moved`;
      const newTitleInput = await inputTable.findElement(By.id('wpNewTitleMain'));
      await newTitleInput.clear();
      await newTitleInput.sendKeys(newTitle);
      // assert((await newTitleInput.getText()) === newTitle, 'New titles do not match');
      await driver.sleep(200);
      const reason = `SELENIUM TEST: Using PageRenameAuto-update ${randomBytes(4).toString('hex')}`;
      const reasonInput = await inputTable.findElement(By.id('wpReason'));
      await reasonInput.sendKeys(reason);
      await driver.sleep(200);

      const populateListButton = await inputTable.findElement(By.id('PRAstart'));
      await populateListButton.click();
      await driver.wait(
        until.elementTextIs(
          inputTable.findElement(By.id('PRAStatus')),
          i18nMessages['successful']
        ),
        /* 1 minute */ 3*60*1000,
        'Failed to fetch pages',
        /* 0 ms */ 500
      );

      const pagesThatWillBeDirectlyEdited = [
        ...Array(6).fill(null).map((_, idx) => (
          `PageRenameAuto-update Test Links to Master${withI18nJs ? ' with-i18n' : ''} ${idx+1}`
        )),
        `Template:PageRenameAuto-update links to master${withI18nJs ? ' with-i18n' : ''}`,
      ];
      const pagesWithTranscludedTemplates = Array(5).fill(null).map((_, idx) => (
        `PageRenameAuto-update Test Transcluding Template${withI18nJs ? ' with-i18n' : ''} ${idx+1}`
      ));
      const expectedPages = new Set([
        ...pagesThatWillBeDirectlyEdited,
        ...pagesWithTranscludedTemplates,
      ]);
      await driver.wait(
        async () => {
          const el = await inputTable.findElement(By.id('PRAQueue'));
          const pages = (await el.getText()).trim().split('\n');
          const matches = pages.length === expectedPages.size && (pages.every(page => expectedPages.has(page)));
          return matches;
        },
        /* 1 minute */ 1*60*1000,
        'List of pages does not match',
        /* 0 ms */ 500
      );

      const processButton = await inputTable.findElement(By.id('PRAprocess'));
      assert((await processButton.isDisplayed()), 'Process button is not visible');
      await processButton.click();

      await driver.wait(
        until.elementTextIs(
          inputTable.findElement(By.id('PRAStatus')),
          i18nMessages['successful'] + ' ' + i18nMessages['linkNewPage']
        ),
        /* 1 minute */ 3*60*1000,
        'Failed to finish PageRenameAutoUpdate operation',
        /* 0 ms */ 500
      );

      const editSummary = enI18nMessages['summary'];
      const editedPagesMatch = await compareRecentlyEditedPages(
        pagesThatWillBeDirectlyEdited,
        editSummary
      );
      assert(editedPagesMatch, 'Recent changes log does not match pages that have been recently changed');

      await driver.sleep(pauseUiCheckingForHumanReview);
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
    'AutoRenamePageWithoutI18n',
    autoRenamePage(false)
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
    'AutoRenamePageWithI18n',
    autoRenamePage(true)
  );

  return testSuite;

};