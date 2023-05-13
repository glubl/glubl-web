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
exports.KeyPackage = exports.Generation = exports.RatchetTree = exports.ParentNode = exports.ParentHash = exports.Capabilities = exports.Extension = void 0;
/** Each user has a key package per room, which has the user's credential and an
 * HPKE public key that can be used to encrypt data for that user.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#key-packages
 */
const constants_1 = require("./constants");
const ciphersuite_1 = require("./ciphersuite");
const credential_1 = require("./credential");
const tlspl = require("./tlspl");
class Extension {
    constructor(extensionType) {
        this.extensionType = extensionType;
    }
    static decode(buffer, offset) {
        const [[extensionType, extensionData], offset1] = tlspl.decode([tlspl.decodeUint8, tlspl.decodeVariableOpaque(2)], buffer, offset);
        switch (extensionType) {
            case constants_1.ExtensionType.Capabilities:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = Capabilities.decode(extensionData);
                    return [extension, offset1];
                }
            case constants_1.ExtensionType.RatchetTree:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = RatchetTree.decode(extensionData);
                    return [extension, offset1];
                }
            case constants_1.ExtensionType.ParentHash:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = ParentHash.decode(extensionData);
                    return [extension, offset1];
                }
            case constants_1.ExtensionType.Generation:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = Generation.decode(extensionData);
                    return [extension, offset1];
                }
            default:
                return [new UnknownExtension(extensionType, extensionData), offset1];
        }
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.extensionType),
            tlspl.variableOpaque(this.extensionData, 2),
        ]);
    }
}
exports.Extension = Extension;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#client-capabilities
class Capabilities extends Extension {
    constructor(versions, ciphersuites, extensions) {
        super(constants_1.ExtensionType.Capabilities);
        this.versions = versions;
        this.ciphersuites = ciphersuites;
        this.extensions = extensions;
    }
    get extensionData() {
        return tlspl.encode([
            tlspl.vector(this.versions.map(tlspl.uint16), 1),
        ]);
    }
    static decode(buffer, offset = 0) {
        const [[versions, ciphersuites, extensions], offset1] = tlspl.decode([
            tlspl.decodeVector(tlspl.decodeUint16, 1),
            tlspl.decodeVector(tlspl.decodeUint16, 1),
            tlspl.decodeVector(tlspl.decodeUint16, 1),
        ], buffer, offset);
        return [new Capabilities(versions, ciphersuites, extensions), offset1];
    }
}
exports.Capabilities = Capabilities;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#parent-hash
class ParentHash extends Extension {
    constructor(parentHash) {
        super(constants_1.ExtensionType.ParentHash);
        this.parentHash = parentHash;
    }
    get extensionData() {
        return tlspl.encode([
            tlspl.variableOpaque(this.parentHash, 1),
        ]);
    }
    static decode(buffer, offset = 0) {
        const [[parentHash], offset1] = tlspl.decode([tlspl.decodeVariableOpaque(1)], buffer, offset);
        return [new ParentHash(parentHash), offset1];
    }
}
exports.ParentHash = ParentHash;
class ParentNode {
    constructor(publicKey, unmergedLeaves, parentHash) {
        this.publicKey = publicKey;
        this.unmergedLeaves = unmergedLeaves;
        this.parentHash = parentHash;
    }
    getHpkeKey(cipherSuite) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hpkeKey) {
                this.hpkeKey = yield cipherSuite.hpke.kem.deserializePublic(this.publicKey);
            }
            return this.hpkeKey;
        });
    }
    static decode(buffer, offset) {
        const [[publicKey, unmergedLeaves, parentHash], offset1] = tlspl.decode([
            tlspl.decodeVariableOpaque(2),
            tlspl.decodeVector(tlspl.decodeUint32, 4),
            tlspl.decodeVariableOpaque(1),
        ], buffer, offset);
        return [new ParentNode(publicKey, unmergedLeaves, parentHash), offset1];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.publicKey, 2),
            tlspl.vector(this.unmergedLeaves.map(tlspl.uint32), 4),
            tlspl.variableOpaque(this.parentHash || constants_1.EMPTY_BYTE_ARRAY /* FIXME: ??? */, 1),
        ]);
    }
}
exports.ParentNode = ParentNode;
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#ratchet-tree-extension
function decodeRatchetTreeNode(buffer, offset) {
    const [[nodeType], offset1] = tlspl.decode([tlspl.decodeUint8], buffer, offset);
    switch (nodeType) {
        case constants_1.NodeType.Leaf:
            return KeyPackage.decode(buffer, offset1);
        case constants_1.NodeType.Parent:
            return ParentNode.decode(buffer, offset1);
        default:
            throw new Error("Invalid node type");
    }
}
class RatchetTree extends Extension {
    constructor(nodes) {
        super(constants_1.ExtensionType.RatchetTree);
        this.nodes = nodes;
    }
    get extensionData() {
        return tlspl.encode([
            tlspl.vector(this.nodes.map((node) => {
                if (node === undefined) {
                    return tlspl.uint8(0);
                }
                else {
                    return tlspl.struct([
                        tlspl.uint8(1),
                        tlspl.uint8(node instanceof KeyPackage ? constants_1.NodeType.Leaf : constants_1.NodeType.Parent),
                        node.encoder,
                    ]);
                }
            }), 4),
        ]);
    }
    static decode(buffer, offset = 0) {
        const [[nodes], offset1] = tlspl.decode([tlspl.decodeVector(tlspl.decodeOptional(decodeRatchetTreeNode), 4)], buffer, offset);
        return [new RatchetTree(nodes), offset1];
    }
}
exports.RatchetTree = RatchetTree;
// FIXME: more extensions
class Generation extends Extension {
    constructor(generation) {
        super(constants_1.ExtensionType.Generation);
        this.generation = generation;
    }
    get extensionData() {
        return tlspl.encode([
            tlspl.uint32(this.generation),
        ]);
    }
    static decode(buffer, offset = 0) {
        const [[generation], offset1] = tlspl.decode([tlspl.decodeUint32], buffer, offset);
        return [new Generation(generation), offset1];
    }
}
exports.Generation = Generation;
class UnknownExtension extends Extension {
    constructor(extensionType, extensionData) {
        super(extensionType);
        this.extensionType = extensionType;
        this.extensionData = extensionData;
    }
}
class KeyPackage {
    constructor(version, cipherSuite, hpkeInitKey, credential, extensions, unsignedEncoding, signature, signingKey) {
        this.version = version;
        this.cipherSuite = cipherSuite;
        this.hpkeInitKey = hpkeInitKey;
        this.credential = credential;
        this.extensions = extensions;
        this.unsignedEncoding = unsignedEncoding;
        this.signature = signature;
        this.signingKey = signingKey;
    }
    static create(version, cipherSuite, hpkeInitKey, credential, extensions, signingKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const unsignedEncoding = tlspl.encode([
                tlspl.uint8(version),
                tlspl.uint16(cipherSuite.id),
                tlspl.variableOpaque(hpkeInitKey, 2),
                credential.encoder,
                tlspl.vector(extensions.map(ext => ext.encoder), 4),
            ]);
            const signature = yield signingKey.sign(unsignedEncoding);
            return new KeyPackage(version, cipherSuite, hpkeInitKey, credential, extensions, unsignedEncoding, signature, signingKey);
        });
    }
    checkSignature() {
        return this.credential.verify(this.unsignedEncoding, this.signature);
    }
    getHpkeKey() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hpkeKey) {
                this.hpkeKey = yield this.cipherSuite.hpke.kem.deserializePublic(this.hpkeInitKey);
            }
            return this.hpkeKey;
        });
    }
    addExtension(extension) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.signingKey) {
                throw new Error("Cannot change extensions without a signing key");
            }
            this.extensions.push(extension);
            this.unsignedEncoding = tlspl.encode([
                tlspl.uint8(this.version),
                tlspl.uint16(this.cipherSuite.id),
                tlspl.variableOpaque(this.hpkeInitKey, 2),
                this.credential.encoder,
                tlspl.vector(this.extensions.map(ext => ext.encoder), 4),
            ]);
            this.signature = yield this.signingKey.sign(this.unsignedEncoding);
        });
    }
    hash() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hashCache) {
                const encoded = tlspl.encode([this.encoder]);
                this.hashCache = yield this.cipherSuite.hash.hash(encoded);
            }
            return this.hashCache;
        });
    }
    static decode(buffer, offset) {
        const [[version, cipherSuiteId, hpkeInitKey, credential, extensions], offset1,] = tlspl.decode([
            tlspl.decodeUint8,
            tlspl.decodeUint16,
            tlspl.decodeVariableOpaque(2),
            credential_1.Credential.decode,
            tlspl.decodeVector(Extension.decode, 4),
        ], buffer, offset);
        const cipherSuite = ciphersuite_1.cipherSuiteById[cipherSuiteId];
        if (!cipherSuite) {
            throw new Error("Unknown ciphersuite");
        }
        const [[signature], offset2] = tlspl.decode([tlspl.decodeVariableOpaque(2)], buffer, offset1);
        return [
            new KeyPackage(version, cipherSuite, hpkeInitKey, credential, extensions, buffer.subarray(offset, offset1), signature),
            offset2,
        ];
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint8(this.version),
            tlspl.uint16(this.cipherSuite.id),
            tlspl.variableOpaque(this.hpkeInitKey, 2),
            this.credential.encoder,
            tlspl.vector(this.extensions.map(ext => ext.encoder), 4),
            tlspl.variableOpaque(this.signature, 2),
        ]);
    }
}
exports.KeyPackage = KeyPackage;
//# sourceMappingURL=keypackage.js.map