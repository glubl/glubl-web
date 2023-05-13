import { CipherSuite } from "./ciphersuite";
import { GroupContext } from "./group";
export declare function expandWithLabel(cipherSuite: CipherSuite, secret: Uint8Array, label: Uint8Array, context: Uint8Array, length: number): Promise<Uint8Array>;
export declare function deriveSecret(cipherSuite: CipherSuite, secret: Uint8Array, label: Uint8Array): Promise<Uint8Array>;
export interface Secrets {
    joinerSecret: Uint8Array;
    memberSecret: Uint8Array;
    welcomeSecret: Uint8Array;
    senderDataSecret: Uint8Array;
    encryptionSecret: Uint8Array;
    exporterSecret: Uint8Array;
    authenticationSecret: Uint8Array;
    externalSecret: Uint8Array;
    confirmationKey: Uint8Array;
    membershipKey: Uint8Array;
    resumptionSecret: Uint8Array;
    initSecret: Uint8Array;
}
export declare function generateSecrets(cipherSuite: CipherSuite, initSecret: Uint8Array, commitSecret: Uint8Array, groupContext: GroupContext, psk?: Uint8Array | undefined): Promise<Secrets>;
export declare function generateSecretsFromJoinerSecret(cipherSuite: CipherSuite, joinerSecret: Uint8Array, commitSecret: Uint8Array, groupContext: GroupContext, psk?: Uint8Array | undefined): Promise<Secrets>;
export declare class SecretTree {
    readonly cipherSuite: CipherSuite;
    readonly treeSize: number;
    private keyTree;
    constructor(cipherSuite: CipherSuite, encryptionSecret: Uint8Array, treeSize: number);
    private deriveChildSecrets;
    getRatchetsForLeaf(leafNum: number): Promise<[HashRatchet, HashRatchet]>;
}
export declare class HashRatchet {
    readonly cipherSuite: CipherSuite;
    readonly nodeNum: number;
    private secret;
    generation: any;
    private savedKeys;
    constructor(cipherSuite: CipherSuite, nodeNum: number, secret: Uint8Array);
    getKey(generation: number): Promise<[Uint8Array, Uint8Array]>;
    private advance;
}
/** Like HashRatchet, but allows you to re-derive keys that were already
 * fetched.  Using this function will void your warranty.
 */
export declare class LenientHashRatchet extends HashRatchet {
    private origSecret;
    constructor(cipherSuite: CipherSuite, nodeNum: number, secret: Uint8Array);
    getKey(generation: number): Promise<[Uint8Array, Uint8Array]>;
}
