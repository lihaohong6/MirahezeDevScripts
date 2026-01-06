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

    constructor(props: PageProps) {
        super(props.title, props.pageid, props.ns);
    }
}