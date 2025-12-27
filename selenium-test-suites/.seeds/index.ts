import {
  resolveEnv,
  runBotOperation
} from "./utils.ts";

import { seedAjaxBatchDelete } from "./AjaxBatchDelete.ts";
import { seedAjaxBatchUndelete } from "./AjaxBatchUndelete.ts";

resolveEnv();

/**
 * Default edit summary
 */
const EDIT_SUMMARY = `SEEDING WIKI PAGES FOR SELENIUM TESTS`;

/**
 * Run our bot
 */
runBotOperation(

  /* SEEDING OPERATIONS */
  [
    seedAjaxBatchDelete,
    // seedAjaxBatchUndelete,
  ], 

  {
    /* Wiki edit summary for our seeding operation */ defaultEditSummary: EDIT_SUMMARY,
    /* Max number of concurrent edits on a wiki */ concurrencies: 100,
    /* Max number of retries */ maxRetries: 3
  }
);