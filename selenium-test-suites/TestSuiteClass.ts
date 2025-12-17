import { URLSearchParams } from 'node:url';
import { styleText } from 'node:util';
import { Builder, Browser, WebDriver } from 'selenium-webdriver';

interface TestSuiteClassOptions {
  connectionTimeout?: number
  pollTimeout?: number
}

interface TestCase {
  id: string
  fn: TestCaseFn
}
type TestCaseFn = (driver: WebDriver) => void | Promise<void>;
type TestAssertionFn = (driver: WebDriver) => boolean | Promise<boolean>;

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
  id: string;
  wikiEntrypoint: string;
  navigateToPage: string;
  navigateToPageUrlParams: { [paramKey: string]: any };
  testCases: TestCase[];
  config?: TestSuiteClassOptions;

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
   * Create a new instance of a Selenium Test Suite
   * 
   * @param id              ID of Selenium Test Suite Class for logging purposes 
   * @param wikiEntrypoint  Entrypoint to the MediaWiki instance's article path, e.g. https://en.wikipedia.org/wiki/
   * @param navigateToPage  When starting the WebDriver for the first time, navigate to this page on the wiki
   * @param urlParams       Additional URL params to pass to the web driver when navigating to the first page
   *                        Default loaded with `useskin=vector-2022` and `safemode=1`
   * @param config          Additional Selenium Test Suite configuration
   */
  constructor (id: string, wikiEntrypoint: string, navigateToPage?: string, urlParams?: { [paramKey: string]: any }, config?: TestSuiteClassOptions) {
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

  addTestCase(testCaseId: string, testCase: TestCaseFn) {
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
    const url = `${this.wikiEntrypoint}/${this.navigateToPage}?${(new URLSearchParams(this.navigateToPageUrlParams)).toString()}`;
    try {
      await driver.get(url);
      await driver.wait(
        async () => {
          const documentIsLoaded = (await driver.executeScript("return document.readyState")) === 'complete';
          const jqIsLoaded = (await driver.executeScript("return $ !== undefined")) === true;
          const mwIsLoaded = (await driver.executeScript("return window.mw !== undefined")) === true;
          return [documentIsLoaded, jqIsLoaded, mwIsLoaded].every(Boolean);
        }, 
        this.config?.connectionTimeout || /* 3 minutes */ 3*60*1000,
        `${this.id} - ${url}\t Connection timeout`,
        this.config?.pollTimeout || /* 300 ms */ 300
      );
      LogUtils.success(`${this.id} - waitForContextToLoad: Successfully loaded context`);
      return true;
    } catch (err) {
      LogUtils.error(`${this.id} - waitForContextToLoad: ${err}`);
      return false;
    }
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
        
      }
    } catch (err) {
      LogUtils.error(`${this.id} - run: ${err}`);
    } finally {
      LogUtils.success(`${this.id}: Successfully completed ${successes} test(s) out of ${total}`);
      await driver.quit();
    }
  }
}

export default TestSuiteClass;