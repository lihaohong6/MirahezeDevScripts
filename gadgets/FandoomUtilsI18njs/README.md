*This article uses material from the "[I18n-js](https://dev.fandom.com/wiki/I18n-js)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

**FandoomUtilsI18njs** is a fork of [Fandom's utility script I18n-js](https://dev.fandom.com/wiki/I18n-js). This utility script is required for multiple-language supports in many of the scripts originating from Fandom Developers Wiki.

FandoomUtilsI18njs is a library for loading a script's messages, stored as JSON, ready for said script to use. Not only does it allow messages to be split out of the main code containing all the logic, it handles language fallbacks and basic parsing as well.

## Usage
### Importing the script
Load the gadget on your wiki by running the following line of code:
```js
// Loads the gadget onto your wiki
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsI18njs/gadget-impl.js');
```

This file is used as a dependency that is loaded by other gadgets when needed, so you shouldn't need to load it manually in most cases.

## Usage for Developers
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

### Loading the module
To load the module to use in your userscripts/gadgets:
```js
// Loads the gadget onto your wiki
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsI18njs/gadget-impl.js');

// Waits for the i18n-js to load
mw.hook('dev.i18n').add(function(i18nJs) {
  // Tells FandoomUtilsI18njs to load messages for another gadget served on the CDN
  i18nJs.loadMessages('<NAME OF GADGET>')
    .done(function (i18nMessages) {
      // You can use the i18n message object now
      $body.append( i18nMessages.msg('<MSG KEY>').plain() );
    });
    // i18nJs.loadMessages never fails
});
```

### Loading your messages
Now that the script is loaded, you're ready to load your messages. This is achieved using the <code>loadMessages</code> method of <code>window.dev.i18n</code> which returns a jQuery promise that resolves with an instance of <code>i18n</code>:
```js
// `name` is the name of the gadget, e.g. AjaxBatchDelete
i18n.loadMessages(name).done(function (i18n) {
    // use your i18n instance here
});
```

Once the messages are loaded, they are cached in case you attempt to load the messages again for any reason. 

The <code>loadMessages</code> method also accepts an optional <code>options</code> object as the second argument, which may include the following properties:
- <code>entrypoint</code><br />Used to set the entrypoint from which to fetch the /i18n.json file.By default this script will always fetch the /i18n.json file from the CDN set using the environment variable <code>CDN_ENTRYPOINT</code>.
- <code>cacheAll</code><br />An array of message names for which translations should be cached for all languages. See [§Message caching](#message-caching) for details.
- <code>cacheVersion</code><br />The minimum message cache version requested by the loading script. See [§Message caching](#message-caching) for details.
- <code>language</code><br />Set a language for the script to consider as the user language, instead of the MediaWiki variable <code>wgUserLanguage</code>. This language will be set as the default language, and will also take place when [calling <code>useUserLang()</code> or <code>inUserLang()</code>](#i18n-usage). If not set, the default language will be set to <code>wgUserLanguage</code>.
- <code>noCache</code><br />Never load the i18n messages from cache (this is not recommended for general use).

#### Message caching
Loaded messages will be cached in [browser storage](https://developer.mozilla.org/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) for up to two days after being loaded, in order to improve responsiveness on future page loads (as the script won't have to wait for messages to be loaded each time). However, this means that your script may use messages that are up to two days old. The cached messages also include a version number which defaults to <code>0</code> (zero).

If a new message is added in a script update, a cache refresh may be necessary to prevent missing messages before the two day cache expiry. To do this, you can use the <code>cacheVersion</code> option in your <code>loadMessages</code> call. If the <code>cacheVersion</code> option is used, it'll be compared to the cached version number, and if the cached version number is less than the requested version, the cache will be refreshed and the cached version number will be set to the requested version.

By default, the cache only keeps translations for the user's language (<code>wgUserLanguage</code>) and the wiki content's language (<code>wgContentLanguage</code>) in order to keep cache size low. If your script needs to use translations from other languages, you'll need to use the <code>cacheAll</code> option in your <code>loadMessages</code> call. This option should be set to an array of strings, each string being the name of a message that should be cached for all languages it has been translated into. This option can also be set to <code>true</code> to cache translations for all languages, though this is not recommended for general use.

### i18n usage
<code>i18n</code> controls access to your individual messages as well as the language it tries to translate them into. It defines the following methods:
- <code>useContentLang()</code><br />Set the default language to the value of <code>wgContentLanguage</code>.
- <code>useUserLang()</code><br />Set the default language to the user language (the user language is the value of <code>wgUserLanguage</code>, unless set otherwise by [the <code>options</code> parameter of <code>loadMessages()</code>](#loading-your-messages)).
- <code>inContentLang()</code><br />Set the language to the value of <code>wgContentLanguage</code> for the next message only.
- <code>inUserLang()</code><br />Set the language to the user language for the next message only.
- <code>inLang(code)</code><br />Set the language to <code>code</code> for the next message only. This method is only functional if the <code>cacheAll</code> option has been configured - see [§Message caching](#message-caching) for details.
- <code>msg(message, arg1, arg2, arg3, ...)</code><br />Create a <code>Message</code> instance representing the message in the closest language to the default language possible with any arguments substituted in. See [§Message usage](#message-usage) for details on how to use this.

### Message usage
> Unlike Fandom's version of i18n-js, which provides its own version of `Message` to parse its messages, this version of i18n-js simply provides a wrapped version of Mediawiki's native `mw.Message` object. Both versions share most of their APIs and have roughly similar functionalities, so you shouldn't need to worry too much about compatibility. However, there may be some caveats and gotchas to Mediawiki's `mw.Message` that you should take note of.

<code>Message</code> represents a translated message in the closest language to the default language set in the <code>i18n</code> instance as possible. If a translation could not be found in the requested language, then it will try a fallback language instead, until it falls back to English. If the English translation could not be found, then it will contain the name of the message wrapped in <code>&lt; ... &gt;</code>, e.g. <code>&lt;i18njs-Example-some-message&gt;</code>, where <code>Example</code> is the name of the script and <code>some-message</code> is the name of the message that could not be found.

If your message uses arguments, these should be specified in the form <code>$n</code> where n is a integer greater than 0, e.g, <code>'Hello, $1, my name is $2'</code>.

There are several methods available for outputting the message stored in the <code>Message</code> instance:
- <code>exists()</code><br />Outputs <code>true</code> if the message is set.
- <code>plain()</code><br />This outputs the message as is with no further processing.
- <code>escape()</code><br />This outputs the message with any HTML characters escaped.
- <code>escaped()</code><br />Synonymous with <code>escape()</code>.
- <code>parse()</code><br />This outputs the message with all basic wikitext links converted into HTML and some locale-specific magic words parsed.

> <code>parse()</code> works identically with [<code>mw.Message.parse()</code>](https://doc.wikimedia.org/mediawiki-core/master/js/mw.Message.html#parse). This means that <code>parse()</code> acts differently before and after <code>jqueryMsg</code> is loaded. If <code>jqueryMsg</code> is not loaded, then <code>escape()</code> and <code>parse()</code> works essentially the same as <code>plain()</code>. See *[the page "Manual:Messages API" on the official MediaWiki site](https://www.mediawiki.org/wiki/Manual:Messages_API#Using_messages_in_JavaScript)*.

- <code>parseDom()</code><br />This works identically with [<code>mw.Message.parseDom()</code>](https://doc.wikimedia.org/mediawiki-core/master/js/mw.Message.html#parseDom). This is only available if <code>jqueryMsg</code> is loaded.

If <code>inLang</code>, <code>inContentLang</code>, or <code>inUserLang</code> are being used, you can also chain the message call:

```js
// start with the user's language (let's say English)
i18n.msg('hello-world').plain(); // Hello World!

// output in the wiki's content language for one message only
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