export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export type PathSegment = string | number;

/**
 * Parses a dot-separated path such as "characters.[0].hp" into segments,
 * converting purely numeric segments to numbers (array indices).
 * @param path
 */
export function parsePath( path: string ): PathSegment[] {
    return path.split( '.' ).map( ( segment ) => {
        return /^\[\d+]$/.test( segment ) ? Number( segment.substring( 1, segment.length - 1 ) ) : segment;
    } );
}

/**
 * Looks up a value at the given path within obj. Returns undefined if any
 * segment along the path does not exist.
 */
export function getByPath( obj: unknown, path: PathSegment[] ): unknown {
    let current: unknown = obj;
    for ( const segment of path ) {
        if ( current === null || typeof current !== 'object' ) {
            return undefined;
        }
        current = ( current as Record<PathSegment, unknown> )[ segment ];
    }
    return current;
}

/**
 * Sets a value at the given path within obj, mutating it in place.
 * All segments except the last are assumed to already exist.
 */
export function setByPath( obj: unknown, path: PathSegment[], value: unknown ): void {
    const parentPath = path.slice( 0, -1 );
    const lastSegment = path[ path.length - 1 ];
    const parent = getByPath( obj, parentPath );
    if ( parent === null || typeof parent !== 'object' ) {
        throw new Error( `Cannot set value: path does not exist` );
    }
    ( parent as Record<PathSegment, unknown> )[ lastSegment ] = value;
}
