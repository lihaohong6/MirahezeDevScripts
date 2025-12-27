*This article uses material from the "[Modal](https://dev.fandom.com/wiki/Modal)" article on the Fandom Developers wiki at Fandom and is licensed under the Creative Commons Attribution-Share Alike License.*

**FandoomUiUtilsModal** library is a library for easier and faster creation and display of OOUI modals.

## Usage
### Importing
To import the Modal library inside your script, use:
```js
mw.loader.load('<CDN DOMAIN>/FandoomUiUtilsModal/gadget-impl.js');
mw.hook('dev.modal').add(function(modal) {
  var myNewModal = new modal({
    ...
  });
  // Alternatively, you can call window.dev.modal after the 'dev.modal' hook
  // has been properly concluded
});
```

### Exported object
The library exposes an object with several properties:
- <code>Modal</code><br />The main class of the library. Instantiating it registers the modal in the library.
- <code>ModalButton</code><br />Class for modal's buttons.
- <code>modals</code><br />Object with all registered modals.
- <code>_init</code><br />Function called before the hook is fired as a callback for when OOUI's modal component loads.
- <code>_modal</code><br />OOUI's modal component internally used by the library.

## Models
### <code>Modal</code>
Class representing the modal object.

#### Parameters
- <code>id</code><br />Unique ID of the modal. <b>This parameter is required.</b>
- <code>context</code><br />Object that modal events should be bound to.
- <code>size</code><br />Size of the modal. Accepted values are <code>small</code>, <code>medium</code>, <code>large</code> and <code>content-size</code>.
- <code>content</code><br /><p>Content of the modal.</p><p>If set to a string, it represents the HTML the modal contains.</p><p>If set to an object <b>while [UI-js](https://dev.fandom.com/wiki/UI-js) is imported</b> (UI-js must be imported before Modal, otherwise it won't work), it runs the object through the <code>dev.ui</code> function and sets the generated HTML as the modal's content.</p><p><b>Note:</b> DOM events set on the nodes through UI-js will get unregistered, as the library calls <code>.outerHTML</code> on the node.</p>
- <code>title</code><br />Title of the modal. By default set to "<i>Modal</i>". This is safe by default unless <code>isHTML</code> is set, in that case it must be escaped properly.
- <code>isHTML</code><br />Whether the title of the modal is passed as HTML.
- <code>buttons</code><br />Array of objects representing parameters to the <code>ModalButton</code> model.
- <code>events</code><br /><p>Map of event names to event listeners to register in the modal. These events can be called by modal buttons.</p><p>By default, OOUI's modal component registers a <code>close</code> event called when the close button is clicked.</p><p>Values of the events object can be single functions, which registers as the only event listeners, or arrays of functions, which registers them all as event listeners.</p>
- <code>class</code> / <code>classes</code><br />String or an array of strings representing the classes of the modal.
- <code>close</code><br />Function called upon closing the modal, which can return <code>false</code> if the modal should not continue closing.
- <code>closeEscape</code><br />Whether the modal should be closed when the <code>Esc</code> button is pressed. By default enabled, set to <code>false</code> to disable.
- <code>closeTitle</code><br />Title on the X button for closing the modal.

#### Properties
Here are the available properties of a Modal instance. Most of them are based on input parameters described above.
- <code>id</code>
- <code>context</code>
- <code>buttons</code>
- <code>classes</code>
- <code>closeFunc</code> — Callback after closing the modal.
- <code>closeEscape</code>
- <code>closeTitle</code>
- <code>content</code> — HTML of the modal as a string.
- <code>events</code> — Map of event names to arrays of callback functions when these events are fired.
- <code>size</code>
- <code>title</code>
- <code>titleIsHTML</code> — Whether the title is displayed unescaped.
- <code>_loading</code> — Internal promise object that is resolved at the time the modal's component is created.
- <code>_modal</code> — Internal modal object returned by the modal factory.

#### Methods
Here are the available methods of a Modal instance. Most of them as used as setters for properties mentioned above. Each of these methods returns a self instance so they can be easily chained together.
- <code>create()</code> — Starts the creation of the modal component and returns a promise that resolves when the creation is done.
- <code>show()</code> — Shows the modal. If its creation hasn't finished yet, it will wait until the creation and then show the modal.
- <code>close()</code> / <code>hide()</code> — Closes the modal.
- <code>enableActionButtons(opts)</code> — Enable the specified action buttons. You can either pass the button element ID as an argument or a Javascript object containing various properties (`opts.actions`, `opts.flags`) to filter the loaded action buttons.
- <code>disableActionButtons(opts)</code> — Disable the specified action buttons.
- <code>toggleActionButtons(opts)</code> — Toggle the disabled status of the specified action buttons.
- <code>setButtons(buttons)</code>
- <code>setClass(class)</code>
- <code>setClasses(classes)</code>
- <code>setClose(close)</code>
- <code>setCloseEscape(closeEscape)</code>
- <code>setCloseTitle(title)</code>
- <code>setContent(content)</code>
- <code>setEvent(name, listener)</code>
- <code>setEvents(events)</code> — <b>Note:</b> This resets all other events of the modal.
- <code>setSize(size)</code>
- <code>setTitle(title, isHTML)</code>
- <code>_close()</code> — Internal callback after a close event has been triggered. Starts recreation of the modal.
- <code>_created(modal)</code> — Internal callback after the modal component has been created.

### <code>ModalButton</code>
Class representing a button in the modal's footer.

#### Parameters
<!--
`type=link` does not work
- <code>type</code><br />Type of the button. Set to <code>button</code> by default. Can be set to either:
 - <code>link</code>
 - <code>input</code>
 - <code>button</code>
-->
- <code>primary</code><br />Whether the button is a primary one or not. Adds a <code>primary</code> class to the button.
- <code>normal</code><br />Adds a <code>normal</code> class to the button.
- <code>text</code> / <code>value</code><br />Text on the button. <b>This parameter is required.</b>
- <code>events</code> / <code>event</code><br />Array of events the button is triggering, or a string if it's triggering a single event.
- <code>classes</code><br />Array of classes, in addition to the <code>primary</code> and <code>normal</code> ones.
- <code>id</code><br />ID of the button.
- <code>disabled</code><br />Whether the button is disabled.
- <code>sprite</code> / <code>imageClass</code><br />Sprite class added to the button. Available sprite classes may be obtained from [the list of OOUI icons](https://doc.wikimedia.org/oojs-ui/master/demos/?page=icons&theme=wikimediaui&direction=ltr&platform=desktop).

> e.g. For example, `sprite: 'edit'` will load the [Edit icon](https://doc.wikimedia.org/oojs-ui/master/demos/dist/themes/wikimediaui/images/icons/edit.svg) on the respective modal button. [Note that you need to also load the respective OOUI icon styles through ResourceLoader](https://www.mediawiki.org/wiki/OOUI/Widgets/Icons,_Indicators,_and_Labels#Icons:~:text=You%20need%20to%20load%20related%20styles%20somewhere%20before%20creating%20IconWidget%2C%20e.g.%20via%20ResourceLoader.%20Modules%20named%20by%20mask%20oojs%2Dui.styles.icons%2D*%2C%20e.g.%20oojs%2Dui.styles.icons%2Dinteractions%20for%20check%20icon.). In this example, the Edit icon is a part of `editing-core`, so the module `oojs-ui.styles.icons-editing-core` also needs to be loaded. Refer to [the official list of OOUI icons](https://doc.wikimedia.org/oojs-ui/master/demos/?page=icons&theme=wikimediaui&direction=ltr&platform=desktop) for these group names.

<!--
`type=link` does not work
- <code>href</code><br />Location the button is linking to if <code>type</code> is set to <code>link</code>.
- <code>title</code><br />Title of the link, if <code>type</code> is set to <code>link</code>.
- <code>target</code><br />Target of the link, if <code>type</code> is set to <code>link</code>.
-->

#### Properties
Available properties of the button object. Their purpose is described in the parameters.
- <code>primary</code>
- <code>normal</code>
- <code>classes</code>
- <code>disabled</code>
- <code>events</code>
- <code>id</code>
- <code>name</code>
- <code>text</code>
- <code>sprite</code>
<!--
`type=link` does not work
- <code>type</code>
- <code>href</code>
- <code>target</code>
- <code>title</code>
-->

#### Methods
Available methods of the button object. Most of these are setters for the properties described above.
- <code>create</code> — Returns required Mustache parameters for rendering the modal button.
- <code>setClasses</code>
- <code>setDisabled</code>
- <code>setEvents</code> / <code>setEvent</code>
- <code>setID</code>
- <code>setName</code>
- <code>setText</code>
- <code>setSprite</code>
<!--
`type=link` does not work
- <code>setType</code>
- <code>setHref</code>
- <code>setTarget</code>
- <code>setTitle</code>
-->

## Examples
As the documentation above might be confusing, here are a few examples with demonstrations. Wrappers mentioned in the [Usage](#usage) section won't be used.

### Simple modal
This example simply creates a small modal with the default title, ID of <code>SimpleModal</code> and "Hello World!" as contents.
```js
var modal = new window.dev.modal.Modal({
  content: 'Hello World!',
  id: 'SimpleModal',
  size: 'small'
});
modal.create();
modal.show();
```

### Medium-sized modal
This example creates a medium-sized modal with the title of "*Medium sized modal*" and ID of <code>MediumModal</code>.
```js
var modal = new window.dev.modal.Modal({
  content: 'This is a medium-sized modal.',
  id: 'MediumModal',
  size: 'medium',
  title: 'Medium-sized modal'
});
modal.create();
modal.show();
```

### UI-js modal
This example creates a modal with contents being generated by UI-js and sized the same as the page content.
```js
var modal = new window.dev.modal.Modal({
  content: {
    children: [
      'This modal uses UI-js to generate the content and it\'s the same size as the content.',
      {
        attr: {
          alt: 'Fandom logo',
          title: 'Fandom logo',
          src: 'https://vignette.wikia.nocookie.net/central/images/8/8f/FANDOM-logo.svg/revision/latest/scale-to-width-down/300'
        },
        type: 'img'
      }
    ],
    type: 'div'
  },
  id: 'UIModal',
  size: 'content-size'
});
modal.create();
modal.show();
```

### Buttons modal
This example creates a modal with various kinds of buttons. One is disabled, one is primary, one is an input element and one is a link.
```js
var modal = new window.dev.modal.Modal({
  buttons: [
    {
      classes: ['my-custom-class'],
      event: 'custom1',
      id: 'my-custom-id',
      primary: true,
      text: 'Primary button'
    },
    {
      disabled: true,
      text: 'Disabled button',
      event: 'custom2'
    },
    {
      event: 'custom3',
      sprite: 'edit',
      text: ' '
    }
  ],
  content: 'This modal has buttons!',
  events: {
    custom1: function() {
      mw.notify('Custom event 1!');
    },
    custom2: function() {
      mw.notify('Custom event 2! (THIS SHOULD NOT HAPPEN!)', { type: 'error' });
    },
    custom3: function() {
      mw.notify('Custom event 3!', { type: 'success' });
    }
  },
  id: 'ButtonsModal'
});
modal.create();
modal.show();
```