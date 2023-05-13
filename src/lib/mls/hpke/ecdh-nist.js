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
exports.p521 = exports.p384 = exports.p256 = void 0;
/** ECDH operations using the NIST curves
 */
const base_1 = require("./base");
const constants_1 = require("../constants");
const util_1 = require("../util");
const elliptic_1 = require("elliptic");
// 4.1.  DH-Based KEM
function makeDH(name, publicKeyLength, privateKeyLength, secretLength, bitmask) {
    const ec = new elliptic_1.ec(name);
    const zeroKey = new Uint8Array(privateKeyLength);
    const order = ec.n.toArrayLike(Uint8Array, "be", privateKeyLength);
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
                    .toArrayLike(Uint8Array, "be", privateKeyLength);
            });
        }
        serialize() {
            return __awaiter(this, void 0, void 0, function* () {
                return Uint8Array.from(this.key.encode());
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
                return (0, util_1.hexToUint8Array)(this.keyPair.getPrivate("hex"));
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
                let sk;
                let counter = 0;
                do {
                    if (counter++ > 255) {
                        throw new Error("Error deriving key pair");
                    }
                    sk = yield (0, base_1.labeledExpand)(kdf, suiteId, dkpPrk, constants_1.CANDIDATE, Uint8Array.from([counter]), privateKeyLength);
                    sk[0] &= bitmask;
                } while ((0, util_1.eqUint8Array)(sk, zeroKey) || (0, util_1.geUint8Array)(sk, order));
                const keyPair = ec.keyFromPrivate(sk);
                return [new PrivateKey(keyPair), new PublicKey(keyPair.getPublic())];
            });
        },
        deserializePublic(enc) {
            return __awaiter(this, void 0, void 0, function* () {
                return new PublicKey(ec.keyFromPublic(enc).getPublic());
            });
        },
        deserializePrivate(enc) {
            return __awaiter(this, void 0, void 0, function* () {
                // FIXME: make sure private key is non-zero (mod order)
                const keyPair = ec.keyFromPrivate(enc);
                return [new PrivateKey(keyPair), new PublicKey(keyPair.getPublic())];
            });
        },
        publicKeyLength: publicKeyLength,
        privateKeyLength: privateKeyLength,
        secretLength: secretLength,
    };
}
exports.p256 = makeDH("p256", 65, 32, 32, 0xff);
exports.p384 = makeDH("p384", 97, 48, 48, 0xff);
exports.p521 = makeDH("p521", 133, 66, 64, 0x01);
//# sourceMappingURL=ecdh-nist.js.map