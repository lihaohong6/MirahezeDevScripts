*This article uses material from the "[QDmodal](https://dev.fandom.com/wiki/QDmodal)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

*FandoomUiUtilsQdmodal* is a library allowing scripts to display a modal dialog. It provides an adaptive layout without complex styling by using the [CSS flexbox layout](https://developer.mozilla.org/docs/Web/CSS/CSS_Flexible_Box_Layout). QDmodal supports both vanilla MediaWiki wikis (e.g. Wikipedia) and the Fandom wiki platform (where it'll match the theme of the wiki it's displayed on).

## Documentation
### Loading the library
First, you'll need to load the QDmodal script:
```js
if (!mw.libs.QDmodal) {
  mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsQdmodal/gadget-impl.js');
}
```

You can use hooks to synchronize loading.
```js
mw.hook('dev.qdmodal').add(function(QDmodal) {
  // QDmodal is the modal constructor
  new QDmodal("my-modal-id");
  // You can also access it with `mw.libs.QDmodal`
});
```

### Using the modal
Once the script has been loaded, you can initialise a new modal using the <code>mw.libs.QDmodal</code> constructor:
```js
var myModal = new mw.libs.QDmodal("my-modal-id");
```

The <code>myModal</code> variable will be a [modal object](#modal-object).

To show the modal, use the modal object's <code>show</code> function with a [data object](#data-object) as the argument:
```js
myModal.show({
  content: "A HTML string or jQuery object to be shown as content within the modal.",
  title: "Text-only string to be shown in the modal header.",
  buttons: [
    {
      text: "Button One",
      href: "https://example.com/",
      attr: {
        id: "my-modal-button-one"
      }
    }, 
    {
      text: "Button Two",
      handler: function (event) {
        // do something when button is clicked
      },
      condition: function (modal) {
        // check if this button should be included
      }
    }
  ]
});
```

If an <code>onBeforeShow</code> property was included in the data object, its function will be run **before** the modal is added to the DOM and before any hook is fired. If a <code>hook</code> property was included in the data object, it will be fired **before** the modal is added to the DOM but **after** the <code>onBeforeShow</code> function is called. If an <code>onShow</code> property was included in the data object, its function will be run **after** the modal is added to the DOM. Arbitrary properties may also be included in the data object: these can be useful for storing information about the current modal content for use within a hook or event handler.

To hide the modal, use the modal object's <code>hide</code> function:
```js
myModal.hide();
```

If an <code>onHide</code> property was included in the data object passed when the modal was shown, its function will be run **before** the modal is removed from the DOM. If this function returns <code>false</code>, the modal won't be hidden.

## Object details
### Modal object
<table style="width: 100%;">
<tbody>
<tr>
<th>Key</th>
<th>Type</th>
<th>Description</th>
</tr>
<tr>
<td><code>$content</code></td>
<td>jQuery object</td>
<td>Main content area within the modal.</td>
</tr>
<tr>
<td><code>$title</code></td>
<td>jQuery object</td>
<td>Title element within the modal.</td>
</tr>
<tr>
<td><code>$footer</code></td>
<td>jQuery object</td>
<td>Footer element within the modal.</td>
</tr>
<tr>
<td><code>visible</code></td>
<td>boolean</td>
<td>Whether the modal is currently being displayed.</td>
</tr>
<tr>
<td><code>data</code></td>
<td>object</td>
<td><a href="#Data_object">Data object</a> representing the modal's current content. If the modal isn't visible, this will be <code>null</code>.
</td>
</tr>
<tr>
<td><code>$element</code></td>
<td>jQuery object</td>
<td>Entire modal element.</td>
</tr>
<tr>
<td><code>$container</code></td>
<td>jQuery object</td>
<td>Parent element of the modal (used to dim background).</td>
</tr>
</tbody>
</table>

### Data object
<table style="width: 100%;">
<tbody><tr>
<th>Key
</th>
<th>Description
</th></tr>
<tr>
<td><code>content</code>
</td>
<td>A HTML string or jQuery object to be shown as content within the modal.
</td></tr>
<tr>
<td><code>title</code>
</td>
<td>Text-only string to be shown in the modal header.
</td></tr>
<tr>
<td><code>hook</code>
</td>
<td>Name of a hook to be fired using the <code><a target="_blank" rel="nofollow noreferrer noopener" class="external text" href="https://doc.wikimedia.org/mediawiki-core/master/js/#!/api/mw.hook">mw.hook</a></code> API. The <a href="#Modal_object">modal object</a> will be passed to the hook function. Note that it is fired <b>before</b> the modal is added to the DOM but <b>after</b> the <code>onBeforeShow</code> function is called.
</td></tr>
<tr>
<td><code>loading</code>
</td>
<td>If this value is <a target="_blank" rel="nofollow noreferrer noopener" class="external text" href="https://developer.mozilla.org/docs/Glossary/Truthy">truthy</a>, an SVG image will replace the modal's content, displaying a spinning animation.
</td></tr>
<tr>
<td><code>buttons</code></td>
<td>An array of <a href="#Button_object">button objects</a> to be added to the modal footer.</td>
</tr>
<tr>
<td><code>onBeforeShow</code></td>
<td>Function run whenever the modal object's <code>show</code> function is called. The <a href="#Modal_object">modal object</a> will be passed to the function. Note that it is run <b>before</b> the modal is added to the DOM and before any hook is fired.</td>
</tr>
<tr>
<td><code>onShow</code></td>
<td>Function run whenever the modal object's <code>show</code> function is called. The <a href="#Modal_object">modal object</a> will be passed to the function. Note that it is run <b>after</b> the modal is added to the DOM.</td>
</tr>
<tr>
<td><code>onHide</code></td>
<td>Function run whenever the modal object's <code>hide</code> function is called. The <a href="#Modal_object">modal object</a> will be passed to the function. Note that it is run <b>before</b> the modal is removed from the DOM. If this function returns <code>false</code>, the modal won't be hidden.</td>
</tr>
</tbody>
</table>

### Button object
<table style="width: 100%;">
<tbody>
<tr>
<th>Key</th>
<th>Description</th>
</tr>
<tr>
<td><code>text</code></td>
<td>Text to be displayed on the button.</td>
</tr>
<tr>
<td><code>href</code></td>
<td>URL to be navigated to whenever the button is clicked. Note this will change the button from a <code>&lt;span&gt;</code> element to an <code>&lt;a&gt;</code>nchor element.</td>
</tr>
<tr>
<td><code>handler</code></td>
<td>Function run whenever the button is clicked. The <a target="_blank" rel="nofollow noreferrer noopener" class="external text" href="https://api.jquery.com/category/events/event-object/">jQuery <code>click</code> event object</a> will be passed to the function.</td>
</tr>
<tr>
<td><code>condition</code></td>
<td>If this property is present and is a function, the function will be run.  The <a href="#Modal_object">modal object</a> will be passed to the function. The button will only be added to the modal footer if this function returns a <a target="_blank" rel="nofollow noreferrer noopener" class="external text" href="https://developer.mozilla.org/docs/Glossary/Truthy">truthy</a> value.</td>
</tr>
<tr>
<td><code>attr</code></td>
<td>Object consisting of attribute names and values to add to the button element. It is passed as-is to <a target="_blank" rel="nofollow noreferrer noopener" class="external text" href="https://api.jquery.com/attr/#attr2">jQuery's <code>attr</code> function</a> and can be used to add an ID, data attributes, etc.</td>
</tr>
</tbody>
</table>