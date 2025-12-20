import TestSuiteClass from '../TestSuiteClass.ts';
import type { TestSuiteDriverArgs } from "../TestSuiteClass.ts";
import assert from 'node:assert';

/***********************************************************************
 * 
 * PREREQUISITES:
 * 
 * 1) Build gadget implementation for FandoomUiUtilsDorui
 * 2) Serve using `npm run serve`
 * 
 ***********************************************************************/

export default async (args: TestSuiteDriverArgs) => {
  
  const testSuite = new TestSuiteClass(
    /* Test Suite ID */ 'FandoomUiUtilsDorui',
    process.env.SELENIUM_TESTING_WIKI_ENTRYPOINT!,
    /* Navigate to page */ 'Special:BlankPage',
    /* Additional URL Params */ {
      'useskin': args.skin || 'vector-2022'
    },
  );

  testSuite.beforeAll = async (driver) => {
    /* Wait until window.dev.dorui is loaded */
    await driver.executeScript(`mw.loader.load("${process.env.SELENIUM_TESTING_SERVE_GADGETS_FROM}/FandoomUiUtilsDorui/gadget-impl.js");`);
    await driver.sleep(500);
    try {
      await (driver.wait(
        async () => (await driver.executeScript(`return (window.dev || {}).dorui !== undefined`)) === true,
        /* 1 minute */ 60*1000,
        'Failed to load window.dev.dorui',
        /* 200 ms */ 200
      ));
      return true;
    } catch (err) {
      return false;
    }
  };

  testSuite.addTestCase(
    'createSimpleContainer',
    async (driver) => {
      const uiContainer = await driver.executeScript(`
        const ui = window.dev.dorui;
        const span = ui.span({
          class: 'my-span-element',
          text: 'Howdy'
        });
        const div = ui.div({
          id: 'my-wrapper',
          child: span
        });
        const container = ui.div({
          id: 'my-container',
          style: {
            display: 'flex'
          },
          children: [
            div,
            ui.div({
              text: 'Badonk'
            })
          ]
        });
        return container.outerHTML;
      `);
      const expected = '<div id="my-container" style="display: flex;"><div id="my-wrapper"><span class="my-span-element">Howdy</span></div><div>Badonk</div></div>';
      assert(uiContainer === expected, `Got HTML: ${uiContainer}`);
    }
  );

  testSuite.addTestCase(
    'createBulletList',
    async (driver) => {
      const uiContainer = await driver.executeScript(`
        const ui = window.dev.dorui;
        const ul = ui.ul({
          children: [
            ui.li({ text: 'Your pastimes consisted of the strange' }),
            ui.li({ text: 'And twisted and deranged' }),
            ui.li({ text: 'And I hate that little game you had called' }),
            ui.li({ text: 'Crying Lightning' }),
          ]
        });
        return ul.outerHTML;
      `);
      const expected = '<ul><li>Your pastimes consisted of the strange</li><li>And twisted and deranged</li><li>And I hate that little game you had called</li><li>Crying Lightning</li></ul>';
      assert(uiContainer === expected, `Got HTML: ${uiContainer}`);
    }
  );

  testSuite.addTestCase(
    'createUiElementWithFragments',
    async (driver) => {
      const uiContainer = await driver.executeScript(`
        const ui = window.dev.dorui;
        const shouldRepeat = true;
        const lyrics = ui.ul({
          children: [
            ui.li({ text: 'One, two, three, four' }),
            ui.li({ text: 'Motion on the ocean floor!' }),
            ui.li({ text: 'Five, six, seven, eight' }),
            ui.li({ text: 'Double bubble, swim some more!' }),
            shouldRepeat && ui.frag([
              ui.li({ text: 'One, two, three, four' }),
              ui.li({ text: 'Motion on the ocean floor!' }),
            ])
          ]
        });
        return lyrics.outerHTML;
      `);
      const expected = '<ul><li>One, two, three, four</li><li>Motion on the ocean floor!</li><li>Five, six, seven, eight</li><li>Double bubble, swim some more!</li><li>One, two, three, four</li><li>Motion on the ocean floor!</li></ul>';
      assert(uiContainer === expected, `Got HTML: ${uiContainer}`);
    }
  );

  await testSuite.run();

};