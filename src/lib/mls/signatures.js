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
exports.Ed25519 = void 0;
// methods for creating signatures
const constants_1 = require("./constants");
const elliptic_1 = require("elliptic");
const subtle = globalThis.crypto.subtle;
const ed25519 = new elliptic_1.eddsa('ed25519');
exports.Ed25519 = {
    generateKeyPair() {
        return __awaiter(this, void 0, void 0, function* () {
            const ikm = new Uint8Array(exports.Ed25519.privateKeyLength);
            globalThis.crypto.getRandomValues(ikm);
            const keyPair = ed25519.keyFromSecret(ikm);
            return [new Ed25519PrivateKey(keyPair), new Ed25519PublicKey(keyPair)];
        });
    },
    deriveKeyPair(ikm) {
        return __awaiter(this, void 0, void 0, function* () {
            const ikmKey = yield subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
            const derivedKey = yield subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: constants_1.EMPTY_BYTE_ARRAY }, ikmKey, exports.Ed25519.privateKeyLength * 8);
            const derivedKeyArr = new Uint8Array(derivedKey);
            const keyPair = ed25519.keyFromSecret(derivedKeyArr);
            derivedKeyArr.fill(0);
            return [new Ed25519PrivateKey(keyPair), new Ed25519PublicKey(keyPair)];
        });
    },
    deserializePrivate(enc) {
        return __awaiter(this, void 0, void 0, function* () {
            const keyPair = ed25519.keyFromSecret(enc);
            return new Ed25519PrivateKey(keyPair);
        });
    },
    deserializePublic(enc) {
        return __awaiter(this, void 0, void 0, function* () {
            const keyPair = ed25519.keyFromPublic([...enc.values()]);
            return new Ed25519PublicKey(keyPair);
        });
    },
    privateKeyLength: 32,
    publicKeyLength: 32,
};
class Ed25519PrivateKey {
    constructor(keyPair) {
        this.keyPair = keyPair;
    }
    sign(message) {
        return __awaiter(this, void 0, void 0, function* () {
            return Uint8Array.from(this.keyPair.sign(message).toBytes());
        });
    }
    serialize() {
        return __awaiter(this, void 0, void 0, function* () {
            return Uint8Array.from(this.keyPair.getSecret());
        });
    }
}
class Ed25519PublicKey {
    constructor(keyPair) {
        this.keyPair = keyPair;
    }
    verify(message, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.keyPair.verify(message, [...signature.values()]);
        });
    }
    serialize() {
        return __awaiter(this, void 0, void 0, function* () {
            return Uint8Array.from(this.keyPair.getPublic());
        });
    }
}
//# sourceMappingURL=signatures.js.map