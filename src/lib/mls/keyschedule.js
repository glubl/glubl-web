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
/** The key schedule determines how to derive keys for various uses.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#key-schedule
 */
import { concatUint8Array } from "./util";
import { APPLICATION, AUTHENTICATION, CONFIRM, EMPTY_BYTE_ARRAY, ENCRYPTION, EPOCH, EXPORTER, EXTERNAL, HANDSHAKE, INIT, KEY, MEMBER, MEMBERSHIP, MLS10, NONCE, RESUMPTION, SECRET, SENDER_DATA, TREE, WELCOME, } from "./constants";
import * as tlspl from "./tlspl";
import { left, right, directPath, root } from "./treemath";
export async function expandWithLabel(cipherSuite, secret, label, context, length) {
    return cipherSuite.hpke.kdf.expand(secret, tlspl.encode([
        tlspl.uint16(length),
        tlspl.variableOpaque(concatUint8Array([MLS10, label]), 1),
        tlspl.variableOpaque(context, 4),
    ]), length);
}
export async function deriveSecret(cipherSuite, secret, label) {
    return expandWithLabel(cipherSuite, secret, label, EMPTY_BYTE_ARRAY, cipherSuite.hpke.kdf.extractLength);
}
export async function generateSecrets(cipherSuite, initSecret, commitSecret, groupContext, psk) {
    const joinerSecret = await cipherSuite.hpke.kdf.extract(initSecret, commitSecret);
    return await generateSecretsFromJoinerSecret(cipherSuite, joinerSecret, commitSecret, groupContext, psk);
}
export async function generateSecretsFromJoinerSecret(cipherSuite, joinerSecret, commitSecret, groupContext, psk) {
    if (psk === undefined) {
        psk = EMPTY_BYTE_ARRAY;
    }
    const memberIkm = await deriveSecret(cipherSuite, joinerSecret, MEMBER);
    const memberSecret = await cipherSuite.hpke.kdf.extract(memberIkm, psk);
    const welcomeSecret = await deriveSecret(cipherSuite, memberSecret, WELCOME);
    const epochSecret = await expandWithLabel(cipherSuite, welcomeSecret, EPOCH, tlspl.encode([groupContext.encoder]), cipherSuite.hpke.kdf.extractLength);
    const [senderDataSecret, encryptionSecret, exporterSecret, authenticationSecret, externalSecret, confirmationKey, membershipKey, resumptionSecret, nextInitSecret,] = await Promise.all([
        SENDER_DATA,
        ENCRYPTION,
        EXPORTER,
        AUTHENTICATION,
        EXTERNAL,
        CONFIRM,
        MEMBERSHIP,
        RESUMPTION,
        INIT,
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
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#secret-tree-secret-tree
async function deriveTreeSecret(cipherSuite, secret, label, node, generation, length) {
    return expandWithLabel(cipherSuite, secret, label, tlspl.encode([
        tlspl.uint32(node),
        tlspl.uint32(generation),
    ]), length);
}
export class SecretTree {
    cipherSuite;
    treeSize;
    keyTree;
    constructor(cipherSuite, encryptionSecret, treeSize) {
        this.cipherSuite = cipherSuite;
        this.treeSize = treeSize;
        this.keyTree = { [root(treeSize)]: encryptionSecret };
    }
    async deriveChildSecrets(nodeNum) {
        const treeNodeSecret = this.keyTree[nodeNum];
        this.keyTree[nodeNum].fill(0);
        delete this.keyTree[nodeNum];
        const [leftChildNum, rightChildNum] = [left(nodeNum), right(nodeNum, this.treeSize)];
        const [leftSecret, rightSecret] = await Promise.all([
            deriveTreeSecret(this.cipherSuite, treeNodeSecret, TREE, leftChildNum, 0, this.cipherSuite.hpke.kdf.extractLength),
            deriveTreeSecret(this.cipherSuite, treeNodeSecret, TREE, rightChildNum, 0, this.cipherSuite.hpke.kdf.extractLength),
        ]);
        this.keyTree[leftChildNum] = leftSecret;
        this.keyTree[rightChildNum] = rightSecret;
    }
    async getRatchetsForLeaf(leafNum) {
        const nodeNum = leafNum * 2;
        const path = directPath(nodeNum, this.treeSize);
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
                await this.deriveChildSecrets(node);
            }
        }
        const leafSecret = this.keyTree[nodeNum];
        delete this.keyTree[nodeNum];
        const [handshakeSecret, applicationSecret] = await Promise.all([
            deriveTreeSecret(this.cipherSuite, leafSecret, HANDSHAKE, nodeNum, 0, this.cipherSuite.hpke.kdf.extractLength),
            deriveTreeSecret(this.cipherSuite, leafSecret, APPLICATION, nodeNum, 0, this.cipherSuite.hpke.kdf.extractLength),
        ]);
        leafSecret.fill(0);
        return [
            new HashRatchet(this.cipherSuite, nodeNum, handshakeSecret),
            new HashRatchet(this.cipherSuite, nodeNum, applicationSecret),
        ];
    }
}
// https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#encryption-keys
export class HashRatchet {
    cipherSuite;
    nodeNum;
    secret;
    generation;
    savedKeys;
    constructor(cipherSuite, nodeNum, secret) {
        this.cipherSuite = cipherSuite;
        this.nodeNum = nodeNum;
        this.secret = secret;
        this.generation = 0;
        this.savedKeys = {};
    }
    async getKey(generation) {
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
                this.savedKeys[this.generation] = await this.advance();
            }
            return await this.advance();
        }
    }
    async advance() {
        const [nonce, key, nextSecret] = await Promise.all([
            deriveTreeSecret(this.cipherSuite, this.secret, NONCE, this.nodeNum, this.generation, this.cipherSuite.hpke.aead.nonceLength),
            deriveTreeSecret(this.cipherSuite, this.secret, KEY, this.nodeNum, this.generation, this.cipherSuite.hpke.aead.keyLength),
            deriveTreeSecret(this.cipherSuite, this.secret, SECRET, this.nodeNum, this.generation, this.cipherSuite.hpke.kdf.extractLength),
        ]);
        this.secret.fill(0);
        this.generation++;
        this.secret = nextSecret;
        return [nonce, key];
    }
}
/** Like HashRatchet, but allows you to re-derive keys that were already
 * fetched.  Using this function will void your warranty.
 */
export class LenientHashRatchet extends HashRatchet {
    origSecret;
    constructor(cipherSuite, nodeNum, secret) {
        super(cipherSuite, nodeNum, secret);
        this.origSecret = new Uint8Array(secret);
    }
    async getKey(generation) {
        try {
            return await super.getKey(generation);
        }
        catch {
            let secret = this.origSecret;
            for (let i = 0; i < generation; i++) {
                const newSecret = await deriveTreeSecret(this.cipherSuite, secret, SECRET, this.nodeNum, i, this.cipherSuite.hpke.kdf.extractLength);
                if (secret !== this.origSecret) {
                    secret.fill(0);
                }
                secret = newSecret;
            }
            const [nonce, key] = await Promise.all([
                deriveTreeSecret(this.cipherSuite, secret, NONCE, this.nodeNum, generation, this.cipherSuite.hpke.aead.nonceLength),
                deriveTreeSecret(this.cipherSuite, secret, KEY, this.nodeNum, generation, this.cipherSuite.hpke.aead.keyLength),
            ]);
            return [nonce, key];
        }
    }
}
//# sourceMappingURL=keyschedule.js.map