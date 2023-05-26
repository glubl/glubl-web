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
/** Each user has a key package per room, which has the user's credential and an
 * HPKE public key that can be used to encrypt data for that user.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#key-packages
 */
import { EMPTY_BYTE_ARRAY, ExtensionType, NodeType } from "./constants";
import { cipherSuiteById } from "./ciphersuite";
import { Credential } from "./credential";
import * as tlspl from "./tlspl";
export class Extension {
    extensionType;
    constructor(extensionType) {
        this.extensionType = extensionType;
    }
    static decode(buffer, offset) {
        const [[extensionType, extensionData], offset1] = tlspl.decode([tlspl.decodeUint8, tlspl.decodeVariableOpaque(2)], buffer, offset);
        switch (extensionType) {
            case ExtensionType.Capabilities:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = Capabilities.decode(extensionData);
                    return [extension, offset1];
                }
            case ExtensionType.RatchetTree:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = RatchetTree.decode(extensionData);
                    return [extension, offset1];
                }
            case ExtensionType.ParentHash:
                {
                    // eslint-disable-next-line comma-dangle, array-bracket-spacing
                    const [extension,] = ParentHash.decode(extensionData);
                    return [extension, offset1];
                }
            case ExtensionType.Generation:
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
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#client-capabilities
export class Capabilities extends Extension {
    versions;
    ciphersuites;
    extensions;
    constructor(versions, ciphersuites, extensions) {
        super(ExtensionType.Capabilities);
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
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#parent-hash
export class ParentHash extends Extension {
    parentHash;
    constructor(parentHash) {
        super(ExtensionType.ParentHash);
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
export class ParentNode {
    publicKey;
    unmergedLeaves;
    parentHash;
    hpkeKey;
    constructor(publicKey, unmergedLeaves, parentHash) {
        this.publicKey = publicKey;
        this.unmergedLeaves = unmergedLeaves;
        this.parentHash = parentHash;
    }
    async getHpkeKey(cipherSuite) {
        if (!this.hpkeKey) {
            this.hpkeKey = await cipherSuite.hpke.kem.deserializePublic(this.publicKey);
        }
        return this.hpkeKey;
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
            tlspl.variableOpaque(this.parentHash || EMPTY_BYTE_ARRAY /* FIXME: ??? */, 1),
        ]);
    }
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#ratchet-tree-extension
function decodeRatchetTreeNode(buffer, offset) {
    const [[nodeType], offset1] = tlspl.decode([tlspl.decodeUint8], buffer, offset);
    switch (nodeType) {
        case NodeType.Leaf:
            return KeyPackage.decode(buffer, offset1);
        case NodeType.Parent:
            return ParentNode.decode(buffer, offset1);
        default:
            throw new Error("Invalid node type");
    }
}
export class RatchetTree extends Extension {
    nodes;
    constructor(nodes) {
        super(ExtensionType.RatchetTree);
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
                        tlspl.uint8(node instanceof KeyPackage ? NodeType.Leaf : NodeType.Parent),
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
// FIXME: more extensions
export class Generation extends Extension {
    generation;
    constructor(generation) {
        super(ExtensionType.Generation);
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
class UnknownExtension extends Extension {
    extensionType;
    extensionData;
    constructor(extensionType, extensionData) {
        super(extensionType);
        this.extensionType = extensionType;
        this.extensionData = extensionData;
    }
}
export class KeyPackage {
    version;
    cipherSuite;
    hpkeInitKey;
    credential;
    extensions;
    unsignedEncoding;
    signature;
    signingKey;
    hpkeKey;
    hashCache;
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
    static async create(version, cipherSuite, hpkeInitKey, credential, extensions, signingKey) {
        const unsignedEncoding = tlspl.encode([
            tlspl.uint8(version),
            tlspl.uint16(cipherSuite.id),
            tlspl.variableOpaque(hpkeInitKey, 2),
            credential.encoder,
            tlspl.vector(extensions.map(ext => ext.encoder), 4),
        ]);
        const signature = await signingKey.sign(unsignedEncoding);
        return new KeyPackage(version, cipherSuite, hpkeInitKey, credential, extensions, unsignedEncoding, signature, signingKey);
    }
    checkSignature() {
        return this.credential.verify(this.unsignedEncoding, this.signature);
    }
    async getHpkeKey() {
        if (!this.hpkeKey) {
            this.hpkeKey = await this.cipherSuite.hpke.kem.deserializePublic(this.hpkeInitKey);
        }
        return this.hpkeKey;
    }
    async addExtension(extension) {
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
        this.signature = await this.signingKey.sign(this.unsignedEncoding);
    }
    async hash() {
        if (!this.hashCache) {
            const encoded = tlspl.encode([this.encoder]);
            this.hashCache = await this.cipherSuite.hash.hash(encoded);
        }
        return this.hashCache;
    }
    static decode(buffer, offset) {
        const [[version, cipherSuiteId, hpkeInitKey, credential, extensions], offset1,] = tlspl.decode([
            tlspl.decodeUint8,
            tlspl.decodeUint16,
            tlspl.decodeVariableOpaque(2),
            Credential.decode,
            tlspl.decodeVector(Extension.decode, 4),
        ], buffer, offset);
        const cipherSuite = cipherSuiteById[cipherSuiteId];
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
//# sourceMappingURL=keypackage.js.map