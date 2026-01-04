import { By } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import assert from 'node:assert';

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for FandoomUiUtilsUijs
 * 2) Serve using `npm run serve`
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const testSuite = new TestSuiteClass({
    id: 'FandoomUiUtilsUijs',
    args
  });

  testSuite.beforeAll = async (driver) => {
    /* Wait until window.dev.ui is loaded */
    await driver.executeScript(`mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsUijs/gadget-impl.js");`);
    await driver.sleep(200);
    try {
      await (driver.wait(
        async () => (await driver.executeScript(`return (window.dev || {}).ui !== undefined`)) === true,
        /* 1 minute */ 60*1000,
        'Failed to load window.dev.ui',
        /* 200 ms */ 200
      ));
      return true;
    } catch (err) {
      return false;
    }
  };

  /***********************************************************************
   * 
   * BASIC UI TESTS
   * 
   ***********************************************************************/
  testSuite.addTestCase(
    'loadSimpleTextNode',
    async function (driver) {
      const output = (await driver.executeScript(`return window.dev.ui("This is a text node");`));
      //@ts-ignore
      assert(output.textContent === 'This is a text node', `Got output: ${output.textContent}`);
    }
  );
  testSuite.addTestCase(
    'loadSimpleDiv',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div></div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithText',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ text: 'This is a div with text', type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div>This is a div with text</div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithAttributes',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ attr: { class: 'thisisatest', id: 'testdiv' }, type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div class="thisisatest" id="testdiv"></div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithTextContentAndAttributes',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ text: 'This is a div with text', attr: { class: 'thisisatest', id: 'testdiv' }, type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div class="thisisatest" id="testdiv">This is a div with text</div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithInlineStyles',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ style: { color: 'red' }, text: 'This is red text', type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div style="color: red;">This is red text</div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithMultipleClasses',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ classes: [ 'wds-button', 'wds-is-secondary' ], text: 'This is a div with multiple classes', type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div class="wds-button wds-is-secondary">This is a div with multiple classes</div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithDataAttributes',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ data: { test: 'Test one', test2: 'Test two' }, type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div data-test="Test one" data-test2="Test two"></div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithChildrenSpans',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ 
        children: [
          {
            text: 'First span',
            type: 'span'
          },
          {
            text: 'Second span',
            type: 'span'
          }
        ], 
        type: 'div' 
      }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div><span>First span</span><span>Second span</span></div>', `Got output: ${output}`);
    }
  );
  testSuite.addTestCase(
    'loadDivWithSanitizedInput',
    async function (driver) {
      const output = await driver.executeScript(`return window.dev.ui({ text: '<script>alert(\\'XSS\\');</script>', type: 'div' }).outerHTML;`);
      //@ts-ignore
      assert(output === '<div>&lt;script&gt;alert(\'XSS\');&lt;/script&gt;</div>', `Got output: ${output}`);
    }
  );

  /***********************************************************************
   * 
   * APPEND TO BODY AND TEST UX
   * 
   ***********************************************************************/
  testSuite.addTestCase(
    'loadDivWithEventListener',
    async function (driver) {
      const output = await driver.executeScript(`window.dev.ui({
        parent: '#mw-content-text',
        attr: {
          id: 'test-uijs-div'
        },
        events: {
          click: function() {
            alert('Test');
          }
        },
        text: 'Click on me!',
        type: 'div'
      });`);
      const element = await driver.findElement(By.id('test-uijs-div'));
      const elementTextContent = await element.getText();
      assert(elementTextContent === 'Click on me!', `Got output: ${elementTextContent}`);
      await element.click();
      let alert = await driver.switchTo().alert();
      let alertText = await alert.getText();
      assert(alertText === 'Test', `Got output: ${alertText}`);
      await alert.accept();
    }
  )

  return testSuite;

};