/** Message encodings
 */
import { HPKE, KEMPublicKey, KEMPrivateKey } from "./hpke/base";
import { Epoch } from "./epoch";
import { ContentType, SenderType, ProposalType, ProposalOrRefType } from "./constants";
import { KeyPackage } from "./keypackage";
import { SigningPublicKey, SigningPrivateKey } from "./signatures";
import { CipherSuite } from "./ciphersuite";
import { HashRatchet } from "./keyschedule";
import { GroupContext } from "./group";
import * as tlspl from "./tlspl";
export declare class HPKECiphertext {
    readonly kemOutput: Uint8Array;
    readonly ciphertext: Uint8Array;
    constructor(kemOutput: Uint8Array, ciphertext: Uint8Array);
    static encrypt(hpke: HPKE, pkR: KEMPublicKey, aad: Uint8Array, pt: Uint8Array): Promise<HPKECiphertext>;
    decrypt(hpke: HPKE, skR: KEMPrivateKey, aad: Uint8Array): Promise<Uint8Array>;
    static decode(buffer: Uint8Array, offset: number): [HPKECiphertext, number];
    get encoder(): tlspl.Encoder;
}
export declare class UpdatePathNode {
    readonly publicKey: Uint8Array;
    readonly encryptedPathSecret: HPKECiphertext[];
    constructor(publicKey: Uint8Array, // encoding of the node's KEMPublicKey
    encryptedPathSecret: HPKECiphertext[]);
    static decode(buffer: Uint8Array, offset: number): [UpdatePathNode, number];
    get encoder(): tlspl.Encoder;
}
export declare class UpdatePath {
    readonly leafKeyPackage: KeyPackage;
    readonly nodes: UpdatePathNode[];
    constructor(leafKeyPackage: KeyPackage, nodes: UpdatePathNode[]);
    static decode(buffer: Uint8Array, offset: number): [UpdatePath, number];
    get encoder(): tlspl.Encoder;
}
export declare class Sender {
    readonly senderType: SenderType;
    readonly sender: number;
    constructor(senderType: SenderType, sender: number);
    static decode(buffer: Uint8Array, offset: number): [Sender, number];
    get encoder(): tlspl.Encoder;
}
export declare class MLSPlaintext {
    readonly groupId: Uint8Array;
    readonly epoch: Epoch;
    readonly sender: Sender;
    readonly authenticatedData: Uint8Array;
    readonly content: Uint8Array | Proposal | Commit;
    readonly signature: Uint8Array;
    confirmationTag?: Uint8Array;
    membershipTag?: Uint8Array;
    readonly contentType: ContentType;
    constructor(groupId: Uint8Array, epoch: Epoch, sender: Sender, authenticatedData: Uint8Array, content: Uint8Array | Proposal | Commit, signature: Uint8Array, confirmationTag?: Uint8Array, membershipTag?: Uint8Array);
    static getContentType(content: Uint8Array | Proposal | Commit): ContentType.Application | ContentType.Proposal | ContentType.Commit;
    static getContentDecode(contentType: ContentType): (buffer: Uint8Array, offset: number) => [any, number];
    static create(cipherSuite: CipherSuite, groupId: Uint8Array, epoch: Epoch, sender: Sender, authenticatedData: Uint8Array, content: Uint8Array | Proposal | Commit, signingKey: SigningPrivateKey, context?: GroupContext | undefined): Promise<MLSPlaintext>;
    calculateTags(cipherSuite: CipherSuite, confirmationKey: Uint8Array | undefined, membershipKey: Uint8Array, context: GroupContext): Promise<void>;
    verify(cipherSuite: CipherSuite, signingPubKey: SigningPublicKey, context?: GroupContext, membershipKey?: Uint8Array): Promise<boolean>;
    verifyConfirmationTag(cipherSuite: CipherSuite, confirmationKey: Uint8Array | undefined, context: GroupContext): Promise<boolean>;
    static decode(buffer: Uint8Array, offset: number): [MLSPlaintext, number];
    get encoder(): tlspl.Encoder;
    get commitContentEncoder(): tlspl.Encoder;
}
export declare class MLSCiphertext {
    readonly groupId: Uint8Array;
    readonly epoch: Epoch;
    readonly contentType: ContentType;
    readonly authenticatedData: Uint8Array;
    readonly encryptedSenderData: Uint8Array;
    readonly ciphertext: Uint8Array;
    constructor(groupId: Uint8Array, epoch: Epoch, contentType: ContentType, authenticatedData: Uint8Array, encryptedSenderData: Uint8Array, ciphertext: Uint8Array);
    static create(cipherSuite: CipherSuite, plaintext: MLSPlaintext, contentRatchet: HashRatchet, senderDataSecret: Uint8Array): Promise<MLSCiphertext>;
    decrypt(cipherSuite: CipherSuite, getContentRatchet: (number: any) => Promise<HashRatchet> | HashRatchet, senderDataSecret: Uint8Array): Promise<MLSPlaintext>;
    static decode(buffer: Uint8Array, offset: number): [MLSCiphertext, number];
    get encoder(): tlspl.Encoder;
}
export declare abstract class Proposal {
    readonly msgType: ProposalType;
    constructor(msgType: ProposalType);
    static decode(buffer: Uint8Array, offset: number): [Proposal, number];
    abstract get encoder(): tlspl.Encoder;
    getHash(cipherSuite: CipherSuite): Promise<Uint8Array>;
}
export declare class Add extends Proposal {
    readonly keyPackage: KeyPackage;
    constructor(keyPackage: KeyPackage);
    static decode(buffer: Uint8Array, offset: number): [Add, number];
    get encoder(): tlspl.Encoder;
}
export declare class Update extends Proposal {
    readonly keyPackage: KeyPackage;
    readonly privateKey?: KEMPrivateKey;
    constructor(keyPackage: KeyPackage, privateKey?: KEMPrivateKey);
    static decode(buffer: Uint8Array, offset: number): [Add, number];
    get encoder(): tlspl.Encoder;
}
export declare class Remove extends Proposal {
    readonly removed: number;
    constructor(removed: number);
    static decode(buffer: Uint8Array, offset: number): [Remove, number];
    get encoder(): tlspl.Encoder;
}
export declare abstract class ProposalOrRef {
    readonly proposalOrRef: ProposalOrRefType;
    constructor(proposalOrRef: ProposalOrRefType);
    static decode(buffer: Uint8Array, offset: number): [ProposalOrRef, number];
    abstract get encoder(): tlspl.Encoder;
}
export declare class ProposalWrapper extends ProposalOrRef {
    readonly proposal: Proposal;
    constructor(proposal: Proposal);
    static decode(buffer: Uint8Array, offset: number): [ProposalWrapper, number];
    get encoder(): tlspl.Encoder;
}
export declare class Reference extends ProposalOrRef {
    readonly hash: Uint8Array;
    constructor(hash: Uint8Array);
    static decode(buffer: Uint8Array, offset: number): [Reference, number];
    get encoder(): tlspl.Encoder;
}
export declare class Commit {
    readonly proposals: ProposalOrRef[];
    readonly updatePath?: UpdatePath | undefined;
    constructor(proposals: ProposalOrRef[], updatePath?: UpdatePath | undefined);
    static decode(buffer: Uint8Array, offset: number): [Commit, number];
    get encoder(): tlspl.Encoder;
}
