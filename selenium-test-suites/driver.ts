import { statSync, existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { styleText } from "node:util";
import { normalizePath } from "vite";

import TestSuiteClass from "./.utils/TestSuiteClass.ts";
import type { TestSuiteDriverArgs } from "./.utils/TestSuiteClass.ts";
import { LogUtils, loadTestEnvironment } from "./.utils/utils.ts";

const __dirname = import.meta.dirname;

function parseCliArguments(): [TestSuiteDriverArgs, string[]] {
  const res: TestSuiteDriverArgs = {};
  const args = process.argv.slice(2);
  const rxCliArg = /^--(skin|browser)=(.*)$/;
  const rxCliArgFormat = /^--\b/;
  const inpSuites: string[] = [];
  args.forEach((arg) => {
    const m = arg.match(rxCliArg);
    if (m !== null) {
      res[m[1] as 'skin' | 'browser'] = m[2];
    } else if (arg.match(rxCliArgFormat) === null) {
      inpSuites.push(arg);
    }
  });
  const suites = getTestSuitesToRun(inpSuites);
  return [res, suites];
}

/**
 * Fetch the filepaths of all scripts ending in 'TestSuite.ts' within the 
 * given directory, in ascending order 
 */
function walkThroughDirectory(dir: string): string[] {
  let testSuiteFiles = readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((file) => {
      return (
        file.isFile() && 
        // excludes files that are in folders starting with . (e.g. selenium-test-suites/.seeds)
        !relative(__dirname, file.parentPath).startsWith('.') &&
        // enforce naming convention 
        file.name.endsWith('TestSuite.ts')
      )
    })
    .map(entry => join(entry.parentPath, entry.name))
    .sort();
  return testSuiteFiles;
}

/**
 * Resolve the filepaths of all test suites to run, based on the given CLI inputs
 * 
 * @param arrInput  CLI inputs
 * @returns         Absolute filepaths of test suites
 */
function getTestSuitesToRun(arrInput: string[]): string[] {
  if (arrInput.length === 0) {
    return walkThroughDirectory(__dirname);
  }

  const res: string[] = [];
  for (const input of arrInput) {
    const path = resolve(__dirname, input);
    if (!existsSync(path)) {
      console.error(styleText(['redBright', 'red'], `Cannot find ${path}`));
      continue;
    }
    const stat = statSync(path);
    if (stat.isFile()) {
      res.push(path);
    } else {
      res.push(...walkThroughDirectory(path));
    }
  }
  return res;
}

interface LogRecord {
  testSuiteName: string
  successes: number
  total: number
  failedTestCases: { id: string, reason: string }[]
}

/**
 * Load the testing environment and run Selenium test suites
 */
async function runTestSuites(): Promise<void> {
  const [args, suites] = parseCliArguments();
  loadTestEnvironment();

  const logRecords: LogRecord[] = [];

  for (const testSuiteFilePath of suites) {
    /* Check the file's existence before trying to import */
    if (!existsSync(testSuiteFilePath)) {
      console.error(`Cannot find test suite at path: ${testSuiteFilePath}`);
      continue;
    }
    
    /* Execute each test suite sequentially */
    const { default: fts } = await import(`file:///${normalizePath(testSuiteFilePath)}`);
    if (typeof fts === 'function') {
      const testSuite: TestSuiteClass = await fts(args);
      const { 
        successes: testSuiteSuccesses, 
        total: testSuiteTotal, 
        failed: failedTestCases 
      } = await testSuite.run();
      logRecords.push({
        testSuiteName: testSuiteFilePath,
        successes: testSuiteSuccesses,
        total: testSuiteTotal,
        failedTestCases
      });
    }
  }

  LogUtils.success('\n\n====Finished executing test suites====');
  logRecords.forEach(({ testSuiteName, successes, total, failedTestCases }) => {
    const lf = (successes < total) ? LogUtils.info : LogUtils.success;
    lf(`${testSuiteName}\t: Successfully completed ${successes} test(s) out of ${total}`);
    if (failedTestCases.length > 0) {
      LogUtils.error(`${testSuiteName}\t: Failed the following test suites:`);
      failedTestCases.forEach(({ id, reason }) => {
        LogUtils.error(`${id}\t: ${reason}`);
      })
    }
  })
}
runTestSuites();