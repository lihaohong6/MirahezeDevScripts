/*
Returned by MediaWiki's query API
 */
export class PageProps {
    constructor(public readonly title: string,
                public pageid?: number,
                public ns?: number) {
    }
}

export class PageInfo extends PageProps {
    text?: string;
    categories: string[] = [];
    fileUrl?: string;

    constructor(props: PageProps) {
        super(props.title, props.pageid, props.ns);
    }

    titleWithoutNs() {
        if (Number.isInteger(this.ns) && this.ns !== 0) {
            return this.title.split(":").splice(1).join(":");
        }
        return this.title;
    }
}