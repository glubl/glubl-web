"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateInterimTranscriptHash = exports.calculateConfirmedTranscriptHash = exports.GroupContext = exports.Group = void 0;
const keyschedule_1 = require("./keyschedule");
const epoch_1 = require("./epoch");
const ratchettree_1 = require("./ratchettree");
const keypackage_1 = require("./keypackage");
const lbbtree_1 = require("./lbbtree");
const message_1 = require("./message");
const util_1 = require("./util");
const constants_1 = require("./constants");
const welcome_1 = require("./welcome");
const tlspl = require("./tlspl");
const treemath_1 = require("./treemath");
function makeEpochStr(epoch, sender) {
    return `${epoch}|${sender.join(",")}`;
}
class NumberedIterator {
    constructor(iterator) {
        this.iterator = iterator;
        this.idx = 0;
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
class Group {
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
    static createNew(version, cipherSuite, groupId, credential, signingPrivateKey, otherMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            // https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#group-creation
            const groupExtensions = []; // FIXME: pass as parameter?
            const [hpkePrivateKey, hpkePubKey] = yield cipherSuite.hpke.kem.generateKeyPair();
            const keyPackage = yield keypackage_1.KeyPackage.create(version, cipherSuite, yield hpkePubKey.serialize(), credential, [new keypackage_1.Generation(1)], // FIXME: extensions -- same as group extensions?
            signingPrivateKey);
            const ratchetTreeView0 = new ratchettree_1.RatchetTreeView(cipherSuite, 0, // leaf num
            new lbbtree_1.Tree([
                new ratchettree_1.NodeData(undefined, hpkePubKey, [], credential, undefined, 0),
            ]), [keyPackage]);
            const initialGroupContext = new GroupContext(groupId, 0, // FIXME: or 1?
            yield ratchetTreeView0.calculateTreeHash(), constants_1.EMPTY_BYTE_ARRAY, // initial confirmed transcript hash
            groupExtensions);
            const adds = otherMembers.map(keyPackage => new message_1.Add(keyPackage));
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [ratchetTreeView1,] = yield ratchetTreeView0.applyProposals(adds);
            const provisionalGroupContext = new GroupContext(groupId, 0, yield ratchetTreeView1.calculateTreeHash(), constants_1.EMPTY_BYTE_ARRAY, groupExtensions);
            const [updatePath, pathSecrets, ratchetTreeView2] = yield ratchetTreeView1.update((pubkey) => keypackage_1.KeyPackage.create(version, cipherSuite, pubkey, credential, [new keypackage_1.Generation(2)], // FIXME: extensions -- same as group extension?
            signingPrivateKey), provisionalGroupContext);
            // FIXME: if we have too many adds, we may need to send the adds as
            // separate proposals, and the Commit message will need to use hashes
            // instead
            const commit = new message_1.Commit(adds.map(add => new message_1.ProposalWrapper(add)), updatePath);
            const plaintext = yield message_1.MLSPlaintext.create(cipherSuite, groupId, 0, new message_1.Sender(constants_1.SenderType.Member, 0), constants_1.EMPTY_BYTE_ARRAY, commit, signingPrivateKey, initialGroupContext);
            const confirmedTranscriptHash = yield calculateConfirmedTranscriptHash(cipherSuite, plaintext, constants_1.EMPTY_BYTE_ARRAY);
            const newGroupContext = new GroupContext(groupId, 1, yield ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, groupExtensions);
            const initSecret = new Uint8Array(cipherSuite.hpke.kdf.extractLength);
            globalThis.crypto.getRandomValues(initSecret);
            const commitSecret = pathSecrets[pathSecrets.length - 1];
            const secrets = yield (0, keyschedule_1.generateSecrets)(cipherSuite, initSecret, commitSecret, newGroupContext);
            yield plaintext.calculateTags(cipherSuite, secrets.confirmationKey, constants_1.EMPTY_BYTE_ARRAY, // FIXME: ???
            initialGroupContext);
            const interimTranscriptHash = yield calculateInterimTranscriptHash(cipherSuite, plaintext, confirmedTranscriptHash);
            const secretTree = new keyschedule_1.SecretTree(cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size);
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
            const groupInfo = yield welcome_1.GroupInfo.create(groupId, 1, yield ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, 
            // FIXME: other extensions?
            // FIXME: allow sending the ratchet tree in other ways
            [yield ratchetTreeView2.toRatchetTreeExtension()], plaintext.confirmationTag, 0, signingPrivateKey);
            const welcome = yield welcome_1.Welcome.create(cipherSuite, secrets.joinerSecret, groupInfo, recipients);
            return [group, plaintext, welcome];
        });
    }
    static createFromWelcome(welcome, keyPackages) {
        return __awaiter(this, void 0, void 0, function* () {
            const cipherSuite = welcome.cipherSuite;
            const [groupSecrets, groupInfo, keyId] = yield welcome.decrypt(keyPackages);
            // FIXME: check signature on groupInfo (we need a public signing key)
            // FIXME: support other methods of getting the ratchet tree
            const [keyPackage, hpkeKey] = keyPackages[keyId];
            const ratchetTreeExt = groupInfo.extensions.find(ext => ext instanceof keypackage_1.RatchetTree);
            if (!ratchetTreeExt) {
                throw new Error("Could not find ratchet tree");
            }
            const [ratchetTreeView, commitSecret] = yield ratchettree_1.RatchetTreeView.fromRatchetTreeExtension(cipherSuite, ratchetTreeExt, keyPackage, hpkeKey, groupInfo.signerIndex, groupSecrets.pathSecret);
            const signerKeyPackage = ratchetTreeView.keyPackages[groupInfo.signerIndex];
            if (!signerKeyPackage) {
                throw new Error("Signer doesn't have a key package");
            }
            if (!(yield groupInfo.checkSignature(signerKeyPackage.credential))) {
                throw new Error("Signature on group info does not match");
            }
            const treeHash = yield ratchetTreeView.calculateTreeHash();
            if (!(0, util_1.eqUint8Array)(treeHash, groupInfo.treeHash)) {
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
            yield Promise.all(ratchetTreeView.keyPackages.map((keyPackage, idx) => __awaiter(this, void 0, void 0, function* () {
                if (keyPackage !== undefined && !(yield keyPackage.checkSignature())) {
                    throw new Error(`Invalid signature for key package #${idx}`);
                }
            })));
            const groupContext = new GroupContext(groupInfo.groupId, groupInfo.epoch, groupInfo.treeHash, groupInfo.confirmedTranscriptHash, []);
            const secrets = yield (0, keyschedule_1.generateSecretsFromJoinerSecret)(cipherSuite, groupSecrets.joinerSecret, commitSecret, groupContext);
            const secretTree = new keyschedule_1.SecretTree(cipherSuite, secrets.encryptionSecret, ratchetTreeView.tree.size);
            const interimTranscriptHash = yield calculateInterimTranscriptHash(cipherSuite, groupInfo, groupInfo.confirmedTranscriptHash);
            const group = new Group(keyPackage.version, // FIXME: is this correct?
            cipherSuite, groupInfo.groupId, groupInfo.epoch, signerKeyPackage.credential.identity, [], // FIXME: extensions -- same as groupInfo.extensions minus ratchettree?
            groupInfo.confirmedTranscriptHash, interimTranscriptHash, ratchetTreeView, secrets, secretTree);
            return [keyId, group];
        });
    }
    needsMerge() {
        return this.extremities.size > 1;
    }
    prepareCommit() {
        let baseEpoch = -1;
        let baseSender;
        const members = new util_1.Uint8ArrayMap();
        for (const [epoch, sender] of this.extremities.values()) {
            if (epoch > baseEpoch) {
                baseEpoch = epoch;
                baseSender = sender;
            }
        }
        const resolves = [];
        for (const [epoch, sender] of this.extremities.values()) {
            if (epoch !== baseEpoch || !(0, util_1.eqUint8Array)(sender, baseSender)) {
                resolves.push([epoch, sender]);
            }
        }
        const baseEpochStr = makeEpochStr(baseEpoch, baseSender);
        const baseState = this.states.get(baseEpochStr);
        const identity = baseState.ratchetTreeView.tree.leaf(baseState.leafNum).credential.identity;
        const maxGenerations = new util_1.Uint8ArrayMap();
        let updatePathRequired = false;
        // for each user, find the leaf in the extremities with the highest generation
        for (const [idx, nodeData] of new NumberedIterator(baseState.ratchetTreeView.tree.leaves())) {
            if (nodeData.credential) {
                maxGenerations.set(nodeData.credential.identity, [nodeData.generation, undefined, undefined]);
                members.set(nodeData.credential.identity, idx);
            }
        }
        const extraUsers = new util_1.Uint8ArrayMap();
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
                            const generationExt = keyPackage.extensions.find(ext => ext instanceof keypackage_1.Generation);
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
            if ((0, util_1.eqUint8Array)(identity, keyPackage.credential.identity)) {
                updatePathRequired = true;
            }
            else {
                updates.push(new message_1.Remove(leafNum));
                updates.push(new message_1.Add(keyPackage));
            }
        }
        return [baseEpoch, baseSender, updates, resolves, updatePathRequired, members, extraUsers];
    }
    commit(proposals, credential, signingPrivateKey, baseEpoch, baseSender, updatePathRequired = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseEpochStr = makeEpochStr(baseEpoch, baseSender);
            const baseState = this.states.get(baseEpochStr);
            // unwrap the proposals
            // FIXME: allow proposal references too
            // FIXME: enforce ordering of proposals
            const bareProposals = proposals.map(({ proposal }) => proposal);
            const newMembers = [];
            for (const proposal of bareProposals) {
                if (proposal instanceof message_1.Add) {
                    newMembers.push(proposal.keyPackage);
                }
            }
            const initialGroupContext = new GroupContext(this.groupId, baseEpoch, yield baseState.ratchetTreeView.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
            const [ratchetTreeView1, addPositions] = yield baseState.ratchetTreeView.applyProposals(bareProposals);
            // update path is required if there are no proposals, or if there is a
            // non-add proposal
            // FIXME: figure out whether updating the path is advantageous even when
            // we only have adds
            updatePathRequired = updatePathRequired ||
                bareProposals.length == 0 ||
                bareProposals.some((proposal) => { return !(proposal instanceof message_1.Add); });
            const nextEpoch = baseEpoch + 1;
            let updatePath;
            let commitSecret = constants_1.EMPTY_BYTE_ARRAY; // FIXME: should be 0 vector of the right length
            let pathSecrets = [];
            let ratchetTreeView2 = ratchetTreeView1;
            if (updatePathRequired) {
                const provisionalGroupContext = new GroupContext(this.groupId, baseEpoch, // FIXME: or nextEpoch?
                yield ratchetTreeView1.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
                const generation = ratchetTreeView2.tree.leaf(baseState.leafNum).generation;
                [updatePath, pathSecrets, ratchetTreeView2] = yield ratchetTreeView1.update((pubkey) => keypackage_1.KeyPackage.create(this.version, this.cipherSuite, pubkey, credential, [new keypackage_1.Generation(generation + 1)], // FIXME: extensions -- same as group extension?
                signingPrivateKey), provisionalGroupContext);
                commitSecret = pathSecrets[pathSecrets.length - 1];
            }
            // FIXME: if we have too many proposals, we may need to send some proposals
            // separately, and the Commit message will need to use hashes instead
            const commit = new message_1.Commit(proposals, updatePath);
            const plaintext = yield message_1.MLSPlaintext.create(this.cipherSuite, this.groupId, baseEpoch, new message_1.Sender(constants_1.SenderType.Member, baseState.leafNum), constants_1.EMPTY_BYTE_ARRAY, commit, signingPrivateKey, initialGroupContext);
            const confirmedTranscriptHash = yield calculateConfirmedTranscriptHash(this.cipherSuite, plaintext, baseState.interimTranscriptHash);
            const newGroupContext = new GroupContext(this.groupId, nextEpoch, yield ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, this.extensions);
            const secrets = yield (0, keyschedule_1.generateSecrets)(this.cipherSuite, baseState.secrets.initSecret, commitSecret, newGroupContext);
            yield plaintext.calculateTags(this.cipherSuite, secrets.confirmationKey, secrets.membershipKey, initialGroupContext);
            const interimTranscriptHash = yield calculateInterimTranscriptHash(this.cipherSuite, plaintext, confirmedTranscriptHash);
            const [ciphertext,] = yield this.encryptMlsPlaintext(plaintext, baseEpoch, baseSender);
            // make welcome messages
            let recipients;
            if (pathSecrets.length) {
                recipients = [];
                // FIXME: O(n log n)
                const path = (0, treemath_1.directPath)(baseState.leafNum * 2, ratchetTreeView2.tree.size);
                const nodeNumToLevel = {};
                for (let i = 0; i < path.length; i++) {
                    nodeNumToLevel[path[i]] = i;
                }
                for (let i = 0; i < addPositions.length; i++) {
                    const leafNum = addPositions[i];
                    const ancestor = (0, treemath_1.commonAncestor)(leafNum * 2, baseState.leafNum * 2);
                    recipients.push({ keyPackage: newMembers[i], pathSecret: pathSecrets[nodeNumToLevel[ancestor]] });
                }
            }
            else {
                recipients = newMembers.map(keyPackage => { return { keyPackage }; });
            }
            const groupInfo = yield welcome_1.GroupInfo.create(this.groupId, nextEpoch, yield ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, 
            // FIXME: other extensions?
            // FIXME: allow sending the ratchet tree in other ways
            [yield ratchetTreeView2.toRatchetTreeExtension()], plaintext.confirmationTag, baseState.leafNum, signingPrivateKey);
            const welcome = yield welcome_1.Welcome.create(this.cipherSuite, secrets.joinerSecret, groupInfo, recipients);
            const nextEpochStr = makeEpochStr(nextEpoch, credential.identity);
            this.extremities = new Map([[nextEpochStr, [nextEpoch, credential.identity]]]);
            const nextState = {
                leafNum: baseState.leafNum,
                confirmedTranscriptHash,
                interimTranscriptHash,
                ratchetTreeView: ratchetTreeView2,
                secrets,
                secretTree: new keyschedule_1.SecretTree(this.cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size),
                hashRatchets: {},
            };
            this.states.set(nextEpochStr, nextState);
            return [ciphertext, plaintext, welcome, addPositions];
        });
    }
    applyCommit(plaintext, oldSender, resolves) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(plaintext.content instanceof message_1.Commit)) {
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
                bareProposals.some((proposal) => { return !(proposal instanceof message_1.Add); });
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [ratchetTreeView1, addPositions] = yield baseState.ratchetTreeView.applyProposals(bareProposals);
            const nextEpoch = plaintext.epoch + 1;
            let commitSecret = constants_1.EMPTY_BYTE_ARRAY; // FIXME: should be 0 vector of the right length
            let ratchetTreeView2 = ratchetTreeView1;
            if (commit.updatePath) {
                const provisionalGroupContext = new GroupContext(this.groupId, plaintext.epoch, // FIXME: or nextEpoch?
                yield ratchetTreeView1.calculateTreeHash(), baseState.confirmedTranscriptHash, this.extensions);
                [commitSecret, ratchetTreeView2] = yield ratchetTreeView1.applyUpdatePath(plaintext.sender.sender, commit.updatePath, provisionalGroupContext);
            }
            else if (pathRequired) {
                throw new Error("UpdatePath was required for this commit, but not UpdatePath given");
            }
            const confirmedTranscriptHash = yield calculateConfirmedTranscriptHash(this.cipherSuite, plaintext, baseState.interimTranscriptHash);
            const newGroupContext = new GroupContext(this.groupId, nextEpoch, yield ratchetTreeView2.calculateTreeHash(), confirmedTranscriptHash, this.extensions);
            const interimTranscriptHash = yield calculateInterimTranscriptHash(this.cipherSuite, plaintext, confirmedTranscriptHash);
            const secrets = yield (0, keyschedule_1.generateSecrets)(this.cipherSuite, baseState.secrets.initSecret, commitSecret, newGroupContext);
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
                secretTree: new keyschedule_1.SecretTree(this.cipherSuite, secrets.encryptionSecret, ratchetTreeView2.tree.size),
                hashRatchets: {},
            };
            this.states.set(nextEpochStr, nextState);
            this.extremities.set(nextEpochStr, [nextEpoch, newSender]);
            return addPositions;
        });
    }
    addGroupStates(group, resolves) {
        if (!(0, util_1.eqUint8Array)(group.groupId, this.groupId)) {
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
    encrypt(data, authenticatedData, signingKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.extremities.size > 1) {
                throw new Error("Extremities need resolving before encryption");
            }
            const [epochStr, [epoch, sender]] = [...this.extremities][0];
            const state = this.states.get(epochStr);
            const context = new GroupContext(this.groupId, epoch, yield state.ratchetTreeView.calculateTreeHash(), state.confirmedTranscriptHash, []);
            const mlsPlaintext = yield message_1.MLSPlaintext.create(this.cipherSuite, this.groupId, epoch, new message_1.Sender(constants_1.SenderType.Member, state.leafNum), authenticatedData, data, signingKey, context);
            yield mlsPlaintext.calculateTags(this.cipherSuite, state.secrets.confirmationKey, state.secrets.membershipKey, context);
            const [ciphertext, epochSender] = yield this.encryptMlsPlaintext(mlsPlaintext, epoch, sender);
            return [ciphertext, epoch, epochSender];
        });
    }
    encryptMlsPlaintext(mlsPlaintext, epoch, sender) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    yield state.secretTree.getRatchetsForLeaf(state.leafNum);
            }
            return [
                yield message_1.MLSCiphertext.create(this.cipherSuite, mlsPlaintext, state.hashRatchets[state.leafNum][ratchetNum], state.secrets.senderDataSecret),
                sender,
            ];
        });
    }
    decrypt(mlsCiphertext, epochSender) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(0, util_1.eqUint8Array)(this.groupId, mlsCiphertext.groupId)) {
                throw new Error("Encrypted for the wrong group.");
            }
            const epochStr = makeEpochStr(mlsCiphertext.epoch, epochSender);
            if (!this.states.has(epochStr)) {
                throw new Error("Unknown epoch");
            }
            const state = this.states.get(epochStr);
            // FIXME: verify
            const ratchetNum = mlsCiphertext.contentType == constants_1.ContentType.Application ? 1 : 0;
            return yield mlsCiphertext.decrypt(this.cipherSuite, (sender) => __awaiter(this, void 0, void 0, function* () {
                if (sender >= state.ratchetTreeView.tree.size) {
                    throw new Error("Invalid sender");
                }
                if (!(sender in state.hashRatchets)) {
                    state.hashRatchets[sender] = yield state.secretTree.getRatchetsForLeaf(sender);
                }
                return state.hashRatchets[sender][ratchetNum];
            }), state.secrets.senderDataSecret);
        });
    }
}
exports.Group = Group;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#group-state
class GroupContext {
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
            epoch_1.decodeEpoch,
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVector(keypackage_1.Extension.decode, 4),
        ], buffer, offset);
        return [
            new GroupContext(groupId, epoch, treeHash, confirmedTranscriptHash, extensions),
            offset1,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            (0, epoch_1.encodeEpoch)(this.epoch),
            tlspl.variableOpaque(this.treeHash, 1),
            tlspl.variableOpaque(this.confirmedTranscriptHash, 1),
            tlspl.vector(this.extensions.map(x => x.encoder), 4),
        ]);
    }
}
exports.GroupContext = GroupContext;
function calculateConfirmedTranscriptHash(cipherSuite, plaintext, interimTranscriptHash) {
    return __awaiter(this, void 0, void 0, function* () {
        const mlsPlaintextCommitContent = tlspl.encode([plaintext.commitContentEncoder]);
        const confirmedTranscriptHash = yield cipherSuite.hash.hash((0, util_1.concatUint8Array)([interimTranscriptHash, mlsPlaintextCommitContent]));
        return confirmedTranscriptHash;
    });
}
exports.calculateConfirmedTranscriptHash = calculateConfirmedTranscriptHash;
function calculateInterimTranscriptHash(cipherSuite, plaintext, confirmedTranscriptHash) {
    return __awaiter(this, void 0, void 0, function* () {
        const newInterimTranscriptHash = yield cipherSuite.hash.hash((0, util_1.concatUint8Array)([confirmedTranscriptHash, plaintext.confirmationTag]));
        return newInterimTranscriptHash;
    });
}
exports.calculateInterimTranscriptHash = calculateInterimTranscriptHash;
//# sourceMappingURL=group.js.map