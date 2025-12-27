import { By, until } from 'selenium-webdriver';
import TestSuiteClass from '../TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from "../TestSuiteClass.ts";
import assert from 'node:assert';
import { webElementHasCssClass } from '../utils.ts';

const pauseUiCheckingForHumanReview = 2000 /* 2 seconds */;

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for FandoomUiUtilsUijs and FandoomUiUtilsModal
 * 2) Serve using `npm run serve`
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const testSuite = new TestSuiteClass(
    /* Test Suite ID */ 'FandoomUiUtilsModal',
    process.env.SELENIUM_TESTING_WIKI_ENTRYPOINT!,
    /* Navigate to page */ 'Special:BlankPage',
    /* Additional URL Params */ {
      'useskin': args.skin || 'vector-2022'
    },
  );

  testSuite.beforeAll = async (driver) => {
    /* Wait until window.dev.modal is loaded */
    await driver.executeScript(`mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsModal/gadget-impl.js");`);
    await driver.sleep(500);
    try {
      await (driver.wait(
        async () => (await driver.executeScript(`return (window.dev || {}).modal !== undefined`)) === true,
        /* 1 minute */ 60*1000,
        'Failed to load window.dev.modal',
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
        const modal = new window.dev.modal.Modal({
          content: 'Hello World!',
          id: 'SimpleModal',
          size: 'small'
        });
        modal.create();
        modal.show();
      `);
      const element = await driver.findElement(By.id('SimpleModal'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );
      const modalText = await element.findElement(By.className('oo-ui-window-body')).getText();
      assert(modalText === 'Hello World!', `Got modal text content: ${modalText}`);

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element
        .findElement(By.className('oo-ui-window-head'))
        .findElement(By.className('oo-ui-processDialog-actions-safe'))
        .findElement(By.css('a.oo-ui-buttonElement-button'));
      await closeButton.click();
      await driver.wait(
        until.elementIsNotVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to dismiss',
        /* 200ms */ 200
      );

      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  /**
   * Description of Test Case:
   * 1) Create & show a medium-sized modal
   * 2) Close the modal after a number of seconds
   */
  testSuite.addTestCase(
    'loadMediumModal',
    async (driver) => {
      await driver.executeScript(`
        const modal = new window.dev.modal.Modal({
          content: 'This is a medium-sized modal.',
          id: 'MediumModal',
          size: 'medium',
          title: 'Medium-sized modal'
        });
        modal.create();
        modal.show();
      `);
      const element = await driver.findElement(By.id('MediumModal'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );
      const modalText = await element.findElement(By.className('oo-ui-window-body')).getText();
      assert(modalText === 'This is a medium-sized modal.', `Got modal text content: ${modalText}`);

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element
        .findElement(By.className('oo-ui-window-head'))
        .findElement(By.className('oo-ui-processDialog-actions-safe'))
        .findElement(By.css('a.oo-ui-buttonElement-button'));
      await closeButton.click();
      await driver.wait(
        until.elementIsNotVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to dismiss',
        /* 200ms */ 200
      );
      
      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  /**
   * Description of Test Case:
   * 1) Load FandoomUiUtilsUijs
   * 2) Create and show a modal made using Ui-Js
   * 3) Close the modal after a number of seconds
   */
  testSuite.addTestCase(
    'loadUiJsModal',
    async (driver) => {
      await driver.executeScript(`
        mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsUijs/gadget-impl.js");
        mw.hook('dev.ui').add(function () {
          const modal = new window.dev.modal.Modal({
            content: {
              children: [
                'This modal uses UI-js to generate the content and it\\'s the same size as the content.',
                {
                  attr: {
                    alt: 'Fandom logo',
                    title: 'Fandom logo',
                    src: 'https://vignette.wikia.nocookie.net/central/images/8/8f/FANDOM-logo.svg/revision/latest/scale-to-width-down/300'
                  },
                  type: 'img'
                }
              ],
              type: 'div'
            },
            id: 'UIModal',
            size: 'content-size'
          });
          modal.create();
          modal.show();
        });
      `);
      await driver.wait(
        until.elementLocated(By.id('UIModal')),
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );
      const element = await driver.findElement(By.id('UIModal'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element
        .findElement(By.className('oo-ui-window-head'))
        .findElement(By.className('oo-ui-processDialog-actions-safe'))
        .findElement(By.css('a.oo-ui-buttonElement-button'));
      await closeButton.click();
      await driver.wait(
        until.elementIsNotVisible(element), 
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
        mw.loader.load('oojs-ui.styles.icons-editing-core');
        const modal = new window.dev.modal.Modal({
          size: 'large',
          buttons: [
            {
              classes: ['my-custom-class'],
              event: 'custom1',
              id: 'my-custom-id',
              primary: true,
              text: 'Primary button'
            },
            {
              disabled: true,
              text: 'Disabled button',
              id: 'my-disabled-btn',
              event: 'disabled-event'
            },
            {
              event: 'custom2',
              text: 'This is an icon button',
              sprite: 'edit',
              id: 'my-icon-btn'
            }
          ],
          content: 'This modal has buttons!',
          events: {
            custom1: function() {
              mw.notify('Custom event 1!', { type: 'info' });
            },
            custom2: function() {
              mw.notify('Custom event 2!', { type: 'warn' });
            },
            'disabled-event': function() {
              mw.notify('This should not happen!', { type: 'error' });
            }
          },
          id: 'ButtonsModal'
        });
        modal.create();
        modal.show();
      `);
      const element = await driver.findElement(By.id('ButtonsModal'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );

      await driver.sleep(500);

      const primaryButton = await driver.findElement(By.id('my-custom-id'));
      await primaryButton.click();
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
      await driver.sleep(500);
      const toast1 = await mwNotificationCanvas.findElement(By.className('mw-notification'));
      const toast1Text = await toast1.getText();
      assert(toast1Text === 'Custom event 1!', `Toast Custom Event 1 message text does not match! (Got ${toast1Text})`);
      await driver.sleep(500);
      await toast1.click();
      await driver.wait(
        until.stalenessOf(toast1),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to hide',
        /* 200ms */ 200
      );
      await driver.sleep(1000);

      const disabledButton = await driver.findElement(By.id('my-disabled-btn'));
      assert((await webElementHasCssClass(disabledButton, 'oo-ui-widget-disabled')), 'my-disabled-btn is not disabled!');
      await disabledButton.click();
      await driver.sleep(500);

      const iconButton = await driver.findElement(By.id('my-icon-btn'));
      await iconButton.findElement(By.css('.oo-ui-icon-edit'));
      await iconButton.click();
      await driver.wait(
        until.elementIsVisible(mwNotificationCanvas),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to load',
        /* 200ms */ 200
      );
      await driver.sleep(500);
      const toast2 = await mwNotificationCanvas.findElement(By.className('mw-notification'));
      const toast2Text = await toast2.getText();
      assert(toast2Text === 'Custom event 2!', `Toast Custom Event 2 message text does not match! (Got ${toast2Text})`);
      await driver.sleep(500);
      await toast2.click();
      await driver.wait(
        until.stalenessOf(toast2),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to hide',
        /* 200ms */ 200
      );
      await driver.sleep(500);

      await driver.sleep(pauseUiCheckingForHumanReview);

      const closeButton = await element
        .findElement(By.className('oo-ui-window-head'))
        .findElement(By.className('oo-ui-processDialog-actions-safe'))
        .findElement(By.css('a.oo-ui-buttonElement-button'));
      await closeButton.click();
      await driver.wait(
        until.elementIsNotVisible, 
        /* 1 minute */ 60*1000,
        'Modal failed to dismiss',
        /* 200ms */ 200
      );

      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  /**
   * Description of Test Case:
   * 1) Create and show a complex modal with buttons
   * 2) Interact with the buttons
   * 3) Assert that the buttons are able to enable/disable themselves
   * 4) Close the modal after a number of seconds
   */
  testSuite.addTestCase(
    'testModalEnableDisableButtons',
    async (driver) => {
      await driver.executeScript(`
        const modal = new window.dev.modal.Modal({
          size: 'large',
          buttons: [
            {
              event: 'start',
              id: 'start-btn',
              primary: true,
              text: 'START'
            },
            {
              event: 'stop',
              id: 'stop-btn',
              text: 'STOP',
              disabled: true,
            }
          ],
          content: 'Lorem ipsum dolor sit amet!',
          events: {
            start: function() {
              mw.notify('STARTING!!', { type: 'success' });
              this.disableActionButtons('start-btn');
              this.enableActionButtons('stop-btn');
            },
            stop: function() {
              mw.notify('STOPPING!!', { type: 'error' });
              this.disableActionButtons('stop-btn');
              this.enableActionButtons('start-btn');
            }
          },
          id: 'ButtonsModalEnableDisable'
        });
        modal.create();
        modal.show();
        `
      );

      const element = await driver.findElement(By.id('ButtonsModalEnableDisable'));
      await driver.wait(
        until.elementIsVisible(element), 
        /* 1 minute */ 60*1000,
        'Modal failed to load',
        /* 200ms */ 200
      );

      await driver.sleep(500);

      const startBtn = await driver.findElement(By.id('start-btn'));
      const stopBtn = await driver.findElement(By.id('stop-btn'));
      assert(!(await webElementHasCssClass(startBtn, 'oo-ui-widget-disabled')), '(BEFORE CLICK) start-btn is disabled!');
      assert((await webElementHasCssClass(stopBtn, 'oo-ui-widget-disabled')), '(BEFORE CLICK) stop-btn is not disabled!');

      await startBtn.click();
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
      await driver.sleep(500);
      const toast1 = await mwNotificationCanvas.findElement(By.className('mw-notification'));
      const toast1Text = await toast1.getText();
      assert(toast1Text === 'STARTING!!', `Toast message text upon starting does not match! (Got ${toast1Text})`);
      await driver.sleep(200);

      assert((await webElementHasCssClass(startBtn, 'oo-ui-widget-disabled')), '(AFTER CLICK START) start-btn is not disabled!');
      assert(!(await webElementHasCssClass(stopBtn, 'oo-ui-widget-disabled')), '(AFTER CLICK START) stop-btn is disabled!');

      await toast1.click();
      await driver.wait(
        until.stalenessOf(toast1),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to hide',
        /* 200ms */ 200
      );

      await driver.sleep(pauseUiCheckingForHumanReview);

      await stopBtn.click();
      await driver.wait(
        until.elementIsVisible(mwNotificationCanvas),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to load',
        /* 200ms */ 200
      );
      await driver.sleep(500);
      const toast2 = await mwNotificationCanvas.findElement(By.className('mw-notification'));
      const toast2Text = await toast2.getText();
      assert(toast2Text === 'STOPPING!!', `Toast message text upon starting does not match! (Got ${toast2Text})`);
      await driver.sleep(200);

      assert(!(await webElementHasCssClass(startBtn, 'oo-ui-widget-disabled')), '(AFTER CLICK STOP) start-btn is disabled!');
      assert((await webElementHasCssClass(stopBtn, 'oo-ui-widget-disabled')), '(AFTER CLICK STOP) stop-btn is not disabled!');

      await toast2.click();
      await driver.wait(
        until.stalenessOf(toast2),
        /* 1 minute */ 60*1000,
        'MediaWiki notification failed to hide',
        /* 200ms */ 200
      );
      
      await driver.sleep(Math.floor(pauseUiCheckingForHumanReview / 2));
    }
  );

  return testSuite;

};