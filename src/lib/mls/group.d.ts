import { HashRatchet, Secrets, SecretTree } from "./keyschedule";
import { Epoch } from "./epoch";
import { RatchetTreeView } from "./ratchettree";
import { Extension, KeyPackage } from "./keypackage";
import { CipherSuite } from "./ciphersuite";
import { KEMPrivateKey } from "./hpke/base";
import { SigningPrivateKey } from "./signatures";
import { MLSPlaintext, MLSCiphertext, Add, Remove, ProposalWrapper } from "./message";
import { Uint8ArrayMap } from "./util";
import { ProtocolVersion } from "./constants";
import { Credential } from "./credential";
import { Welcome } from "./welcome";
import * as tlspl from "./tlspl";
export interface GroupState {
    leafNum: number;
    confirmedTranscriptHash: Uint8Array;
    interimTranscriptHash: Uint8Array;
    ratchetTreeView: RatchetTreeView;
    secrets: Secrets;
    secretTree: SecretTree;
    hashRatchets: Record<number, [HashRatchet, HashRatchet]>;
}
export declare class Group {
    readonly version: ProtocolVersion;
    readonly cipherSuite: CipherSuite;
    readonly groupId: Uint8Array;
    readonly extensions: Extension[];
    states: Map<string, GroupState>;
    extremities: Map<string, [Epoch, Uint8Array]>;
    constructor(version: ProtocolVersion, cipherSuite: CipherSuite, groupId: Uint8Array, epoch: Epoch, sender: Uint8Array, extensions: Extension[], confirmedTranscriptHash: Uint8Array, interimTranscriptHash: Uint8Array, ratchetTreeView: RatchetTreeView, secrets: Secrets, secretTree: SecretTree);
    getState(epoch: number, sender: Uint8Array): GroupState;
    /** Create a brand new group.
     */
    static createNew(version: ProtocolVersion, cipherSuite: CipherSuite, groupId: Uint8Array, credential: Credential, signingPrivateKey: SigningPrivateKey, otherMembers: KeyPackage[]): Promise<[Group, MLSPlaintext, Welcome]>;
    static createFromWelcome(welcome: Welcome, keyPackages: Record<string, [KeyPackage, KEMPrivateKey]>): Promise<[string, Group]>;
    needsMerge(): boolean;
    prepareCommit(): [Epoch, Uint8Array, (Add | Remove)[], [Epoch, Uint8Array][], boolean, Uint8ArrayMap<number>, Uint8ArrayMap<KeyPackage>];
    commit(proposals: ProposalWrapper[], credential: Credential, signingPrivateKey: SigningPrivateKey, baseEpoch: Epoch, baseSender: Uint8Array, updatePathRequired?: boolean): Promise<[MLSCiphertext, MLSPlaintext, Welcome, number[]]>;
    applyCommit(plaintext: MLSPlaintext, oldSender: Uint8Array, resolves: [Epoch, Uint8Array][]): Promise<number[]>;
    addGroupStates(group: Group, resolves: [Epoch, Uint8Array][]): void;
    encrypt(data: Uint8Array, authenticatedData: Uint8Array, signingKey: SigningPrivateKey): Promise<[MLSCiphertext, Epoch, Uint8Array]>;
    encryptMlsPlaintext(mlsPlaintext: MLSPlaintext, epoch?: Epoch, sender?: Uint8Array): Promise<[MLSCiphertext, Uint8Array]>;
    decrypt(mlsCiphertext: MLSCiphertext, epochSender: Uint8Array): Promise<MLSPlaintext>;
}
export declare class GroupContext {
    readonly groupId: Uint8Array;
    readonly epoch: Epoch;
    readonly treeHash: Uint8Array;
    readonly confirmedTranscriptHash: Uint8Array;
    readonly extensions: Extension[];
    constructor(groupId: Uint8Array, epoch: Epoch, treeHash: Uint8Array, confirmedTranscriptHash: Uint8Array, extensions: Extension[]);
    static decode(buffer: Uint8Array, offset: number): [GroupContext, number];
    get encoder(): tlspl.Encoder;
}
export declare function calculateConfirmedTranscriptHash(cipherSuite: CipherSuite, plaintext: MLSPlaintext, interimTranscriptHash: Uint8Array): Promise<Uint8Array>;
export declare function calculateInterimTranscriptHash(cipherSuite: CipherSuite, plaintext: {
    confirmationTag?: Uint8Array;
}, confirmedTranscriptHash: Uint8Array): Promise<Uint8Array>;
