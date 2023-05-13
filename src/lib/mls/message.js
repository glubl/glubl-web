"use strict";
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
var exports = {};

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
exports.Commit = exports.Reference = exports.ProposalWrapper = exports.ProposalOrRef = exports.Remove = exports.Update = exports.Add = exports.Proposal = exports.MLSCiphertext = exports.MLSPlaintext = exports.Sender = exports.UpdatePath = exports.UpdatePathNode = exports.HPKECiphertext = void 0;
const epoch_1 = require("./epoch");
const util_1 = require("./util");
const constants_1 = require("./constants");
const keypackage_1 = require("./keypackage");
const keyschedule_1 = require("./keyschedule");
const tlspl = require("./tlspl");
/* ciphertext encrypted to an HPKE public key
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#update-paths
 */
class HPKECiphertext {
    constructor(kemOutput, ciphertext) {
        this.kemOutput = kemOutput;
        this.ciphertext = ciphertext;
    }
    static encrypt(hpke, pkR, aad, pt) {
        return __awaiter(this, void 0, void 0, function* () {
            const [enc, ct] = yield hpke.sealBase(pkR, constants_1.EMPTY_BYTE_ARRAY, aad, pt);
            return new HPKECiphertext(enc, ct);
        });
    }
    decrypt(hpke, skR, aad) {
        return hpke.openBase(this.kemOutput, skR, constants_1.EMPTY_BYTE_ARRAY, aad, this.ciphertext);
    }
    static decode(buffer, offset) {
        const [[kemOutput, ciphertext], offset1] = tlspl.decode([tlspl.decodeVariableOpaque(2), tlspl.decodeVariableOpaque(2)], buffer, offset);
        return [new HPKECiphertext(kemOutput, ciphertext), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.kemOutput, 2),
            tlspl.variableOpaque(this.ciphertext, 2),
        ]);
    }
}
exports.HPKECiphertext = HPKECiphertext;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#update-paths
class UpdatePathNode {
    constructor(publicKey, // encoding of the node's KEMPublicKey
    encryptedPathSecret) {
        this.publicKey = publicKey;
        this.encryptedPathSecret = encryptedPathSecret;
    }
    static decode(buffer, offset) {
        const [[publicKey, encryptedPathSecret], offset1] = tlspl.decode([tlspl.decodeVariableOpaque(2), tlspl.decodeVector(HPKECiphertext.decode, 4)], buffer, offset);
        return [new UpdatePathNode(publicKey, encryptedPathSecret), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.publicKey, 2),
            tlspl.vector(this.encryptedPathSecret.map(x => x.encoder), 4),
        ]);
    }
}
exports.UpdatePathNode = UpdatePathNode;
class UpdatePath {
    constructor(leafKeyPackage, nodes) {
        this.leafKeyPackage = leafKeyPackage;
        this.nodes = nodes;
    }
    static decode(buffer, offset) {
        const [[leafKeyPackage, nodes], offset1] = tlspl.decode([keypackage_1.KeyPackage.decode, tlspl.decodeVector(UpdatePathNode.decode, 4)], buffer, offset);
        return [new UpdatePath(leafKeyPackage, nodes), offset1];
    }
    get encoder() {
        return tlspl.struct([
            this.leafKeyPackage.encoder,
            tlspl.vector(this.nodes.map(x => x.encoder), 4),
        ]);
    }
}
exports.UpdatePath = UpdatePath;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#message-framing
class Sender {
    constructor(senderType, sender) {
        this.senderType = senderType;
        this.sender = sender;
    }
    static decode(buffer, offset) {
        const [[senderType, sender], offset1] = tlspl.decode([tlspl.decodeUint8, tlspl.decodeUint8], buffer, offset);
        return [new Sender(senderType, sender), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.senderType),
            tlspl.uint8(this.sender),
        ]);
    }
}
exports.Sender = Sender;
class MLSPlaintext {
    constructor(groupId, epoch, sender, authenticatedData, content, signature, confirmationTag, membershipTag) {
        this.groupId = groupId;
        this.epoch = epoch;
        this.sender = sender;
        this.authenticatedData = authenticatedData;
        this.content = content;
        this.signature = signature;
        this.confirmationTag = confirmationTag;
        this.membershipTag = membershipTag;
        this.contentType = MLSPlaintext.getContentType(content);
    }
    static getContentType(content) {
        if (content instanceof Uint8Array) {
            return constants_1.ContentType.Application;
        }
        else if (content instanceof Proposal) {
            return constants_1.ContentType.Proposal;
        }
        else if (content instanceof Commit) {
            return constants_1.ContentType.Commit;
        }
        else {
            throw new Error("Unknown content type");
        }
    }
    static getContentDecode(contentType) {
        switch (contentType) {
            case constants_1.ContentType.Application:
                return tlspl.decodeVariableOpaque(4);
            case constants_1.ContentType.Proposal:
                return Proposal.decode;
            case constants_1.ContentType.Commit:
                return Commit.decode;
            default:
                throw new Error("Unknown content type");
        }
    }
    static create(cipherSuite, groupId, epoch, sender, authenticatedData, content, signingKey, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (sender.senderType === constants_1.SenderType.Member && context === undefined) {
                throw new Error("Group context must be provided for messages sent by members");
            }
            const contentType = MLSPlaintext.getContentType(content);
            const mlsPlaintextTBS = tlspl.encode([
                (sender.senderType === constants_1.SenderType.Member ? context.encoder : tlspl.empty),
                tlspl.variableOpaque(groupId, 1),
                (0, epoch_1.encodeEpoch)(epoch),
                sender.encoder,
                tlspl.variableOpaque(authenticatedData, 4),
                tlspl.uint8(contentType),
                content instanceof Uint8Array ?
                    tlspl.variableOpaque(content, 4) :
                    content.encoder,
            ]);
            const signature = yield signingKey.sign(mlsPlaintextTBS);
            return new MLSPlaintext(groupId, epoch, sender, authenticatedData, content, signature);
        });
    }
    calculateTags(cipherSuite, confirmationKey, membershipKey, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.content instanceof Commit && !confirmationKey) {
                throw new Error("Confirmation key must be provided for commits");
            }
            this.confirmationTag = (this.content instanceof Commit && confirmationKey) ?
                yield cipherSuite.hash.mac(confirmationKey, context.confirmedTranscriptHash) :
                undefined;
            const mlsPlaintextTBS = tlspl.encode([
                (this.sender.senderType === constants_1.SenderType.Member ?
                    context.encoder :
                    tlspl.empty),
                tlspl.variableOpaque(this.groupId, 1),
                (0, epoch_1.encodeEpoch)(this.epoch),
                this.sender.encoder,
                tlspl.variableOpaque(this.authenticatedData, 4),
                tlspl.uint8(this.contentType),
                this.content instanceof Uint8Array ?
                    tlspl.variableOpaque(this.content, 4) :
                    this.content.encoder,
            ]);
            this.membershipTag =
                yield cipherSuite.hash.mac(membershipKey, tlspl.encode([
                    tlspl.opaque(mlsPlaintextTBS),
                    tlspl.variableOpaque(this.signature, 2),
                    this.confirmationTag ?
                        tlspl.struct([tlspl.uint8(1), tlspl.variableOpaque(this.confirmationTag, 1)]) :
                        tlspl.uint8(0),
                ]));
        });
    }
    verify(cipherSuite, signingPubKey, context, membershipKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.sender.senderType === constants_1.SenderType.Member && context === undefined) {
                throw new Error("Group context must be provided for messages sent by members");
            }
            if (this.content instanceof Commit && this.confirmationTag === undefined) {
                throw new Error("Confirmation tag must be present for commits");
            }
            const mlsPlaintextTBS = tlspl.encode([
                (this.sender.senderType === constants_1.SenderType.Member ? context.encoder : tlspl.empty),
                tlspl.variableOpaque(this.groupId, 1),
                (0, epoch_1.encodeEpoch)(this.epoch),
                this.sender.encoder,
                tlspl.variableOpaque(this.authenticatedData, 4),
                tlspl.uint8(this.contentType),
                this.content instanceof Uint8Array ?
                    tlspl.variableOpaque(this.content, 4) :
                    this.content.encoder,
            ]);
            if ((yield signingPubKey.verify(mlsPlaintextTBS, this.signature)) === false) {
                return false;
            }
            if (this.membershipTag) {
                if (membershipKey === undefined) {
                    throw new Error("Membership tag is present, but membership key not supplied");
                }
                const mlsPlaintextTBM = tlspl.encode([
                    tlspl.opaque(mlsPlaintextTBS),
                    tlspl.variableOpaque(this.signature, 2),
                    this.confirmationTag ?
                        tlspl.struct([tlspl.uint8(1), tlspl.variableOpaque(this.confirmationTag, 1)]) :
                        tlspl.uint8(0),
                ]);
                return yield cipherSuite.hash.verifyMac(membershipKey, mlsPlaintextTBM, this.membershipTag);
            }
            return true;
        });
    }
    verifyConfirmationTag(cipherSuite, confirmationKey, context) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(this.content instanceof Commit)) {
                throw new Error("Confirmation tag can only be checked on commit messages");
            }
            const confirmationTag = yield cipherSuite.hash.mac(confirmationKey, context.confirmedTranscriptHash);
            return (0, util_1.eqUint8Array)(confirmationTag, this.confirmationTag);
        });
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, sender, authenticatedData, contentType], offset1] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            epoch_1.decodeEpoch,
            Sender.decode,
            tlspl.decodeVariableOpaque(4),
            tlspl.decodeUint8,
        ], buffer, offset);
        const [[content, signature, confirmationTag, membershipTag], offset2] = tlspl.decode([
            MLSPlaintext.getContentDecode(contentType),
            tlspl.decodeVariableOpaque(2),
            tlspl.decodeOptional(tlspl.decodeVariableOpaque(1)),
            tlspl.decodeOptional(tlspl.decodeVariableOpaque(1)),
        ], buffer, offset1);
        return [
            new MLSPlaintext(groupId, epoch, sender, authenticatedData, content, signature, confirmationTag, membershipTag), offset2,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            (0, epoch_1.encodeEpoch)(this.epoch),
            this.sender.encoder,
            tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.uint8(this.contentType),
            this.content instanceof Uint8Array ?
                tlspl.variableOpaque(this.content, 4) :
                this.content.encoder,
            tlspl.variableOpaque(this.signature, 2),
            this.confirmationTag ?
                tlspl.struct([
                    tlspl.uint8(1), tlspl.variableOpaque(this.confirmationTag, 1),
                ]) :
                tlspl.uint8(0),
            this.membershipTag ?
                tlspl.struct([
                    tlspl.uint8(1), tlspl.variableOpaque(this.membershipTag, 1),
                ]) :
                tlspl.uint8(0),
        ]);
    }
    get commitContentEncoder() {
        if (!(this.content instanceof Commit)) {
            throw new Error("Not a commit message");
        }
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            (0, epoch_1.encodeEpoch)(this.epoch),
            this.sender.encoder,
            // FIXME: tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.uint8(this.contentType),
            this.content instanceof Uint8Array ?
                tlspl.variableOpaque(this.content, 4) :
                this.content.encoder,
            tlspl.variableOpaque(this.signature, 2),
        ]);
    }
}
exports.MLSPlaintext = MLSPlaintext;
class MLSCiphertext {
    constructor(groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext) {
        this.groupId = groupId;
        this.epoch = epoch;
        this.contentType = contentType;
        this.authenticatedData = authenticatedData;
        this.encryptedSenderData = encryptedSenderData;
        this.ciphertext = ciphertext;
    }
    static create(cipherSuite, plaintext, contentRatchet, senderDataSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            if (plaintext.sender.senderType !== constants_1.SenderType.Member) {
                throw new Error("Sender must be a group member");
            }
            const hpke = cipherSuite.hpke;
            const mlsCiphertextContent = tlspl.encode([
                plaintext.content instanceof Uint8Array ?
                    tlspl.variableOpaque(plaintext.content, 4) :
                    plaintext.content.encoder,
                tlspl.variableOpaque(plaintext.signature, 2),
                plaintext.confirmationTag ?
                    tlspl.struct([
                        tlspl.uint8(1), tlspl.variableOpaque(plaintext.confirmationTag, 1),
                    ]) :
                    tlspl.uint8(0),
                tlspl.variableOpaque(constants_1.EMPTY_BYTE_ARRAY, 2), // FIXME: padding
            ]);
            const mlsCiphertextContentAad = tlspl.encode([
                tlspl.variableOpaque(plaintext.groupId, 1),
                (0, epoch_1.encodeEpoch)(plaintext.epoch),
                tlspl.uint8(plaintext.contentType),
                tlspl.variableOpaque(plaintext.authenticatedData, 4),
            ]);
            // encrypt content
            const reuseGuard = new Uint8Array(4);
            globalThis.crypto.getRandomValues(reuseGuard);
            const generation = contentRatchet.generation;
            const [contentNonce, contentKey] = yield contentRatchet.getKey(generation);
            for (let i = 0; i < 4; i++) {
                contentNonce[i] ^= reuseGuard[i];
            }
            const ciphertext = yield hpke.aead.seal(contentKey, contentNonce, mlsCiphertextContentAad, mlsCiphertextContent);
            contentKey.fill(0);
            contentNonce.fill(0);
            // encrypt sender
            const mlsSenderData = tlspl.encode([
                tlspl.uint32(plaintext.sender.sender),
                tlspl.uint32(generation),
                tlspl.opaque(reuseGuard),
            ]);
            const mlsSenderDataAad = tlspl.encode([
                tlspl.variableOpaque(plaintext.groupId, 1),
                (0, epoch_1.encodeEpoch)(plaintext.epoch),
                tlspl.uint8(plaintext.contentType),
            ]);
            const ciphertextSample = ciphertext.subarray(0, hpke.kdf.extractLength);
            const [senderDataKey, senderDataNonce] = yield Promise.all([
                (0, keyschedule_1.expandWithLabel)(cipherSuite, senderDataSecret, constants_1.KEY, ciphertextSample, hpke.aead.keyLength),
                (0, keyschedule_1.expandWithLabel)(cipherSuite, senderDataSecret, constants_1.NONCE, ciphertextSample, hpke.aead.nonceLength),
            ]);
            const encryptedSenderData = yield hpke.aead.seal(senderDataKey, senderDataNonce, mlsSenderDataAad, mlsSenderData);
            return new MLSCiphertext(plaintext.groupId, plaintext.epoch, plaintext.contentType, plaintext.authenticatedData, encryptedSenderData, ciphertext);
        });
    }
    decrypt(cipherSuite, getContentRatchet, senderDataSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            const hpke = cipherSuite.hpke;
            // decrypt sender
            const mlsSenderDataAad = tlspl.encode([
                tlspl.variableOpaque(this.groupId, 1),
                (0, epoch_1.encodeEpoch)(this.epoch),
                tlspl.uint8(this.contentType),
            ]);
            const ciphertextSample = this.ciphertext.subarray(0, hpke.kdf.extractLength);
            const [senderDataKey, senderDataNonce] = yield Promise.all([
                (0, keyschedule_1.expandWithLabel)(cipherSuite, senderDataSecret, constants_1.KEY, ciphertextSample, hpke.aead.keyLength),
                (0, keyschedule_1.expandWithLabel)(cipherSuite, senderDataSecret, constants_1.NONCE, ciphertextSample, hpke.aead.nonceLength),
            ]);
            const mlsSenderData = yield hpke.aead.open(senderDataKey, senderDataNonce, mlsSenderDataAad, this.encryptedSenderData);
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [[sender, generation, reuseGuard],] = tlspl.decode([
                tlspl.decodeUint32,
                tlspl.decodeUint32,
                tlspl.decodeOpaque(4),
            ], mlsSenderData, 0);
            // decrypt content
            const mlsCiphertextContentAad = tlspl.encode([
                tlspl.variableOpaque(this.groupId, 1),
                (0, epoch_1.encodeEpoch)(this.epoch),
                tlspl.uint8(this.contentType),
                tlspl.variableOpaque(this.authenticatedData, 4),
            ]);
            const [contentNonce, contentKey] = yield (yield getContentRatchet(sender))
                .getKey(generation);
            for (let i = 0; i < 4; i++) {
                contentNonce[i] ^= reuseGuard[i];
            }
            const mlsCiphertextContent = yield hpke.aead.open(contentKey, contentNonce, mlsCiphertextContentAad, this.ciphertext);
            contentKey.fill(0);
            contentNonce.fill(0);
            const contentDecode = MLSPlaintext.getContentDecode(this.contentType);
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [[content, signature, confirmationTag,],] = tlspl.decode([
                contentDecode,
                tlspl.decodeVariableOpaque(2),
                tlspl.decodeOptional(tlspl.decodeVariableOpaque(1)),
                tlspl.decodeOptional(tlspl.decodeVariableOpaque(2)),
            ], mlsCiphertextContent, 0);
            return new MLSPlaintext(this.groupId, this.epoch, new Sender(constants_1.SenderType.Member, sender), this.authenticatedData, content, signature, confirmationTag);
        });
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext,], offset1,] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            epoch_1.decodeEpoch,
            tlspl.decodeUint8,
            tlspl.decodeVariableOpaque(4),
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVariableOpaque(4),
        ], buffer, offset);
        return [
            new MLSCiphertext(groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext),
            offset1,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            (0, epoch_1.encodeEpoch)(this.epoch),
            tlspl.uint8(this.contentType),
            tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.variableOpaque(this.encryptedSenderData, 1),
            tlspl.variableOpaque(this.ciphertext, 4),
        ]);
    }
}
exports.MLSCiphertext = MLSCiphertext;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#proposals
class Proposal {
    constructor(msgType) {
        this.msgType = msgType;
    }
    static decode(buffer, offset) {
        const [msgType, offset1] = tlspl.decodeUint8(buffer, offset);
        switch (msgType) {
            case constants_1.ProposalType.Add:
                return Add.decode(buffer, offset1);
            case constants_1.ProposalType.Update:
                return Update.decode(buffer, offset1);
            case constants_1.ProposalType.Remove:
                return Remove.decode(buffer, offset1);
            default:
                throw new Error("Unknown proposal type");
        }
    }
    getHash(cipherSuite) {
        return __awaiter(this, void 0, void 0, function* () {
            const encoding = tlspl.encode([this.encoder]);
            return yield cipherSuite.hash.hash(encoding);
        });
    }
}
exports.Proposal = Proposal;
class Add extends Proposal {
    constructor(keyPackage) {
        super(constants_1.ProposalType.Add);
        this.keyPackage = keyPackage;
    }
    static decode(buffer, offset) {
        const [keyPackage, offset1] = keypackage_1.KeyPackage.decode(buffer, offset);
        return [new Add(keyPackage), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.msgType),
            this.keyPackage.encoder,
        ]);
    }
}
exports.Add = Add;
class Update extends Proposal {
    constructor(keyPackage, privateKey) {
        super(constants_1.ProposalType.Update);
        this.keyPackage = keyPackage;
        this.privateKey = privateKey;
    }
    static decode(buffer, offset) {
        const [keyPackage, offset1] = keypackage_1.KeyPackage.decode(buffer, offset);
        return [new Update(keyPackage), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.msgType),
            this.keyPackage.encoder,
        ]);
    }
}
exports.Update = Update;
class Remove extends Proposal {
    constructor(removed) {
        super(constants_1.ProposalType.Remove);
        this.removed = removed;
    }
    static decode(buffer, offset) {
        const [removed, offset1] = tlspl.decodeUint32(buffer, offset);
        return [new Remove(removed), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.msgType),
            tlspl.uint32(this.removed),
        ]);
    }
}
exports.Remove = Remove;
// FIXME: more proposals
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#commit
class ProposalOrRef {
    constructor(proposalOrRef) {
        this.proposalOrRef = proposalOrRef;
    }
    static decode(buffer, offset) {
        const [proposalOrRef, offset1] = tlspl.decodeUint8(buffer, offset);
        switch (proposalOrRef) {
            case constants_1.ProposalOrRefType.Proposal:
                return ProposalWrapper.decode(buffer, offset1);
            case constants_1.ProposalOrRefType.Reference:
                return Reference.decode(buffer, offset1);
            default:
                throw new Error("Unknown proposalOrRef type");
        }
    }
}
exports.ProposalOrRef = ProposalOrRef;
class ProposalWrapper extends ProposalOrRef {
    constructor(proposal) {
        super(constants_1.ProposalOrRefType.Proposal);
        this.proposal = proposal;
    }
    static decode(buffer, offset) {
        const [proposal, offset1] = Proposal.decode(buffer, offset);
        return [new ProposalWrapper(proposal), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.proposalOrRef),
            this.proposal.encoder,
        ]);
    }
}
exports.ProposalWrapper = ProposalWrapper;
class Reference extends ProposalOrRef {
    constructor(hash) {
        super(constants_1.ProposalOrRefType.Reference);
        this.hash = hash;
    }
    static decode(buffer, offset) {
        const [hash, offset1] = tlspl.decodeVariableOpaque(1)(buffer, offset);
        return [new Reference(hash), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.proposalOrRef),
            tlspl.variableOpaque(this.hash, 1),
        ]);
    }
}
exports.Reference = Reference;
class Commit {
    constructor(proposals, updatePath) {
        this.proposals = proposals;
        this.updatePath = updatePath;
    }
    static decode(buffer, offset) {
        const [[proposals, updatePath], offset1] = tlspl.decode([
            tlspl.decodeVector(ProposalOrRef.decode, 4),
            tlspl.decodeOptional(UpdatePath.decode),
        ], buffer, offset);
        return [new Commit(proposals, updatePath), offset1];
    }
    get encoder() {
        if (this.updatePath === undefined) {
            return tlspl.struct([
                tlspl.vector(this.proposals.map(x => x.encoder), 4),
                tlspl.uint8(0),
            ]);
        }
        else {
            return tlspl.struct([
                tlspl.vector(this.proposals.map(x => x.encoder), 4),
                tlspl.uint8(1),
                this.updatePath.encoder,
            ]);
        }
    }
}
exports.Commit = Commit;
//# sourceMappingURL=message.js.map