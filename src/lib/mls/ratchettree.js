/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { EMPTY_BYTE_ARRAY, NODE, PATH, ProposalType } from "./constants";
import { eqUint8Array, Uint8ArrayMap } from "./util";
import { Leaf, Tree } from "./lbbtree";
import * as treemath from "./treemath";
import { Generation, ParentHash, ParentNode, RatchetTree, KeyPackage } from "./keypackage";
import { deriveSecret } from "./keyschedule";
import { HPKECiphertext, UpdatePathNode, UpdatePath, } from "./message";
import * as tlspl from "./tlspl";
/** The ratchet tree allows group members to efficiently update the group secrets.
 */
// Ratchet Tree Nodes
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#ratchet-tree-nodes
/* Each node in a ratchet tree contains up to five values:
 *
 * - A private key (only within the member's direct path, see below)
 * - A public key
 * - An ordered list of leaf indices for "unmerged" leaves (see {{views}})
 * - A credential (only for leaf nodes)
 * - A hash of the node's parent, as of the last time the node was changed.
 *
 * We also add a leaf number, when the node represents a leaf.
 */
export class NodeData {
    privateKey;
    publicKey;
    unmergedLeaves;
    credential;
    parentHash;
    leafNum;
    generation;
    constructor(privateKey, publicKey, unmergedLeaves, credential, parentHash, leafNum, generation = -1) {
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.unmergedLeaves = unmergedLeaves;
        this.credential = credential;
        this.parentHash = parentHash;
        this.leafNum = leafNum;
        this.generation = generation;
    }
}
/* The resolution of a node is an ordered list of non-blank nodes that
 * collectively cover all non-blank descendants of the node.
 *
 * - The resolution of a non-blank node comprises the node itself, followed by
 *   its list of unmerged leaves, if any
 * - The resolution of a blank leaf node is the empty list
 * - The resolution of a blank intermediate node is the result of concatenating
 *   the resolution of its left child with the resolution of its right child,
 *   in that order
 */
async function resolutionOf(node, keyPackages, omitLeaves) {
    if (omitLeaves === undefined) {
        omitLeaves = new Set();
    }
    else if (node.data.leafNum !== undefined && omitLeaves.has(node.data.leafNum)) {
        return [];
    }
    if (node.data.publicKey !== undefined) {
        const ret = [node.data.publicKey];
        for (const leafNum of node.data.unmergedLeaves) {
            if (!omitLeaves.has(leafNum)) {
                ret.push(await keyPackages[leafNum].getHpkeKey());
            }
        }
        return ret;
    }
    else if (node instanceof Leaf) {
        return [];
    }
    else {
        return (await resolutionOf(node.leftChild, keyPackages, omitLeaves))
            .concat(await resolutionOf(node.rightChild, keyPackages, omitLeaves));
    }
}
export class RatchetTreeView {
    cipherSuite;
    leafNum;
    tree;
    keyPackages;
    // NOTE: we assume that the identity in each credential is unique
    idToLeafNum;
    emptyLeaves;
    nodeHashes;
    constructor(cipherSuite, leafNum, tree, keyPackages, idToLeafNum, emptyLeaves, nodeHashes) {
        this.cipherSuite = cipherSuite;
        this.leafNum = leafNum;
        this.tree = tree;
        this.keyPackages = keyPackages;
        this.idToLeafNum = idToLeafNum || new Uint8ArrayMap([...tree]
            .filter((val, idx) => !(idx % 2))
            .map((val, idx) => {
            if (val.credential) {
                return [val.credential.identity, idx];
            }
            else {
                return undefined;
            }
        })
            .filter(val => val !== undefined));
        this.emptyLeaves = emptyLeaves ||
            [...tree]
                .filter((val, idx) => !(idx % 0))
                .map((val, idx) => [val, idx])
                .filter(v => v[0].publicKey === undefined)
                .map(v => v[1]);
        this.nodeHashes = nodeHashes || {};
    }
    async toRatchetTreeExtension() {
        const nodes = new Array(this.tree.size * 2 - 1);
        const createNode = async (nodeNum, node) => {
            const data = node.data;
            if (nodeNum & 0x1) { // internal node
                nodes[nodeNum] = new ParentNode(data.publicKey ? await data.publicKey.serialize() : EMPTY_BYTE_ARRAY, data.unmergedLeaves, data.parentHash);
                await Promise.all([
                    createNode(treemath.left(nodeNum), node.leftChild),
                    createNode(treemath.right(nodeNum, this.tree.size), node.rightChild),
                ]);
            }
            else { // leaf node
                nodes[nodeNum] = this.keyPackages[nodeNum / 2];
            }
        };
        await createNode(treemath.root(this.tree.size), this.tree.root);
        return new RatchetTree(nodes);
    }
    static async fromRatchetTreeExtension(cipherSuite, ext, keyPackage, secretKey, sender, pathSecret) {
        const ourIdentity = keyPackage.credential.identity;
        let leafNum = undefined;
        const nodes = new Array(ext.nodes.length);
        const keyPackages = [];
        const idToLeafNum = new Uint8ArrayMap();
        const emptyLeaves = [];
        // first process the leaf nodes (which are even-numbered)
        for (let i = 0; i < ext.nodes.length; i += 2) {
            const node = ext.nodes[i];
            if (node === undefined) {
                nodes[i] = new NodeData(undefined, undefined, [], undefined, undefined, i / 2);
                keyPackages.push(undefined);
                emptyLeaves.push(i / 2);
            }
            else {
                if (!(node instanceof KeyPackage)) {
                    throw new Error(`Expected a key package at position ${i}`);
                }
                let parentHash;
                for (const extension of node.extensions) {
                    if (extension instanceof ParentHash) {
                        parentHash = extension.parentHash;
                        // FIXME: verify parent hash
                    }
                    // FIXME: other extensions
                }
                keyPackages.push(node);
                if (eqUint8Array(node.credential.identity, ourIdentity)) {
                    leafNum = i / 2;
                }
                const generationExt = node.extensions.find(ext => ext instanceof Generation);
                const generation = generationExt ? generationExt.generation : -1;
                nodes[i] = new NodeData(undefined, await node.getHpkeKey(), [], node.credential, parentHash, i / 2, generation);
                idToLeafNum.set(node.credential.identity, i / 2);
            }
        }
        // next process the internal nodes
        for (let i = 1; i < ext.nodes.length; i += 2) {
            const node = ext.nodes[i];
            if (node === undefined) {
                nodes[i] = new NodeData(undefined, undefined, [], undefined, undefined);
            }
            else {
                if (!(node instanceof ParentNode)) {
                    throw new Error(`Expected a parent node at position ${i}`);
                }
                // FIXME: check parentHash
                if (node.publicKey.length === 0) {
                    nodes[i] = new NodeData(undefined, undefined, node.unmergedLeaves, undefined, node.parentHash);
                }
                else {
                    nodes[i] = new NodeData(undefined, await node.getHpkeKey(cipherSuite), node.unmergedLeaves, undefined, node.parentHash);
                }
            }
        }
        if (leafNum === undefined) {
            throw new Error("Could not find our leaf");
        }
        nodes[leafNum * 2].privateKey = secretKey;
        let commitSecret;
        if (pathSecret && sender !== undefined) {
            // start from the lowest common ancestor, and iterate over
            // ancestors, setting the secret key based on the path secret until
            // we get to the root
            let currNodeNum = treemath.commonAncestor(leafNum * 2, sender * 2);
            let currPathSecret = pathSecret;
            const numLeaves = (nodes.length + 1) / 2;
            const root = treemath.root(numLeaves);
            for (;; currNodeNum = treemath.parent(currNodeNum, numLeaves)) {
                const currNode = nodes[currNodeNum];
                const currNodeSecret = await deriveSecret(cipherSuite, currPathSecret, NODE);
                const [currNodePriv, currNodePub] = await cipherSuite.hpke.kem.deriveKeyPair(currNodeSecret);
                if (!eqUint8Array(await currNodePub.serialize(), await currNode.publicKey.serialize())) {
                    throw new Error(`Mismatched key on node ${currNodeNum}`);
                }
                currNode.privateKey = currNodePriv;
                currPathSecret = await deriveSecret(cipherSuite, currPathSecret, PATH);
                if (currNodeNum === root) {
                    break;
                }
            }
            commitSecret = currPathSecret;
        }
        else {
            commitSecret = new Uint8Array(cipherSuite.hpke.kdf.extractLength);
        }
        return [
            new RatchetTreeView(cipherSuite, leafNum, new Tree(nodes), keyPackages, idToLeafNum, emptyLeaves),
            commitSecret,
        ];
    }
    async update(makeKeyPackage, groupContext, omitLeaves = new Set()) {
        // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#ratchet-tree-evolution
        // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#synchronizing-views-of-the-tree
        const copath = [...this.tree.coPathOfLeafNum(this.leafNum)].reverse();
        const n = copath.length;
        const keyPackages = Array.from(this.keyPackages); // FIXME: O(n)
        // FIXME: is this the right length?
        const leafSecret = new Uint8Array(this.cipherSuite.hpke.kem.privateKeyLength);
        globalThis.crypto.getRandomValues(leafSecret);
        const [leafPriv, leafPub] = await this.cipherSuite.hpke.kem.deriveKeyPair(leafSecret);
        const keyPackage = await makeKeyPackage(await leafPub.serialize());
        keyPackages[this.leafNum] = keyPackage;
        const newPath = [new NodeData(leafPriv, leafPub, [], keyPackage.credential, undefined, // parentHash gets calculated and replaced below
            this.leafNum)];
        const updatePathNodes = [];
        let currPathSecret = leafSecret;
        const pathSecrets = [];
        const context = tlspl.encode([groupContext.encoder]);
        for (let i = 0; i < n; i++) {
            // derive secrets for this node
            currPathSecret = await deriveSecret(this.cipherSuite, currPathSecret, PATH);
            pathSecrets.push(currPathSecret);
            const currNodeSecret = await deriveSecret(this.cipherSuite, currPathSecret, NODE);
            const [currNodePriv, currNodePub] = await this.cipherSuite.hpke.kem.deriveKeyPair(currNodeSecret);
            newPath.push(new NodeData(currNodePriv, currNodePub, [], undefined, undefined));
            const encryptedPathSecret = [];
            // encrypt the path secret for users under the copath
            for (const publicKey of await resolutionOf(copath[i], this.keyPackages, omitLeaves)) {
                encryptedPathSecret.push(await HPKECiphertext.encrypt(this.cipherSuite.hpke, publicKey, context, currPathSecret));
            }
            updatePathNodes.push(new UpdatePathNode(await currNodePub.serialize(), encryptedPathSecret));
        }
        leafSecret.fill(0);
        newPath.reverse();
        const coPath = this.tree.coPathOfLeafNum(this.leafNum);
        let parentHash = EMPTY_BYTE_ARRAY;
        for (const node of newPath) {
            node.parentHash = parentHash;
            const { done, value: coPathChildNode } = coPath.next();
            if (!done) {
                const encoded = tlspl.encode([
                    tlspl.variableOpaque(await node.publicKey.serialize(), 2),
                    tlspl.variableOpaque(parentHash, 1),
                    tlspl.vector(await resolutionOf(coPathChildNode, this.keyPackages)
                        .then((keys) => Promise.all(keys.map(key => key.serialize()
                        .then(ser => tlspl.variableOpaque(ser, 2))))), 2),
                ]);
                parentHash = await this.cipherSuite.hash.hash(encoded);
            }
        }
        await keyPackage.addExtension(new ParentHash(parentHash));
        // generate UpdatePath message
        const updatePath = new UpdatePath(keyPackage, updatePathNodes);
        // update our tree
        const newTree = this.tree.replacePathToLeaf(this.leafNum, newPath);
        const nodeHashes = Object.assign({}, this.nodeHashes); // FIXME: O(n)
        invalidateNodeHashes(nodeHashes, this.leafNum, this.tree.size);
        // add the commit secret
        pathSecrets.push(await deriveSecret(this.cipherSuite, currPathSecret, PATH));
        return [
            updatePath,
            pathSecrets,
            new RatchetTreeView(this.cipherSuite, this.leafNum, newTree, keyPackages, this.idToLeafNum, this.emptyLeaves, nodeHashes),
        ];
    }
    async applyUpdatePath(fromNode, updatePath, groupContext) {
        // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#synchronizing-views-of-the-tree
        const keyPackages = Array.from(this.keyPackages); // FIXME: O(n)
        const privateKeys = [...this.tree.pathToLeafNum(this.leafNum)]
            .map(data => data.privateKey)
            .filter(data => data !== undefined);
        // FIXME: check that updatePath.leafKeyPackage.credential matches the
        // credential we already have for the node
        if (!await updatePath.leafKeyPackage.checkSignature()) {
            throw new Error("Bad signature on key package");
        }
        keyPackages[fromNode] = updatePath.leafKeyPackage;
        const generationExt = updatePath.leafKeyPackage.extensions.find(ext => ext instanceof Generation);
        const generation = generationExt ? generationExt.generation : -1;
        const newPath = [new NodeData(undefined, await updatePath.leafKeyPackage.getHpkeKey(), [], updatePath.leafKeyPackage.credential, undefined, // gets calculated and replaced below
            fromNode, generation)];
        let currPathSecret;
        let i = 0;
        for (; i < updatePath.nodes.length; i++) {
            const updatePathNode = updatePath.nodes[i];
            // FIXME: is there a better way of doing this than trying to
            // decrypt every ciphertext with every key?  In theory, we should
            // know exactly which node was encrypted to which key.
            const encrKeyPairs = [].concat(...updatePathNode.encryptedPathSecret.map(encr => privateKeys.map(key => [encr, key])));
            for (const [encryptedPathSecret, key] of encrKeyPairs) {
                try {
                    currPathSecret = await encryptedPathSecret.decrypt(this.cipherSuite.hpke, key, tlspl.encode([groupContext.encoder]));
                    break;
                }
                catch (e) { }
            }
            if (currPathSecret) {
                break;
            }
            newPath.push(new NodeData(undefined, await this.cipherSuite.hpke.kem.deserializePublic(updatePathNode.publicKey), [], undefined, undefined));
        }
        if (!currPathSecret) {
            throw new Error("Could not decrypt path secret");
        }
        for (; i < updatePath.nodes.length; i++) {
            const currNodeSecret = await deriveSecret(this.cipherSuite, currPathSecret, NODE);
            const [currNodePriv, currNodePub] = await this.cipherSuite.hpke.kem.deriveKeyPair(currNodeSecret);
            const serializedPubKey = await currNodePub.serialize();
            if (!eqUint8Array(serializedPubKey, updatePath.nodes[i].publicKey)) {
                throw new Error("Derived public key does not match");
            }
            newPath.push(new NodeData(currNodePriv, currNodePub, [], // FIXME: ???
            undefined, undefined));
            currPathSecret = await deriveSecret(this.cipherSuite, currPathSecret, PATH);
        }
        newPath.reverse();
        const coPath = this.tree.coPathOfLeafNum(fromNode);
        let parentHash = EMPTY_BYTE_ARRAY;
        for (const node of newPath) {
            node.parentHash = parentHash;
            const { done, value: coPathChildNode } = coPath.next();
            if (!done) {
                const encoded = tlspl.encode([
                    tlspl.variableOpaque(await node.publicKey.serialize(), 2),
                    tlspl.variableOpaque(parentHash, 1),
                    tlspl.vector(await resolutionOf(coPathChildNode, this.keyPackages)
                        .then((keys) => Promise.all(keys.map(key => key.serialize()
                        .then(ser => tlspl.variableOpaque(ser, 2))))), 2),
                ]);
                parentHash = await this.cipherSuite.hash.hash(encoded);
            }
        }
        // check the parentHash matches the parentHash that we got in the key package
        for (const extension of updatePath.leafKeyPackage.extensions) {
            if (extension instanceof ParentHash) {
                if (eqUint8Array(extension.parentHash, parentHash)) {
                    parentHash = undefined;
                    break;
                }
                else {
                    throw new Error("Parent hash does not match");
                }
            }
        }
        if (parentHash !== undefined) {
            throw new Error("Key package does not have ParentHash extension");
        }
        const newTree = this.tree.replacePathToLeaf(fromNode, newPath);
        const nodeHashes = Object.assign({}, this.nodeHashes); // FIXME: O(n)
        invalidateNodeHashes(nodeHashes, this.leafNum, this.tree.size);
        return [
            currPathSecret,
            new RatchetTreeView(this.cipherSuite, this.leafNum, newTree, keyPackages, this.idToLeafNum, this.emptyLeaves),
        ];
    }
    async applyProposals(proposals) {
        // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#proposals
        let tree = this.tree;
        // removes are applied first, then updates, then adds
        const adds = [];
        const updates = [];
        const removes = [];
        let idToLeafNum = this.idToLeafNum;
        let emptyLeaves = this.emptyLeaves;
        const keyPackages = Array.from(this.keyPackages);
        const addPositions = []; // which positions the new leaves were added to
        for (const proposal of proposals) {
            switch (proposal.msgType) {
                case ProposalType.Add:
                    adds.push(proposal);
                    break;
                case ProposalType.Update:
                    updates.push(proposal);
                    break;
                case ProposalType.Remove:
                    removes.push(proposal);
                    break;
                default:
                    throw new Error("Unknown proposal type");
            }
        }
        if (removes.length) {
            idToLeafNum = new Uint8ArrayMap(idToLeafNum); // FIXME: O(n)
            emptyLeaves = Array.from(emptyLeaves); // FIXME: O(n)
            for (const remove of removes) {
                const path = [...tree.pathToLeafNum(remove.removed)];
                idToLeafNum.delete(path[path.length - 1].credential.identity);
                emptyLeaves.push(remove.removed);
                keyPackages[remove.removed] = undefined;
                const newPath = path.map((data) => {
                    return new NodeData(undefined, undefined, [], undefined, undefined);
                });
                tree = tree.replacePathToLeaf(remove.removed, newPath);
            }
        }
        for (const update of updates) {
            const leafNum = this.idToLeafNum.get(update.keyPackage.credential.identity);
            // FIXME: make sure the update's credential matches the credential
            // we already have
            keyPackages[leafNum] = update.keyPackage;
            const publicKey = await update.keyPackage.getHpkeKey();
            // Blank the intermediate nodes along the path from the sender's leaf to the root
            const path = [...tree.pathToLeafNum(leafNum)]
                .map((data, idx, arr) => {
                return new NodeData(undefined, undefined, [], undefined, undefined);
            });
            const generationExt = update.keyPackage.extensions.find(ext => ext instanceof Generation);
            const generation = generationExt ? generationExt.generation : -1;
            path[path.length - 1] = new NodeData(leafNum === this.leafNum ? update.privateKey : undefined, publicKey, [], update.keyPackage.credential, undefined, // FIXME:
            leafNum, generation);
            tree = tree.replacePathToLeaf(leafNum, path);
        }
        if (adds.length) {
            if (!removes.length) {
                idToLeafNum = new Uint8ArrayMap(idToLeafNum); // FIXME: O(n)
                emptyLeaves = Array.from(emptyLeaves); // FIXME: O(n)
            }
            emptyLeaves.sort(); // FIXME: O(n log n)
            for (const add of adds) {
                const publicKey = await add.keyPackage.getHpkeKey();
                const generationExt = add.keyPackage.extensions.find(ext => ext instanceof Generation);
                const generation = generationExt ? generationExt.generation : -1;
                if (emptyLeaves.length) {
                    const leafNum = emptyLeaves.shift();
                    addPositions.push(leafNum);
                    const leafData = new NodeData(undefined, publicKey, [], add.keyPackage.credential, new Uint8Array(), // FIXME:
                    leafNum, generation);
                    keyPackages[leafNum] = add.keyPackage;
                    const path = [...tree.pathToLeafNum(leafNum)]
                        .map((data, idx, arr) => {
                        if (idx === arr.length - 1) {
                            return leafData;
                        }
                        else {
                            return new NodeData(undefined, undefined, data.unmergedLeaves.concat([leafNum]), undefined, new Uint8Array());
                        }
                    });
                    tree = tree.replacePathToLeaf(leafNum, path);
                    idToLeafNum.set(add.keyPackage.credential.identity, leafNum);
                }
                else {
                    const leafNum = tree.size;
                    addPositions.push(leafNum);
                    const leafData = new NodeData(undefined, publicKey, [], add.keyPackage.credential, new Uint8Array(), // FIXME:
                    leafNum, generation);
                    keyPackages[leafNum] = add.keyPackage;
                    tree = tree.addNode(leafData, (leftChild, rightChild) => {
                        return new NodeData(undefined, undefined, leftChild.data.unmergedLeaves.concat([leafNum]), // FIXME: ???
                        undefined, new Uint8Array());
                    });
                    idToLeafNum.set(add.keyPackage.credential.identity, leafNum);
                }
            }
        }
        return [
            new RatchetTreeView(this.cipherSuite, this.leafNum, tree, keyPackages, idToLeafNum, emptyLeaves),
            addPositions,
        ];
    }
    // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#parent-hash
    async calculateParentHashForLeaf(leafNum) {
        const path = [...this.tree.pathToLeafNum(leafNum)];
        path.pop(); // stop before the KeyPackage
        let parentHash = EMPTY_BYTE_ARRAY; // parentHash for root is the empty string
        for (const node of path) {
            const parentNode = new ParentNode(node.publicKey ? await node.publicKey.serialize() : EMPTY_BYTE_ARRAY, node.unmergedLeaves, parentHash);
            const encoding = tlspl.encode([parentNode.encoder]);
            parentHash = await this.cipherSuite.hash.hash(encoding);
        }
        return parentHash;
    }
    // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#tree-hashes
    async calculateTreeHash() {
        const calculateNodeHash = async (nodeNum, node) => {
            if (!(nodeNum in this.nodeHashes)) {
                let encoding;
                if (nodeNum & 0x1) { // internal node
                    encoding = tlspl.encode([
                        tlspl.uint32(nodeNum),
                        node.data.publicKey ?
                            tlspl.struct([
                                tlspl.uint8(1),
                                (new ParentNode(await node.data.publicKey.serialize(), node.data.unmergedLeaves, node.data.parentHash)).encoder,
                            ]) :
                            tlspl.uint8(0),
                        tlspl.variableOpaque(await calculateNodeHash(treemath.left(nodeNum), node.leftChild), 1),
                        tlspl.variableOpaque(await calculateNodeHash(treemath.right(nodeNum, this.tree.size), node.rightChild), 1),
                    ]); // ParentNodeHashInput struct
                }
                else { // leaf node
                    encoding = tlspl.encode([
                        tlspl.uint32(nodeNum),
                        node.data.publicKey ?
                            tlspl.struct([
                                tlspl.uint8(1),
                                this.keyPackages[nodeNum / 2].encoder,
                            ]) :
                            tlspl.uint8(0),
                    ]); // LeafNodeHashInput struct
                }
                this.nodeHashes[nodeNum] = await this.cipherSuite.hash.hash(encoding);
            }
            return this.nodeHashes[nodeNum];
        };
        return await calculateNodeHash(treemath.root(this.tree.size), this.tree.root);
    }
}
function invalidateNodeHashes(nodeHashes, leafNum, treeSize) {
    // Invalidate nodeHashes that were changed.  Start at the leaf and stop
    // when we reach the root, or when we reach a node that we don't have a
    // value for, because if we don't have a value for a node, then we
    // don't have a value for any of its parents.
    const rootNum = treemath.root(treeSize);
    for (let nodeNum = leafNum * 2; nodeHashes[nodeNum]; nodeNum = treemath.parent(nodeNum, treeSize)) {
        delete nodeHashes[nodeNum];
        if (nodeNum === rootNum) {
            break;
        }
    }
}
//# sourceMappingURL=ratchettree.js.map