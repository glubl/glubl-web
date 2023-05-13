import { Epoch } from "./epoch";
import { KEMPrivateKey } from "./hpke/base";
import { CipherSuite } from "./ciphersuite";
import { KeyPackage, Extension } from "./keypackage";
import { HPKECiphertext } from "./message";
import { SigningPrivateKey } from "./signatures";
import { Credential } from "./credential";
import * as tlspl from "./tlspl";
export declare class GroupInfo {
    readonly groupId: Uint8Array;
    readonly epoch: Epoch;
    readonly treeHash: Uint8Array;
    readonly confirmedTranscriptHash: Uint8Array;
    readonly extensions: Extension[];
    readonly confirmationTag: Uint8Array;
    readonly signerIndex: number;
    readonly unsignedEncoding: Uint8Array;
    readonly signature: Uint8Array;
    constructor(groupId: Uint8Array, epoch: Epoch, treeHash: Uint8Array, confirmedTranscriptHash: Uint8Array, extensions: Extension[], confirmationTag: Uint8Array, signerIndex: number, unsignedEncoding: Uint8Array, signature: Uint8Array);
    static create(groupId: Uint8Array, epoch: Epoch, treeHash: Uint8Array, confirmedTranscriptHash: Uint8Array, extensions: Extension[], confirmationTag: Uint8Array, signerIndex: number, signingKey: SigningPrivateKey): Promise<GroupInfo>;
    checkSignature(credential: Credential): Promise<boolean>;
    static decode(buffer: Uint8Array, offset: number): [GroupInfo, number];
    get encoder(): tlspl.Encoder;
}
export declare class GroupSecrets {
    readonly joinerSecret: Uint8Array;
    readonly pathSecret?: Uint8Array | undefined;
    constructor(joinerSecret: Uint8Array, pathSecret?: Uint8Array | undefined);
    static decode(buffer: Uint8Array, offset: number): [GroupSecrets, number];
    get encoder(): tlspl.Encoder;
}
export declare class EncryptedGroupSecrets {
    readonly keyPackageHash: Uint8Array;
    readonly encryptedGroupSecrets: HPKECiphertext;
    constructor(keyPackageHash: Uint8Array, encryptedGroupSecrets: HPKECiphertext);
    static decode(buffer: Uint8Array, offset: number): [EncryptedGroupSecrets, number];
    get encoder(): tlspl.Encoder;
}
export declare class Welcome {
    readonly cipherSuite: CipherSuite;
    readonly secrets: EncryptedGroupSecrets[];
    readonly encryptedGroupInfo: Uint8Array;
    constructor(cipherSuite: CipherSuite, secrets: EncryptedGroupSecrets[], encryptedGroupInfo: Uint8Array);
    static decode(buffer: Uint8Array, offset: number): [Welcome, number];
    get encoder(): tlspl.Encoder;
    static create(cipherSuite: CipherSuite, joinerSecret: Uint8Array, groupInfo: GroupInfo, recipients: {
        keyPackage: KeyPackage;
        pathSecret?: Uint8Array;
    }[]): Promise<Welcome>;
    static calculateWelcomeKey(cipherSuite: CipherSuite, joinerSecret: Uint8Array, psk: Uint8Array): Promise<[Uint8Array, Uint8Array]>;
    decrypt(keyPackages: Record<string, [KeyPackage, KEMPrivateKey]>): Promise<[GroupSecrets, GroupInfo, string]>;
}
