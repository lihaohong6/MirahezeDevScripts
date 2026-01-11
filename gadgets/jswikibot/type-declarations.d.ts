declare namespace OO.ui {
    export interface ProcessDialog {
        $body: JQuery;
        $foot: JQuery;
        actions: ActionSet;
    }
}

declare namespace mw.widgets {
    namespace datetime {
        class DateTimeInputWidget extends OO.ui.InputWidget {

        }
    }
    class TitleInputWidget extends OO.ui.TextInputWidget {
        constructor(options: OO.ui.TextInputWidget.ConfigOptions & {suggestions: boolean})
    }
}
