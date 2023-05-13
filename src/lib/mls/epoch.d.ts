import * as tlspl from "./tlspl";
/** Abstract out the epoch type.
 */
export type Epoch = number;
export declare function eqEpoch(e1: Epoch, e2: Epoch): boolean;
export declare const encodeEpoch: typeof tlspl.uint64;
export declare const decodeEpoch: typeof tlspl.decodeUint64;
