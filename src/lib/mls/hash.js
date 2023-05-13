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
exports.sha512 = exports.sha256 = void 0;
const subtle = globalThis.crypto.subtle;
function makeHash(name, blockSize) {
    let zeroKey; // a key consisting of blockSize 0's, which is the default key for mac
    return {
        hash(data) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Uint8Array(yield subtle.digest(name, data));
            });
        },
        mac(key, data) {
            return __awaiter(this, void 0, void 0, function* () {
                let cryptoKey;
                if (key.length === 0) {
                    if (!zeroKey) {
                        key = new Uint8Array(blockSize);
                        zeroKey = yield subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign", "verify"]);
                    }
                    cryptoKey = zeroKey;
                }
                else {
                    cryptoKey = yield subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign"]);
                }
                return new Uint8Array(yield subtle.sign("HMAC", cryptoKey, data));
            });
        },
        verifyMac(key, data, mac) {
            return __awaiter(this, void 0, void 0, function* () {
                let cryptoKey;
                if (key.length === 0) {
                    if (!zeroKey) {
                        key = new Uint8Array(blockSize);
                        zeroKey = yield subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["sign", "verify"]);
                    }
                    cryptoKey = zeroKey;
                }
                else {
                    cryptoKey = yield subtle.importKey("raw", key, { name: "HMAC", hash: name, length: key.byteLength * 8 }, false, ["verify"]);
                }
                return yield subtle.verify("HMAC", cryptoKey, mac, data);
            });
        },
    };
}
exports.sha256 = makeHash("SHA-256", 64);
exports.sha512 = makeHash("SHA-512", 128);
//# sourceMappingURL=hash.js.map