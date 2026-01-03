import { Mwn } from "mwn";

import http from "http";
import https from "https";
import axios from "axios";
import { existsSync } from "fs";
import { resolve } from "path";

/**
 * Resolves the project's environment variables
 */
export function resolveEnv(): void {
  const __dirname = import.meta.dirname;
  const envFile = resolve(__dirname, '../.env.test');
  if (!existsSync(envFile)) {
    throw new Error(`Cannot find ${envFile}`);
  }
  process.loadEnvFile(envFile);
}

export async function initBot(): Promise<Mwn> {
  const bot = new Mwn({
    apiUrl: process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT,
    username: process.env.SELENIUM_TESTING_WIKI_USERNAME,
    password: process.env.SELENIUM_TESTING_WIKI_PASSWORD,
    userAgent: 'Custom Mwn Bot',
    silent: true,       // suppress messages (except error messages)
    retryPause: 5000,   // pause for 5000 milliseconds (5 seconds) on maxlag error.
    maxRetries: 5       // attempt to retry a failing requests upto 5 times
  });

  /* For non-prod environments, set the bot to transmit requests over insecure HTTP if needed */
  if (process.env.ENV_REJECT_UNAUTHORIZED === '0') {
    console.log("Setting HTTP Request Agent to not reject unauthorized requests. Do not do this on a production environment.");
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });
    axios.defaults.httpAgent = httpAgent;
    axios.defaults.httpsAgent = httpsAgent;
    bot.setRequestOptions({ httpAgent, httpsAgent });
  }

  /* Finally login */
  if (!!process.env.SELENIUM_TESTING_WIKI_USERNAME || !!process.env.SELENIUM_TESTING_WIKI_PASSWORD) {
    // Login using Special:BotPasswords
    console.log(`Logging into ${process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT} as ${process.env.SELENIUM_TESTING_WIKI_USERNAME}`);
    await bot.login({
      apiUrl: process.env.SELENIUM_TESTING_WIKI_API_ENTRYPOINT,
      username: process.env.SELENIUM_TESTING_WIKI_USERNAME,
      password: process.env.SELENIUM_TESTING_WIKI_PASSWORD,
    });
    console.log(`Successfully logged in!`);
  }
  return bot;
}

interface SeedingBotOptions {
  defaultEditSummary: string
  concurrencies: number
  maxRetries: number
}
export type SeedingOp = (wikipageOperations: SeedingWikipageOperations) => void | Promise<void>;
export type SeedingCallback = (bot: Mwn, currentPageTitle: string, defaultEditSummary: string) => Promise<void>;
export type SeedingWikipageOperations = Map<string, { contents?: string, callbacks: SeedingCallback[] }>;

/**
 * @param operations 
 * @param title
 * @param featureBeingTested
 * @param additionalDescription
 */
export function seedPage(operations: SeedingWikipageOperations, { title, featureBeingTested, additionalDescription, callback }: { title: string, featureBeingTested?: string, additionalDescription?: string, callback?: SeedingCallback }): void {
  operations.set(
    title,
    {
      contents: `==Test Description==\n\nThis is a test page for the gadget/feature ${featureBeingTested || title}. ${additionalDescription || ''}`,
      callbacks: callback === undefined ? [] : [callback]
    }
  );
}

/**
 * Creates and runs the Mwn Bot
 * 
 * @param seeds
 * An array of functions that take in one arguments: a hashmap record of wikipage titles (as key) and 
 * an object (as value) containing the wikipage contents and callback to perform with the Mwn bot. 
 * To seed the wikipages, each of these functions should add a value to the passed hashmap, for 
 * example:
 * 
 * ```js
 * function seed (operations) {
 *    // For example, we want to add a page titled 'Example Page', and then we want to 
 *    // delete this page to test our undeleting bot
 *    operations.set(
 *       'Example Page',
 *       {
 *          contents: '== Heading ==\n\nExample Contents',
 *          async (bot, defaultEditingSummary) => {
 *             await bot.delete('Example Page', defaultEditingSummary);
 *          }
 *       }
 *    )
 * }
 * ```
 * @param options 
 * Mwn bot configuration options 
 * @returns 
 */
export async function runBotOperation(seeds: SeedingOp[], { defaultEditSummary, concurrencies, maxRetries }: SeedingBotOptions): Promise<void> {
  const bot = await initBot();

  const operations: SeedingWikipageOperations = new Map();

  seeds.forEach((seed) => {
    seed(operations);
  });
  
  await bot.batchOperation(
    Array.from(operations.keys()),
    async (pageTitle: string): Promise<any> => {
      const operation = operations.get(pageTitle)!;
      if (operation.contents) {
        await bot.save(pageTitle, operation.contents, defaultEditSummary); 
        console.log(`Saved page ${pageTitle}`);
      }
      operation.callbacks.forEach(async (cb) => {
        await cb(bot, pageTitle, defaultEditSummary);
      })
      return;
    },
    concurrencies,
    maxRetries
  );
  console.log('Finished seeding pages!');
}