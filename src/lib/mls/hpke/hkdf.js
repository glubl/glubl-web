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
exports.hkdfSha512 = exports.hkdfSha384 = exports.hkdfSha256 = void 0;
const util_1 = require("../util");
const subtle = globalThis.crypto.subtle;
function makeHKDF(name, size, blockSize, id) {
    let zeroKey; // a key consisting of blockSize 0's, which is the default salt
    return {
        extract(salt, ikm) {
            return __awaiter(this, void 0, void 0, function* () {
                let key;
                // importKey doesn't like a 0-byte length, so if it's size 0,
                // expand it to an all-zero array, because that's what HMAC will do
                // anyways
                if (salt === undefined || salt.length === 0) {
                    if (!zeroKey) {
                        salt = new Uint8Array(blockSize);
                        zeroKey = yield subtle.importKey("raw", salt, { name: "HMAC", hash: name, length: salt.byteLength * 8 }, false, ["sign"]);
                    }
                    key = zeroKey;
                }
                else {
                    key = yield subtle.importKey("raw", salt, { name: "HMAC", hash: name, length: salt.byteLength * 8 }, false, ["sign"]);
                }
                return new Uint8Array(yield subtle.sign("HMAC", key, ikm));
            });
        },
        expand(prk, info, length) {
            return __awaiter(this, void 0, void 0, function* () {
                if (info === undefined) {
                    info = new Uint8Array(0);
                }
                const ret = new Uint8Array(length);
                const key = yield subtle.importKey("raw", prk, { name: "HMAC", hash: name, length: info.byteLength * 8 }, false, ["sign"]);
                let chunk = new Uint8Array(0);
                for (let [pos, i] = [0, 0]; pos < length; pos += size, i++) {
                    chunk = new Uint8Array(yield subtle.sign("HMAC", key, (0, util_1.concatUint8Array)([chunk, info, Uint8Array.from([i + 1])])));
                    if (pos + size > length) {
                        ret.set(chunk.subarray(0, length - pos), size * i);
                    }
                    else {
                        ret.set(chunk, size * i);
                    }
                }
                return ret;
            });
        },
        extractLength: size,
        hashLength: size,
        id: id,
    };
}
exports.hkdfSha256 = makeHKDF("SHA-256", 32, 64, 0x0001);
exports.hkdfSha384 = makeHKDF("SHA-384", 48, 128, 0x0002);
exports.hkdfSha512 = makeHKDF("SHA-512", 64, 128, 0x0003);
//# sourceMappingURL=hkdf.js.map