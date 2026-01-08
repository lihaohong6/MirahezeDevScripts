import { By, WebDriver, WebElement, until } from 'selenium-webdriver';
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
 * 1) Build gadget implementation for Countdown and its dependencies 
 *    FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'Countdown',
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
   * HELPERS
   * 
   ***********************************************************************/

  const loadScripts = async (driver: WebDriver): Promise<boolean> => {
    /* Wait until Countdown and its dependencies are loaded */
    await driver.executeScript(`
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18nLoader/gadget-impl.js");
      mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/Countdown/gadget-impl.js");
    `);
    await driver.sleep(200);
    return true;
  };

  /***********************************************************************
   * 
   * TEST CASE DEFINITIONS
   * 
   ***********************************************************************/
  const test = (withI18nLoader: boolean) => {
    return async (driver: WebDriver) => {
      try {
        if (!withI18nLoader) {
          await preemptivelyDisableI18n(driver, gadgetNamespace);
        }
        const deadline = await driver.executeScript(`
        window.countdownTimer = {
          myFunction: function () {
            window.myCallbackIsCalled = true;
            $(this).text("A custom callback is called!");
          }
        }

        const delta = 30*1000;
        const newYear = \`${new Date().getFullYear()+1}-01-01T00:00:00Z\`;
        const deadline = (new Date(Date.now()+delta)).toISOString();
        $('#mw-content-text').empty().append(
          \`<h2>Expect the timer to count down</h2>
          <div id="test-1">
            <span class="countdown" style="display:none;">
              Only <span class="countdowndate">\${newYear}</span> until the new year...
            </span>
            <span class="nocountdown">
              It's time for the new year!
            </span>
          </div>\`,
          \`<h2>Expect the countdown to remove itself</h2>
          <div id="test-2">
            <span data-end="remove" class="countdown" style="display:none;">
              Only <span class="countdowndate">\${deadline}</span> until the end...
            </span>
            <span class="nocountdown">Test No. 2</span>
          </div>\`,
          \`<h2>Expect the countdown to stop itself</h2>
          <div id="test-3">
            <span data-end="stop" class="countdown" style="display:none;">
              Only <span class="countdowndate">\${deadline}</span> until the end...
            </span>
            <span class="nocountdown">Test No. 3</span>
          </div>\`,
          \`<h2>Expect the countdown to be replaced with another element</h2>
          <div id="test-4">
            <span data-end="toggle" data-toggle=".post-countdown" class="countdown" style="display:none;">
              Only <span class="countdowndate">\${deadline}</span> until the end...
            </span>
            <span class="post-countdown" style="display:none;">
              Christmas came early!
            </span>
            <span class="nocountdown">Test No. 4</span>
          </div>\`,
          \`<h2>Expect the countdown to call a custom callback</h2>
            <div id="test-5">
              <span data-end="callback" data-callback="myFunction" class="countdown" style="display:none;">
                Only <span class="countdowndate">\${deadline}</span> until the new year...
              </span>
              <span class="nocountdown">Test No. 5</span>
          </div>\`,
        );
        return deadline;
        `);
        await driver.wait(
          until.elementLocated(By.css('#mw-content-text #test-1')),
          /* 5 s */ 5*1000,
          'Failed to load onto DOM',
          /* 100 ms */ 100
        );
        await loadScripts(driver);
        await driver.wait(
          async (driver) => {
            return (await driver.executeScript(`
              const body = $('#mw-content-text');
              const countdowns = body.find('#test-1, #test-2, #test-3, #test-4, #test-5');
              let allHandled = true;
              countdowns.each(function() { 
                if (!$(this).find('.countdown').hasClass('handled')) {
                  allHandled = false;
                }
              });
              return allHandled;
            `));
          },
          /* 20 s */ 20*1000,
          'Failed to trigger handler',
          /* 100 ms */ 100
        );
        const nocountdowns = await driver.findElements(By.className('nocountdown'));
        const nocountdownsAreHidden = !(await Promise.all(nocountdowns.map((el) => el.isDisplayed()))).every(Boolean);
        assert(nocountdownsAreHidden, 'Placeholder countdown text is visible');

        const waitFor = (new Date(deadline as string) as unknown as number) - Date.now();
        if (waitFor > 0) await driver.sleep(waitFor);
        
        const test2Passed = await driver.executeScript(`return $('#mw-content-text #test-2 .countdown').length === 0;`);
        assert(test2Passed, 'Test 2 failed: Countdown did not remove from the DOM upon end.');

        const test3Countdown = await driver.findElement(By.css('#mw-content-text #test-3 .countdown'));
        let test3Passed = await test3Countdown.isDisplayed();
        test3Passed = test3Passed && (await test3Countdown.getText() === 'Only 0 days, 0 hours, 0 minutes and 0 seconds until the end...');
        assert(test2Passed, 'Test 3 failed: Countdown did not stop itself from the DOM upon end.');

        const test4Countdown = await driver.findElement(By.css('#mw-content-text #test-4 .countdown'));
        let test4Passed = !(await test4Countdown.isDisplayed());
        const test4PostCountdown = await driver.findElement(By.css('#mw-content-text #test-4 .post-countdown'));
        test4Passed = test4Passed && (await test4PostCountdown.isDisplayed());
        const test4CountdownText = await test4Countdown.getText();
        // test4Passed = test4Passed && (test4CountdownText === 'Christmas came early!');
        assert(test4Passed, 'Test 4 failed: Countdown did not toggle visibility with another element');

        const test5Countdown = await driver.findElement(By.css('#mw-content-text #test-5 .countdown'));
        // const test5CountdownText = await test5Countdown.getText();
        // let test5Passed = test5CountdownText === 'A custom callback is called!';
        let test5Passed = (await driver.executeScript(`return window.myCallbackIsCalled === true;`));
        assert(test5Passed, 'Test 5 failed: Countdown did not invoke a callback');

        await driver.sleep(pauseUiCheckingForHumanReview);
      } catch (err) {
        LogUtils.error(err);
      }
    }
  }

  /***********************************************************************
   * 
   * REGISTER TEST CASE & RUN
   * 
   ***********************************************************************/
  testSuite.addTestCase(
    'TestWithLoadedI18nLoader',
    test(true)
  );

  return testSuite;

};