/** Each user has a key package per room, which has the user's credential and an
 * HPKE public key that can be used to encrypt data for that user.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#key-packages
 */
import { ExtensionType, ProtocolVersion } from "./constants";
import { CipherSuite } from "./ciphersuite";
import { Credential } from "./credential";
import { SigningPrivateKey } from "./signatures";
import { KEMPublicKey } from "./hpke/base";
import * as tlspl from "./tlspl";
export declare abstract class Extension {
    readonly extensionType: ExtensionType;
    constructor(extensionType: ExtensionType);
    abstract get extensionData(): Uint8Array;
    static decode(buffer: Uint8Array, offset: number): [Extension, number];
    get encoder(): tlspl.Encoder;
}
export declare class Capabilities extends Extension {
    readonly versions: ProtocolVersion[];
    readonly ciphersuites: number[];
    readonly extensions: ExtensionType[];
    constructor(versions: ProtocolVersion[], ciphersuites: number[], extensions: ExtensionType[]);
    get extensionData(): Uint8Array;
    static decode(buffer: Uint8Array, offset?: number): [Capabilities, number];
}
export declare class ParentHash extends Extension {
    readonly parentHash: Uint8Array;
    constructor(parentHash: Uint8Array);
    get extensionData(): Uint8Array;
    static decode(buffer: Uint8Array, offset?: number): [ParentHash, number];
}
export declare class ParentNode {
    readonly publicKey: Uint8Array;
    readonly unmergedLeaves: number[];
    readonly parentHash: Uint8Array;
    private hpkeKey;
    constructor(publicKey: Uint8Array, unmergedLeaves: number[], parentHash: Uint8Array);
    getHpkeKey(cipherSuite: CipherSuite): Promise<KEMPublicKey>;
    static decode(buffer: Uint8Array, offset: number): [ParentNode, number];
    get encoder(): tlspl.Encoder;
}
export declare class RatchetTree extends Extension {
    readonly nodes: Array<KeyPackage | ParentNode | undefined>;
    constructor(nodes: Array<KeyPackage | ParentNode | undefined>);
    get extensionData(): Uint8Array;
    static decode(buffer: Uint8Array, offset?: number): [RatchetTree, number];
}
export declare class Generation extends Extension {
    readonly generation: number;
    constructor(generation: number);
    get extensionData(): Uint8Array;
    static decode(buffer: Uint8Array, offset?: number): [Generation, number];
}
export declare class KeyPackage {
    readonly version: ProtocolVersion;
    readonly cipherSuite: CipherSuite;
    readonly hpkeInitKey: Uint8Array;
    readonly credential: Credential;
    readonly extensions: Extension[];
    unsignedEncoding: Uint8Array;
    signature: Uint8Array;
    readonly signingKey?: SigningPrivateKey;
    private hpkeKey;
    private hashCache;
    constructor(version: ProtocolVersion, cipherSuite: CipherSuite, hpkeInitKey: Uint8Array, credential: Credential, extensions: Extension[], unsignedEncoding: Uint8Array, signature: Uint8Array, signingKey?: SigningPrivateKey);
    static create(version: ProtocolVersion, cipherSuite: CipherSuite, hpkeInitKey: Uint8Array, credential: Credential, extensions: Extension[], signingKey: SigningPrivateKey): Promise<KeyPackage>;
    checkSignature(): Promise<boolean>;
    getHpkeKey(): Promise<KEMPublicKey>;
    addExtension(extension: Extension): Promise<void>;
    hash(): Promise<Uint8Array>;
    static decode(buffer: Uint8Array, offset: number): [KeyPackage, number];
    get encoder(): tlspl.Encoder;
}
