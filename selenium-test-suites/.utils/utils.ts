import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { styleText } from "node:util";
import { WebDriver, WebElement, By, until } from "selenium-webdriver";

export class LogUtils {
  static info(msg: any) {
    console.info(styleText(['magenta', 'cyan'], `${msg}`));
  }
  static error(msg: any) {
    console.error(styleText(['redBright', 'red'], `${msg}`));
  }
  static success(msg: any) {
    console.info(styleText(['green', 'greenBright', 'cyan'], `${msg}`));
  }
}

/**
 * Load environment variables from ./selenium-test-suites/.env.test
 */
export const loadTestEnvironment = () => {

  const __dirname = import.meta.dirname;

  loadEnvFile(resolve(__dirname, '../.env.test'));

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
 * Utility function used to determine if a given Selenium Web Element contains a given CSS class
 * 
 * @param webElement 
 * @param cssClass 
 * @returns 
 */
export const webElementHasCssClass = async (webElement: WebElement, cssClass: string): Promise<boolean> => {
  const attr = await webElement.getAttribute('class');
  const cssClasses = new Set(attr.split(' '));
  return cssClasses.has(cssClass);
}

/**
 * Utility function used to interact with a browser's global script environment and check whether a given
 * jQuery element has the given class
 * 
 * @param driver 
 * @param elementSelector 
 * @param cssClass 
 */
export const jqueryElementHasCssClass = async (driver: WebDriver, elementSelector: string, cssClass: string): Promise<boolean> => {
  return (await driver.executeScript(`
    return $('${elementSelector}').hasClass('${cssClass}');
  `));
}

/**
 * Utility function used to determine whether an OOUI action button with the given element ID is disabled
 * 
 * @param driver 
 * @param button 
 * @returns 
 */
export const isOOUIActionButtonDisabled = async (driver: WebDriver, button: WebElement): Promise<boolean> => {
  const selector = `#${await button.getAttribute('id')}`;
  return await jqueryElementHasCssClass(driver, selector, 'oo-ui-widget-disabled');
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
      const vectorMenu = await driver.findElement(By.id('vector-page-tools'));
      const vectorMenuIsVisible = await vectorMenu.isDisplayed();
      if (!vectorMenuIsVisible) {
        const hamburgerMenuButton = await driver.findElement(By.id('vector-page-tools-dropdown'));
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

/**
 * For tools that depend on the gadget FandoomUtilsI18njs to load i18n messages, use this 
 * to pre-emptively disable the gadget dependency so that the Selenium test suites can test
 * if fallback messages are loaded correctly
 * 
 * @param driver 
 * @returns 
 */
export const preemptivelyDisableI18n = async (driver: WebDriver, gadgetNamespace: string): Promise<void> => {
  let isI18nJsLoaded = await driver.executeScript(`return mw.loader.getState('${gadgetNamespace}.FandoomUtilsI18njs') !== null;`);
  if (isI18nJsLoaded === true) {
    throw new Error('DISABLE FandoomUtilsI18njs ON THE WIKI BEFORE RUNNING THIS TEST!!');
  }
  isI18nJsLoaded = await driver.executeScript(`
    mw.loader.impl(function() {
      return [
        "${gadgetNamespace}.FandoomUtilsI18njs",
        function () {
          mw.hook('dev.i18n').fire({ 
            loadMessages: function () {
              var deferred = $.Deferred();
              deferred.resolve();
              return deferred;
            } 
          });
        }, 
        { "css": [] }, 
        {}, {}, null
      ]
    });
    return mw.loader.getState('${gadgetNamespace}.FandoomUtilsI18njs') !== null;
    `);
  if (isI18nJsLoaded === false) {
    throw new Error('Failed to disable FandoomUtilsI18njs');
  }
}