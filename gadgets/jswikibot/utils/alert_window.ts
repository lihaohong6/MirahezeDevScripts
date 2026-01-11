export interface WindowResult<T> {
    action: string;
    data: T;
}

export function simpleAlert(title: string, message: string) {
    const messageDialog = new OO.ui.MessageDialog();
    openWindow(messageDialog, {
        title: title,
        message: message,
        actions: [
            {action: 'ok', label: 'OK', flags: ['primary', 'safe']}
        ]
    });
}

export function openWindow<T>(dialog: OO.ui.Dialog,
                           data?: OO.ui.WindowManager.WindowOpeningData,
                           closureCallback: (data: T) => void = () => {}) {
    const windowManager = new OO.ui.WindowManager({classes: ['jswikibot-window']});
    $(document.body).append(windowManager.$element);
    windowManager.addWindows([dialog]);

    const opened = windowManager.openWindow(dialog, data);

    // eslint-disable-next-line
    opened.closed.then((result: any) => {
        windowManager.$element.remove();
        windowManager.destroy();
        closureCallback(result as T);
    });
}
