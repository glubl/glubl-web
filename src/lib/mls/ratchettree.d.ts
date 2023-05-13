import { Uint8ArrayMap } from "./util";
import { Tree } from "./lbbtree";
import { RatchetTree, KeyPackage } from "./keypackage";
import { KEMPrivateKey, KEMPublicKey } from "./hpke/base";
// import { CipherSuite } from "./ciphersuite";
/// <reference path="./ciphersuite.ts" />.

import { Credential } from "./credential";
import { UpdatePath, Proposal } from "./message";
import { GroupContext } from "./group";
/** The ratchet tree allows group members to efficiently update the group secrets.
 */
export declare class NodeData {
    privateKey: KEMPrivateKey | undefined;
    publicKey: KEMPublicKey | undefined;
    unmergedLeaves: number[];
    credential: Credential | undefined;
    parentHash: Uint8Array | undefined;
    leafNum?: number | undefined;
    generation: number;
    constructor(privateKey: KEMPrivateKey | undefined, publicKey: KEMPublicKey | undefined, unmergedLeaves: number[], credential: Credential | undefined, parentHash: Uint8Array | undefined, leafNum?: number | undefined, generation?: number);
}
type MakeKeyPackage = (pubKey: Uint8Array) => Promise<KeyPackage>;
export declare class RatchetTreeView {
    readonly cipherSuite: CipherSuite;
    readonly leafNum: number;
    readonly tree: Tree<NodeData>;
    readonly keyPackages: (KeyPackage | undefined)[];
    readonly idToLeafNum: Uint8ArrayMap<number>;
    readonly emptyLeaves: number[];
    readonly nodeHashes: Record<number, Uint8Array>;
    constructor(cipherSuite: CipherSuite, leafNum: number, tree: Tree<NodeData>, keyPackages: (KeyPackage | undefined)[], idToLeafNum?: Uint8ArrayMap<number>, emptyLeaves?: number[], nodeHashes?: Record<number, Uint8Array>);
    toRatchetTreeExtension(): Promise<RatchetTree>;
    static fromRatchetTreeExtension(cipherSuite: CipherSuite, ext: RatchetTree, keyPackage: KeyPackage, secretKey: KEMPrivateKey, sender?: number, pathSecret?: Uint8Array | undefined): Promise<[RatchetTreeView, Uint8Array]>;
    update(makeKeyPackage: MakeKeyPackage, groupContext: GroupContext, omitLeaves?: Set<number>): Promise<[UpdatePath, Uint8Array[], RatchetTreeView]>;
    applyUpdatePath(fromNode: number, updatePath: UpdatePath, groupContext: GroupContext): Promise<[Uint8Array, RatchetTreeView]>;
    applyProposals(proposals: Proposal[]): Promise<[RatchetTreeView, number[]]>;
    calculateParentHashForLeaf(leafNum: number): Promise<Uint8Array>;
    calculateTreeHash(): Promise<Uint8Array>;
}
export {};
