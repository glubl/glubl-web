/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import { SecretTree, generateSecrets, generateSecretsFromJoinerSecret, } from "./keyschedule";
import { encodeEpoch, decodeEpoch } from "./epoch";
import { NodeData, RatchetTreeView } from "./ratchettree";
import { Extension, Generation, KeyPackage, RatchetTree } from "./keypackage";
import { Tree } from "./lbbtree";
import { MLSPlaintext, MLSCiphertext, Add, Commit, Remove, ProposalWrapper, Sender, } from "./message";
import { concatUint8Array, eqUint8Array, Uint8ArrayMap } from "./util";
import { EMPTY_BYTE_ARRAY, ContentType, SenderType } from "./constants";
import { GroupInfo, Welcome } from "./welcome";
import * as tlspl from "./tlspl";
import { commonAncestor, directPath } from "./treemath";
function makeEpochStr(epoch, sender) {
    return `${epoch}|${sender.join(",")}`;
}
class NumberedIterator {
    iterator;
    idx = 0;
    constructor(iterator) {
        this.iterator = iterator;
    }
    next() {
        const res = this.iterator.next();
        if (res.done) {
            return { done: true, value: undefined };
        }
        else {
            return { done: false, value: [this.idx++, res.value] };
        }
    }
    [Symbol.iterator]() {
        return this;
    }
}
export class Group {
    version;
    cipherSuite;
    groupId;
    extensions;
    states;
    extremities;
    constructor(version, cipherSuite, groupId, epoch, sender, extensions, confirmedTranscriptHash, interimTranscriptHash, ratchetTreeView, secrets, secretTree) {
        this.version = version;
        this.cipherSuite = cipherSuite;
        this.groupId = groupId;
        this.extensions = extensions;
        const epochStr = makeEpochStr(epoch, sender);
        this.states = new Map([[
                epochStr,
                {
                    leafNum: ratchetTreeView.leafNum,
                    confirmedTranscriptHash, interimTranscriptHash,
                    ratchetTreeView, secrets, secretTree,
                    hashRatchets: {},
                },
            ]]);
        this.extremities = new Map([[epochStr, [epoch, sender]]]);
    }
    getState(epoch, sender) {
        const epochStr = makeEpochStr(epoch, sender);
        return this.states.get(epochStr);
    }
    /** Create a brand new group.
     */
    static async createNew(version, cipherSuite, groupId, credential, signingPrivateKey, otherMembers) {
        // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#group-creation
        const groupExtensions = []; // FIXME: pass as parameter?
        const [hpkePrivateKey, hpkePubKey] = await cipherSuite.hpke.kem.generateKeyPair();
        const keyPackage = await KeyPackage.create(version, cipherSuite, await hpkePubKey.serialize(), credential, [new Generation(1)], // FIXME: extensions -- same as group extensions?
        signingPrivateKey);
        const ratchetTreeView0 = new RatchetTreeView(cipherSuite, 0, // leaf num
        new Tree([
            new NodeData(undefined, hpkePubKey, [], credential, undefined, 0),
        ]), [keyPackage]);
        const initialGroupContext = new GroupContext(groupId, 0, // FIXME: or 1?
        await ratchetTreeView0.calculateTreeHash(), EMPTY_BYTE_ARRAY, // initial confirmed transcript hash
        groupExtensions);
        const adds = otherMembers.map(keyPackage => new Add(keyPackage));
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [ratchetTreeView1,] = await ratchetTreeView0.applyProposals(adds);
        const provisionalGroupContext = new GroupContext(groupId, 0, await ratchetTreeView1.calculateTreeHash(), EMPTY_BYTE_ARRAY, groupExtensions);
        const [updatePath, pathSecrets, ratchetTreeView2] = await ratchetTreeView1.update((pubkey) => KeyPackage.create(version, cipherSuite, pubkey, credential, [new Generation(2)], // FIXME: extensions -- same as group extension?
        signingPrivateKey), provisionalGroupContext);
        // FIXME: if we have too many adds, we may need to send the adds as
        // separate proposals, and the Commit message will need to use hashes
        // instead
        const commit = new Commit(adds.map(add => new ProposalWrapper(add)), updatePath);
        const plaintext = await MLSPlaintext.create(cipherSuite, groupId, 0, new Sender(SenderType.Member, 0), EMPTY_BYTE_ARRAY, commit, signingPrivateKey, initialGroupContext);
        const confirmedTranscriptHash = await calculateConfirmedTranscriptHash(cipherSuite, plaintext, EMPTY_BYTE_ARRAY);
        const newGroupContext = new GroupContext(groupId, 1, await ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, groupExtensions);
        const initSecret = new Uint8Array(cipherSuite.hpke.kdf.extractLength);
        globalThis.crypto.getRandomValues(initSecret);
        const commitSecret = pathSecrets[pathSecrets.length - 1];
        const secrets = await generateSecrets(cipherSuite, initSecret, commitSecret, newGroupContext);
        await plaintext.calculateTags(cipherSuite, secrets.confirmationKey, EMPTY_BYTE_ARRAY, // FIXME: ???
        initialGroupContext);
        const interimTranscriptHash = await calculateInterimTranscriptHash(cipherSuite, plaintext, confirmedTranscriptHash);
        const secretTree = new SecretTree(cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size);
        const group = new Group(version, cipherSuite, groupId, 1, credential.identity, groupExtensions, confirmedTranscriptHash, interimTranscriptHash, ratchetTreeView2, secrets, secretTree);
        // make welcome messages
        /* we are leaf 0.  Our parent will be the lowest common ancestor (LCA)
         * for the next leaf.  Our grandparent will be the lowest common
         * ancestor for the next 2 leaves.  Our great-grandparent will be the
         * lowest common ancestor for the next 4 leaves, etc.
         *
         *                                             D
         *                         ___________________/ \
         *                        /                      \
         *                       C                        \
         *             _________/ \_________               \
         *            /                     \               \
         *           B                       *               \
         *       ___/ \___               ___/ \___            \
         *      /         \             /         \            |
         *     A           *           *           *           *
         *    / \         / \         / \         / \         / \
         *   /   \       /   \       /   \       /   \       /   \
         *  0     1     2     3     4     5     6     7     8     9
         *      \_ _/  \___ ___/   \_________ __________/  \_______ ...
         *        V        V                 V                     V
         *    LCA is A  LCA is B         LCA is C             LCA is D  ...
         *
         * So we iterate over the path secrets array and encrypt each secret
         * for the next 2^i leaves.
         */
        const recipients = [];
        for (let i = 0; (1 << i - 1) <= otherMembers.length; i++) {
            const numRecipients = 1 << i;
            const maxRecipients = otherMembers.length - numRecipients + 1;
            for (let j = 0; j < numRecipients && j < maxRecipients; j++) {
                recipients.push({
                    keyPackage: otherMembers[numRecipients - 1 + j],
                    pathSecret: pathSecrets[i],
                });
            }
        }
        const groupInfo = await GroupInfo.create(groupId, 1, await ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, 
        // FIXME: other extensions?
        // FIXME: allow sending the ratchet tree in other ways
        [await ratchetTreeView2.toRatchetTreeExtension()], plaintext.confirmationTag, 0, signingPrivateKey);
        const welcome = await Welcome.create(cipherSuite, secrets.joinerSecret, groupInfo, recipients);
        return [group, plaintext, welcome];
    }
    static async createFromWelcome(welcome, keyPackages) {
        const cipherSuite = welcome.cipherSuite;
        const [groupSecrets, groupInfo, keyId] = await welcome.decrypt(keyPackages);
        // FIXME: check signature on groupInfo (we need a public signing key)
        // FIXME: support other methods of getting the ratchet tree
        const [keyPackage, hpkeKey] = keyPackages[keyId];
        const ratchetTreeExt = groupInfo.extensions.find(ext => ext instanceof RatchetTree);
        if (!ratchetTreeExt) {
            throw new Error("Could not find ratchet tree");
        }
        const [ratchetTreeView, commitSecret] = await RatchetTreeView.fromRatchetTreeExtension(cipherSuite, ratchetTreeExt, keyPackage, hpkeKey, groupInfo.signerIndex, groupSecrets.pathSecret);
        const signerKeyPackage = ratchetTreeView.keyPackages[groupInfo.signerIndex];
        if (!signerKeyPackage) {
            throw new Error("Signer doesn't have a key package");
        }
        if (!await groupInfo.checkSignature(signerKeyPackage.credential)) {
            throw new Error("Signature on group info does not match");
        }
        const treeHash = await ratchetTreeView.calculateTreeHash();
        if (!eqUint8Array(treeHash, groupInfo.treeHash)) {
            throw new Error("Tree hash does not match");
        }
        // FIXME: For each non-empty parent node, verify that exactly one of
        // the node's children are non-empty and have the hash of this node set
        // as their parent_hash value (if the child is another parent) or has a
        // parent_hash extension in the KeyPackage containing the same value
        // (if the child is a leaf). If either of the node's children is empty,
        // and in particular does not have a parent hash, then its respective
        // children's parent_hash values have to be considered instead.
        // check the signature on all the key packages
        // FIXME: this doesn't work??
        await Promise.all(ratchetTreeView.keyPackages.map(async (keyPackage, idx) => {
            if (keyPackage !== undefined && !(await keyPackage.checkSignature())) {
                throw new Error(`Invalid signature for key package #${idx}`);
            }
        }));
        const groupContext = new GroupContext(groupInfo.groupId, groupInfo.epoch, groupInfo.treeHash, groupInfo.confirmedTranscriptHash, []);
        const secrets = await generateSecretsFromJoinerSecret(cipherSuite, groupSecrets.joinerSecret, commitSecret, groupContext);
        const secretTree = new SecretTree(cipherSuite, secrets.encryptionSecret, ratchetTreeView.tree.size);
        const interimTranscriptHash = await calculateInterimTranscriptHash(cipherSuite, groupInfo, groupInfo.confirmedTranscriptHash);
        const group = new Group(keyPackage.version, // FIXME: is this correct?
        cipherSuite, groupInfo.groupId, groupInfo.epoch, signerKeyPackage.credential.identity, [], // FIXME: extensions -- same as groupInfo.extensions minus ratchettree?
        groupInfo.confirmedTranscriptHash, interimTranscriptHash, ratchetTreeView, secrets, secretTree);
        return [keyId, group];
    }
    needsMerge() {
        return this.extremities.size > 1;
    }
    prepareCommit() {
        let baseEpoch = -1;
        let baseSender;
        const members = new Uint8ArrayMap();
        for (const [epoch, sender] of this.extremities.values()) {
            if (epoch > baseEpoch) {
                baseEpoch = epoch;
                baseSender = sender;
            }
        }
        const resolves = [];
        for (const [epoch, sender] of this.extremities.values()) {
            if (epoch !== baseEpoch || !eqUint8Array(sender, baseSender)) {
                resolves.push([epoch, sender]);
            }
        }
        const baseEpochStr = makeEpochStr(baseEpoch, baseSender);
        const baseState = this.states.get(baseEpochStr);
        const identity = baseState.ratchetTreeView.tree.leaf(baseState.leafNum).credential.identity;
        const maxGenerations = new Uint8ArrayMap();
        let updatePathRequired = false;
        // for each user, find the leaf in the extremities with the highest generation
        for (const [idx, nodeData] of new NumberedIterator(baseState.ratchetTreeView.tree.leaves())) {
            if (nodeData.credential) {
                maxGenerations.set(nodeData.credential.identity, [nodeData.generation, undefined, undefined]);
                members.set(nodeData.credential.identity, idx);
            }
        }
        const extraUsers = new Uint8ArrayMap();
        for (const epochStr of this.extremities.keys()) {
            if (epochStr === baseEpochStr) {
                continue;
            }
            const state = this.states.get(epochStr);
            for (const [leafNum, nodeData] of new NumberedIterator(state.ratchetTreeView.tree.leaves())) {
                if (nodeData.credential) {
                    const cred = nodeData.credential.identity;
                    if (maxGenerations.has(cred)) {
                        if (nodeData.generation > maxGenerations.get(cred)[0]) {
                            maxGenerations.set(cred, [nodeData.generation, epochStr, leafNum]);
                        }
                    }
                    else {
                        const keyPackage = extraUsers.get(nodeData.credential.identity);
                        if (keyPackage) {
                            const generationExt = keyPackage.extensions.find(ext => ext instanceof Generation);
                            const generation = generationExt ? generationExt.generation : -1;
                            if (nodeData.generation <= generation) {
                                continue;
                            }
                        }
                        extraUsers.set(nodeData.credential.identity, state.ratchetTreeView.keyPackages[leafNum]);
                    }
                }
            }
        }
        // construct update proposals
        const updates = [];
        for (const [, epochStr, leafNum] of maxGenerations.values()) {
            if (epochStr === undefined) {
                continue;
            }
            const keyPackage = this.states.get(epochStr).ratchetTreeView.keyPackages[leafNum];
            if (eqUint8Array(identity, keyPackage.credential.identity)) {
                updatePathRequired = true;
            }
            else {
                updates.push(new Remove(leafNum));
                updates.push(new Add(keyPackage));
            }
        }
        return [baseEpoch, baseSender, updates, resolves, updatePathRequired, members, extraUsers];
    }
    async commit(proposals, credential, signingPrivateKey, baseEpoch, baseSender, updatePathRequired = false) {
        const baseEpochStr = makeEpochStr(baseEpoch, baseSender);
        const baseState = this.states.get(baseEpochStr);
        // unwrap the proposals
        // FIXME: allow proposal references too
        // FIXME: enforce ordering of proposals
        const bareProposals = proposals.map(({ proposal }) => proposal);
        const newMembers = [];
        for (const proposal of bareProposals) {
            if (proposal instanceof Add) {
                newMembers.push(proposal.keyPackage);
            }
        }
        const initialGroupContext = new GroupContext(this.groupId, baseEpoch, await baseState.ratchetTreeView.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
        const [ratchetTreeView1, addPositions] = await baseState.ratchetTreeView.applyProposals(bareProposals);
        // update path is required if there are no proposals, or if there is a
        // non-add proposal
        // FIXME: figure out whether updating the path is advantageous even when
        // we only have adds
        updatePathRequired = updatePathRequired ||
            bareProposals.length == 0 ||
            bareProposals.some((proposal) => { return !(proposal instanceof Add); });
        const nextEpoch = baseEpoch + 1;
        let updatePath;
        let commitSecret = EMPTY_BYTE_ARRAY; // FIXME: should be 0 vector of the right length
        let pathSecrets = [];
        let ratchetTreeView2 = ratchetTreeView1;
        if (updatePathRequired) {
            const provisionalGroupContext = new GroupContext(this.groupId, baseEpoch, // FIXME: or nextEpoch?
            await ratchetTreeView1.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
            const generation = ratchetTreeView2.tree.leaf(baseState.leafNum).generation;
            [updatePath, pathSecrets, ratchetTreeView2] = await ratchetTreeView1.update((pubkey) => KeyPackage.create(this.version, this.cipherSuite, pubkey, credential, [new Generation(generation + 1)], // FIXME: extensions -- same as group extension?
            signingPrivateKey), provisionalGroupContext);
            commitSecret = pathSecrets[pathSecrets.length - 1];
        }
        // FIXME: if we have too many proposals, we may need to send some proposals
        // separately, and the Commit message will need to use hashes instead
        const commit = new Commit(proposals, updatePath);
        const plaintext = await MLSPlaintext.create(this.cipherSuite, this.groupId, baseEpoch, new Sender(SenderType.Member, baseState.leafNum), EMPTY_BYTE_ARRAY, commit, signingPrivateKey, initialGroupContext);
        const confirmedTranscriptHash = await calculateConfirmedTranscriptHash(this.cipherSuite, plaintext, baseState.interimTranscriptHash);
        const newGroupContext = new GroupContext(this.groupId, nextEpoch, await ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, this.extensions);
        const secrets = await generateSecrets(this.cipherSuite, baseState.secrets.initSecret, commitSecret, newGroupContext);
        await plaintext.calculateTags(this.cipherSuite, secrets.confirmationKey, secrets.membershipKey, initialGroupContext);
        const interimTranscriptHash = await calculateInterimTranscriptHash(this.cipherSuite, plaintext, confirmedTranscriptHash);
        const [ciphertext,] = await this.encryptMlsPlaintext(plaintext, baseEpoch, baseSender);
        // make welcome messages
        let recipients;
        if (pathSecrets.length) {
            recipients = [];
            // FIXME: O(n log n)
            const path = directPath(baseState.leafNum * 2, ratchetTreeView2.tree.size);
            const nodeNumToLevel = {};
            for (let i = 0; i < path.length; i++) {
                nodeNumToLevel[path[i]] = i;
            }
            for (let i = 0; i < addPositions.length; i++) {
                const leafNum = addPositions[i];
                const ancestor = commonAncestor(leafNum * 2, baseState.leafNum * 2);
                recipients.push({ keyPackage: newMembers[i], pathSecret: pathSecrets[nodeNumToLevel[ancestor]] });
            }
        }
        else {
            recipients = newMembers.map(keyPackage => { return { keyPackage }; });
        }
        const groupInfo = await GroupInfo.create(this.groupId, nextEpoch, await ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, 
        // FIXME: other extensions?
        // FIXME: allow sending the ratchet tree in other ways
        [await ratchetTreeView2.toRatchetTreeExtension()], plaintext.confirmationTag, baseState.leafNum, signingPrivateKey);
        const welcome = await Welcome.create(this.cipherSuite, secrets.joinerSecret, groupInfo, recipients);
        const nextEpochStr = makeEpochStr(nextEpoch, credential.identity);
        this.extremities = new Map([[nextEpochStr, [nextEpoch, credential.identity]]]);
        const nextState = {
            leafNum: baseState.leafNum,
            confirmedTranscriptHash,
            interimTranscriptHash,
            ratchetTreeView: ratchetTreeView2,
            secrets,
            secretTree: new SecretTree(this.cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size),
            hashRatchets: {},
        };
        this.states.set(nextEpochStr, nextState);
        return [ciphertext, plaintext, welcome, addPositions];
    }
    async applyCommit(plaintext, oldSender, resolves) {
        if (!(plaintext.content instanceof Commit)) {
            throw new Error("must be a Commit");
        }
        if (!this.states.has(makeEpochStr(plaintext.epoch, oldSender))) {
            throw new Error("Unknown epoch");
        }
        const baseEpochStr = makeEpochStr(plaintext.epoch, oldSender);
        const baseState = this.states.get(baseEpochStr);
        const newSender = baseState.ratchetTreeView.keyPackages[plaintext.sender.sender].credential.identity;
        const commit = plaintext.content;
        // unwrap the proposals
        // FIXME: allow proposal references too
        // FIXME: enforce ordering of proposals
        const bareProposals = commit.proposals
            .map(({ proposal }) => proposal);
        const pathRequired = bareProposals.length == 0 ||
            bareProposals.some((proposal) => { return !(proposal instanceof Add); });
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [ratchetTreeView1, addPositions] = await baseState.ratchetTreeView.applyProposals(bareProposals);
        const nextEpoch = plaintext.epoch + 1;
        let commitSecret = EMPTY_BYTE_ARRAY; // FIXME: should be 0 vector of the right length
        let ratchetTreeView2 = ratchetTreeView1;
        if (commit.updatePath) {
            const provisionalGroupContext = new GroupContext(this.groupId, plaintext.epoch, // FIXME: or nextEpoch?
            await ratchetTreeView1.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
            [commitSecret, ratchetTreeView2] = await ratchetTreeView1.applyUpdatePath(plaintext.sender.sender, commit.updatePath, provisionalGroupContext);
        }
        else if (pathRequired) {
            throw new Error("UpdatePath was required for this commit, but not UpdatePath given");
        }
        const confirmedTranscriptHash = await calculateConfirmedTranscriptHash(this.cipherSuite, plaintext, baseState.interimTranscriptHash);
        const newGroupContext = new GroupContext(this.groupId, nextEpoch, await ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, this.extensions);
        const interimTranscriptHash = await calculateInterimTranscriptHash(this.cipherSuite, plaintext, confirmedTranscriptHash);
        const secrets = await generateSecrets(this.cipherSuite, baseState.secrets.initSecret, commitSecret, newGroupContext);
        if (!plaintext.verifyConfirmationTag(this.cipherSuite, secrets.confirmationKey, newGroupContext)) {
            throw new Error("Confirmation tag does not match");
        }
        for (const [epoch, sender] of resolves) {
            this.extremities.delete(makeEpochStr(epoch, sender));
        }
        this.extremities.delete(baseEpochStr);
        const nextEpochStr = makeEpochStr(nextEpoch, newSender);
        const nextState = {
            leafNum: baseState.leafNum,
            confirmedTranscriptHash,
            interimTranscriptHash,
            ratchetTreeView: ratchetTreeView2,
            secrets,
            secretTree: new SecretTree(this.cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size),
            hashRatchets: {},
        };
        this.states.set(nextEpochStr, nextState);
        this.extremities.set(nextEpochStr, [nextEpoch, newSender]);
        return addPositions;
    }
    addGroupStates(group, resolves) {
        if (!eqUint8Array(group.groupId, this.groupId)) {
            throw new Error("Group IDs don't match");
        }
        if (group.version != this.version || group.cipherSuite.id != this.cipherSuite.id) {
            // FIXME: extensions?
            throw new Error("Group parameters don't match");
        }
        for (const [key, value] of group.states.entries()) {
            // FIXME: check if key is already present
            this.states.set(key, value);
        }
        for (const [key, value] of group.extremities.entries()) {
            // FIXME: check if key is already in states
            this.extremities.set(key, value);
        }
        for (const [epoch, sender] of resolves) {
            const epochStr = makeEpochStr(epoch, sender);
            this.extremities.delete(epochStr);
        }
    }
    async encrypt(data, authenticatedData, signingKey) {
        if (this.extremities.size > 1) {
            throw new Error("Extremities need resolving before encryption");
        }
        const [epochStr, [epoch, sender]] = [...this.extremities][0];
        const state = this.states.get(epochStr);
        const context = new GroupContext(this.groupId, epoch, await state.ratchetTreeView.calculateTreeHash(), state.confirmedTranscriptHash, []);
        const mlsPlaintext = await MLSPlaintext.create(this.cipherSuite, this.groupId, epoch, new Sender(SenderType.Member, state.leafNum), authenticatedData, data, signingKey, context);
        await mlsPlaintext.calculateTags(this.cipherSuite, state.secrets.confirmationKey, state.secrets.membershipKey, context);
        const [ciphertext, epochSender] = await this.encryptMlsPlaintext(mlsPlaintext, epoch, sender);
        return [ciphertext, epoch, epochSender];
    }
    async encryptMlsPlaintext(mlsPlaintext, epoch, sender) {
        let epochStr;
        if (epoch && sender) {
            epochStr = makeEpochStr(epoch, sender);
        }
        else if (this.extremities.size == 1) {
            [epochStr, [epoch, sender]] = [...this.extremities][0];
        }
        else {
            throw new Error("Extremities need resolving before encryption");
        }
        const ratchetNum = mlsPlaintext.content instanceof Uint8Array ? 1 : 0;
        const state = this.states.get(epochStr);
        if (!state.hashRatchets[state.leafNum]) {
            state.hashRatchets[state.leafNum] =
                await state.secretTree.getRatchetsForLeaf(state.leafNum);
        }
        return [
            await MLSCiphertext.create(this.cipherSuite, mlsPlaintext, state.hashRatchets[state.leafNum][ratchetNum], state.secrets.senderDataSecret),
            sender,
        ];
    }
    async decrypt(mlsCiphertext, epochSender) {
        if (!eqUint8Array(this.groupId, mlsCiphertext.groupId)) {
            throw new Error("Encrypted for the wrong group.");
        }
        const epochStr = makeEpochStr(mlsCiphertext.epoch, epochSender);
        if (!this.states.has(epochStr)) {
            throw new Error("Unknown epoch");
        }
        const state = this.states.get(epochStr);
        // FIXME: verify
        const ratchetNum = mlsCiphertext.contentType == ContentType.Application ? 1 : 0;
        return await mlsCiphertext.decrypt(this.cipherSuite, async (sender) => {
            if (sender >= state.ratchetTreeView.tree.size) {
                throw new Error("Invalid sender");
            }
            if (!(sender in state.hashRatchets)) {
                state.hashRatchets[sender] = await state.secretTree.getRatchetsForLeaf(sender);
            }
            return state.hashRatchets[sender][ratchetNum];
        }, state.secrets.senderDataSecret);
    }
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#group-state
export class GroupContext {
    groupId;
    epoch;
    treeHash;
    confirmedTranscriptHash;
    extensions;
    constructor(groupId, epoch, treeHash, confirmedTranscriptHash, extensions) {
        this.groupId = groupId;
        this.epoch = epoch;
        this.treeHash = treeHash;
        this.confirmedTranscriptHash = confirmedTranscriptHash;
        this.extensions = extensions;
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, treeHash, confirmedTranscriptHash, extensions], offset1,] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            decodeEpoch,
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVector(Extension.decode, 4),
        ], buffer, offset);
        return [
            new GroupContext(groupId, epoch, treeHash, confirmedTranscriptHash, extensions),
            offset1,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            encodeEpoch(this.epoch),
            tlspl.variableOpaque(this.treeHash, 1),
            tlspl.variableOpaque(this.confirmedTranscriptHash, 1),
            tlspl.vector(this.extensions.map(x => x.encoder), 4),
        ]);
    }
}
export async function calculateConfirmedTranscriptHash(cipherSuite, plaintext, interimTranscriptHash) {
    const mlsPlaintextCommitContent = tlspl.encode([plaintext.commitContentEncoder]);
    const confirmedTranscriptHash = await cipherSuite.hash.hash(concatUint8Array([interimTranscriptHash, mlsPlaintextCommitContent]));
    return confirmedTranscriptHash;
}
export async function calculateInterimTranscriptHash(cipherSuite, plaintext, confirmedTranscriptHash) {
    const newInterimTranscriptHash = await cipherSuite.hash.hash(concatUint8Array([confirmedTranscriptHash, plaintext.confirmationTag]));
    return newInterimTranscriptHash;
}
//# sourceMappingURL=group.js.map