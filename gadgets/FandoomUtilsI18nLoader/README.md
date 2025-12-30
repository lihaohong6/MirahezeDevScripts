*This article uses material from the "[I18n-js](https://dev.fandom.com/wiki/I18n-js)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

**FandoomUtilsI18nLoader** is a fork of [Fandom's utility script I18n-js](https://dev.fandom.com/wiki/I18n-js). This utility script is required for multiple-language supports in many of the scripts originating from Fandom Developers Wiki.

## Differences with I18n-js
 - Unlike I18n-js, FandoomUtilsI18nLoader does not expose an interface for parsing the messages into the DOM. This is by design, so as to minimize the risks of [Cross Site Scripting](https://owasp.org/www-community/attacks/xss/).
 - Parsing of messages is instead done using `mediawiki.message` which is shipped with every MediaWiki installation.
 - The original I18n-js uses a hook event to signal its readiness to other scripts that may depend on it. This is changed in FandoomUtilsI18nLoader, such that you can no longer use `mw.hook('dev.i18n')` to respond to FandoomUtilsI18nLoader's readiness on the MediaWiki environment. Instead, you must call upon the module using `mw.loader.using`.

## Usage
### Importing the script
Load the gadget on your wiki by running the following line of code:
```js
// Loads the gadget onto your wiki
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsI18nLoader/gadget-impl.js');
```

This file is used as a dependency that is loaded by other gadgets when needed, so you shouldn't need to load it manually in most cases.

## Quick Start for Developers
### Setting up messages for your userscripts
Make sure to set the environment variable `CDN_ENTRYPOINT` when building and deploying your gadgets. Messages for each gadget are served automatically when you add the i18n.json file as part of the `gadget.i18n` field in `gadgets-definition.yaml` in this repository. 

The format of your messages should be as follows:
```js
{
    "en": {
        "name": "value"
    },
    "pl": {
        "name": "wartość"
    }
}
```

### Loading the module (using boilerplate logic)
This Vite repository provides you with the means to inject boilerplate logic with regards to i18n, like so:
```js
/* AUTO-GENERATE BOILERPLATE LOGIC ON COMPILATION */
INJECT_FANDOM_UTILS_I18N();
```

The line of code above will inject the following three functions into the script/bundle when `npm run build` is run.
 - `getI18nLoader()`
 - `getFallbackMessages()`
 - `prepareI18n(i18nLoader)`

These three functions encapsulate the i18n message loading logic, so you would only need to use the module like so:
```js
// We want to call getI18nLoader() first & foremost to get FandoomUtilsI18nLoader to load your 
// messages from the i18n.json file that is served on the CDN.
//
// getI18nLoader() returns a jQuery.Deferred() object that ALWAYS resolves whether FandoomUtilsI18nLoader
// succeeded in fetching the messages from the remote i18n.json file or not. On event of failure,
// getFallbackMessages() is invoked to fetch the fallback messages instead.
getI18nLoader().then(function (i18nLoader) {
    // prepareI18n is called to create a utility object that shares its API with the original version of
    // I18n-js on Fandom Developers wiki.
    var i18n = prepareI18n(i18nLoader);

    // For example, you can call useUserLang() to switch the language setting to user preferences (default
    // is wiki content language):
    i18n.useUserLang();

    // You can use msg() to parse messages
    i18n.msg('hello-world').plain(); // Hello World!
    i18n.msg('greet', 'John').plain(); // Hello, John!

    // Use inContentLang() to output in the wiki's content language for one message only
    i18n.inContentLang().msg('hello-world').plain(); // Bonjour le monde !

    // and back to English again
    i18n.msg('hello-world').plain(); // Hello World!
});
```

These three functions will be located within the same scope as the original line of code that is used to inject the logic, so you shouldn't need to worry about them polluting the global scope.

## Advanced Usage for Developers
### Invoking the module without boilerplate logic
Besides the above method of injecting boilerplate logic, you can also manually call upon the module:
```js
mw.loader.using(['ext.gadget.store.FandoomUiUtilsI18nLoader'], function (require) {
    // Call upon FandoomUiUtilsI18nLoader using require:
    var i18nModule = require('ext.gadget.store.FandoomUiUtilsI18nLoader');
    // Load messages
    i18nModule.loadMessages('<NAME OF GADGET>', options)
        .done(function (i18nLoader) {
            // i18nLoader holds the map of messages and exposes some
            // logic for switching the language of messages (via 
            // useContentLang(), useUserLang(), inContentLang(), etc...)
            // i18nLoader IS NOT responsible for the actual parsing of 
            // messages into a string that is embeddable into the DOM
            // As such, i18nLoader itself does not expose the msg() method 

            // To actually parse the messages that you've loaded using
            // this tool, you pass i18nLoader.getMessages() to mw.Message:
            var helloMessage = new mw.Message(i18nLoader.getMessages(), 'hello-world' );
            helloMessage.plain();   // Hello World!
            var greetMessage = new mw.Message(i18nLoader.getMessages(), 'greet', ['John'] );
            greetMessage.plain();   // Hello, John!
        });
});
```

**It is recommended to use boilerplate logic insertion over manual invocation for simplicity.**

## API
### i18nModule.loadMessages
The <code>loadMessages</code> method accepts an optional <code>options</code> object as the second argument, which may include the following properties:
- <code>entrypoint</code><br />Used to set the entrypoint from which to fetch the /i18n.json file.By default this script will always fetch the /i18n.json file from the CDN set using the environment variable <code>CDN_ENTRYPOINT</code>.
- <code>cacheAll</code><br />An array of message names for which translations should be cached for all languages. See [§Message caching](#message-caching) for details.
- <code>cacheVersion</code><br />The minimum message cache version requested by the loading script. See [§Message caching](#message-caching) for details.
- <code>language</code><br />Set a language for the script to consider as the user language, instead of the MediaWiki variable <code>wgUserLanguage</code>. This language will be set as the default language, and will also take place when [calling <code>useUserLang()</code> or <code>inUserLang()</code>](#i18n-usage). If not set, the default language will be set to <code>wgUserLanguage</code>.
- <code>noCache</code><br />Never load the i18n messages from cache (this is not recommended for general use).

#### Message caching
Loaded messages will be cached in [browser storage](https://developer.mozilla.org/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) for up to two days after being loaded, in order to improve responsiveness on future page loads (as the script won't have to wait for messages to be loaded each time). However, this means that your script may use messages that are up to two days old. The cached messages also include a version number which defaults to <code>0</code> (zero).

If a new message is added in a script update, a cache refresh may be necessary to prevent missing messages before the two day cache expiry. To do this, you can use the <code>cacheVersion</code> option in your <code>loadMessages</code> call. If the <code>cacheVersion</code> option is used, it'll be compared to the cached version number, and if the cached version number is less than the requested version, the cache will be refreshed and the cached version number will be set to the requested version.

By default, the cache only keeps translations for the user's language (<code>wgUserLanguage</code>) and the wiki content's language (<code>wgContentLanguage</code>) in order to keep cache size low. If your script needs to use translations from other languages, you'll need to use the <code>cacheAll</code> option in your <code>loadMessages</code> call. This option should be set to an array of strings, each string being the name of a message that should be cached for all languages it has been translated into. This option can also be set to <code>true</code> to cache translations for all languages, though this is not recommended for general use.

### i18nLoader object
[`i18nModule.loadMessages()`](#i18nmoduleloadmessages) returns a jQuery.Deferred() object that resolves as an `i18nLoader` object. This object stores your individual messages and controls access to the language it tries to translate them into. It defines the following methods:
- <code>useContentLang()</code><br />Set the default language to the value of <code>wgContentLanguage</code>.
- <code>useUserLang()</code><br />Set the default language to the user language (the user language is the value of <code>wgUserLanguage</code>, unless set otherwise by [the <code>options</code> parameter of <code>loadMessages()</code>](#loading-your-messages)).
- <code>inContentLang()</code><br />Set the language to the value of <code>wgContentLanguage</code> for the next message only.
- <code>inUserLang()</code><br />Set the language to the user language for the next message only.
- <code>inLang(code)</code><br />Set the language to <code>code</code> for the next message only. This method is only functional if the <code>cacheAll</code> option has been configured - see [§Message caching](#message-caching) for details.

**Note that** the `i18nLoader` object does not expose a `msg()` method that parses the contents of the message into the contents of a DOM. This is done to minimize XSS risks.

### Boilerplate i18n object
[Injecting boilerplate logic](#loading-the-module-using-boilerplate-logic) produces a function named `prepareI18n` that creates an `i18n` object that shares its API with that of the original I18n-js. It defines the following methods:
- <code>useContentLang() / inContentLang()</code><br />Same as <code>i18nLoader</code>.
- <code>useUserLang() / inUserLang()</code><br />Same as <code>i18nLoader</code>.
- <code>inLang(code)</code><br />Same as <code>i18nLoader</code>.
- <code>msg(message, arg1, arg2, arg3, ...)</code><br />Create a <code>Message</code> instance representing the message in the closest language to the default language possible with any arguments substituted in. See [§Message usage](#message-usage) for details on how to use this.

### Message usage
> Unlike Fandom's version of i18n-js, which provides its own version of `Message` to parse its messages, this version of i18n-js simply provides a wrapped version of Mediawiki's native `mw.Message` object. Both versions share most of their APIs and have roughly similar functionalities, so you shouldn't need to worry too much about compatibility.

<code>Message</code> represents a translated message in the closest language to the default language set in the <code>i18n</code> instance as possible. If a translation could not be found in the requested language, then it will try a fallback language instead, until it falls back to English. If the English translation could not be found, then it will contain the name of the message wrapped in <code>&lt; ... &gt;</code>, e.g. <code>&lt;i18njs-Example-some-message&gt;</code>, where <code>Example</code> is the name of the script and <code>some-message</code> is the name of the message that could not be found.

If your message uses arguments, these should be specified in the form <code>$n</code> where n is a integer greater than 0, e.g, <code>'Hello, $1, my name is $2'</code>.

There are several methods available for outputting the message stored in the <code>Message</code> instance:
- <code>exists()</code><br />Outputs <code>true</code> if the message is set.
- <code>plain()</code><br />This outputs the message as is with no further processing.
- <code>escape()</code><br />This outputs the message with any HTML characters escaped.
- <code>escaped()</code><br />Synonymous with <code>escape()</code>.
- <code>parse()</code><br />This outputs the message with all basic wikitext links converted into HTML and some locale-specific magic words parsed.
<!--
This was fixed by having mediawiki.jqueryMsg be loaded along with FandoomUtilsI18nLoader
> <code>parse()</code> works identically with [<code>mw.Message.parse()</code>](https://doc.wikimedia.org/mediawiki-core/master/js/mw.Message.html#parse). This means that <code>parse()</code> acts differently before and after <code>mediawiki.jqueryMsg</code> is loaded. If <code>mediawiki.jqueryMsg</code> is not loaded, then <code>escape()</code> and <code>parse()</code> works essentially the same as <code>plain()</code>. See *[the page "Manual:Messages API" on the official MediaWiki site](https://www.mediawiki.org/wiki/Manual:Messages_API#Using_messages_in_JavaScript)*.-->
- <code>parseDom()</code><br />This works identically with [<code>mw.Message.parseDom()</code>](https://doc.wikimedia.org/mediawiki-core/master/js/mw.Message.html#parseDom).<!--This is only available if <code>jqueryMsg</code> is loaded.-->

If <code>inLang</code>, <code>inContentLang</code>, or <code>inUserLang</code> are being used, you can also chain the message call:

```js
// Start with English
i18n.msg('hello-world').plain(); // Hello World!

// Use inContentLang() to output in the wiki's content language for one message only
i18n.inContentLang().msg('hello-world').plain(); // Bonjour le monde !

// and back to English again
i18n.msg('hello-world').plain(); // Hello World!
```

## Overriding messages
Sometimes, an end-user may wish to customise a set of messages according to their own preferences or even for a site-wide installation. This can be achieved using the following:

```js
// in a user or site.js file

// initialise the global objects used without overwriting any already there
window.dev = window.dev || {};
window.dev.i18n = window.dev.i18n || {};
window.dev.i18n.overrides = window.dev.i18n.overrides || {};
window.dev.i18n.overrides['EXAMPLE'] = window.dev.i18n.overrides['EXAMPLE'] || {};

// customise the desired messages
window.dev.i18n.overrides['EXAMPLE']['some-message'] = 'My customised message';
window.dev.i18n.overrides['EXAMPLE']['another-message'] = 'Another customised message';
```

<code>EXAMPLE</code> is the name used by the message loader to identify where to load the message from. For example, for the name <code>I18nEdit</code>, the page would be <code><strong>I18nEdit</strong>/i18n.json</code>. Therefore to customise the messages of <code>I18nEdit</code>, you would use the following:

```js
window.dev = window.dev || {};
window.dev.i18n = window.dev.i18n || {};
window.dev.i18n.overrides = window.dev.i18n.overrides || {};
window.dev.i18n.overrides['I18nEdit'] = window.dev.i18n.overrides['I18nEdit'] || {};

window.dev.i18n.overrides['I18nEdit']['title'] = 'My new title';
```

To find the name of a message, the [QQX language code trick](https://mediawiki.org/wiki/Help:System_message#Finding_messages_and_documentation) can be used. For scripts using I18n-js, the text will be shown as <code>(i18njs-Example-some-message)</code>, where <code>Example</code> is the name of the script and <code>some-message</code> is the name of the message. For example, the <code>edit-language</code> message used in I18nEdit would show <code>(i18njs-I18nEdit-edit-language)</code>.