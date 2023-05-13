/** Hash functions.  Also define MAC functions since MLS uses hash-based MACs
 */
export interface Hash {
    hash: (data: Uint8Array) => Promise<Uint8Array>;
    mac: (key: Uint8Array, data: Uint8Array) => Promise<Uint8Array>;
    verifyMac: (key: Uint8Array, data: Uint8Array, mac: Uint8Array) => Promise<boolean>;
}
export declare const sha256: Hash;
export declare const sha512: Hash;
