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
exports.LenientHashRatchet = exports.HashRatchet = exports.SecretTree = exports.generateSecretsFromJoinerSecret = exports.generateSecrets = exports.deriveSecret = exports.expandWithLabel = void 0;
/** The key schedule determines how to derive keys for various uses.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#key-schedule
 */
const util_1 = require("./util");
const constants_1 = require("./constants");
const tlspl = require("./tlspl");
const treemath_1 = require("./treemath");
function expandWithLabel(cipherSuite, secret, label, context, length) {
    return __awaiter(this, void 0, void 0, function* () {
        return cipherSuite.hpke.kdf.expand(secret, tlspl.encode([
            tlspl.uint16(length),
            tlspl.variableOpaque((0, util_1.concatUint8Array)([constants_1.MLS10, label]), 1),
            tlspl.variableOpaque(context, 4),
        ]), length);
    });
}
exports.expandWithLabel = expandWithLabel;
function deriveSecret(cipherSuite, secret, label) {
    return __awaiter(this, void 0, void 0, function* () {
        return expandWithLabel(cipherSuite, secret, label, constants_1.EMPTY_BYTE_ARRAY, cipherSuite.hpke.kdf.extractLength);
    });
}
exports.deriveSecret = deriveSecret;
function generateSecrets(cipherSuite, initSecret, commitSecret, groupContext, psk) {
    return __awaiter(this, void 0, void 0, function* () {
        const joinerSecret = yield cipherSuite.hpke.kdf.extract(initSecret, commitSecret);
        return yield generateSecretsFromJoinerSecret(cipherSuite, joinerSecret, commitSecret, groupContext, psk);
    });
}
exports.generateSecrets = generateSecrets;
function generateSecretsFromJoinerSecret(cipherSuite, joinerSecret, commitSecret, groupContext, psk) {
    return __awaiter(this, void 0, void 0, function* () {
        if (psk === undefined) {
            psk = constants_1.EMPTY_BYTE_ARRAY;
        }
        const memberIkm = yield deriveSecret(cipherSuite, joinerSecret, constants_1.MEMBER);
        const memberSecret = yield cipherSuite.hpke.kdf.extract(memberIkm, psk);
        const welcomeSecret = yield deriveSecret(cipherSuite, memberSecret, constants_1.WELCOME);
        const epochSecret = yield expandWithLabel(cipherSuite, welcomeSecret, constants_1.EPOCH, tlspl.encode([groupContext.encoder]), cipherSuite.hpke.kdf.extractLength);
        const [senderDataSecret, encryptionSecret, exporterSecret, authenticationSecret, externalSecret, confirmationKey, membershipKey, resumptionSecret, nextInitSecret,] = yield Promise.all([
            constants_1.SENDER_DATA,
            constants_1.ENCRYPTION,
            constants_1.EXPORTER,
            constants_1.AUTHENTICATION,
            constants_1.EXTERNAL,
            constants_1.CONFIRM,
            constants_1.MEMBERSHIP,
            constants_1.RESUMPTION,
            constants_1.INIT,
        ].map(label => deriveSecret(cipherSuite, epochSecret, label)));
        return {
            joinerSecret,
            memberSecret,
            welcomeSecret,
            senderDataSecret,
            encryptionSecret,
            exporterSecret,
            authenticationSecret,
            externalSecret,
            confirmationKey,
            membershipKey,
            resumptionSecret,
            initSecret: nextInitSecret,
        };
    });
}
exports.generateSecretsFromJoinerSecret = generateSecretsFromJoinerSecret;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#secret-tree-secret-tree
function deriveTreeSecret(cipherSuite, secret, label, node, generation, length) {
    return __awaiter(this, void 0, void 0, function* () {
        return expandWithLabel(cipherSuite, secret, label, tlspl.encode([
            tlspl.uint32(node),
            tlspl.uint32(generation),
        ]), length);
    });
}
class SecretTree {
    constructor(cipherSuite, encryptionSecret, treeSize) {
        this.cipherSuite = cipherSuite;
        this.treeSize = treeSize;
        this.keyTree = { [(0, treemath_1.root)(treeSize)]: encryptionSecret };
    }
    deriveChildSecrets(nodeNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const treeNodeSecret = this.keyTree[nodeNum];
            this.keyTree[nodeNum].fill(0);
            delete this.keyTree[nodeNum];
            const [leftChildNum, rightChildNum] = [(0, treemath_1.left)(nodeNum), (0, treemath_1.right)(nodeNum, this.treeSize)];
            const [leftSecret, rightSecret] = yield Promise.all([
                deriveTreeSecret(this.cipherSuite, treeNodeSecret, constants_1.TREE, leftChildNum, 0, this.cipherSuite.hpke.kdf.extractLength),
                deriveTreeSecret(this.cipherSuite, treeNodeSecret, constants_1.TREE, rightChildNum, 0, this.cipherSuite.hpke.kdf.extractLength),
            ]);
            this.keyTree[leftChildNum] = leftSecret;
            this.keyTree[rightChildNum] = rightSecret;
        });
    }
    getRatchetsForLeaf(leafNum) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeNum = leafNum * 2;
            const path = (0, treemath_1.directPath)(nodeNum, this.treeSize);
            const nodesToDerive = [];
            for (const node of path) {
                nodesToDerive.push(node);
                if (node in this.keyTree) {
                    break;
                }
            }
            if (!(nodeNum in this.keyTree)) {
                if (!(nodesToDerive[nodesToDerive.length - 1] in this.keyTree)) {
                    throw new Error("Ratchet for leaf has already been derived");
                }
                while (nodesToDerive.length) {
                    const node = nodesToDerive.pop();
                    yield this.deriveChildSecrets(node);
                }
            }
            const leafSecret = this.keyTree[nodeNum];
            delete this.keyTree[nodeNum];
            const [handshakeSecret, applicationSecret] = yield Promise.all([
                deriveTreeSecret(this.cipherSuite, leafSecret, constants_1.HANDSHAKE, nodeNum, 0, this.cipherSuite.hpke.kdf.extractLength),
                deriveTreeSecret(this.cipherSuite, leafSecret, constants_1.APPLICATION, nodeNum, 0, this.cipherSuite.hpke.kdf.extractLength),
            ]);
            leafSecret.fill(0);
            return [
                new HashRatchet(this.cipherSuite, nodeNum, handshakeSecret),
                new HashRatchet(this.cipherSuite, nodeNum, applicationSecret),
            ];
        });
    }
}
exports.SecretTree = SecretTree;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#encryption-keys
class HashRatchet {
    constructor(cipherSuite, nodeNum, secret) {
        this.cipherSuite = cipherSuite;
        this.nodeNum = nodeNum;
        this.secret = secret;
        this.generation = 0;
        this.savedKeys = {};
    }
    getKey(generation) {
        return __awaiter(this, void 0, void 0, function* () {
            if (generation < this.generation) {
                if (generation in this.savedKeys) {
                    const key = this.savedKeys[generation];
                    delete this.savedKeys[generation];
                    return key;
                }
                else {
                    throw new Error("Key was already fetched");
                }
            }
            else {
                while (this.generation < generation) {
                    this.savedKeys[this.generation] = yield this.advance();
                }
                return yield this.advance();
            }
        });
    }
    advance() {
        return __awaiter(this, void 0, void 0, function* () {
            const [nonce, key, nextSecret] = yield Promise.all([
                deriveTreeSecret(this.cipherSuite, this.secret, constants_1.NONCE, this.nodeNum, this.generation, this.cipherSuite.hpke.aead.nonceLength),
                deriveTreeSecret(this.cipherSuite, this.secret, constants_1.KEY, this.nodeNum, this.generation, this.cipherSuite.hpke.aead.keyLength),
                deriveTreeSecret(this.cipherSuite, this.secret, constants_1.SECRET, this.nodeNum, this.generation, this.cipherSuite.hpke.kdf.extractLength),
            ]);
            this.secret.fill(0);
            this.generation++;
            this.secret = nextSecret;
            return [nonce, key];
        });
    }
}
exports.HashRatchet = HashRatchet;
/** Like HashRatchet, but allows you to re-derive keys that were already
 * fetched.  Using this function will void your warranty.
 */
class LenientHashRatchet extends HashRatchet {
    constructor(cipherSuite, nodeNum, secret) {
        super(cipherSuite, nodeNum, secret);
        this.origSecret = new Uint8Array(secret);
    }
    getKey(generation) {
        const _super = Object.create(null, {
            getKey: { get: () => super.getKey }
        });
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield _super.getKey.call(this, generation);
            }
            catch (_a) {
                let secret = this.origSecret;
                for (let i = 0; i < generation; i++) {
                    const newSecret = yield deriveTreeSecret(this.cipherSuite, secret, constants_1.SECRET, this.nodeNum, i, this.cipherSuite.hpke.kdf.extractLength);
                    if (secret !== this.origSecret) {
                        secret.fill(0);
                    }
                    secret = newSecret;
                }
                const [nonce, key] = yield Promise.all([
                    deriveTreeSecret(this.cipherSuite, secret, constants_1.NONCE, this.nodeNum, generation, this.cipherSuite.hpke.aead.nonceLength),
                    deriveTreeSecret(this.cipherSuite, secret, constants_1.KEY, this.nodeNum, generation, this.cipherSuite.hpke.aead.keyLength),
                ]);
                return [nonce, key];
            }
        });
    }
}
exports.LenientHashRatchet = LenientHashRatchet;
//# sourceMappingURL=keyschedule.js.map