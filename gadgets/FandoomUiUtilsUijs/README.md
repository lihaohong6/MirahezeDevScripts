*This article uses material from the "[Ui-js](https://dev.fandom.com/wiki/UI-js)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

**FandoomUiUtilsUijs** is a JavaScript library providing a function for creating DOM elements. It can be used as a tool for building user interfaces in scripts.

## Usage
### Importing
To import the script through your own script, use:
```js
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsUijs/gadget-impl.js');
```

The script's function won't be immediately available, but it will call a hook through <code>mw.hook</code>. To ensure the builder function exists, you can use:
```js
mw.hook('dev.ui').add(function(ui) {
  // Use your code here
  // `ui` parameter is the builder function
  // It is also available in `window.dev.ui` at this point
});
```

### Function
UI-js exposes a single function used for creating DOM elements. It accepts a single parameter, an object with the following possible properties:
- <code>attr</code><br />Object containing all attributes of the element and their values.
- <code>checked</code><br />Used for to determine if a checkbox is checked.<br>If the element isn't a checkbox, setting this parameter does nothing.
- <code>children</code><br />Array of objects that represent configurations for child elements of the current element.<br>Any valid value that can be passed to the library function is a valid element of this array.
- <code>classes</code><br />If the element has multiple classes, this is a more useful property than setting the class through <code>attr</code>.<br>Additionally, some linters may throw warnings/errors as <code>class</code> is a reserved word and should not be used in property names for ES3 compatibility.
- <code>condition</code><br />If the element should be generated.<br>Used to simplify the logic when some elements should only display under certain conditions.
- <code>data</code><br />Object containing all data attributes of the element.<br>Technically the same as <code>attr</code> option but every attribute is prefixed with <code>data-</code>.
- <code>events</code><br />Object with all event listeners.<br>Keys of this object are [event](https://developer.mozilla.org/docs/Web/Events) names, values are functions used for handling these events.
- <code>html</code><br />Inner HTML of the element.<br>Should only be used in cases when HTML is not easily convertible to objects recognized by the script (for example, if HTML is downloaded from another source), otherwise, use script's functionality to generate needed DOM nodes.
- <code>parent</code><br />If the element should be appended to another already existent DOM element, it can be passed here as a string that represents the selector for it.
- <code>selected</code><br />Selected index of the element.<br>Used for <code>&lt;select></code> dropdowns.
- <code>style</code><br />Object with CSS properties of the element.<br>*This option isn't always working in the current version. Please submit bug reports for cases where this parameter doesn't work.*
- <code>text</code><br />Text content of the element.
- <code>type</code><br />Type of the element. For example, if you want to make a div element, it should be set to <code>div</code>.<br>If not set, it will create a [document fragment](https://developer.mozilla.org/docs/Web/API/DocumentFragment).

If a simple string is passed to the function, it will create a simple [text node](https://developer.mozilla.org/docs/Web/API/Text) with contents of the string.

## Examples
Examples below are using the <code>ui</code> function to generate DOM elements. Instructions on how to get that function can be seen in the "[Importing](#importing)" section and more information about its parameters is in "[Function](#function)" section.
<table style="width: 100%;">
<tbody>
<tr>
<th>Description</th>
<th>Code</th>
<th>Generates</th>
</tr>
<tr>
<td>Text node</td>
<td>

```js
ui("This is a text node");
```
</td>
<td><pre>This is a text node</pre>
</td>
</tr>
<tr>
<td>Div element</td>
<td>

```js
ui({type: 'div'});
```
</td>
<td>

```html
<div></div>
```
</td>
</tr>
<tr>
<td>With text</td>
<td>

```js
ui({
  text: 'This is a div with text',
  type: 'div'
});
```
</td>
<td>

```html
<div>This is a div with text</div>
```
</td>
</tr>
<tr>
<td>With a class and ID</td>
<td>

```js
ui({
  attr: {
    class: 'thisisatest',
    id: 'testdiv'
  },
  type: 'div'
});
```
</td>
<td>

```html
<div class="thisisatest" id="testdiv"></div>
```
</td>
</tr>
<tr>
<td>With red text
</td>
<td>

```js
ui({
  style: {
    color: 'red'
  },
  text: 'This is red text',
  type: 'div'
});
```
</td>
<td>

```html
<div style="color: red;">This is red text</div>
```
</td>
</tr>
<tr>
<td>With <code>data</code> attributes
</td>
<td>

```js
ui({
  data: {
    test: 'Test one',
    test2: 'Test two'
  },
  type: 'div'
});
```
</td>
<td>

```html
<div data-test="Test one" data-test2="Test two"></div>
```
</td>
</tr>
<tr>
<td>With event listener</td>
<td>

```js
ui({
  events: {
    click: function() {
      console.log('Test');
    }
  },
  text: 'Click on me!',
  type: 'div'
});
```
</td>
<td>

```html
<div>Click on me!</div>
```
Div logs "Test" into console when clicked on.
</td>
</tr>
<tr>
<td>With children spans
</td>
<td>

```js
ui({
  children: [
    {
      text: 'First span',
      type: 'span'
    },
    {
      text: 'Second span',
      type: 'span'
    }
  ],
  type: 'div'
});
```
</td>
<td>

```html
<div>
  <span>First span</span>
  <span>Second span</span>
</div>
```
</td>
</tr>
<tr>
<td>Appended to the body</td>
<td>

```js
ui({
  parent: 'body',
  text: 'Text',
  type: 'div'
});
```
</td>
<td>

```html
<div>Text</div>
```
Div is appended to the body upon creation.
</td>
</tr>
<tr>
<td>Only displayed to administrators</td>
<td>

```js
var ug = mw.config.get('wgUserGroups');
ui({
  condition: ug.indexOf('sysop') !== -1,
  text: 'Admin, you can see this!',
  type: 'div'
});
```
</td>
<td>

```html
<div>Admin, you can see this!</div>
```
Displayed only to administrators.
</td>
</tr>
<tr>
<td>With multiple classes
</td>
<td>

```js
ui({
  classes: [
    'wds-button',
    'wds-is-secondary'
  ],
  type: 'div'
});
```
</td>
<td>

```html
<div class="wds-button wds-is-secondary"></div>
```
</td>
</tr>
</tbody>
</table>