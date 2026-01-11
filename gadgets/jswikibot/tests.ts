import {ALL_SEVERITIES, ProgressWindow} from "./utils/progress_window";

export async function testProgressWindow() {
    let cancelled = false;
    const window = new ProgressWindow(10000, () => {cancelled = true;});
    for (let i = 0; i < 10000; i++) {
        if (cancelled) {
            break;
        }
        window.addLog(ALL_SEVERITIES[i % 4], "Test");
        window.makeProgress(1);
    }
}