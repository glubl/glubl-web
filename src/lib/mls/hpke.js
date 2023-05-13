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
Object.defineProperty(exports, "__esModule", { value: true });
exports.x25519HkdfSha256Aes128Gcm = exports.p256HkdfSha256Aes128Gcm = exports.dh = exports.aead = exports.kdf = exports.kem = void 0;
/** HPKE (Hybrid Public Key Encryption) operations
 * https://tools.ietf.org/html/draft-irtf-cfrg-hpke-05
 */
const ecdh_nist_1 = require("./hpke/ecdh-nist");
const hkdf_1 = require("./hpke/hkdf");
const dhkem_1 = require("./hpke/dhkem");
const aes_1 = require("./hpke/aes");
const base_1 = require("./hpke/base");
exports.kem = {
    p256HkdfSha256: dhkem_1.p256HkdfSha256,
    p384HkdfSha384: dhkem_1.p384HkdfSha384,
    p521HkdfSha512: dhkem_1.p521HkdfSha512,
    x25519HkdfSha256: dhkem_1.x25519HkdfSha256,
};
exports.kdf = {
    hkdfSha256: hkdf_1.hkdfSha256,
    hkdfSha384: hkdf_1.hkdfSha384,
    hkdfSha512: hkdf_1.hkdfSha512,
};
exports.aead = {
    aes128Gcm: aes_1.aes128Gcm,
    aes256Gcm: aes_1.aes256Gcm,
};
exports.dh = {
    p256: ecdh_nist_1.p256,
    p384: ecdh_nist_1.p384,
    p521: ecdh_nist_1.p521,
};
exports.p256HkdfSha256Aes128Gcm = new base_1.HPKE(dhkem_1.p256HkdfSha256, hkdf_1.hkdfSha256, aes_1.aes128Gcm);
exports.x25519HkdfSha256Aes128Gcm = new base_1.HPKE(dhkem_1.x25519HkdfSha256, hkdf_1.hkdfSha256, aes_1.aes128Gcm);
//# sourceMappingURL=hpke.js.map