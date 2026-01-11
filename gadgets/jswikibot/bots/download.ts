import {Bot, BotConfigurationDialog} from "./bot";
import {LogSeverity} from "../utils/progress_window";
import {PageInfo} from "../models/page";
import {InputType} from "../utils/input_dialog";
import {simpleAlert} from "../utils/alert_window";
import {fetchFileUrl} from "../utils/page_info_fetcher";
import {API} from "../utils/mw_api";

interface DownloadOptions {
    pages: string[];
    downloadThrottle: number;
}

async function downloadFile(url: string, title: string): Promise<boolean> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
            return false;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = title;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);

        return true;
    } catch (err) {
        console.error('Download failed', err);
        return false;
    }
}


export const downloadBot: Bot<DownloadOptions> = new Bot({
    name: "DownloadBot",
    description: "Download files from the wiki in bulk",
    batchSize: 1,
    preprocessPages: (pages) => {
        return fetchFileUrl(pages);
    },
    processBatch: async (pages: PageInfo[], options) => {
        const page = pages[0];
        
        const url = page.fileUrl;
        if (!url || url === "") {
            return {
                severity: LogSeverity.ERROR,
                message: `Page ${page.title} does not have a valid url. Are you sure it's a valid file page?`
            };
        }

        await API.throttle('download', options.downloadThrottle);
        const success = await downloadFile(url, page.titleWithoutNs());

        if (success) {
            return {
                severity: LogSeverity.SUCCESS,
                message: `${page.title} downloaded`
            };
        } else {
            return {
                severity: LogSeverity.ERROR,
                message: `Failed to download ${page.title}`
            };
        }
    },
    createConfigDialog: () => new BotConfigurationDialog({
        inputOptions: [
            {
                key: "downloadThrottle",
                label: "Download throttle (seconds)",
                type: InputType.NUMBER,
                defaultValue: 1,
                min: 0,
                help: "Time to wait between downloads to avoid overloading the server"
            }
        ],
        validator: (data: DownloadOptions) => {
            if (data.downloadThrottle < 0) {
                simpleAlert("Invalid input", "Download throttle must be non-negative");
                return false;
            }
            return true;
        }
    })
});
