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
import { decodeEpoch, encodeEpoch } from "./epoch";
import { eqUint8Array } from "./util";
import { EMPTY_BYTE_ARRAY, NONCE, KEY, ContentType, SenderType, ProposalType, ProposalOrRefType } from "./constants";
import { KeyPackage } from "./keypackage";
import { expandWithLabel } from "./keyschedule";
import * as tlspl from "./tlspl";
/* ciphertext encrypted to an HPKE public key
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#update-paths
 */
export class HPKECiphertext {
    kemOutput;
    ciphertext;
    constructor(kemOutput, ciphertext) {
        this.kemOutput = kemOutput;
        this.ciphertext = ciphertext;
    }
    static async encrypt(hpke, pkR, aad, pt) {
        const [enc, ct] = await hpke.sealBase(pkR, EMPTY_BYTE_ARRAY, aad, pt);
        return new HPKECiphertext(enc, ct);
    }
    decrypt(hpke, skR, aad) {
        return hpke.openBase(this.kemOutput, skR, EMPTY_BYTE_ARRAY, aad, this.ciphertext);
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
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#update-paths
export class UpdatePathNode {
    publicKey;
    encryptedPathSecret;
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
export class UpdatePath {
    leafKeyPackage;
    nodes;
    constructor(leafKeyPackage, nodes) {
        this.leafKeyPackage = leafKeyPackage;
        this.nodes = nodes;
    }
    static decode(buffer, offset) {
        const [[leafKeyPackage, nodes], offset1] = tlspl.decode([KeyPackage.decode, tlspl.decodeVector(UpdatePathNode.decode, 4)], buffer, offset);
        return [new UpdatePath(leafKeyPackage, nodes), offset1];
    }
    get encoder() {
        return tlspl.struct([
            this.leafKeyPackage.encoder,
            tlspl.vector(this.nodes.map(x => x.encoder), 4),
        ]);
    }
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#message-framing
export class Sender {
    senderType;
    sender;
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
export class MLSPlaintext {
    groupId;
    epoch;
    sender;
    authenticatedData;
    content;
    signature;
    confirmationTag;
    membershipTag;
    contentType;
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
            return ContentType.Application;
        }
        else if (content instanceof Proposal) {
            return ContentType.Proposal;
        }
        else if (content instanceof Commit) {
            return ContentType.Commit;
        }
        else {
            throw new Error("Unknown content type");
        }
    }
    static getContentDecode(contentType) {
        switch (contentType) {
            case ContentType.Application:
                return tlspl.decodeVariableOpaque(4);
            case ContentType.Proposal:
                return Proposal.decode;
            case ContentType.Commit:
                return Commit.decode;
            default:
                throw new Error("Unknown content type");
        }
    }
    static async create(cipherSuite, groupId, epoch, sender, authenticatedData, content, signingKey, context) {
        if (sender.senderType === SenderType.Member && context === undefined) {
            throw new Error("Group context must be provided for messages sent by members");
        }
        const contentType = MLSPlaintext.getContentType(content);
        const mlsPlaintextTBS = tlspl.encode([
            (sender.senderType === SenderType.Member ? context.encoder : tlspl.empty),
            tlspl.variableOpaque(groupId, 1),
            encodeEpoch(epoch),
            sender.encoder,
            tlspl.variableOpaque(authenticatedData, 4),
            tlspl.uint8(contentType),
            content instanceof Uint8Array ?
                tlspl.variableOpaque(content, 4) :
                content.encoder,
        ]);
        const signature = await signingKey.sign(mlsPlaintextTBS);
        return new MLSPlaintext(groupId, epoch, sender, authenticatedData, content, signature);
    }
    async calculateTags(cipherSuite, confirmationKey, membershipKey, context) {
        if (this.content instanceof Commit && !confirmationKey) {
            throw new Error("Confirmation key must be provided for commits");
        }
        this.confirmationTag = (this.content instanceof Commit && confirmationKey) ?
            await cipherSuite.hash.mac(confirmationKey, context.confirmedTranscriptHash) :
            undefined;
        const mlsPlaintextTBS = tlspl.encode([
            (this.sender.senderType === SenderType.Member ?
                context.encoder :
                tlspl.empty),
            tlspl.variableOpaque(this.groupId, 1),
            encodeEpoch(this.epoch),
            this.sender.encoder,
            tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.uint8(this.contentType),
            this.content instanceof Uint8Array ?
                tlspl.variableOpaque(this.content, 4) :
                this.content.encoder,
        ]);
        this.membershipTag =
            await cipherSuite.hash.mac(membershipKey, tlspl.encode([
                tlspl.opaque(mlsPlaintextTBS),
                tlspl.variableOpaque(this.signature, 2),
                this.confirmationTag ?
                    tlspl.struct([tlspl.uint8(1), tlspl.variableOpaque(this.confirmationTag, 1)]) :
                    tlspl.uint8(0),
            ]));
    }
    async verify(cipherSuite, signingPubKey, context, membershipKey) {
        if (this.sender.senderType === SenderType.Member && context === undefined) {
            throw new Error("Group context must be provided for messages sent by members");
        }
        if (this.content instanceof Commit && this.confirmationTag === undefined) {
            throw new Error("Confirmation tag must be present for commits");
        }
        const mlsPlaintextTBS = tlspl.encode([
            (this.sender.senderType === SenderType.Member ? context.encoder : tlspl.empty),
            tlspl.variableOpaque(this.groupId, 1),
            encodeEpoch(this.epoch),
            this.sender.encoder,
            tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.uint8(this.contentType),
            this.content instanceof Uint8Array ?
                tlspl.variableOpaque(this.content, 4) :
                this.content.encoder,
        ]);
        if (await signingPubKey.verify(mlsPlaintextTBS, this.signature) === false) {
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
            return await cipherSuite.hash.verifyMac(membershipKey, mlsPlaintextTBM, this.membershipTag);
        }
        return true;
    }
    async verifyConfirmationTag(cipherSuite, confirmationKey, context) {
        if (!(this.content instanceof Commit)) {
            throw new Error("Confirmation tag can only be checked on commit messages");
        }
        const confirmationTag = await cipherSuite.hash.mac(confirmationKey, context.confirmedTranscriptHash);
        return eqUint8Array(confirmationTag, this.confirmationTag);
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, sender, authenticatedData, contentType], offset1] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            decodeEpoch,
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
            encodeEpoch(this.epoch),
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
            encodeEpoch(this.epoch),
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
export class MLSCiphertext {
    groupId;
    epoch;
    contentType;
    authenticatedData;
    encryptedSenderData;
    ciphertext;
    constructor(groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext) {
        this.groupId = groupId;
        this.epoch = epoch;
        this.contentType = contentType;
        this.authenticatedData = authenticatedData;
        this.encryptedSenderData = encryptedSenderData;
        this.ciphertext = ciphertext;
    }
    static async create(cipherSuite, plaintext, contentRatchet, senderDataSecret) {
        if (plaintext.sender.senderType !== SenderType.Member) {
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
            tlspl.variableOpaque(EMPTY_BYTE_ARRAY, 2), // FIXME: padding
        ]);
        const mlsCiphertextContentAad = tlspl.encode([
            tlspl.variableOpaque(plaintext.groupId, 1),
            encodeEpoch(plaintext.epoch),
            tlspl.uint8(plaintext.contentType),
            tlspl.variableOpaque(plaintext.authenticatedData, 4),
        ]);
        // encrypt content
        const reuseGuard = new Uint8Array(4);
        globalThis.crypto.getRandomValues(reuseGuard);
        const generation = contentRatchet.generation;
        const [contentNonce, contentKey] = await contentRatchet.getKey(generation);
        for (let i = 0; i < 4; i++) {
            contentNonce[i] ^= reuseGuard[i];
        }
        const ciphertext = await hpke.aead.seal(contentKey, contentNonce, mlsCiphertextContentAad, mlsCiphertextContent);
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
            encodeEpoch(plaintext.epoch),
            tlspl.uint8(plaintext.contentType),
        ]);
        const ciphertextSample = ciphertext.subarray(0, hpke.kdf.extractLength);
        const [senderDataKey, senderDataNonce] = await Promise.all([
            expandWithLabel(cipherSuite, senderDataSecret, KEY, ciphertextSample, hpke.aead.keyLength),
            expandWithLabel(cipherSuite, senderDataSecret, NONCE, ciphertextSample, hpke.aead.nonceLength),
        ]);
        const encryptedSenderData = await hpke.aead.seal(senderDataKey, senderDataNonce, mlsSenderDataAad, mlsSenderData);
        return new MLSCiphertext(plaintext.groupId, plaintext.epoch, plaintext.contentType, plaintext.authenticatedData, encryptedSenderData, ciphertext);
    }
    async decrypt(cipherSuite, getContentRatchet, senderDataSecret) {
        const hpke = cipherSuite.hpke;
        // decrypt sender
        const mlsSenderDataAad = tlspl.encode([
            tlspl.variableOpaque(this.groupId, 1),
            encodeEpoch(this.epoch),
            tlspl.uint8(this.contentType),
        ]);
        const ciphertextSample = this.ciphertext.subarray(0, hpke.kdf.extractLength);
        const [senderDataKey, senderDataNonce] = await Promise.all([
            expandWithLabel(cipherSuite, senderDataSecret, KEY, ciphertextSample, hpke.aead.keyLength),
            expandWithLabel(cipherSuite, senderDataSecret, NONCE, ciphertextSample, hpke.aead.nonceLength),
        ]);
        const mlsSenderData = await hpke.aead.open(senderDataKey, senderDataNonce, mlsSenderDataAad, this.encryptedSenderData);
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [[sender, generation, reuseGuard],] = tlspl.decode([
            tlspl.decodeUint32,
            tlspl.decodeUint32,
            tlspl.decodeOpaque(4),
        ], mlsSenderData, 0);
        // decrypt content
        const mlsCiphertextContentAad = tlspl.encode([
            tlspl.variableOpaque(this.groupId, 1),
            encodeEpoch(this.epoch),
            tlspl.uint8(this.contentType),
            tlspl.variableOpaque(this.authenticatedData, 4),
        ]);
        const [contentNonce, contentKey] = await (await getContentRatchet(sender))
            .getKey(generation);
        for (let i = 0; i < 4; i++) {
            contentNonce[i] ^= reuseGuard[i];
        }
        const mlsCiphertextContent = await hpke.aead.open(contentKey, contentNonce, mlsCiphertextContentAad, this.ciphertext);
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
        return new MLSPlaintext(this.groupId, this.epoch, new Sender(SenderType.Member, sender), this.authenticatedData, content, signature, confirmationTag);
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, contentType, authenticatedData, encryptedSenderData, ciphertext,], offset1,] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            decodeEpoch,
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
            encodeEpoch(this.epoch),
            tlspl.uint8(this.contentType),
            tlspl.variableOpaque(this.authenticatedData, 4),
            tlspl.variableOpaque(this.encryptedSenderData, 1),
            tlspl.variableOpaque(this.ciphertext, 4),
        ]);
    }
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#proposals
export class Proposal {
    msgType;
    constructor(msgType) {
        this.msgType = msgType;
    }
    static decode(buffer, offset) {
        const [msgType, offset1] = tlspl.decodeUint8(buffer, offset);
        switch (msgType) {
            case ProposalType.Add:
                return Add.decode(buffer, offset1);
            case ProposalType.Update:
                return Update.decode(buffer, offset1);
            case ProposalType.Remove:
                return Remove.decode(buffer, offset1);
            default:
                throw new Error("Unknown proposal type");
        }
    }
    async getHash(cipherSuite) {
        const encoding = tlspl.encode([this.encoder]);
        return await cipherSuite.hash.hash(encoding);
    }
}
export class Add extends Proposal {
    keyPackage;
    constructor(keyPackage) {
        super(ProposalType.Add);
        this.keyPackage = keyPackage;
    }
    static decode(buffer, offset) {
        const [keyPackage, offset1] = KeyPackage.decode(buffer, offset);
        return [new Add(keyPackage), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.msgType),
            this.keyPackage.encoder,
        ]);
    }
}
export class Update extends Proposal {
    keyPackage;
    privateKey;
    constructor(keyPackage, privateKey) {
        super(ProposalType.Update);
        this.keyPackage = keyPackage;
        this.privateKey = privateKey;
    }
    static decode(buffer, offset) {
        const [keyPackage, offset1] = KeyPackage.decode(buffer, offset);
        return [new Update(keyPackage), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.msgType),
            this.keyPackage.encoder,
        ]);
    }
}
export class Remove extends Proposal {
    removed;
    constructor(removed) {
        super(ProposalType.Remove);
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
// FIXME: more proposals
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#commit
export class ProposalOrRef {
    proposalOrRef;
    constructor(proposalOrRef) {
        this.proposalOrRef = proposalOrRef;
    }
    static decode(buffer, offset) {
        const [proposalOrRef, offset1] = tlspl.decodeUint8(buffer, offset);
        switch (proposalOrRef) {
            case ProposalOrRefType.Proposal:
                return ProposalWrapper.decode(buffer, offset1);
            case ProposalOrRefType.Reference:
                return Reference.decode(buffer, offset1);
            default:
                throw new Error("Unknown proposalOrRef type");
        }
    }
}
export class ProposalWrapper extends ProposalOrRef {
    proposal;
    constructor(proposal) {
        super(ProposalOrRefType.Proposal);
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
export class Reference extends ProposalOrRef {
    hash;
    constructor(hash) {
        super(ProposalOrRefType.Reference);
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
export class Commit {
    proposals;
    updatePath;
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
//# sourceMappingURL=message.js.map