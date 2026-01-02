## About
This is a set of [Selenium](https://www.selenium.dev) test suites that may be used to test your gadgets/userscripts on a MediaWiki instance.

## Pre-requisites

### Building & serving the gadgets
You must first build & serve the gadgets (either from a local endpoint or a live CDN) before you could test them on a MediaWiki instance. You can do this with the commands `npm run build` (build the gadgets) `npm run serve` (serve the gadgets from localhost).

> Make sure that the environment variable `CDN_ENTRYPOINT` is set before deploying the gadgets to a live CDN. Failure to set this environment variable correctly before deploying may cause the scripts that depend on other scripts (e.g. FandoomUtilsI18nLoader) to fail to load correctly.

### Installing required drivers
In addition to the npm package `selenium-webdriver`, you will also need to install the required webdriver for each web browser to test. Refer to [this page](https://www.npmjs.com/package/selenium-webdriver) for the links to the required executables.

### Setting up the test environment
Set up the test environment by creating the file `.env.test` in the folder `selenium-test-suites/`. An example configuration is:

```sh
# The endpoint from which to serve the gadgets from
# http://localhost:4173 is the default endpoint if serving from localhost 
SELENIUM_TESTING_SERVE_GADGETS_FROM=http://localhost:4173

# The endpoint from which to get a wiki article
SELENIUM_TESTING_WIKI_ENTRYPOINT=http://localhost:8080/wiki
# The endpoint to which you can make API requests (https://www.mediawiki.org/wiki/API:Action_API)
SELENIUM_TESTING_WIKI_API_ENTRYPOINT=http://localhost:8080/api.php

# These are used to login (via webpage) to the wiki
SELENIUM_TESTING_WIKI_USERNAME=exampleuser
SELENIUM_TESTING_WIKI_PASSWORD=verysecurepassword
```

### Seeding the test pages

Run `npm run selenium-seed` to start a bot run (powered by [Mwn](mwn.toolforge.org)) that will create the required test pages on the chosen wiki.

### Running specific test suites

You can start running test suites by using the following command:

```sh
npm run selenium-test -- <RELATIVE PATH TO TEST SUITE (FROM selenium-test-suites/)> 
```

For example:

```sh
# Run a single test suite
npm run selenium-test -- FandoomUiUtils/ModalTestSuite.ts

# Run multiple test suites
npm run selenium-test -- FandoomUiUtils/ModalTestSuite.ts FandoomUiUtils/DoruiTestSuite.ts

# Run all test suites in the directory `selenium-test-suites/FandoomUiUtils`
npm run selenium-test -- FandoomUiUtils
```

Test suites will always be done **sequentially**.

#### Switching browser/MediaWiki skin

The test suites are executed in the MediaWiki skin Vector-2022 by default. To switch the MediaWiki skin, pass the argument `--skin=<SKIN>` to `npm run selenium-test`:

```sh
npm run selenium-test -- --skin=timeless FandoomUiUtils/ModalTestSuite.ts 
```

You can also pass the argument `--browser=<BROWSER>` to switch the browser.