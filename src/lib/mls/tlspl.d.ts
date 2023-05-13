export interface Encoder {
    readonly length: number;
    writeToBuffer: ((buffer: Uint8Array, offset: number) => void);
}
export declare class Static implements Encoder {
    private readonly buffer;
    constructor(buffer: Uint8Array);
    get length(): number;
    writeToBuffer(buffer: Uint8Array, offset: number): void;
}
export declare const empty: Static;
export declare function uint8(num: number): Encoder;
export declare function uint16(num: number): Encoder;
export declare function uint24(num: number): Encoder;
export declare function uint32(num: number): Encoder;
export declare function uint64(num: number): Encoder;
export declare function opaque(src: Uint8Array): Encoder;
export declare function variableOpaque(src: Uint8Array, lengthBytes: number): Encoder;
export declare function struct(items: Encoder[]): Encoder;
export declare function vector(items: Encoder[], lengthBytes: number): Encoder;
export declare function encode(items: Encoder[]): Uint8Array;
type Decoder = ((buffer: Uint8Array, offset: number) => [any, number]);
export declare function decodeUint8(buffer: Uint8Array, offset: number): [number, number];
export declare function decodeUint16(buffer: Uint8Array, offset: number): [number, number];
export declare function decodeUint32(buffer: Uint8Array, offset: number): [number, number];
export declare function decodeUint64(buffer: Uint8Array, offset: number): [number, number];
export declare function decodeOpaque(length: number): Decoder;
export declare function decodeVariableOpaque(lengthBytes: number): Decoder;
export declare function decodeStruct(decoders: Decoder[]): Decoder;
export declare function decodeVector(decoder: Decoder, lengthBytes: number, numElems?: number): Decoder;
export declare function decodeOptional(decoder: Decoder): Decoder;
export declare function decode(decoders: Decoder[], buffer: Uint8Array, offset?: number): [any[], number];
export {};
