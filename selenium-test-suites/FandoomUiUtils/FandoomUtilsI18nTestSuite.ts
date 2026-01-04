import { WebDriver } from 'selenium-webdriver';
import TestSuiteClass from '../.utils/TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from '../.utils/utils.ts';
import { preemptivelyDisableI18n } from '../.utils/utils.ts';
import assert from 'node:assert';

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for FandoomUtilsI18nLoader
 * 2) Serve using `npm run serve`
 * 3) Wiki content language should be in English
 * 4) Serve AjaxBatchDelete/i18n.json
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {

  const gadgetNamespace = process.env.GADGET_NAMESPACE || 'ext.gadget.store';

  const testSuite = new TestSuiteClass({
    id: 'FandoomUtilsI18nLoader',
    urlParams: {
      'uselang': 'zh-hans'
    },
    args
  });
  
  /***********************************************************************
   * 
   * FETCH EXPECTED MESSAGING
   * 
   ***********************************************************************/
  const [enI18nMessages, zhI18nMessages, jaI18nMessages] = await (async () => {
    const res = await fetch(`${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/AjaxBatchDelete/i18n.json`);
    const json = await res.json();
    return [json['en'], json['zh-hans'], json['ja']];
  })();

  /***********************************************************************
   * 
   * HELPERS
   * 
   ***********************************************************************/
  const loadFandoomUtilsI18nLoader = async (driver: WebDriver): Promise<void> => {
    await driver.executeScript(`mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUtilsI18nLoader/gadget-impl.js");`);
    await driver.sleep(500);
    await (driver.wait(
      async () => (await driver.executeScript(`return mw.loader.getState('${gadgetNamespace}.FandoomUtilsI18nLoader') !== null;`)) === true,
      /* 1 minute */ 60*1000,
      'Failed to load FandoomUtilsI18nLoader',
      /* 200 ms */ 200
    ));
  }

  const injectedI18nLogic = `
    function prepareI18n(i18nLoader) {
      var p = {
        _i18nLoader: i18nLoader,
        msg: function() {
          var args = Array.prototype.slice.call(arguments);
          if (args.length === 0) {
            return;
          }
          var key = args.shift();
          return new mw.Message(this._i18nLoader.getMessages(), key, args);
        }
      };
      ["setTempLang", "setDefaultLang"].forEach(function(prop) {
        p[prop] = p._i18nLoader[prop].bind(p._i18nLoader);
      });
      ["useLang", "usePageLang", "useContentLang", "usePageViewLang", "useUserLang", "inLang", "inPageLang", "inContentLang", "inPageViewLang", "inUserLang"].forEach(function(prop) {
        p[prop] = p._i18nLoader[prop].bind(p);
      });
      return p;
    }
    function getI18nLoader() {
      var deferred = new $.Deferred();
      mw.loader.using("${gadgetNamespace}.FandoomUtilsI18nLoader").done(function(require2) {
        var module2 = require2("${gadgetNamespace}.FandoomUtilsI18nLoader");
        module2.loadMessages("AjaxBatchDelete", { "cacheAll": true }).done(function(i18nLoader) {
          if (!i18nLoader) {
            deferred.resolve(getFallbackMessages());
            return;
          }
          deferred.resolve(i18nLoader);
        });
      }).fail(function(err) {
        console.error(err);
        deferred.resolve(getFallbackMessages());
      });
      return deferred;
    }
    function getFallbackMessages() {
      console.warn("[FandoomUtilsI18nLoader] Failed to load messages. Using fallback messages instead.");
      var msgMap = new mw.Map();
      msgMap.set(${JSON.stringify(enI18nMessages)});
      if (mw.Message.prototype.escape === void 0) {
        mw.Message.prototype.escape = mw.Message.prototype.escaped;
      }
      var m = {
        getMessages: function() {
          return msgMap;
        }
      };
      ["setDefaultLang", "setTempLang", "useLang", "usePageLang", "useContentLang", "usePageViewLang", "useUserLang"].forEach(function(prop) {
        m[prop] = $.noop;
      });
      ["inLang", "inPageLang", "inContentLang", "inPageViewLang", "inUserLang"].forEach(function(prop) {
        m[prop] = function() {
          return this;
        };
      });
      return m;
    }
    getI18nLoader().then(function(loader) {
      window.i18n = prepareI18n(loader);
    });`;

  /***********************************************************************
   * 
   * BASIC UI TESTS
   * 
   ***********************************************************************/

  /**
   * Several tests with i18n that has failed to load (use fallback messages)
   */
  testSuite.addTestCase(
    'i18nFallback',
    async (driver) => {
      await preemptivelyDisableI18n(driver, gadgetNamespace);
      await driver.executeScript(injectedI18nLogic);
      await driver.wait(
        async (driver) => {
          return (await driver.executeScript(`return window.i18n !== undefined`)) === true;
        },
        /* 3 minutes */ 3*60*1000,
        'i18n failed to load',
        /* 500 ms */ 500
      );

      const isProxiedCorrectly = await driver.executeScript(
        `
        const isValid = (fn) => (fn !== undefined && typeof fn === 'function');
        const hasTheNeededMethodsFn = (o) => (['msg', 'setTempLang', 'setDefaultLang', 'useLang', 'usePageLang', 'useContentLang', 'usePageViewLang', 'useUserLang', 'inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang'].every((prop) => isValid(o[prop])));
        
        const hasTheNeededMethods = hasTheNeededMethodsFn(i18n);
        if (!hasTheNeededMethods) return false;

        const inMethodsReturnSelf = ['inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang'].every((prop) => {
          return hasTheNeededMethodsFn(i18n[prop]());
        });
        return inMethodsReturnSelf;
        `
      );
      assert(isProxiedCorrectly, 'Generated i18n object is not proxied correctly');

      const res1Matches = await driver.executeScript(
        `return i18n.msg('toolsTitle').plain() === "${enI18nMessages['toolsTitle']}";`
      );
      assert(res1Matches, 'Res 1 does not match');

      const res2Matches = await driver.executeScript(
        `return i18n.msg('errorGetContents', 'FOO', 'BAR').plain() === "${
          enI18nMessages['errorGetContents']
            .replace('$1', 'FOO')
            .replace('$2', 'BAR')
        }";`
      );
      assert(res2Matches, 'Res 2 does not match');

      const res3Matches = await driver.executeScript(
        `i18n.useContentLang();
        return i18n.msg('toolsTitle').plain() === "${enI18nMessages['toolsTitle']}";`
      );
      assert(res3Matches, 'Res 3 does not match');

      const res4Matches = await driver.executeScript(
        `return i18n.inContentLang().msg('toolsTitle').plain() === "${enI18nMessages['toolsTitle']}";`
      );
      assert(res4Matches, 'Res 4 does not match');
    }
  );

  /**
   * Load i18n and check if it is proxied correctly
   */
  testSuite.addTestCase(
    'i18nIsProxiedCorrectly',
    async (driver) => {
      await driver.navigate().refresh();
      await testSuite.waitForContextToLoad(driver);
      await loadFandoomUtilsI18nLoader(driver);
      await driver.executeScript(injectedI18nLogic);
      await driver.wait(
        async (driver) => {
          return (await driver.executeScript(`return window.i18n !== undefined`)) === true;
        },
        /* 3 minutes */ 3*60*1000,
        'i18n failed to load',
        /* 500 ms */ 500
      );

      const isProxiedCorrectly = await driver.executeScript(
        `
        const isValid = (fn) => (fn !== undefined && typeof fn === 'function');
        const hasTheNeededMethodsFn = (o) => (['msg', 'setTempLang', 'setDefaultLang', 'useLang', 'usePageLang', 'useContentLang', 'usePageViewLang', 'useUserLang', 'inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang'].every((prop) => isValid(o[prop])));
        
        const hasTheNeededMethods = hasTheNeededMethodsFn(i18n);
        if (!hasTheNeededMethods) return false;

        const inMethodsReturnSelf = ['inLang', 'inPageLang', 'inContentLang', 'inPageViewLang', 'inUserLang'].every((prop) => {
          return hasTheNeededMethodsFn(i18n[prop]('en'));
        });
        return inMethodsReturnSelf;
        `
      );
      assert(isProxiedCorrectly, 'Generated i18n object is not proxied correctly');
    }
  );
  
  /**
   * Several tests with i18n successfully loaded
   */
  testSuite.addTestCase(
    'i18nTest',
    async (driver) => {
      await driver.navigate().refresh();
      await testSuite.waitForContextToLoad(driver);
      await driver.executeScript(`localStorage.clear()`);
      await loadFandoomUtilsI18nLoader(driver);
      await driver.executeScript(injectedI18nLogic);
      await driver.wait(
        async (driver) => {
          return (await driver.executeScript(`return window.i18n !== undefined`)) === true;
        },
        /* 3 minutes */ 3*60*1000,
        'i18n failed to load',
        /* 500 ms */ 500
      );

      const res1Matches = await driver.executeScript(
        `
        const a = i18n.msg('toolsTitle').plain();
        const b = i18n.msg('toolsTitle').plain();
        return a === b && a === "${zhI18nMessages['toolsTitle']}";
        `
      );
      assert(res1Matches, 'Res 1 does not match');

      const res2Matches = await driver.executeScript(
        `
        const a = i18n.msg('errorGetContents', 'FOO', 'BAR').plain();
        const b = i18n.msg('errorGetContents', 'FOO', 'BAR').plain();
        return a === b && a === "${
          zhI18nMessages['errorGetContents']
            .replace('$1', 'FOO')
            .replace('$2', 'BAR')
        }";`
      );
      assert(res2Matches, 'Res 2 does not match');

      const res3Matches = await driver.executeScript(
        `i18n.useContentLang();
        const a = i18n.msg('toolsTitle').plain();
        const b = i18n.msg('toolsTitle').plain();
        return a === b && a === "${enI18nMessages['toolsTitle']}";`
      );
      assert(res3Matches, 'Res 3 does not match');

      const res4Matches = await driver.executeScript(
        `i18n.useUserLang();
        const a = i18n.msg('toolsTitle').plain();
        const b = i18n.msg('toolsTitle').plain();
        return a === b && a === "${zhI18nMessages['toolsTitle']}";`
      );
      assert(res4Matches, 'Res 4 does not match');

      const res5Matches = await driver.executeScript(
        `
        const a = i18n.inContentLang().msg('inputReason').plain() === "${enI18nMessages['inputReason']}";
        const b = i18n.msg('toolsTitle').plain() === "${zhI18nMessages['toolsTitle']}";
        return a && b;
        `
      );
      assert(res5Matches, 'Res 5 does not match');
      
      const res6Matches = await driver.executeScript(
        `
        const a = i18n.inLang('ja').msg('inputReason').plain() === "${jaI18nMessages['inputReason']}";
        const b = i18n.msg('toolsTitle').plain() === "${zhI18nMessages['toolsTitle']}";
        return a && b;
        `
      );
      assert(res6Matches, 'Res 6 does not match');
      
      const res7Matches = await driver.executeScript(
        `
        i18n.useContentLang();
        const a = i18n.inUserLang().msg('inputReason').plain() === "${zhI18nMessages['inputReason']}";
        const b = i18n.msg('inputReason').plain() === "${enI18nMessages['inputReason']}";
        return a && b;
        `
      );
      assert(res7Matches, 'Res 7 does not match');
    }
  );

  return testSuite;
};