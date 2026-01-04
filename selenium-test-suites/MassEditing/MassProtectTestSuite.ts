import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import { randomBytes } from 'node:crypto';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
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
 * 1) Build gadget implementation for MassProtect and its dependencies 
 *    FandoomUiUtilsModal, PowertoolsPlacement, and FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with protect rights
 *    credentials to said account should be provided in .env
 * 4) Seed pages using .seeds/MassProtect.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'MassProtect',
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
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassProtect/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const ENUM_PROTECT_OPTION = {
    ALLOWALL: "all",
    AUTOCONFIRMED: "autoconfirmed",
    SYSOP: "sysop"
  };

  const selectProtectOption = async (driver: WebDriver, attribute: 'edit' | 'move' | 'upload' | 'create' | 'comment', protectOption: string): Promise<void> => {
    const selectOption = await driver.findElement(By.css(`#form-mass-protect #protect-${attribute}`));
    await selectOption.click();
    const chooseOption = await selectOption.findElement(By.css(`option[value="${attribute}=${protectOption}"]`));
    await chooseOption.click();
    await driver.sleep(200);
  }

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until MassProtect and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassProtect/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#t-mp').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load MassProtect',
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
  const compareRecentlyProtectedPages = async (pages: string[], compareComment: string, forUnprotectAction: boolean = false): Promise<boolean> => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'logevents',
      letype: 'protect',
      leaction: forUnprotectAction ? 'protect/unprotect' : 'protect/protect',
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
      $('#form-mass-protect form').trigger('reset');
      $('#form-mass-protect #text-error-output').empty();
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
      const navLink = await driver.findElement(By.id('t-mp'));
      assert(navLink.getText(), i18nMessages['title']);
      await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
      await driver.wait(
        until.elementLocated(By.id('form-mass-protect')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('form-mass-protect'));
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
   * Protect 10 pages in one operation
   */
  const protectTenPagesFromManualInput = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToProtect = Array(10).fill(null).map((_, index) => `MassProtect${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const comment = `SELENIUM TEST: Protect pages from manual user input ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'edit', ENUM_PROTECT_OPTION.AUTOCONFIRMED);
        selectProtectOption(driver, 'move', ENUM_PROTECT_OPTION.SYSOP);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);
        
        const pageListInput = await modal.findElement(By.id('text-mass-protect'));
        await pageListInput.sendKeys(
          ...pagesToProtect.map((page) => `${page}\n`)
        );
        await driver.sleep(200);

        const initiateButton = await modal.findElement(By.id('mp-start'));
        const pauseButton = await modal.findElement(By.id('mp-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
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
        
        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToProtect, comment
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
   * Protect pages stored in a category in one operation
   */
  const protectTenPagesFromCategory = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );
        
        const comment = `SELENIUM TEST: Protect pages that are part of a category ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'edit', ENUM_PROTECT_OPTION.AUTOCONFIRMED);
        selectProtectOption(driver, 'move', ENUM_PROTECT_OPTION.SYSOP);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);
        
        const addCategoryContentsButton = await modal.findElement(By.id('mp-add-pages-in-category'));
        await addCategoryContentsButton.click();
        const promptAlert = await driver.switchTo().alert();
        await promptAlert.sendKeys(`MassProtect Test Category${withI18nJs ? ' with-i18n' : ''}`);
        await promptAlert.accept();
        await driver.wait(
          async () => (
            (await driver.executeScript(`
              return $('#form-mass-protect #text-mass-protect').val() || '';
            `)) !== ''
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 500 ms */ 500
        );
        const pagesToProtect = (await (async () => (
          await driver.executeScript(`
            return $('#form-mass-protect #text-mass-protect').val() || '';
          `)
        ))() as string).split('\n').filter((s) => s.trim() !== '');

        await modal.click();
        await driver.sleep(1000);

        const initiateButton = await modal.findElement(By.id('mp-start'));
        const pauseButton = await modal.findElement(By.id('mp-pause'));
        
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
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
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

        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToProtect, comment
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
   * Protect 10 pages from being created in one operation
   */
  const protectTenPagesFromBeingCreated = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToProtect = Array(10).fill(null).map((_, index) => `MassProtect Cannot Create${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const comment = `SELENIUM TEST: Protect pages from being created ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'create', ENUM_PROTECT_OPTION.SYSOP);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);

        const pageListInput = await modal.findElement(By.id('text-mass-protect'));
        await pageListInput.sendKeys(
          ...pagesToProtect.map((page) => `${page}\n`)
        );

        const initiateButton = await modal.findElement(By.id('mp-start'));
        const pauseButton = await modal.findElement(By.id('mp-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
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

        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToProtect, comment
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
   * Protect 10 pages from being uploaded in one operation
   */
  const protectTenPagesFromBeingUploaded = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToProtect = Array(10).fill(null).map((_, index) => `File:MassProtect Cannot Upload${withI18nJs ? ' with-i18n' : ''} ${index+1}.jpeg`);
        const comment = `SELENIUM TEST: Protect pages from being created ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'upload', ENUM_PROTECT_OPTION.SYSOP);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);

        const pageListInput = await modal.findElement(By.id('text-mass-protect'));
        await pageListInput.sendKeys(
          ...pagesToProtect.map((page) => `${page}\n`)
        );
        await driver.sleep(200);

        const initiateButton = await modal.findElement(By.id('mp-start'));
        const pauseButton = await modal.findElement(By.id('mp-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
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

        const pagesHaveBeenProtected = await compareRecentlyProtectedPages(
          pagesToProtect, comment
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
   * Protect non-existent page
   */
  const protectNonExistentPage = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const comment = `SELENIUM TEST: Try to protect a non-existent page ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'edit', ENUM_PROTECT_OPTION.SYSOP);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);
        const pageListInput = await modal.findElement(By.id('text-mass-protect'));
        await pageListInput.sendKeys('This page does not exist');
        await driver.sleep(200);

        const initiateButton = await modal.findElement(By.id('mp-start'));
        await initiateButton.click();

        const errorOutput = await modal.findElement(By.id('text-error-output'));
        
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
          /* 500 ms */ 500
        );
        await driver.wait(
          until.elementTextContains(
            errorOutput, 
            i18nMessages['fail']
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

  /**
   * Unprotect 10 pages in one operation
   */
  const unprotectTenPages = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 't-mp', skin);
        await driver.wait(
          until.elementLocated(By.id('form-mass-protect')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToUnprotect = Array(10).fill(null).map((_, index) => `MassProtect Test Remove Protection${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        const comment = `SELENIUM TEST: Unprotect pages ${randomBytes(4).toString('hex')}`;

        modal = await driver.findElement(By.id('form-mass-protect'));
        selectProtectOption(driver, 'edit', ENUM_PROTECT_OPTION.ALLOWALL);
        selectProtectOption(driver, 'move', ENUM_PROTECT_OPTION.ALLOWALL);

        const protectReasonInput = await modal.findElement(By.id('protect-reason'));
        await protectReasonInput.sendKeys(comment);
        await driver.sleep(200);
        
        const pageListInput = await modal.findElement(By.id('text-mass-protect'));
        await pageListInput.sendKeys(
          ...pagesToUnprotect.map((page) => `${page}\n`)
        );
        await driver.sleep(200);

        const initiateButton = await modal.findElement(By.id('mp-start'));
        const pauseButton = await modal.findElement(By.id('mp-pause'));
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
            i18nMessages['finished'] + ' ' + i18nMessages['done']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassProtect operation',
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
        
        const pagesHaveBeenUnprotected = await compareRecentlyProtectedPages(
          pagesToUnprotect, comment, true
        );
        assert(pagesHaveBeenUnprotected, 'Protect log does not match');

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
    'MassProtectWithNoI18nJs',
    protectTenPagesFromManualInput(false)
  );
  testSuite.addTestCase(
    'MassProtectPagesInCategoryWithNoI18nJs',
    protectTenPagesFromCategory(false)
  );
  testSuite.addTestCase(
    'ProtectPagesFromBeingCreatedWithNoI18nJs',
    protectTenPagesFromBeingCreated(false)
  );
  testSuite.addTestCase(
    'ProtectPagesFromBeingUploadedWithNoI18nJs',
    protectTenPagesFromBeingUploaded(false)
  );
  testSuite.addTestCase(
    'UnprotectPagesWithNoI18nJs',
    unprotectTenPages(false)
  );
  testSuite.addTestCase(
    'ProtectNonExistentPageWithNoI18nJs',
    protectNonExistentPage(false)
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
    'MassProtectWithI18nJs',
    protectTenPagesFromManualInput(true)
  );
  testSuite.addTestCase(
    'MassProtectPagesInCategoryWithI18nJs',
    protectTenPagesFromCategory(true)
  );
  testSuite.addTestCase(
    'ProtectPagesFromBeingCreatedWithI18nJs',
    protectTenPagesFromBeingCreated(true)
  );
  testSuite.addTestCase(
    'ProtectPagesFromBeingUploadedWithI18nJs',
    protectTenPagesFromBeingUploaded(true)
  );
  testSuite.addTestCase(
    'UnprotectPagesWithI18nJs',
    unprotectTenPages(true)
  );
  testSuite.addTestCase(
    'ProtectNonExistentPageWithI18nJs',
    protectNonExistentPage(true)
  );

  return testSuite;

};