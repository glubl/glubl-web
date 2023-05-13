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
exports.Welcome = exports.EncryptedGroupSecrets = exports.GroupSecrets = exports.GroupInfo = void 0;
/** Welcoming new members.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#welcoming-new-members
 */
const util_1 = require("./util");
const epoch_1 = require("./epoch");
const keyschedule_1 = require("./keyschedule");
const constants_1 = require("./constants");
const ciphersuite_1 = require("./ciphersuite");
const keypackage_1 = require("./keypackage");
const message_1 = require("./message");
const tlspl = require("./tlspl");
class GroupInfo {
    constructor(groupId, epoch, treeHash, confirmedTranscriptHash, extensions, confirmationTag, signerIndex, unsignedEncoding, signature) {
        this.groupId = groupId;
        this.epoch = epoch;
        this.treeHash = treeHash;
        this.confirmedTranscriptHash = confirmedTranscriptHash;
        this.extensions = extensions;
        this.confirmationTag = confirmationTag;
        this.signerIndex = signerIndex;
        this.unsignedEncoding = unsignedEncoding;
        this.signature = signature;
    }
    static create(groupId, epoch, treeHash, confirmedTranscriptHash, extensions, confirmationTag, signerIndex, signingKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const unsignedEncoding = tlspl.encode([
                tlspl.variableOpaque(groupId, 1),
                (0, epoch_1.encodeEpoch)(epoch),
                tlspl.variableOpaque(treeHash, 1),
                tlspl.variableOpaque(confirmedTranscriptHash, 1),
                tlspl.vector(extensions.map(ext => ext.encoder), 4),
                tlspl.variableOpaque(confirmationTag, 1),
                tlspl.uint32(signerIndex),
            ]);
            const signature = yield signingKey.sign(unsignedEncoding);
            return new GroupInfo(groupId, epoch, treeHash, confirmedTranscriptHash, extensions, confirmationTag, signerIndex, unsignedEncoding, signature);
        });
    }
    checkSignature(credential) {
        return credential.verify(this.unsignedEncoding, this.signature);
    }
    static decode(buffer, offset) {
        const [[groupId, epoch, treeHash, confirmedTranscriptHash, extensions, confirmationTag, signerIndex,], offset1,] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            epoch_1.decodeEpoch,
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeVector(keypackage_1.Extension.decode, 4),
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeUint32,
        ], buffer, offset);
        const [[signature], offset2] = tlspl.decode([tlspl.decodeVariableOpaque(2)], buffer, offset1);
        return [
            new GroupInfo(groupId, epoch, treeHash, confirmedTranscriptHash, extensions, confirmationTag, signerIndex, buffer.subarray(offset, offset1), signature),
            offset2,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.groupId, 1),
            (0, epoch_1.encodeEpoch)(this.epoch),
            tlspl.variableOpaque(this.treeHash, 1),
            tlspl.variableOpaque(this.confirmedTranscriptHash, 1),
            tlspl.vector(this.extensions.map(ext => ext.encoder), 4),
            tlspl.variableOpaque(this.confirmationTag, 1),
            tlspl.uint32(this.signerIndex),
            tlspl.variableOpaque(this.signature, 2),
        ]);
    }
}
exports.GroupInfo = GroupInfo;
class GroupSecrets {
    constructor(joinerSecret, pathSecret) {
        this.joinerSecret = joinerSecret;
        this.pathSecret = pathSecret;
    }
    static decode(buffer, offset) {
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [[joinerSecret, pathSecret,], offset1] = tlspl.decode([
            tlspl.decodeVariableOpaque(1),
            tlspl.decodeOptional(tlspl.decodeVariableOpaque(1)),
            tlspl.decodeUint8, // FIXME: decodeOptional(decodeVector(PrSharedKeyID, 2))
        ], buffer, offset);
        return [new GroupSecrets(joinerSecret, pathSecret), offset1];
    }
    get encoder() {
        const fields = [tlspl.variableOpaque(this.joinerSecret, 1)];
        if (this.pathSecret === undefined) {
            fields.push(tlspl.uint8(0));
        }
        else {
            fields.push(tlspl.uint8(1));
            fields.push(tlspl.variableOpaque(this.pathSecret, 1));
        }
        fields.push(tlspl.uint8(0)); // FIXME: psks
        return tlspl.struct(fields);
    }
}
exports.GroupSecrets = GroupSecrets;
class EncryptedGroupSecrets {
    constructor(keyPackageHash, encryptedGroupSecrets) {
        this.keyPackageHash = keyPackageHash;
        this.encryptedGroupSecrets = encryptedGroupSecrets;
    }
    static decode(buffer, offset) {
        const [[keyPackageHash, encryptedGroupSecrets], offset1] = tlspl.decode([tlspl.decodeVariableOpaque(1), message_1.HPKECiphertext.decode], buffer, offset);
        return [new EncryptedGroupSecrets(keyPackageHash, encryptedGroupSecrets), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.keyPackageHash, 1),
            this.encryptedGroupSecrets.encoder,
        ]);
    }
}
exports.EncryptedGroupSecrets = EncryptedGroupSecrets;
class Welcome {
    constructor(cipherSuite, secrets, encryptedGroupInfo) {
        this.cipherSuite = cipherSuite;
        this.secrets = secrets;
        this.encryptedGroupInfo = encryptedGroupInfo;
    }
    static decode(buffer, offset) {
        const [[cipherSuiteId, secrets, encryptedGroupInfo], offset1] = tlspl.decode([
            tlspl.decodeUint16,
            tlspl.decodeVector(EncryptedGroupSecrets.decode, 4),
            tlspl.decodeVariableOpaque(4),
        ], buffer, offset);
        const cipherSuite = ciphersuite_1.cipherSuiteById[cipherSuiteId];
        if (!cipherSuite) {
            throw new Error("Unknown ciphersuite");
        }
        return [new Welcome(cipherSuite, secrets, encryptedGroupInfo), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint16(this.cipherSuite.id),
            tlspl.vector(this.secrets.map(x => x.encoder), 4),
            tlspl.variableOpaque(this.encryptedGroupInfo, 4),
        ]);
    }
    static create(cipherSuite, joinerSecret, groupInfo, recipients) {
        return __awaiter(this, void 0, void 0, function* () {
            const hpke = cipherSuite.hpke;
            // FIXME: make sure all recipients are using the same ciphersuite
            const secrets = yield Promise.all(recipients.map(({ keyPackage, pathSecret }) => __awaiter(this, void 0, void 0, function* () {
                const kpHash = yield keyPackage.hash();
                const groupSecrets = new GroupSecrets(joinerSecret, pathSecret);
                const encryptedGroupSecrets = yield message_1.HPKECiphertext.encrypt(hpke, yield keyPackage.getHpkeKey(), constants_1.EMPTY_BYTE_ARRAY, tlspl.encode([groupSecrets.encoder]));
                return new EncryptedGroupSecrets(kpHash, encryptedGroupSecrets);
            })));
            const [welcomeNonce, welcomeKey] = yield Welcome.calculateWelcomeKey(cipherSuite, joinerSecret, constants_1.EMPTY_BYTE_ARRAY);
            const encodedGroupInfo = tlspl.encode([groupInfo.encoder]);
            const encryptedGroupInfo = yield hpke.aead.seal(welcomeKey, welcomeNonce, constants_1.EMPTY_BYTE_ARRAY, encodedGroupInfo);
            return new Welcome(cipherSuite, secrets, encryptedGroupInfo);
        });
    }
    static calculateWelcomeKey(cipherSuite, joinerSecret, psk) {
        return __awaiter(this, void 0, void 0, function* () {
            const hpke = cipherSuite.hpke;
            const memberIkm = yield (0, keyschedule_1.deriveSecret)(cipherSuite, joinerSecret, constants_1.MEMBER);
            const memberSecret = yield hpke.kdf.extract(memberIkm, psk);
            const welcomeSecret = yield (0, keyschedule_1.deriveSecret)(cipherSuite, memberSecret, constants_1.WELCOME);
            return yield Promise.all([
                hpke.kdf.expand(welcomeSecret, constants_1.NONCE, hpke.aead.nonceLength),
                hpke.kdf.expand(welcomeSecret, constants_1.KEY, hpke.aead.keyLength),
            ]);
        });
    }
    decrypt(keyPackages) {
        return __awaiter(this, void 0, void 0, function* () {
            const hpke = this.cipherSuite.hpke;
            const kpHashes = yield Promise.all(
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            Object.entries(keyPackages).map(([id, [keyPackage,]]) => __awaiter(this, void 0, void 0, function* () {
                return [id, yield keyPackage.hash()];
            })));
            let keyId;
            const secrets = this.secrets.find((secret) => {
                for (const [id, kpHash] of kpHashes) {
                    if ((0, util_1.eqUint8Array)(secret.keyPackageHash, kpHash)) {
                        keyId = id;
                        return true;
                    }
                }
                return false;
            });
            if (secrets === undefined) {
                throw new Error("Not encrypted for our key package");
            }
            const encodedGroupSecrets = yield secrets.encryptedGroupSecrets.decrypt(this.cipherSuite.hpke, keyPackages[keyId][1], constants_1.EMPTY_BYTE_ARRAY);
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [groupSecrets,] = GroupSecrets.decode(encodedGroupSecrets, 0);
            const [welcomeNonce, welcomeKey] = yield Welcome.calculateWelcomeKey(this.cipherSuite, groupSecrets.joinerSecret, constants_1.EMPTY_BYTE_ARRAY);
            const encodedGroupInfo = yield hpke.aead.open(welcomeKey, welcomeNonce, constants_1.EMPTY_BYTE_ARRAY, this.encryptedGroupInfo);
            // eslint-disable-next-line comma-dangle, array-bracket-spacing
            const [groupInfo,] = GroupInfo.decode(encodedGroupInfo, 0);
            return [groupSecrets, groupInfo, keyId];
        });
    }
}
exports.Welcome = Welcome;
//# sourceMappingURL=welcome.js.map