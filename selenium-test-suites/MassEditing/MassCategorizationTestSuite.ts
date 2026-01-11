import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
import { Select } from 'selenium-webdriver/lib/select.js';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import { 
  clickLinkOnPowertoolsMenu, 
  LogUtils, 
  preemptivelyDisableI18n,
  webElementHasCssClass
} from '../.utils/utils.ts';
import assert from 'node:assert';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for MassCategorization and its dependencies 
 *    FandoomUiUtilsModal, FandoomUiUtilsDorui, PowertoolsPlacement, and 
 *    FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Create a wiki account (preferably on a testing wiki) with delete rights
 *    credentials to said account should be provided in .env
 * 4) Seed pages using .seeds/MassCategorization.ts
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'MassCategorization',
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
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassCategorization/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans']];
  })();


  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/

  const writeCategoryNameToInput = async (driver: WebDriver, categoryInputGroup: WebElement, mode: 'add' | 'replace' | 'remove', categoryName: string, categoryReplacementName?: string): Promise<void> => {
    try {
      const selectOptionValue = (
        mode === 'add' ? 1 :
        mode === 'remove' ? 2 :
        3
      );
      const categorizationModeSelect = new Select(await categoryInputGroup.findElement(By.css('.MassCat-mode-select')));
      await categorizationModeSelect.selectByValue(''+selectOptionValue);
      // Force the input event to trigger
      await driver.executeScript(`
        const event = new Event('input', { bubbles: true });
        $('.MassCat-category-update .MassCat-mode-select').each(function () {
          $(this)[0].dispatchEvent(event);
        });
      `);
      await driver.sleep(500);
      assert((await webElementHasCssClass(categoryInputGroup, `MassCat-category-update-${mode}`)), `Category input group does not have CSS class MassCat-category-update-${mode}`);

      const categoryNameInputs = await categoryInputGroup.findElements(By.css('.MassCat-category-input'));
      assert(
        categoryNameInputs.length === (mode === 'replace' ? 2 : 1), 
        `Got ${categoryNameInputs.length} elements with class 'MassCat-category-input'`
      );
      await categoryNameInputs[0].clear();
      await categoryNameInputs[0].sendKeys(categoryName);

      if (mode === 'replace' && categoryReplacementName !== undefined) {
        await categoryNameInputs[1].clear();
        await categoryNameInputs[1].sendKeys(categoryReplacementName);
      }

      await driver.sleep(500);
    } catch (err) {
      throw err;
    }
  }

  interface MwActionApiCategoryMember {
    batchcomplete: string
    error?: {
      info?: string
    }
    query?: {
      categorymembers: {
        title: string
      }[]
    }
  }
  const compareCategoryMembers = async (expectedPages: string[], category: string): Promise<boolean> => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT}?${new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmnamespace: '0',
      cmlimit: '500',
      cmprop: 'title',
      cb: new Date(Date.now()).toISOString()
    })}`);
    const d: MwActionApiCategoryMember = await res.json();
    if (d.error) {
      throw new Error(d.error.info || d.error as string);
    }
    const gotPages = new Set(
      d.query!.categorymembers
        .map(({ title }) => title)
    );
    return expectedPages.every((expectedPage) => gotPages.has(expectedPage));
  };

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until MassCategorization and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsDorui/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/PowertoolsPlacement/gadget-impl.js");
    `);
    await driver.sleep(200);
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/MassCategorization/gadget-impl.js");
    `);
    await driver.sleep(200);
    await (driver.wait(
      async () => (await driver.executeScript(`return $('#MassCat-tools-button').length > 0`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load MassCategorization',
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
      const navLink = await driver.findElement(By.id('MassCat-tools-button'));
      assert(navLink.getText(), i18nMessages['my-tools-button']);
      await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
      await driver.wait(
        until.elementLocated(By.id('MassCatModal')),
        /* 1 minute */ 1*60*1000,
        'Modal failed to load',
        /* 250 ms */ 250
      );
      const modal = await driver.findElement(By.id('MassCatModal'));
      const modalTitle = await modal.findElement(
        By.css('.oo-ui-processDialog-location .oo-ui-processDialog-title')
      );
      assert(modalTitle.getText(), i18nMessages['modal-title']);
      
      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await modal.findElement(
        By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
   * Add categories to 10 pages in one operation
   */
  const massAddCategories = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
        await driver.wait(
          until.elementLocated(By.id('MassCatModal')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToEdit = Array(10).fill(null).map((_, index) => `MassCategorization Test Add${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        
        modal = await driver.findElement(By.id('MassCatModal'));
        
        const pageListInput = await modal.findElement(By.css('.MassCat-pages-textarea'));
        for (const page of pagesToEdit) {
          await pageListInput.sendKeys(page + '\n');
        }
        await driver.sleep(500);

        const addToCategory = `Added by MassCategorization${withI18nJs ? ' with-i18n' : ''}`;
        const categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 1, `Found ${categoryInputGroups.length} category input groups`);
        await writeCategoryNameToInput(driver, categoryInputGroups[0], 'add', addToCategory);
        
        const initiateButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-primary'));
        await initiateButton.click();

        const statusOutput = await modal.findElement(By.id('MassCat-status-container'));
        
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        const finishedAlert = await driver.switchTo().alert();
        await finishedAlert.dismiss();

        await driver.wait(
          until.elementTextIs(
            statusOutput, 
            i18nMessages['status-finished']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );

        const successfullyAdded = await compareCategoryMembers(pagesToEdit, addToCategory);
        assert(successfullyAdded, 'List of category members does not match');

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
   * Remove categories from 10 pages in one operation
   */
  const massRemoveCategories = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
        await driver.wait(
          until.elementLocated(By.id('MassCatModal')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        modal = await driver.findElement(By.id('MassCatModal'));
        
        const addCategoryContentsButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-other > .oo-ui-actionWidget:nth-child(2)'));
        await addCategoryContentsButton.click();
        const promptAlert = await driver.switchTo().alert();
        await promptAlert.sendKeys(`MassCategorization Remove${withI18nJs ? ' with-i18n' : ''}`);
        await promptAlert.accept();
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 250 ms */ 250
        );
        const successAlert = await driver.switchTo().alert();
        await successAlert.dismiss();
        await driver.wait(
          async () => (
            (await driver.executeScript(`
              return $('#MassCatModal .MassCat-pages-textarea').val() || '';
            `)) !== ''
          ),
          /* 1 minute */ 1*60*1000,
          'Textarea is not filled',
          /* 200 ms */ 200
        );

        const removeFromCategory = `MassCategorization Remove${withI18nJs ? ' with-i18n' : ''}`;
        const categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 1, `Found ${categoryInputGroups.length} category input groups`);
        await writeCategoryNameToInput(driver, categoryInputGroups[0], 'remove', removeFromCategory);
        
        const initiateButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-primary'));
        await initiateButton.click();

        const statusOutput = await modal.findElement(By.id('MassCat-status-container'));
        
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        const finishedAlert = await driver.switchTo().alert();
        await finishedAlert.dismiss();

        await driver.wait(
          until.elementTextIs(
            statusOutput, 
            i18nMessages['status-finished']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        
        const successfullyAdded = await compareCategoryMembers([], removeFromCategory);
        assert(successfullyAdded, 'List of category members does not match');

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
   * Replace categories from 10 pages in one operation
   */
  const massReplaceCategories = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
        await driver.wait(
          until.elementLocated(By.id('MassCatModal')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        modal = await driver.findElement(By.id('MassCatModal'));
        
        const addCategoryContentsButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-other > .oo-ui-actionWidget:nth-child(2)'));
        await addCategoryContentsButton.click();
        const promptAlert = await driver.switchTo().alert();
        await promptAlert.sendKeys(`MassCategorization Replace${withI18nJs ? ' with-i18n' : ''}`);
        await promptAlert.accept();
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to fetch pages from category',
          /* 250 ms */ 250
        );
        const successAlert = await driver.switchTo().alert();
        await successAlert.dismiss();
        await driver.wait(
          async () => (
            (await driver.executeScript(`
              return $('#MassCatModal .MassCat-pages-textarea').val() || '';
            `)) !== ''
          ),
          /* 1 minute */ 1*60*1000,
          'Textarea is not filled',
          /* 200 ms */ 200
        );

        const pagesToEdit = (await (async () => (
          await driver.executeScript(`
            return $('#MassCatModal .MassCat-pages-textarea').val() || '';
          `)
        ))() as string).split('\n').filter((s) => s.trim() !== '');

        const removeFromCategory = `MassCategorization Replace${withI18nJs ? ' with-i18n' : ''}`;
        const addToCategory = `MassCategorization Replacement${withI18nJs ? ' with-i18n' : ''}`;
        const categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 1, `Found ${categoryInputGroups.length} category input groups`);
        await writeCategoryNameToInput(
          driver,
          categoryInputGroups[0], 
          'replace', 
          removeFromCategory,
          addToCategory
        );
        
        const initiateButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-primary'));
        await initiateButton.click();

        const statusOutput = await modal.findElement(By.id('MassCat-status-container'));
        
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        const finishedAlert = await driver.switchTo().alert();
        await finishedAlert.dismiss();

        await driver.wait(
          until.elementTextIs(
            statusOutput, 
            i18nMessages['status-finished']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );

        const successfullyReplaced = (
          (await compareCategoryMembers([], removeFromCategory)) &&
          (await compareCategoryMembers(pagesToEdit, addToCategory))
        );
        assert(successfullyReplaced, 'List of category members does not match');

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
   * Add, remove, and replace categories from 10 pages in one operation
   */
  const massComplexOperationCategories = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
        await driver.wait(
          until.elementLocated(By.id('MassCatModal')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToEdit = Array(10).fill(null).map((_, index) => `MassCategorization Test Complex Example${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        
        modal = await driver.findElement(By.id('MassCatModal'));
        
        const pageListInput = await modal.findElement(By.css('.MassCat-pages-textarea'));
        for (const page of pagesToEdit) {
          await pageListInput.sendKeys(page + '\n');
        }
        await driver.sleep(200);

        const addCategorizationOptionButton = await modal.findElement(By.id('MassCat-add-category'));
        const removeCategorizationOptionButton = await modal.findElement(By.id('MassCat-remove-category'));
        for (let i = 0; i < 5; i++) {
          await addCategorizationOptionButton.click();
        }
        await driver.sleep(500);
        let categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 6, `Found ${categoryInputGroups.length} category input groups`);
        for (let i = 0; i < 2; i++) {
          await removeCategorizationOptionButton.click();
        }
        await driver.sleep(500);
        categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 4, `Found ${categoryInputGroups.length} category input groups`);

        const addToCategories = [
          `Added by MassCategorization complex${withI18nJs ? ' with-i18n' : ''}`,
          `MassCategorization Complex Replacement${withI18nJs ? ' with-i18n' : ''}`
        ];
        const removeFromCategories = [
          `MassCategorization Complex Remove This 1${withI18nJs ? ' with-i18n' : ''}`,
          `MassCategorization complex remove this 2${withI18nJs ? ' with-i18n' : ''}`,
          `MassCategorization Complex Replace This${withI18nJs ? ' with-i18n' : ''}`,
        ];
        await writeCategoryNameToInput(
          driver, 
          categoryInputGroups[0], 
          'add',
          addToCategories[0]
        );
        await writeCategoryNameToInput(
          driver, 
          categoryInputGroups[1], 
          'remove',
          removeFromCategories[0],
        );
        await writeCategoryNameToInput(
          driver, 
          categoryInputGroups[2], 
          'remove',
          removeFromCategories[1],
        );
        await writeCategoryNameToInput(
          driver, 
          categoryInputGroups[3], 
          'replace',
          removeFromCategories[2],
          addToCategories[1],
        );

        await driver.sleep(500);

        const initiateButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-primary'));
        await initiateButton.click();

        const statusOutput = await modal.findElement(By.id('MassCat-status-container'));
        
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        const finishedAlert = await driver.switchTo().alert();
        await finishedAlert.dismiss();

        await driver.wait(
          until.elementTextIs(
            statusOutput, 
            i18nMessages['status-finished']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );

        const prs = await Promise.all([
          ...addToCategories.map((cat) => compareCategoryMembers(pagesToEdit, cat)),
          ...removeFromCategories.map((cat) => compareCategoryMembers([], cat)),
        ]);
        assert(prs.every(Boolean), 'List of category members does not match');

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const numCategoryGroups = (await modal.findElements(By.css('.MassCat-category-update'))).length;
          const removeCategorizationOptionButton = await modal.findElement(By.id('MassCat-remove-category'));
          for (let i = 0; i < numCategoryGroups-1; i++) {
            await removeCategorizationOptionButton.click();
          }

          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
   * Add categories that aren't included in transclusions to 10 pages in one operation
   */
  const massAddCategoriesNoInclude = (withI18nJs: boolean = false) => (
    async (driver: WebDriver) => {
      const i18nMessages = withI18nJs ? zhI18nMessages : enI18nMessages;
      let modal: WebElement | null = null;
      try {
        await clickLinkOnPowertoolsMenu(driver, 'MassCat-tools-button', skin);
        await driver.wait(
          until.elementLocated(By.id('MassCatModal')),
          /* 1 minute */ 1*60*1000,
          'Modal failed to load',
          /* 250 ms */ 250
        );

        const pagesToEdit = Array(5).fill(null).map((_, index) => `Template:MassCategorization Template${withI18nJs ? ' with-i18n' : ''} ${index+1}`);
        
        modal = await driver.findElement(By.id('MassCatModal'));
        
        const pageListInput = await modal.findElement(By.css('.MassCat-pages-textarea'));
        for (const page of pagesToEdit) {
          await pageListInput.sendKeys( page + '\n' );
        }
        await driver.sleep(200);

        const categoryInputGroups = await modal.findElements(By.css('.MassCat-category-update'));
        assert(categoryInputGroups.length === 1, `Found ${categoryInputGroups.length} category input groups`);
        await writeCategoryNameToInput(driver, categoryInputGroups[0], 'add', 'Added by MassCategorization');

        const noincludeCheckbox = await modal
          .findElement(By.css('#MassCat-options-container > .MassCat-options-label:nth-child(1) input[type="checkbox"]'));
        await noincludeCheckbox.click();

        const initiateButton = await modal.findElement(By.css('.oo-ui-processDialog-actions-primary'));
        await initiateButton.click();

        const statusOutput = await modal.findElement(By.id('MassCat-status-container'));
        
        await driver.wait(
          until.alertIsPresent(),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );
        const finishedAlert = await driver.switchTo().alert();
        await finishedAlert.dismiss();
        
        await driver.wait(
          until.elementTextIs(
            statusOutput, 
            i18nMessages['status-finished']
          ),
          /* 3 minutes */ 3*60*1000,
          'Failed to finish MassCategorization operation',
          /* 500 ms */ 500
        );

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        throw err;
      } finally {
        if (modal !== null) {
          const closeButton = await modal.findElement(
            By.css('.oo-ui-processDialog-actions-other .oo-ui-buttonWidget:first-child')
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
    'MassAddCategoriesWithNoI18nJs',
    massAddCategories(false)
  );
  testSuite.addTestCase(
    'MassRemoveCategoriesWithNoI18nJs',
    massRemoveCategories(false)
  );
  testSuite.addTestCase(
    'MassReplaceCategoriesWithNoI18nJs',
    massReplaceCategories(false)
  );
  testSuite.addTestCase(
    'MassComplexOperationWithNoI18nJs',
    massComplexOperationCategories(false)
  );
  testSuite.addTestCase(
    'MassAddCategoriesNoincludeWithNoI18nJs',
    massAddCategoriesNoInclude(false)
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
    'MassAddCategoriesWithI18nJs',
    massAddCategories(true)
  );
  testSuite.addTestCase(
    'MassRemoveCategoriesWithI18nJs',
    massRemoveCategories(true)
  );
  testSuite.addTestCase(
    'MassReplaceCategoriesWithI18nJs',
    massReplaceCategories(true)
  );
  testSuite.addTestCase(
    'MassComplexOperationWithI18nJs',
    massComplexOperationCategories(true)
  );
  testSuite.addTestCase(
    'MassAddCategoriesNoincludeWithI18nJs',
    massAddCategoriesNoInclude(true)
  );

  return testSuite;

};