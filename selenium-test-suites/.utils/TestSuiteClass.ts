import { URLSearchParams } from 'node:url';
import { Builder, Browser, WebDriver, until, By } from 'selenium-webdriver';
import { LogUtils } from './utils.ts';

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
  stopFurtherTestsOnFailure: boolean
}
export type TestCaseFn = (driver: WebDriver) => void | Promise<void>;
export type TestAssertionFn = (driver: WebDriver) => boolean | Promise<boolean>;

export interface TestCaseOptions {
  stopFurtherTestsOnFailure?: boolean
  onlyTestThisTestCase?: boolean
}

interface TestSuiteFailedLog {
  id: string
  reason: string
}
export interface TestSuiteRunResults {
  successes: number
  total: number
  failed: TestSuiteFailedLog[]
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
  onlyTest: number[];
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
    this.onlyTest = [];
    this.config = config;
  }

  /**
   * Register a test case to run.
   * 
   * Test cases are run sequentially.
   * 
   * @param testCaseId 
   * Test Case ID for logging purposes
   * @param testCase
   * @param stopFurtherTestsOnFailure 
   * If set to `true` then the test suite will not run successive test cases (instead marking
   * them as failed) 
   */
  addTestCase(testCaseId: string, testCase: TestCaseFn, options: TestCaseOptions = {} ): void {
    this.testCases.push({ 
      id: testCaseId, 
      fn: testCase, 
      stopFurtherTestsOnFailure: options.stopFurtherTestsOnFailure || false 
    });
    if (options.onlyTestThisTestCase) {
      this.onlyTest.push(this.testCases.length - 1);
    }
  }

  /**
   * Navigate to another page and wait for the context to load
   * 
   * @param driver 
   * @param pagename 
   * @param additionalParams 
   * @returns 
   */
  async moveToAnotherPage(driver: WebDriver, pagename: string, additionalParams: { [key: string]: any } = {}): Promise<boolean> {
    return (await this.waitForContextToLoad(driver, pagename, {
      ...this.navigateToPageUrlParams,
      ...additionalParams
    }));
  }

  /**
   * Upon starting a test suite run, navigate to the given page and wait for ResourceLoader
   * to load jQuery and the `mw` Javascript library onto the context.
   * 
   * @param driver 
   * @returns 
   */
  async waitForContextToLoad(driver: WebDriver, navigateToPage?: string, navigateToPageUrlParams?: { [key: string]: any }): Promise<boolean> {
    try {
      await driver.get(
        this.getUrlToWikiPage(
          navigateToPage || this.navigateToPage, 
          navigateToPageUrlParams || this.navigateToPageUrlParams
        )
      );
      await driver.wait(
        async () => {
          const documentIsLoaded = (await driver.executeScript("return document.readyState")) === 'complete';
          const jqIsLoaded = (await driver.executeScript("return window.$ !== undefined")) === true;
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
   * Login with the given credentials, then navigate to the page first passed to the test suite 
   * contructor
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
    if (!(await this.waitForContextToLoad(driver))) {
      throw new Error('Failed to get context to load after login');
    }
  };

  /**
   * Logout of the wiki
   * 
   * @param driver 
   */
  async logout(driver: WebDriver): Promise<void> {
    await driver.get(this.getUrlToWikiPage('Special:UserLogout'));
  }

  async runSingleTestCase(driver: WebDriver, testCase: TestCase): Promise<{ isSuccess: boolean, error?: any }> {
    try {
      await testCase.fn(driver);
      LogUtils.success(`${this.id} - ${testCase.id}: Test completed successfully`);
      return { isSuccess: true };
    } catch (err) {
      LogUtils.error(`${this.id} - ${testCase.id}: ${err}`);
      return { isSuccess: false, error: err } 
    };
  }

  /**
   * Run test cases sequentially
   */
  async run(): Promise<TestSuiteRunResults> {
    let driver = await new Builder().forBrowser(Browser.EDGE).build();
    let successes = 0;
    let total = this.testCases.length;
    const failedTestCases: TestSuiteFailedLog[] = [];
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

      let tcs: TestCase[] = this.testCases;
      if (this.onlyTest.length > 0) {
        tcs = this.onlyTest.map((idx) => {
          return this.testCases[idx];
        });
      }

      /* Run tests sequentially */
      for (const testCase of tcs) {
        
        /* Assert before each test case */
        if (!!this.beforeEach) {
          const asserted = await this.beforeEach(driver);
          if (!asserted) { continue; }
        }

        const { isSuccess, error } = await this.runSingleTestCase(driver, testCase);
        if (isSuccess) { 
          successes++; 
        } else {
          let reason = error!;
          if (testCase.stopFurtherTestsOnFailure) {
            reason += ' Test cases following this test case are skipped and considered to have failed';
          }
          failedTestCases.push({ id: testCase.id, reason });
        }

        /* Assert after each test case */
        if (!!this.afterEach) {
          const asserted = await this.afterEach(driver);
          if (!asserted) { 
            LogUtils.error(`${this.id} - afterEach: Failed to complete`);
            continue; 
          }
        }

        if (!isSuccess && testCase.stopFurtherTestsOnFailure) {
          LogUtils.error(`${this.id} - Stopping further tests...`);
          break;
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
    return { successes, total, failed: failedTestCases };
  }
}

export default TestSuiteClass;