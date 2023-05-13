export declare function concatUint8Array(arrays: Uint8Array[]): Uint8Array;
export declare function eqUint8Array(a: Uint8Array, b: Uint8Array): boolean;
export declare function geUint8Array(a: Uint8Array, b: Uint8Array): boolean;
export declare function stringToUint8Array(str: string): Uint8Array;
export declare function hexToUint8Array(str: string): Uint8Array;
export declare class Uint8ArrayMap<T> {
    private map;
    private keyMap;
    constructor(iterable?: Iterable<[Uint8Array, T]>);
    get size(): number;
    clear(): void;
    delete(key: Uint8Array): void;
    entries(): Iterable<[Uint8Array, T]>;
    forEach(f: (val: T, key: Uint8Array, map: any) => any, thisarg?: any): void;
    get(key: Uint8Array): T | undefined;
    has(key: Uint8Array): boolean;
    keys(): Iterable<Uint8Array>;
    set(key: Uint8Array, value: T): void;
    values(): Iterable<T>;
    [Symbol.iterator](): Uint8ArrayMapIterator<T>;
}
declare class Uint8ArrayMapIterator<T> implements Iterator<[Uint8Array, T]> {
    private map;
    private keyIterator;
    constructor(map: Uint8ArrayMap<T>);
    next(): IteratorResult<[Uint8Array, T]>;
}
export {};
