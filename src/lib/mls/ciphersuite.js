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
import { x25519HkdfSha256Aes128Gcm } from "./hpke";
import { Ed25519 } from "./signatures";
import { SignatureScheme as SignatureSchemeId } from "./constants";
import { sha256 } from "./hash";
// eslint-disable-next-line camelcase
export const mls10_128_DhKemX25519Aes128GcmSha256Ed25519 = {
    hpke: x25519HkdfSha256Aes128Gcm,
    signatureScheme: Ed25519,
    hash: sha256,
    id: 1,
    signatureSchemeId: SignatureSchemeId.ed25519,
};
// FIXME:
// MLS10_128_DHKEMP256_AES128GCM_SHA256_P256 = 2,
// MLS10_128_DHKEMX25519_CHACHA20POLY1305_SHA256_Ed25519 = 3,
// MLS10_256_DHKEMX448_AES256GCM_SHA512_Ed448 = 4,
// MLS10_256_DHKEMP521_AES256GCM_SHA512_P521 = 5,
// MLS10_256_DHKEMX448_CHACHA20POLY1305_SHA512_Ed448 = 6,
export const cipherSuiteById = {
    1: mls10_128_DhKemX25519Aes128GcmSha256Ed25519,
};
//# sourceMappingURL=ciphersuite.js.map