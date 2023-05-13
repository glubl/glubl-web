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
exports.cipherSuiteById = exports.mls10_128_DhKemX25519Aes128GcmSha256Ed25519 = void 0;
const hpke_1 = require("./hpke");
const signatures_1 = require("./signatures");
const constants_1 = require("./constants");
const hash_1 = require("./hash");
// eslint-disable-next-line camelcase
exports.mls10_128_DhKemX25519Aes128GcmSha256Ed25519 = {
    hpke: hpke_1.x25519HkdfSha256Aes128Gcm,
    signatureScheme: signatures_1.Ed25519,
    hash: hash_1.sha256,
    id: 1,
    signatureSchemeId: constants_1.SignatureScheme.ed25519,
};
// FIXME:
// MLS10_128_DHKEMP256_AES128GCM_SHA256_P256 = 2,
// MLS10_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519 = 3,
// MLS10_256_DHKEMX448_AES256GCM_SHA512_Ed448 = 4,
// MLS10_256_DHKEMP521_AES256GCM_SHA512_P521 = 5,
// MLS10_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448 = 6,
exports.cipherSuiteById = {
    1: exports.mls10_128_DhKemX25519Aes128GcmSha256Ed25519,
};
//# sourceMappingURL=ciphersuite.js.map