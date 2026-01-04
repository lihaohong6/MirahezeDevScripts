import { By, until } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import assert from 'node:assert';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for FandoomUiUtilsQdmodal
 * 2) Serve using `npm run serve`
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const testSuite = new TestSuiteClass({
    id: 'FandoomUiUtilsQdmodal',
    args
  });

  testSuite.beforeAll = async (driver) => {
    /* Wait until mw.libs.QDmodal is loaded */
    await driver.executeScript(`mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsQdmodal/gadget-impl.js");`);
    await driver.sleep(500);
    try {
      await (driver.wait(
        async () => (await driver.executeScript(`return (mw.libs || {}).QDmodal !== undefined`)) === true,
        /* 1 minute */ 60*1000,
        'Failed to load mw.libs.QDmodal',
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
  /**
   * Description of Test Case:
   * 1) Create & show a simple modal
   * 2) Close the modal after a number of seconds
   */
  testSuite.addTestCase(
    'loadSimpleModal',
    async (driver) => {
      await driver.executeScript(`
        const myModal = new mw.libs.QDmodal("my-modal-id");
        myModal.show({
          content: "Hello World!",
          title: "Some title"
        });
      `);
      const element = await driver.findElement(By.id('my-modal-id'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );
      const modalTitle = await element.findElement(By.css('header h3')).getText();
      assert(modalTitle === 'Some title', `Got modal title: ${modalTitle}`);
      const modalText = await element.findElement(By.css('section')).getText();
      assert(modalText === 'Hello World!', `Got modal text content: ${modalText}`);

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element.findElement(By.className('qdmodal-close'));
      await closeButton.click();
      await driver.wait(
        async () => (await driver.executeScript("return $('#my-modal-id').length === 0")) === true, 
        /* 1 minute */ 60*1000,
        'Modal failed to dismiss',
        /* 200ms */ 200
      );

      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  /**
   * Description of Test Case:
   * 1) Create and show a complex modal with custom buttons
   * 2) Interact with the buttons
   * 3) Close the modal after a number of seconds
   */
  testSuite.addTestCase(
    'loadModalWithButtons',
    async (driver) => {
      await driver.executeScript(`
        const myModal = new mw.libs.QDmodal("my-modal-id");
        myModal.show({
          content: (
            $('<div>', { 
            'class': 'my-custom-modal-content-body' 
            })
              .text('Lorem ipsum dolor sit amet.')
              .append(
                $('<ul>').append(
                  $('<li>').text('Item 1'),
                  $('<li>').text('Item 2'),
                  $('<li>').text('Item 3')
                )
              )
          ),
          title: "My modal title",
          buttons: [
            {
              text: "Button One",
              href: "https://example.com/",
              attr: {
                id: "my-modal-button-one",
                'class': 'my-custom-modal-button'
              }
            }, 
            {
              text: "Button Two",
              handler: function (event) {
                mw.notify('MY CUSTOM EVENT!!', { type: 'info' });
              },
              condition: function (event) {
                return true;
              },
              attr: {
                id: "my-modal-button-two",
                'class': 'my-custom-modal-button'
              }
            }, 
            {
              text: "Button Three",
              handler: function (event) {
                mw.notify('THIS SHOULD NOT HAPPEN!!', { type: 'error' });
              },
              condition: function (event) {
                return false;
              },
              attr: {
                id: "my-modal-button-three",
                'class': 'my-custom-modal-button'
              }
            }
          ]
        });
      `);
      const element = await driver.findElement(By.id('my-modal-id'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );

      const modalTitle = await element.findElement(By.css('header h3')).getText();
      assert(modalTitle === 'My modal title', `Got modal title: ${modalTitle}`);
      const modalBodyHtml = (await driver.executeScript("return $('#my-modal-id > section').first().html()"));
      assert(modalBodyHtml === '<div class="my-custom-modal-content-body">Lorem ipsum dolor sit amet.<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div>', `Got modal text content: ${modalBodyHtml}`);

      {
        const buttonOne = await driver.findElement(By.id('my-modal-button-one'));
        const buttonOneCssClass = await buttonOne.getAttribute('class');
        assert(buttonOneCssClass === 'my-custom-modal-button qdmodal-button', `Got CSS class ${buttonOneCssClass} for #my-modal-button-one`);
        assert((await buttonOne.getTagName() === 'a'), '#my-modal-button-one is not an anchor link');
        const buttonOneHyperlink = await buttonOne.getAttribute('href');
        assert(buttonOneHyperlink === 'https://example.com/', `Got hyperlink ${buttonOneHyperlink} for #my-modal-button-one`);
        const buttonOneText = await buttonOne.getText();
        assert(buttonOneText === 'Button One', `Got button text ${buttonOneText} for #my-modal-button-one`);
      }

      {
        const buttonTwo = await driver.findElement(By.id('my-modal-button-two'));
        const buttonTwoCssClass = await buttonTwo.getAttribute('class');
        assert(buttonTwoCssClass === 'my-custom-modal-button qdmodal-button', `Got CSS class ${buttonTwoCssClass} for #my-modal-button-two`);
        const buttonTwoText = await buttonTwo.getText();
        assert(buttonTwoText === 'Button Two', `Got button text ${buttonTwoText} for #my-modal-button-two`);

        await buttonTwo.click();
        await driver.wait(
        async () => (await driver.executeScript("return $('#mw-notification-area').length > 0")) === true,
          /* 1 minute */ 1*60*1000,
          `Failed to load MediaWiki notifications`,
          /* 200 ms */ 200
        );
        const mwNotificationCanvas = await driver.findElement(By.id('mw-notification-area'));
        await driver.wait(
          until.elementIsVisible(mwNotificationCanvas),
          /* 1 minute */ 60*1000,
          'MediaWiki notification failed to load',
          /* 200ms */ 200
        );
        const toast = await mwNotificationCanvas.findElement(By.className('mw-notification'));
        const toastText = await toast.getText();
        assert(toastText === 'MY CUSTOM EVENT!!', `Toast message text does not match! (Got ${toastText})`);
        await driver.wait(
          until.stalenessOf(toast),
          /* 1 minute */ 60*1000,
          'MediaWiki notification failed to auto-hide',
          /* 200ms */ 200
        );
      }

      const buttonThreeIsRendered = (await driver.executeScript("return $('#my-modal-id > footer #my-modal-button-three').length > 0"));
      assert(buttonThreeIsRendered === false, '#my-modal-button-three is loaded');

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element.findElement(By.className('qdmodal-close'));
      await closeButton.click();
      await driver.wait(
        async () => (await driver.executeScript("return $('#my-modal-id').length === 0")) === true, 
        /* 1 minute */ 60*1000,
        'Modal failed to dismiss',
        /* 200ms */ 200
      );

      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  return testSuite;

};