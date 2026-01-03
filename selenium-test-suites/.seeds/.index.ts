import {
  resolveEnv,
  runBotOperation
} from "./.utils.ts";

import { seedAjaxBatchDelete } from "./AjaxBatchDelete.ts";
import { seedAjaxBatchRedirect } from "./AjaxBatchRedirect.ts";
import { seedAjaxBatchUndelete } from "./AjaxBatchUndelete.ts";
import { seedMassNullEdit } from "./MassNullEdit.ts";
import { seedMassRename } from "./MassRename.ts";
import { seedMassCategorization } from "./MassCategorization.ts";
import { seedMassProtect } from "./MassProtect.ts";
import { seedPageRenameAutoUpdate } from "./PageRenameAutoUpdate.ts";

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
    seedAjaxBatchRedirect,
    seedAjaxBatchUndelete,
    seedMassNullEdit,
    seedMassRename,
    seedMassCategorization,
    seedMassProtect,
    seedPageRenameAutoUpdate,
  ], 

  {
    /* Wiki edit summary for our seeding operation */ defaultEditSummary: EDIT_SUMMARY,
    /* Max number of concurrent edits on a wiki */ concurrencies: 20,
    /* Max number of retries */ maxRetries: 3
  }
);