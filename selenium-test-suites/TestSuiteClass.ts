import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { URLSearchParams } from 'node:url';
import { styleText } from 'node:util';
import { Builder, Browser, WebDriver, until, By } from 'selenium-webdriver';

export interface TestSuiteDriverArgs {
  skin?: string
  browser?: string
}

export interface TestSuiteClassConfig {
  connectionTimeout?: number
  pollTimeout?: number
  credentials?: {
    username?: string
    password?: string
  }
}

export interface TestCase {
  id: string
  fn: TestCaseFn
}
export type TestCaseFn = (driver: WebDriver) => void | Promise<void>;
export type TestAssertionFn = (driver: WebDriver) => boolean | Promise<boolean>;

class LogUtils {
  static info(msg: string) {
    console.info(styleText(['magenta', 'cyan'], msg));
  }
  static error(msg: string) {
    console.error(styleText(['redBright', 'red'], msg));
  }
  static success(msg: string) {
    console.info(styleText(['green', 'greenBright', 'cyan'], msg));
  }
}

class TestSuiteClass {
  static LogUtils = LogUtils;

  /**
   * ID of Selenium Test Suite Class for logging purposes
   */
  id: string;

  /**
   * Entrypoint to the MediaWiki instance's article path, e.g. https://en.wikipedia.org/wiki/
   */
  wikiEntrypoint: string;

  navigateToPage: string;
  navigateToPageUrlParams: { [paramKey: string]: any };
  testCases: TestCase[];
  config?: TestSuiteClassConfig;

  /**
   * The given function must return true when run before any of the test cases is executed.
   * Otherwise, all test cases will be considered to fail. 
   */
  beforeAll?: TestAssertionFn;
  
  /**
   * The given function is run before each of the test cases. The function must return true 
   * or all test cases will be considered to fail. 
   */
  beforeEach?: TestAssertionFn

  /**
   * The given function is run after each of the test cases. Useful for teardown.
   */
  afterEach?: TestAssertionFn

  /**
   * The given function is run after all test cases have been executed. Useful for teardown.
   */
  afterAll?: TestAssertionFn

  /**
   * Create a new instance of a Selenium Test Suite
   * 
   * @param id              ID of Selenium Test Suite Class for logging purposes 
   * @param wikiEntrypoint  Entrypoint to the MediaWiki instance's article path, e.g. https://en.wikipedia.org/wiki/
   * @param navigateToPage  When starting the WebDriver for the first time, navigate to this page on the wiki
   * @param urlParams       Additional URL params to pass to the web driver when navigating to the first page
   *                        Default loaded with `useskin=vector-2022` and `safemode=1`
   * @param config          Additional Selenium Test Suite configuration
   */
  constructor (id: string, wikiEntrypoint: string, navigateToPage?: string, urlParams?: { [paramKey: string]: any }, config?: TestSuiteClassConfig) {
    this.id = id;
    this.wikiEntrypoint = wikiEntrypoint;
    this.navigateToPage = navigateToPage || '';
    this.navigateToPageUrlParams = {
      'safemode': 1,
      'useskin': 'vector-2022',
      ...(urlParams || {})
    };
    this.testCases = [];
    this.config = config;
  }

  /**
   * Register a test case to run.
   * 
   * Test cases are run sequentially.
   * 
   * @param testCaseId  Test Case ID for logging purposes
   * @param testCase
   */
  addTestCase(testCaseId: string, testCase: TestCaseFn): void {
    this.testCases.push({ id: testCaseId, fn: testCase });
  }

  /**
   * Upon starting a test suite run, navigate to the given page and wait for ResourceLoader
   * to load jQuery and the `mw` Javascript library onto the context.
   * 
   * @param driver 
   * @returns 
   */
  async waitForContextToLoad(driver: WebDriver): Promise<boolean> {
    try {
      await driver.get(
        this.getUrlToWikiPage(this.navigateToPage, this.navigateToPageUrlParams)
      );
      await driver.wait(
        async () => {
          const documentIsLoaded = (await driver.executeScript("return document.readyState")) === 'complete';
          const jqIsLoaded = (await driver.executeScript("return $ !== undefined")) === true;
          const mwIsLoaded = (await driver.executeScript("return window.mw !== undefined")) === true;
          return [documentIsLoaded, jqIsLoaded, mwIsLoaded].every(Boolean);
        }, 
        this.config?.connectionTimeout || /* 3 minutes */ 3*60*1000,
        `${this.id} - ${this.wikiEntrypoint}/${this.navigateToPage}\t Connection timeout`,
        this.config?.pollTimeout || /* 300 ms */ 300
      );
      LogUtils.success(`${this.id} - waitForContextToLoad: Successfully loaded context`);
      return true;
    } catch (err) {
      LogUtils.error(`${this.id} - waitForContextToLoad: ${err}`);
      return false;
    }
  }

  /**
   * Utility function to get the URL to a wiki article, search parameters included
   * 
   * @param pagename 
   * @param params 
   * @returns 
   */
  getUrlToWikiPage(pagename: string, params?: { [key: string]: string }): string {
    const url = `${this.wikiEntrypoint}/${pagename}?${(new URLSearchParams(params || {})).toString()}`;
    return url;
  }

  /**
   * Login with the given credentials
   * 
   * @param driver 
   */
  async login(driver: WebDriver): Promise<void> {
    if (!this.config?.credentials?.username || !this.config?.credentials?.password) {
      throw new Error('No credentials given!');
    }
    await driver.get(this.getUrlToWikiPage('Special:UserLogin'));
    await driver.wait(
      until.elementLocated(By.id('userloginForm')),
      /* 3 minutes */ 3*60*1000,
      'Failed to load Login Page',
      /* 250 ms */ 200
    );
    const loginForm = await driver.findElement(By.id('userloginForm'));
    const usernameInput = await driver.findElement(By.id('wpName1'));
    await usernameInput.sendKeys(this.config.credentials.username!);
    const passwordInput = await driver.findElement(By.id('wpPassword1'))
    await passwordInput.sendKeys(this.config.credentials.password!);
    const submitButton = await driver.findElement(By.id('wpLoginAttempt'));
    await submitButton.click();
    await driver.wait(
      until.stalenessOf(loginForm),
      /* 3 minutes */ 3*60*1000,
      'Failed to get a response after login attempt',
      /* 250 ms */ 200
    );
    await driver.wait(
      async () => (await driver.executeScript(`return $('#userloginForm').length === 0`)) === true,
      /* 1 minute */ 1*60*1000,
      'Failed to login',
      /* 250 ms */ 200
    );
  };

  /**
   * Logout of the wiki
   * 
   * @param driver 
   */
  async logout(driver: WebDriver): Promise<void> {
    await driver.get(this.getUrlToWikiPage('Special:UserLogout'));
  }

  async runSingleTestCase(driver: WebDriver, testCase: TestCase): Promise<boolean> {
    try {
      await testCase.fn(driver);
      LogUtils.success(`${this.id} - ${testCase.id}: Test completed successfully`);
      return true;
    } catch (err) {
      LogUtils.error(`${this.id} - ${testCase.id}: ${err}`);
      return false;
    }
  }

  /**
   * Run test cases sequentially
   */
  async run(): Promise<void> {
    let driver = await new Builder().forBrowser(Browser.EDGE).build();
    let successes = 0;
    let total = 0;
    try {
      
      const contextLoaded = await this.waitForContextToLoad(driver);
      if (!contextLoaded) {
        throw new Error('Context failed to load');
      }

      /* Assert before any test case is done */
      if (!!this.beforeAll) {
        const asserted = await this.beforeAll(driver);
        if (!asserted) {
          throw new Error('Failed beforeAll assertion');
        }
        LogUtils.info(`${this.id} - beforeAll: Passed successfully`);
      }

      /* Run tests sequentially */
      for (const testCase of this.testCases) {
        
        total++;
        
        /* Assert before each test case */
        if (!!this.beforeEach) {
          const asserted = await this.beforeEach(driver);
          if (!asserted) { continue; }
        }

        const isSuccess = await this.runSingleTestCase(driver, testCase);
        if (isSuccess) { successes++; }

        /* Assert after each test case */
        if (!!this.afterEach) {
          const asserted = await this.afterEach(driver);
          if (!asserted) { 
            LogUtils.error(`${this.id} - afterEach: Failed to complete`)
            continue; 
          }
        }
        
      }
      
      /* Assert after all test cases are done */
      if (!!this.afterAll) {
        const asserted = await this.afterAll(driver);
        if (!asserted) {
          throw new Error('Failed afterAll assertion');
        }
        LogUtils.info(`${this.id} - afterAll: Passed successfully`);
      }

    } catch (err) {
      LogUtils.error(`${this.id} - run: ${err}`);
    } finally {
      LogUtils.success(`${this.id}: Successfully completed ${successes} test(s) out of ${total}`);
      await driver.quit();
    }
  }
}

/**
 * Load environment variables from ./selenium-test-suites/.env.test
 */
export const loadTestEnvironment = () => {

  const __dirname = import.meta.dirname;

  loadEnvFile(resolve(__dirname, './.env.test'));

  const mandatoryVars = [
    'SELENIUM_TESTING_WIKI_ENTRYPOINT',
    'SELENIUM_TESTING_SERVE_GADGETS_FROM',
  ];
  mandatoryVars.forEach((varName) => {
    if (!process.env[varName]) {
      const msg = `The environment variable "${varName}" must be set!!`;
      LogUtils.error(msg);
      throw new Error(msg);
    }
  });
}

/**
 * Utility function for testing
 * 
 * Click a link located on the menu created by the gadget PowertoolsPlacement
 * 
 * @param driver    Selenium WebDriver
 * @param navLinkId HTML ID of the navigation link located on the PowertoolsPlacement menu
 * @param skin      MediaWiki skin
 */
export const clickLinkOnPowertoolsMenu = async (driver: WebDriver, navLinkId: string, skin?: string) => {
  if (skin === undefined) {
    skin = await driver.executeScript('return mw.config.values.skin;');
  }
  let powertoolsDropdown;
  switch (skin) {
    case 'vector':
    case 'modern':
    case 'monobook':
    case 'gamepress':
      // Do nothing
      break;
    
    case 'vector-2022':
      const vectorMenu = await driver.findElement(By.id('vector-main-menu'));
      const vectorMenuIsVisible = await vectorMenu.isDisplayed();
      if (!vectorMenuIsVisible) {
        const hamburgerMenuButton = await driver.findElement(By.id('vector-main-menu-dropdown'));
        await hamburgerMenuButton.click();
      }
      break;
    
    case 'timeless':
      const timelessSiteTools = await driver.findElement(By.css('#site-tools > .sidebar-inner'));
      const timelessSiteToolsIsVisible = await timelessSiteTools.isDisplayed();
      if (!timelessSiteToolsIsVisible) {
        const siteToolsMenuButton = await driver.findElement(By.css('#site-tools > h2'));
        await siteToolsMenuButton.click();
      }
      break;
    
    case 'minerva':
      powertoolsDropdown = await driver.findElement(
        By.css('.minerva-header > .navigation-drawer')
      );
      await powertoolsDropdown.click();
      break;

    case 'medik':
      powertoolsDropdown = await driver.findElement(
        By.js("return $('.dropdown').filter(function () { $(this).find('#p-power-editor-tools').length > 0 })")
      );
      await powertoolsDropdown.click();
      break;

    case 'citizen':
      powertoolsDropdown = await driver.findElement(
        By.id('citizen-powertools-portlet-container-details')
      );
      await powertoolsDropdown.click();
      break;

    case 'cosmos':
    default:
      powertoolsDropdown = await driver.findElement(
        By.id('p-power-editor-tools')
      );
      await powertoolsDropdown.click();
  }
  const navLink = await driver.findElement(By.id(navLinkId));
  await driver.wait(
    until.elementIsVisible(navLink),
    /* 1 minute */ 1*60*1000,
    `Nav link ${navLinkId} is not visible`,
    /* 250 ms */ 250
  )
  await navLink.click();
}

export default TestSuiteClass;