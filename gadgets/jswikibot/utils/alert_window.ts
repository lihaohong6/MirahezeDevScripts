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

export function openWindow(dialog: OO.ui.Dialog, data?: OO.ui.WindowManager.WindowOpeningData) {
    const windowManager = new OO.ui.WindowManager();
    $(document.body).append(windowManager.$element);
    windowManager.addWindows([dialog]);

    const opened = windowManager.openWindow(dialog, data);

    opened.closed.then(() => {
        windowManager.clearWindows();
        windowManager.$element.remove();
        windowManager.destroy();
    });
}
