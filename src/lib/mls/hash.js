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
const subtle = globalThis.crypto.subtle;
function makeHash(name, blockSize) {
    let zeroKey; // a key consisting of blockSize 0's, which is the default key for mac
    return {
        async hash(data) {
            return new Uint8Array(await subtle.digest(name, data));
        },
        async mac(key, data) {
            let cryptoKey;
            if (key.length === 0) {
                if (!zeroKey) {
                    key = new Uint8Array(blockSize);
                    zeroKey = await subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign", "verify"]);
                }
                cryptoKey = zeroKey;
            }
            else {
                cryptoKey = await subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign"]);
            }
            return new Uint8Array(await subtle.sign("HMAC", cryptoKey, data));
        },
        async verifyMac(key, data, mac) {
            let cryptoKey;
            if (key.length === 0) {
                if (!zeroKey) {
                    key = new Uint8Array(blockSize);
                    zeroKey = await subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign", "verify"]);
                }
                cryptoKey = zeroKey;
            }
            else {
                cryptoKey = await subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["verify"]);
            }
            return await subtle.verify("HMAC", cryptoKey, mac, data);
        },
    };
}
export const sha256 = makeHash("SHA-256", 64);
export const sha512 = makeHash("SHA-512", 128);
//# sourceMappingURL=hash.js.map