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
exports.x25519 = void 0;
/** ECDH operations using the X25519 curve
 */
const base_1 = require("./base");
const constants_1 = require("../constants");
const util_1 = require("../util");
const elliptic_1 = require("elliptic");
// 4.1.  DH-Based KEM
function makeDH(name, publicKeyLength, privateKeyLength, secretLength, clamp) {
    const ec = new elliptic_1.ec(name);
    class PublicKey extends base_1.DHPublicKey {
        constructor(key) {
            super();
            this.key = key;
        }
        dh(privKey) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!(privKey instanceof PrivateKey)) {
                    throw new Error("Incompatible private key");
                }
                return privKey.keyPair.derive(this.key)
                    .toArrayLike(Uint8Array, "be", privateKeyLength).reverse();
            });
        }
        serialize() {
            return __awaiter(this, void 0, void 0, function* () {
                const k = Uint8Array.from(this.key.encode());
                k.reverse();
                if (k.length < publicKeyLength) {
                    const k1 = new Uint8Array(publicKeyLength);
                    k1.set(k);
                    return k1;
                }
                else {
                    return k;
                }
            });
        }
    }
    class PrivateKey extends base_1.DHPrivateKey {
        constructor(keyPair) {
            super();
            this.keyPair = keyPair;
        }
        serialize() {
            return __awaiter(this, void 0, void 0, function* () {
                const k = (0, util_1.hexToUint8Array)(this.keyPair.getPrivate("hex"));
                k.reverse();
                if (k.length < publicKeyLength) {
                    const k1 = new Uint8Array(privateKeyLength);
                    k1.set(k);
                    return k1;
                }
                else {
                    return k;
                }
            });
        }
    }
    return {
        generateKeyPair() {
            return __awaiter(this, void 0, void 0, function* () {
                const keyPair = ec.genKeyPair();
                return [new PrivateKey(keyPair), new PublicKey(keyPair.getPublic())];
            });
        },
        // 7.1.2.  DeriveKeyPair
        deriveKeyPair(kdf, suiteId, ikm) {
            return __awaiter(this, void 0, void 0, function* () {
                const dkpPrk = yield (0, base_1.labeledExtract)(kdf, suiteId, constants_1.EMPTY_BYTE_ARRAY, constants_1.DKP_PRK, ikm);
                const sk = yield (0, base_1.labeledExpand)(kdf, suiteId, dkpPrk, constants_1.SK, constants_1.EMPTY_BYTE_ARRAY, privateKeyLength);
                clamp(sk);
                sk.reverse();
                const keyPair = ec.keyFromPrivate(sk);
                return [new PrivateKey(keyPair), new PublicKey(keyPair.getPublic())];
            });
        },
        deserializePublic(enc) {
            return __awaiter(this, void 0, void 0, function* () {
                const k = new Uint8Array(enc);
                return new PublicKey(ec.keyFromPublic(k.reverse()).getPublic());
            });
        },
        deserializePrivate(enc) {
            return __awaiter(this, void 0, void 0, function* () {
                const k = new Uint8Array(enc);
                clamp(k);
                k.reverse();
                const keyPair = ec.keyFromPrivate(k);
                return [new PrivateKey(keyPair), new PublicKey(keyPair.getPublic())];
            });
        },
        publicKeyLength: publicKeyLength,
        privateKeyLength: privateKeyLength,
        secretLength: secretLength,
    };
}
function clamp25519(key) {
    key[0] &= 248;
    key[31] &= 127;
    key[31] |= 64;
    return key;
}
//function clamp448(key: Uint8Array) {
//    key[0] &= 252;
//    key[55] |= 128
//    return key;
//}
exports.x25519 = makeDH("curve25519", 32, 32, 32, clamp25519);
//# sourceMappingURL=ecdh-x.js.map