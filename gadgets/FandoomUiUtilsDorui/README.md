*This article uses material from the "[Dorui](https://dev.fandom.com/wiki/Dorui)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

**FandoomUiUtilsDorui** is a JavaScript library that provides a better alternative for creating DOM elements.

It's heavily inspired by [UI-js](https://dev.fandom.com/wiki/UI-js), optimized for more complex interfaces with conditionally displayed elements, cleaner looking objects for elements with attributes, and prettier looking code by calling functions named after elements instead of using <code>type</code>.

The library's name is inspired by [my own username](https://dev.fandom.com/wiki/User:Dorumin), so you don't forget me.

## Importing
You know how this goes:
```js
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsDorui/gadget-impl.js');
mw.hook('dev.doru.ui').add(function(ui) {
  // Your code here
  // `ui` is an alias to `window.dev.dorui`
  // It's advised to keep a reference to `ui`, so element creation is short and easy
  // You will find more information in the examples section
});
```

## Differences from UI-js
Given that Dorui is derived from UI-js, a good place to start is in how it differs from the original.

### New things
- There is no longer a <code>type</code> property to the object passed to the constructor function. With Dorui, you call functions that alias to creating those elements:
```js
// UI-js
var div = dev.ui({
  type: 'div'
});
var span = dev.ui({
  type: 'span',
  text: 'Hello, world!'
});

// Dorui
var div = ui.div();
var span = ui.span({
  text: 'Hello, world!'
});
```
  - For the (very) rare case where there isn't already an existing alias to the element, you can [{{fullurl:Talk:Dorui|action=edit&section=new&preloadtitle=I+like+cubes+and+I+want+an+element+to+be+aliased}} request it to be added], but meanwhile use the first parameter to the base function. This is the rare and only case where you'll use the exported function directly.
```js
var marquee = ui('marquee', {
  text: 'I am classified as a carcinogenic'
});
```
- Attributes can now be directly in the object passed to constructor functions, this avoids always having an <code>attr</code> object when you, for example, only need an element with an <code>id</code>.
```js
// UI-js
var div = dev.ui({
  type: 'div',
  attr: {
    id: 'container'
  }
});

// Dorui
var div = ui.div({
  id: 'container'
});
```
  - For the cases where you need to use a reserved attribute name (for example, <code>text</code>), you can still use the UI-js method, although <code>attr</code> was renamed to <code>attrs</code> for consistency.
```js
var div = ui.div({
  attrs: {
    id: 'container',
    text: 'boohoo'
  }
});
```
- There is now a <code>child</code> property for when you only need an element to have one child. This lets you have a shallower tree when your elements only need to have one child each.
```js
// UI-js
var div = dev.ui({
  type: 'div',
  children: [
    {
      type: 'span',
      text: 'I am a child'
    }
  ]
});

// Dorui
var div = ui.div({
  child: ui.span({
    text: 'I am a child'
  })
});
```
  - As you can see from the example above, children are no longer objects, but they're nodes themselves. In this case, they're what's returned from <code>ui.tag()</code> functions.
  - <code>child</code> does not support passing strings to it, as <code>children</code> would. This is because <code>text</code> already exists.
  - You should not use <code>child</code> and <code>children</code> together. They would simply be added in the order that they're declared, but it's silly nonetheless.
- <code>style</code> now supports custom CSS properties to be added.
```js
var div = ui.div({
  style: {
    // You can use camelCase or dashed-case
    backgroundColor: 'var(--custom-color)',
    '--custom-color': '#0ff'
  }
});
```
- <code>classes</code> now also supports passing an object for conditional classes. This is an additional feature as arrays are still supported.
```js
var button = ui.button({
  classes: {
    'wds-button': true,
    'wds-is-disbled': buttonData.disabled
  },
  props: {
    disabled: buttonData.disabled
  },
  text: buttonData.text
});
```

### Different things
- <code>attr</code> was renamed to <code>attrs</code> for consistency with <code>props</code> and <code>classes</code>, as these let you add more than one class or property at a time.
- The <code>child</code> and <code>children</code> properties now expect ready-to-use nodes to be passed to them directly, instead of UI-js's way of describing the whole tree with plain objects.
  - This was chosen because it enables the shorthand <code>ui.tag()</code> pattern, and it makes conditional short-circuiting better.
- Conditional elements were changed to use the short-circuiting <code>&&</code> instead. This is because, often, elements that have to be shown conditionally expect to only be computed if it exists, and UI-js's <code>condition</code> did not support this.
```js
// UI-js
var div = dev.ui({
  type: 'div',
  children: [
    {
      type: 'span',
      text: 'Stop! You violated the law!',
      condition: shouldShowBanner
    }
  ]
});

// Dorui
var div = ui.div({
  children: [
    shouldShowBanner && ui.span({
      text: 'Stop! You violated the law!'
    })
  ]
  // This pattern also works with `child`:
  // child: shouldShowBanner && ui.span({
  //     text: 'Stop! You violated the law!'
  // })
});
```
  - This reduces a lot of code repetition when you also require in the data used in the condition for the element you're creating.
```js
// UI-js
var div = dev.ui({
  type: 'div',
  children: [
    {
      type: 'span',
      text: banner && banner.message,
      condition: banner && banner.message
    }
  ]
});

// Dorui
var div = ui.div({
  child: banner && banner.message && ui.span({
    // You can now be sure that `banner` and `banner.message` both are truthy
    // so you can skip the check here
    text: banner.message
  })
});
```
  - Formally, falsy values are now ignored in the <code>child</code> and <code>children</code> options.
- SVG support is different. Dorui supports a plethora more svg tags than UI-js, and has a few more svg attribute namespace mappings than UI-js. However this isn't enough to definitively say that Dorui is better on that front, both libraries have been used to recreate every SVG element in a regular Fandom document successfully.
- Another reason ''not'' to pick Dorui over UI-js is speed. Dorui is around 2x faster when you only use it to create empty elements, but that lead grows smaller as you start doing things with them, such as adding attributes or event listeners. With complex loads, it's only around 20% faster, and that is negated by the fact that, after minification, Dorui is larger than UI-js (~2kb vs ~4kb).

### Removed things
- The <code>type</code> property was completely removed, as it's now the first parameter passed to <code>ui</code>, and users are advised to use aliases with a bound tag name.
- <code>condition</code> was removed, and in its place falsy values are ignored in the <code>child</code> and <code>children</code> slots.
- <code>parent</code> was removed. It was ambiguous in what it did, and changed its behavior over time. In the beginning, it cloned the node for every matching element found in the document. When cloning nodes turned problematic, it was changed to the current behavior, where it appends the same element to every matching element, which results in the last element getting it. This behavior is undocumented and weird, it would be safe to assume the element should be appended to the first matching element.
  - Solution: Use <code>appendChild</code> or whatever method you like to insert elements to the DOM.
```js
// With jQuery
$('#mw-content-text').append(ui.div());

// With vanilla
document.querySelector('#mw-content-text').appendChild(
  ui.div()
);

// With null checks
var parent = document.querySelector('#mw-content-text');
if (parent !== null) {
  parent.appendChild(
    ui.div()
  );
}

// Prepending
var parent = document.getElementById('mw-content-text');

parent.insertBefore(
  ui.div(),
  parent.firstChild
);
```
- <code>selected</code> was removed. The reason is simple to anyone who tried to use it: It doesn't work. This is because <code>selected</code> simply assigns to the <code>selectedIndex</code> property, which is bounded by how many children the element has. However, this step is done before adding the children, so it always fails to update the property properly.
  - Solution: Use <code>props</code> with <code>selectedIndex</code>! It will work as long as you remember to have <code>props</code> ''after'' your <code>children</code>.
```js
var select = ui.select({
  children: [
    ui.option({ text: 'Option 1' }),
    ui.option({ text: 'Option 2' }),
  ],
  // Remember: have `props` AFTER `children`
  props: {
    // Default to the 2nd option
    selectedIndex: 1
  }
});
```
- <code>checked</code> was removed. There's no fancy reason here, you can simply achieve the same thing with <code>props.checked</code>:
```js
var checkbox = ui.input({
  type: 'checkbox',
  props: {
    checked: true
  }
});
```
- <code>data</code> was removed. It's simply a mapping to <code>data-</code> attributes, that you can achieve with <code>attrs</code>. It was removed because it could be confused with using the HTML5 <code>dataset</code> property, which is often not what you want.
  - Solution: Just use <code>data-</code>
```js
var chatEntry = ui.li({
  attrs: {
    'data-name': username
  },
  text: content
});
```
- Passing <code>undefined</code> or <code>#document-fragment</code> no longer creates a document fragment. If you need to create one using this library, for example, to group a chunk of nodes within a parent for conditional usage, you can use the <code>ui.frag(children)</code> helper function. It takes an array of nodes, just like the <code>children</code> property.
- Similarly, <code>#text</code> no longer creates a text node. This was simply an undocumented implementation detail, so you shouldn't worry about it. To create text nodes using Dorui, you can use <code>text</code>, or pass a string to one of the items in a <code>children</code> array.

## Documentation
Dorui exports a single function, <code>ui(tag, options)</code>, which we call the **ui factory**. It takes two arguments.

> tag

It's a string that is the HTML tag name that you want to create. For example, <code>div</code>. This property must be passed in, and it must not be an empty string.

> options

It's an object that represents the options that will configure the element that will be created. We call this object **Options**, and it has some properties that have special meaning. Any unrecognized properties will be set as an argument. This object **should not** be <code>undefined</code>, or anything that's not a plain object.

Fortunately, users rarely have to use the factory function directly, as it looks a little weird to use and you must always pass in options even if you want a virgin element. Instead, they use aliased functions that let you build common elements more easily.

### Aliased functions
There are many functions that alias to the ui factory, but have a bound tag name. For example, <code>ui.div(options)</code>. Calling this function directly is equivalent to calling <code>ui('div', options)</code>.

There's one more thing about them that makes them nicer to use, and it's that they automatically deal with the <code>options</code> object if you miss it, it's not as stringent as the factory. So it's perfectly fine to use <code>ui.br()</code> to create a line break with no attributes or children.

The following is a list of HTML tag aliases:
- <code>ui.[a](https://developer.mozilla.org/docs/Web/HTML/Element/a)()</code>
- <code>ui.[abbr](https://developer.mozilla.org/docs/Web/HTML/Element/abbr)()</code>
- <code>ui.[address](https://developer.mozilla.org/docs/Web/HTML/Element/address)()</code>
- <code>ui.[area](https://developer.mozilla.org/docs/Web/HTML/Element/area)()</code>
- <code>ui.[article](https://developer.mozilla.org/docs/Web/HTML/Element/article)()</code>
- <code>ui.[aside](https://developer.mozilla.org/docs/Web/HTML/Element/aside)()</code>
- <code>ui.[audio](https://developer.mozilla.org/docs/Web/HTML/Element/audio)()</code>
- <code>ui.[b](https://developer.mozilla.org/docs/Web/HTML/Element/b)()</code>
- <code>ui.[bdi](https://developer.mozilla.org/docs/Web/HTML/Element/bdi)()</code>
- <code>ui.[bdo](https://developer.mozilla.org/docs/Web/HTML/Element/bdo)()</code>
- <code>ui.[blockquote](https://developer.mozilla.org/docs/Web/HTML/Element/blockquote)()</code>
- <code>ui.[body](https://developer.mozilla.org/docs/Web/HTML/Element/body)()</code>
- <code>ui.[br](https://developer.mozilla.org/docs/Web/HTML/Element/br)()</code>
- <code>ui.[button](https://developer.mozilla.org/docs/Web/HTML/Element/button)()</code>
- <code>ui.[canvas](https://developer.mozilla.org/docs/Web/HTML/Element/canvas)()</code>
- <code>ui.[caption](https://developer.mozilla.org/docs/Web/HTML/Element/caption)()</code>
- <code>ui.[cite](https://developer.mozilla.org/docs/Web/HTML/Element/cite)()</code>
- <code>ui.[code](https://developer.mozilla.org/docs/Web/HTML/Element/code)()</code>
- <code>ui.[col](https://developer.mozilla.org/docs/Web/HTML/Element/col)()</code>
- <code>ui.[colgroup](https://developer.mozilla.org/docs/Web/HTML/Element/colgroup)()</code>
- <code>ui.[data](https://developer.mozilla.org/docs/Web/HTML/Element/data)()</code>
- <code>ui.[datalist](https://developer.mozilla.org/docs/Web/HTML/Element/datalist)()</code>
- <code>ui.[dd](https://developer.mozilla.org/docs/Web/HTML/Element/dd)()</code>
- <code>ui.[del](https://developer.mozilla.org/docs/Web/HTML/Element/del)()</code>
- <code>ui.[details](https://developer.mozilla.org/docs/Web/HTML/Element/details)()</code>
- <code>ui.[dfn](https://developer.mozilla.org/docs/Web/HTML/Element/dfn)()</code>
- <code>ui.[dialog](https://developer.mozilla.org/docs/Web/HTML/Element/dialog)()</code>
- <code>ui.[div](https://developer.mozilla.org/docs/Web/HTML/Element/div)()</code>
- <code>ui.[dl](https://developer.mozilla.org/docs/Web/HTML/Element/dl)()</code>
- <code>ui.[dt](https://developer.mozilla.org/docs/Web/HTML/Element/dt)()</code>
- <code>ui.[em](https://developer.mozilla.org/docs/Web/HTML/Element/em)()</code>
- <code>ui.[embed](https://developer.mozilla.org/docs/Web/HTML/Element/embed)()</code>
- <code>ui.[fieldset](https://developer.mozilla.org/docs/Web/HTML/Element/fieldset)()</code>
- <code>ui.[figcaption](https://developer.mozilla.org/docs/Web/HTML/Element/figcaption)()</code>
- <code>ui.[figure](https://developer.mozilla.org/docs/Web/HTML/Element/figure)()</code>
- <code>ui.[footer](https://developer.mozilla.org/docs/Web/HTML/Element/footer)()</code>
- <code>ui.[form](https://developer.mozilla.org/docs/Web/HTML/Element/form)()</code>
- <code>ui.[h1](https://developer.mozilla.org/docs/Web/HTML/Element/h1)()</code>
- <code>ui.[h2](https://developer.mozilla.org/docs/Web/HTML/Element/h2)()</code>
- <code>ui.[h3](https://developer.mozilla.org/docs/Web/HTML/Element/h3)()</code>
- <code>ui.[h4](https://developer.mozilla.org/docs/Web/HTML/Element/h4)()</code>
- <code>ui.[h5](https://developer.mozilla.org/docs/Web/HTML/Element/h5)()</code>
- <code>ui.[h6](https://developer.mozilla.org/docs/Web/HTML/Element/h6)()</code>
- <code>ui.[head](https://developer.mozilla.org/docs/Web/HTML/Element/head)()</code>
- <code>ui.[header](https://developer.mozilla.org/docs/Web/HTML/Element/header)()</code>
- <code>ui.[hr](https://developer.mozilla.org/docs/Web/HTML/Element/hr)()</code>
- <code>ui.[html](https://developer.mozilla.org/docs/Web/HTML/Element/html)()</code>
- <code>ui.[i](https://developer.mozilla.org/docs/Web/HTML/Element/i)()</code>
- <code>ui.[iframe](https://developer.mozilla.org/docs/Web/HTML/Element/iframe)()</code>
- <code>ui.[img](https://developer.mozilla.org/docs/Web/HTML/Element/img)()</code>
- <code>ui.[input](https://developer.mozilla.org/docs/Web/HTML/Element/input)()</code>
- <code>ui.[ins](https://developer.mozilla.org/docs/Web/HTML/Element/ins)()</code>
- <code>ui.[kbd](https://developer.mozilla.org/docs/Web/HTML/Element/kbd)()</code>
- <code>ui.[label](https://developer.mozilla.org/docs/Web/HTML/Element/label)()</code>
- <code>ui.[legend](https://developer.mozilla.org/docs/Web/HTML/Element/legend)()</code>
- <code>ui.[li](https://developer.mozilla.org/docs/Web/HTML/Element/li)()</code>
- <code>ui.[link](https://developer.mozilla.org/docs/Web/HTML/Element/link)()</code>
- <code>ui.[main](https://developer.mozilla.org/docs/Web/HTML/Element/main)()</code>
- <code>ui.[map](https://developer.mozilla.org/docs/Web/HTML/Element/map)()</code>
- <code>ui.[mark](https://developer.mozilla.org/docs/Web/HTML/Element/mark)()</code>
- <code>ui.[meta](https://developer.mozilla.org/docs/Web/HTML/Element/meta)()</code>
- <code>ui.[meter](https://developer.mozilla.org/docs/Web/HTML/Element/meter)()</code>
- <code>ui.[nav](https://developer.mozilla.org/docs/Web/HTML/Element/nav)()</code>
- <code>ui.[noscript](https://developer.mozilla.org/docs/Web/HTML/Element/noscript)()</code>
- <code>ui.[object](https://developer.mozilla.org/docs/Web/HTML/Element/object)()</code>
- <code>ui.[ol](https://developer.mozilla.org/docs/Web/HTML/Element/ol)()</code>
- <code>ui.[optgroup](https://developer.mozilla.org/docs/Web/HTML/Element/optgroup)()</code>
- <code>ui.[option](https://developer.mozilla.org/docs/Web/HTML/Element/option)()</code>
- <code>ui.[output](https://developer.mozilla.org/docs/Web/HTML/Element/output)()</code>
- <code>ui.[p](https://developer.mozilla.org/docs/Web/HTML/Element/p)()</code>
- <code>ui.[param](https://developer.mozilla.org/docs/Web/HTML/Element/param)()</code>
- <code>ui.[picture](https://developer.mozilla.org/docs/Web/HTML/Element/picture)()</code>
- <code>ui.[pre](https://developer.mozilla.org/docs/Web/HTML/Element/pre)()</code>
- <code>ui.[progress](https://developer.mozilla.org/docs/Web/HTML/Element/progress)()</code>
- <code>ui.[q](https://developer.mozilla.org/docs/Web/HTML/Element/q)()</code>
- <code>ui.[s](https://developer.mozilla.org/docs/Web/HTML/Element/s)()</code>
- <code>ui.[samp](https://developer.mozilla.org/docs/Web/HTML/Element/samp)()</code>
- <code>ui.[script](https://developer.mozilla.org/docs/Web/HTML/Element/script)()</code>
- <code>ui.[section](https://developer.mozilla.org/docs/Web/HTML/Element/section)()</code>
- <code>ui.[select](https://developer.mozilla.org/docs/Web/HTML/Element/select)()</code>
- <code>ui.[small](https://developer.mozilla.org/docs/Web/HTML/Element/small)()</code>
- <code>ui.[source](https://developer.mozilla.org/docs/Web/HTML/Element/source)()</code>
- <code>ui.[span](https://developer.mozilla.org/docs/Web/HTML/Element/span)()</code>
- <code>ui.[strong](https://developer.mozilla.org/docs/Web/HTML/Element/strong)()</code>
- <code>ui.[style](https://developer.mozilla.org/docs/Web/HTML/Element/style)()</code>
- <code>ui.[sub](https://developer.mozilla.org/docs/Web/HTML/Element/sub)()</code>
- <code>ui.[summary](https://developer.mozilla.org/docs/Web/HTML/Element/summary)()</code>
- <code>ui.[sup](https://developer.mozilla.org/docs/Web/HTML/Element/sup)()</code>
- <code>ui.[table](https://developer.mozilla.org/docs/Web/HTML/Element/table)()</code>
- <code>ui.[tbody](https://developer.mozilla.org/docs/Web/HTML/Element/tbody)()</code>
- <code>ui.[td](https://developer.mozilla.org/docs/Web/HTML/Element/td)()</code>
- <code>ui.[textarea](https://developer.mozilla.org/docs/Web/HTML/Element/textarea)()</code>
- <code>ui.[tfoot](https://developer.mozilla.org/docs/Web/HTML/Element/tfoot)()</code>
- <code>ui.[th](https://developer.mozilla.org/docs/Web/HTML/Element/th)()</code>
- <code>ui.[thead](https://developer.mozilla.org/docs/Web/HTML/Element/thead)()</code>
- <code>ui.[time](https://developer.mozilla.org/docs/Web/HTML/Element/time)()</code>
- <code>ui.[title](https://developer.mozilla.org/docs/Web/HTML/Element/title)()</code>
- <code>ui.[tr](https://developer.mozilla.org/docs/Web/HTML/Element/tr)()</code>
- <code>ui.[track](https://developer.mozilla.org/docs/Web/HTML/Element/track)()</code>
- <code>ui.[u](https://developer.mozilla.org/docs/Web/HTML/Element/u)()</code>
- <code>ui.[ul](https://developer.mozilla.org/docs/Web/HTML/Element/ul)()</code>
- <code>ui.[video](https://developer.mozilla.org/docs/Web/HTML/Element/video)()</code>
----

And the registered SVG tags that have special SVG semantics:
- <code>ui.[animate](https://developer.mozilla.org/docs/Web/SVG/Element/animate)()</code>
- <code>ui.[animation](https://developer.mozilla.org/docs/Web/SVG/Element/animation)()</code>
- <code>ui.[circle](https://developer.mozilla.org/docs/Web/SVG/Element/circle)()</code>
- <code>ui.[clipPath](https://developer.mozilla.org/docs/Web/SVG/Element/clipPath)()</code>
- <code>ui.[defs](https://developer.mozilla.org/docs/Web/SVG/Element/defs)()</code>
- <code>ui.[desc](https://developer.mozilla.org/docs/Web/SVG/Element/desc)()</code>
- <code>ui.[ellipse](https://developer.mozilla.org/docs/Web/SVG/Element/ellipse)()</code>
- <code>ui.[feColorMatrix](https://developer.mozilla.org/docs/Web/SVG/Element/feColorMatrix)()</code>
- <code>ui.[feGaussianBlur](https://developer.mozilla.org/docs/Web/SVG/Element/feGaussianBlur)()</code>
- <code>ui.[feOffset](https://developer.mozilla.org/docs/Web/SVG/Element/feOffset)()</code>
- <code>ui.[filter](https://developer.mozilla.org/docs/Web/SVG/Element/filter)()</code>
- <code>ui.[foreignObject](https://developer.mozilla.org/docs/Web/SVG/Element/foreignObject)()</code>
- <code>ui.[g](https://developer.mozilla.org/docs/Web/SVG/Element/g)()</code>
- <code>ui.[geometry](https://developer.mozilla.org/docs/Web/SVG/Element/geometry)()</code>
- <code>ui.[image](https://developer.mozilla.org/docs/Web/SVG/Element/image)()</code>
- <code>ui.[line](https://developer.mozilla.org/docs/Web/SVG/Element/line)()</code>
- <code>ui.[linearGradient](https://developer.mozilla.org/docs/Web/SVG/Element/linearGradient)()</code>
- <code>ui.[mask](https://developer.mozilla.org/docs/Web/SVG/Element/mask)()</code>
- <code>ui.[path](https://developer.mozilla.org/docs/Web/SVG/Element/path)()</code>
- <code>ui.[polygon](https://developer.mozilla.org/docs/Web/SVG/Element/polygon)()</code>
- <code>ui.[rect](https://developer.mozilla.org/docs/Web/SVG/Element/rect)()</code>
- <code>ui.[stop](https://developer.mozilla.org/docs/Web/SVG/Element/stop)()</code>
- <code>ui.[svg](https://developer.mozilla.org/docs/Web/SVG/Element/svg)()</code>
- <code>ui.[symbol](https://developer.mozilla.org/docs/Web/SVG/Element/symbol)()</code>
- <code>ui.[text](https://developer.mozilla.org/docs/Web/SVG/Element/text)()</code>
- <code>ui.[use](https://developer.mozilla.org/docs/Web/SVG/Element/use)()</code>
----

The set of supported SVG tags is expected to grow in the future.

### The Options object
This is the meat of element creation, without it the library is just a glorified <code>document.createElement</code>.

So, how does it work? Every property in the object is a pair of a key, and a value. The key is what the script will interpret as having a special meaning, or being used as an attribute. The value decides what exactly is done.

When the key is unrecognized as having a special meaning, it's assumed that the key is an attribute name, and the value is the attribute's value. The value will be simply stringified, so an object will be <code>attribute="[object Object]"</code> and a boolean like <code>false</code> will be <code>attribute="false"</code>.

There is another behavior of the options object that you should know, and it's that their effects happen in the same order that they're in the object itself. You got a taste of it in the section for [things removed from UI-js](#removed-things), where the order of <code>children</code> and <code>props.selectedIndex</code> mattered for working with select default values. Most of the time, this doesn't make a difference, but it matters for the defined behaviors of using <code>child</code>, <code>children</code>, and <code>text</code> together. You should still only use <code>children</code> instead of mix and matching for clarity, but this serves to explain the edge cases.

These are the keys that have special meanings:
- attrs<br /><p>It must be a plain object that represents what values will be set to the element. It's provided as an escape hatch to the special meaning keys, in case you need to set an attribute with the name of <code>child</code> or <code>events</code> for some reason.</p><p>However, it's not only an escape hatch, it also has some special handling of boolean values. Instead of stringifying like the default fallthrough does, it can be used as '''conditional attributes'''. For example, if you pass in <code>checked: false</code>, the element won't have a checked attribute at all. However, if you pass in <code>checked: true</code>, it will have <code>checked="checked"</code>.</p><p>This is merely an example, for the checked attribute, you should use <code>props</code>, which is the better way to handle input element values.</p>
- child<br />It must be a node, such as a text node (though then you'd use <code>text</code>), a document fragment (though then you'd use <code>children</code>), or an element. Actually, just use an element. You would use this when you don't need multiple children, and the only child is an element and not text. If a falsy value is passed (e.g. <code>0, false, null, undefined, NaN</code>), it will be ignored.
- children<br />It must be an array of nodes or strings. They will be appended in order to the parent. Strings will be converted to text nodes. If a falsy value is found within the array, it will be ignored.
- text<br />It must be a string, and it appends a text node to the element.
- html<br />It must be a string. It completely overrides the element's contents with the given html. Only use this if you absolutely have to deal with foreign HTML instead of creating nodes yourself.
- classes<br />It can be an array of strings or a plain object. If an array, it assigns those classes to the element. If an object, its keys are used as class names, and the value decides whether the class is added to the element or not. You can think of it as conditional classes, just like how <code>attrs</code> can have conditional attributes.
- events<br />It must be a plain object. Its keys are used as event names, and the values have to be functions that will be the event callbacks passed to <code>addEventListener</code>.
- style<br />It must be a plain object. Its keys are used as CSS property names, and the values as the... values. You can use camelCase property names (for example, <code>backgroundColor</code>, <code>borderTopRightRadius</code>, <code>WebkitTransform</code>) or regular dashed-case names. CSS variables are supported, too.
- props<br />It must be a plain object. Custom properties that will be assigned directly to the element once it's created.

### Document fragments
There is one extra utility function provided to create document fragments, <code>ui.frag()</code>.

It takes a single argument, which is an array of children. Just like in the options object, this array can have regular nodes or strings that will be converted into text nodes.

## Examples
Before seeing simpler usage examples, we'll tackle the far more complicated problem of program structure.

Even if you don't end up using either method, it's still useful to establish a context where the rest of the examples could be placed and how they would run.

### General structure
Adding dependencies to dev scripts in general takes some thought in how you'll structure your program to keep it tidy

In general, simpler is better, so if you only need one or few dependencies then a structure like the following may work for your program.

```js
(function() {
  var ui;

  function init(lib) {
    ui = lib;

    $('#my-tools-menu').append(
      ui.li({
        text: 'My script'
      })
    );
  }

  mw.hook('dev.doru.ui').add(init);
})();
```

This is well and good, and fairly standard among dev scripts. However, if you want a more biased code sample for a script that may need some more complex dependency management, feel free to take a look at the following example.
```js
(function() {
  // Double runs
  if (window.MyScript && MyScript.loaded) return;

  var ui;

  window.MyScript = {
    loaded: true,

    // List of dependencies
    loading: [
      'dorui',
      'i18n-js',
      'i18n'
    ],

    // Callback for each loaded dependency
    onload: function(key, arg) {
      switch (key) {
        case 'i18n-js':
          arg.loadMessages('MyScript').then(this.onload.bind(this, 'i18n'));
          break;
        case 'i18n':
          this.i18n = arg;
          break;
        case 'dorui':
          ui = arg;
          break;
      }

      var index = this.loading.indexOf(key);
      if (index === -1) throw new Error('Unregistered dependency loaded: ' + key);

      this.loading.splice(index, 1);

      if (this.loading.length !== 0) return;

      this.init();
    },

    // Import dependencies and bind to their hooks
    preload: function() {
      // Load FandoomUtilsI18njs & FandoomUiUtilsDorui if not yet loaded

      // When loaded, execute the callback `this.onload`
      mw.hook('dev.i18n').add(this.onload.bind(this, 'i18n-js'));
      mw.hook('dev.doru.ui').add(this.onload.bind(this, 'dorui'));
    },

    // Function that will be called when all dependencies are loaded
    init: function() {
      var menu = document.getElementById('my-tools-menu');
      if (menu === null) return;

      menu.appendChild(
        ui.li({
          text: this.i18n.msg('tools-menu-label').plain()
        })
      );
    }
  };

  MyScript.preload();
})();
```

Of course, this is far more complex, but it can handle a more complicated dependency tree. It's up to you whether this complexity cost is worth it or not, or maybe you can adapt some of the patterns in the above code for yourself.

### Making simple elements
Going forward, we will be assuming that you have an appropriate structure in your code where the variable <code>ui</code> safely refers to the factory function.

By now you should have a decent idea of how element creation works, so these examples shouldn't seem strange but they could get you more used to how it looks and works.

```js
var span = ui.span({
  class: 'my-span-element',
  text: 'Howdy'
});

var div = ui.div({
  id: 'my-wrapper',
  child: span
});

var container = ui.div({
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
```

### Dealing with input elements
Input elements are some of the most complicated in HTML, given how different they all are.

Luckily, <code>props</code> lets you deal with the most problematic parts such as the different ways of setting default values and so on.

```js
// Equivalent to <input type="text" value="hello">
// Keep in mind type="text" is implied by the browser if omitted, but it doesn't hurt
ui.input({
  type: 'text',
  props: {
    value: 'hello'
  }
});

// Equivalent to <textarea>hello</textarea>
// But oh my, we can still use the same method to set the default value!
ui.textarea({
  props: {
    value: 'hello'
  }
});

// Equivalent to <input type="checkbox" checked="checked">
// The attribute is never actually set, because the checked property is set with JS
// But the checkbox will be checked
ui.input({
  type: 'checkbox',
  props: {
    checked: true
  }
});
```

### Making WDS buttons
It's all good to be able to create elements, but they'll still sorta stand out if you don't style them just like the rest of the site

To make a button that looks like the edit button on top of this page, we'll need [WDSIcons](https://dev.fandom.com/wiki/WDSIcons), so we'll assume you have it imported.

```js
var button = ui.button({
  class: 'wds-button',
  children: [
    dev.wds.icon('pencil-small'),
    ui.span({
      text: 'Edit'
    })
  ]
});
```

What's that, you say? You want the dropdown as well? Well, aren't you a picky one, alright, here you go:
```js
var buttonGroup = ui.div({
  class: 'wds-button-group',
  children: [
    ui.button({
      class: 'wds-button',
      children: [
        dev.wds.icon('pencil-small'),
        ui.span({
          text: 'Edit'
        })
      ]
    }),
    ui.div({
      class: 'wds-dropdown',
      children: [
        ui.div({
          classes: ['wds-button', 'wds-dropdown__toggle'],
          child: dev.wds.icon('dropdown-tiny')
        }),
        ui.div({
          classes: ['wds-dropdown__content', 'wds-is-not-scrollable', 'wds-is-right-aligned'],
          child: ui.ul({
            classes: ['wds-list', 'wds-is-linked'],
            children: [
              ui.li({
                child: ui.a({
                  text: 'Ha-ha'
                })
              })
            ]
          })
        })
      ]
    })
  ]
});
```

### Extracting functions
But the code above is *super* unwieldy to carry around everywhere. What if we could just have some simpler object with only the relevant data, and generate an element out of that? Like this:
```js
buildWDSButton({
  text: 'Click me',
  dropdown: [
    {
      text: 'Choice 1',
      href: '/wiki/User:Dorumin'
    },
    {
      text: 'Choice 2',
      href: mw.util.getUrl('User:Sophiedp')
    }
  ]
});
```

Well, you can extract the element creation into functions easily, using objects and arrays as inputs. In fact, it's encouraged, so you can keep your UI easy to understand as small functions, like so:
```js
function buildDropdownItem(data) {
  return ui.li({
    child: ui.a({
      href: data.href || '#',
      text: data.text
    })
  });
}

function buildDropdown(children) {
  return ui.div({
    class: 'wds-dropdown',
    children: [
      ui.div({
        classes: ['wds-button', 'wds-dropdown__toggle'],
        child: dev.wds.icon('dropdown-tiny')
      }),
      ui.div({
        classes: ['wds-dropdown__content', 'wds-is-not-scrollable', 'wds-is-right-aligned'],
        child: ui.ul({
          classes: ['wds-list', 'wds-is-linked'],
          children: children.map(buildDropdownItem)
        })
      })
    ]
  });
}

function buildWDSButton(data) {
  return ui.div({
    class: 'wds-button-group',
    children: [
      ui.button({
        class: 'wds-button',
        children: [
          dev.wds.icon('pencil-small'),
          ui.span({
            text: data.text
          })
        ]
      }),
      data.dropdown && buildDropdown(data.dropdown)
    ]
  });
}
```

Isn't that a lot easier to understand?

### Using modals
To show modals using [ShowCustomModal](https://dev.fandom.com/wiki/ShowCustomModal), you can use code like the following:
```js
mw.hook('dev.showCustomModal').add(function() {
  dev.showCustomModal('My modal', {
    id: 'MyModal',
    content: ui.ul({
      children: [
        ui.li({ text: 'Your pastimes consisted of the strange' }),
        ui.li({ text: 'And twisted and deranged' }),
        ui.li({ text: 'And I hate that little game you had called' }),
        ui.li({ text: 'Crying Lightning' }),
      ]
    })
  });
});
```

### Using fragments
Fragments are a rather niche feature that you may think don't really have a place in the library.

Well, for a start, you're right. But they *are* a pretty handy way to group children easily!

Normally, with Dorui, you can already do that with <code>children</code>, but fragments let you do that even from within that array.

This comes in handy when choosing whether to conditionally include more than one element based on one condition, without having a container:
```js
var shouldRepeat = true;

var lyrics = ui.ul({
  children: [
    // vs. SAYU, No Straight Roads soundtrack
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
```

They're also useful for passing into functions that expect a single node. For example, if you want to show a modal with multiple children, but don't want to add a container, you can use fragments!

Let's revisit the [example from before about modals](#using-modals) and change it to use fragments, and list items as paragraphs:
```js
mw.hook('dev.showCustomModal').add(function() {
  dev.showCustomModal('My modal', {
    id: 'MyModal',
    content: ui.frag([
      ui.p({ text: 'Your pastimes consisted of the strange' }),
      ui.p({ text: 'And twisted and deranged' }),
      ui.p({ text: 'And I hate that little game you had called' }),
      ui.p({ text: 'Crying Lightning' }),
    ])
  });
});
```

This gets rid of one level of indentation and an unnecessary wrapper element. Hopefully you find fragments useful, if only a few times.

### Porting from UI-js
Porting scripts from UI-js to Dorui is usually not needed, unless you will keep working on it and feel like Dorui will be more enjoyable to use in the long run.

### Porting from HTML
If you have a chunk of HTML that you want to turn into Dorui, you don't have to perform the transformation yourself. You can use [this](https://dev.fandom.com/wiki/MediaWiki:Dorui/html.js) tool to turn it into a Dorui tree.