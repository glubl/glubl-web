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
exports.x25519HkdfSha256 = exports.p521HkdfSha512 = exports.p384HkdfSha384 = exports.p256HkdfSha256 = void 0;
// 4.1.  DH-Based KEM
/** DHKEM methods, build from DH groups and KDFs */
const base_1 = require("./base");
const hkdf_1 = require("./hkdf");
const ecdh_nist_1 = require("./ecdh-nist");
const ecdh_x_1 = require("./ecdh-x");
exports.p256HkdfSha256 = (0, base_1.makeDHKEM)(ecdh_nist_1.p256, hkdf_1.hkdfSha256, 0x0010);
exports.p384HkdfSha384 = (0, base_1.makeDHKEM)(ecdh_nist_1.p384, hkdf_1.hkdfSha384, 0x0011);
exports.p521HkdfSha512 = (0, base_1.makeDHKEM)(ecdh_nist_1.p521, hkdf_1.hkdfSha512, 0x0012);
exports.x25519HkdfSha256 = (0, base_1.makeDHKEM)(ecdh_x_1.x25519, hkdf_1.hkdfSha256, 0x0020);
//# sourceMappingURL=dhkem.js.map