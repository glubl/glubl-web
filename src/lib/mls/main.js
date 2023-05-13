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

var exports = {};

Object.defineProperty(exports, "__esModule", { value: true });
exports.dh = exports.aead = exports.kdf = exports.kem = void 0;
const ecdh_nist_1 = require("./hpke/ecdh-nist");
const hkdf_1 = require("./hpke/hkdf");
const dhkem_1 = require("./hpke/dhkem");
const aes_1 = require("./hpke/aes");
exports.kem = {
    p256HkdfSha256: dhkem_1.p256HkdfSha256,
};
exports.kdf = {
    hkdfSha256: hkdf_1.hkdfSha256,
};
exports.aead = {
    aes128Gcm: aes_1.aes128Gcm,
    aes256Gcm: aes_1.aes256Gcm,
};
exports.dh = {
    p256: ecdh_nist_1.p256,
};
//# sourceMappingURL=main.js.map