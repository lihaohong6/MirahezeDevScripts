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
type SeedingWikipageContents = Map<string, string>;
type SeedingWikipageBotCallbacks = Map<string, SeedingCallback>;
type SeedingOp = (pages: SeedingWikipageContents, callbacks: SeedingWikipageBotCallbacks) => void | Promise<void>;
type SeedingCallback = (bot: Mwn, defaultEditSummary: string) => Promise<void>;

/**
 * @param pages 
 * @param title
 * @param n
 * @param featureBeingTested
 * @param additionalDescription
 */
export function seedPage(pages: SeedingWikipageContents, { title, n, featureBeingTested, additionalDescription }: { title: string, n: number, featureBeingTested?: string, additionalDescription?: string }): void {
  pages.set(
    /* Title */ `${title} ${n}`,
    /* Page contents */
    `==Test Description==\n\nThis is a test page for the gadget/feature ${featureBeingTested || title} ${additionalDescription || ''}`
  );
}

/**
 * Creates and runs the Mwn Bot
 * 
 * @param seeds
 * An array of functions that take in two arguments: a hashmap record of wikipage titles (as key) and 
 * wikipage contents (as value), and a hashmap record of wikipage titles (as key) and callbacks to perform 
 * with the Mwn bot. Each of these functions should set the corresponding wikipage titles, contents, and 
 * possible bot callbacks onto the given hashmaps, for example:
 * 
 * ```js
 * function seed (pages, callbacks) {
 *    // You must set pages!
 *    pages.set('Example Page', '== Heading ==\n\nExample Contents');
 * 
 *    // Setting callbacks is perfectly optional!
 *    callbacks.set(
 *      'Example Page', 
 *      async (bot, defaultEditingSummary) => {
 *          // For example, we might want to delete our recently created page, 
 *          // in order to test our recently made undeleting bot
 *          await bot.delete('Example Page', defaultEditingSummary);
 *      }
 *    );
 * }
 * ```
 * @param options 
 * Mwn bot configuration options 
 * @returns 
 */
export async function runBotOperation(seeds: SeedingOp[], { defaultEditSummary, concurrencies, maxRetries }: SeedingBotOptions): Promise<void> {
  const bot = await initBot();

  const pages: SeedingWikipageContents = new Map<string, string>();
  const callbacks: SeedingWikipageBotCallbacks = new Map<string, SeedingCallback>();
  
  seeds.forEach((seed) => {
    seed(pages, callbacks);
  });
  
  await bot.batchOperation(
    Array.from(pages.keys()),
    async (pageTitle: string): Promise<any> => {
      console.log(`Saving page ${pageTitle}`);
      await bot.save(pageTitle, pages.get(pageTitle)!, defaultEditSummary); 
      if (callbacks.has(pageTitle)) {
        await callbacks.get(pageTitle)!(bot, defaultEditSummary);
      }
      return;
    },
    concurrencies,
    maxRetries
  );
  console.log('Finished seeding pages!');
}