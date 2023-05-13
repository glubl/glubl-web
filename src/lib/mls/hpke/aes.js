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
exports.aes256Gcm = exports.aes128Gcm = void 0;
const subtle = globalThis.crypto.subtle;
exports.aes128Gcm = {
    seal(key, nonce, aad, pt) {
        return __awaiter(this, void 0, void 0, function* () {
            const k = yield subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
            return new Uint8Array(yield subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, k, pt));
        });
    },
    open(key, nonce, aad, ct) {
        return __awaiter(this, void 0, void 0, function* () {
            const k = yield subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
            return new Uint8Array(yield subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, k, ct));
        });
    },
    keyLength: 16,
    nonceLength: 12,
    id: 0x0001,
};
exports.aes256Gcm = {
    seal(key, nonce, aad, pt) {
        return __awaiter(this, void 0, void 0, function* () {
            const k = yield subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
            return new Uint8Array(yield subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, k, pt));
        });
    },
    open(key, nonce, aad, ct) {
        return __awaiter(this, void 0, void 0, function* () {
            const k = yield subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
            return new Uint8Array(yield subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, k, ct));
        });
    },
    keyLength: 32,
    nonceLength: 12,
    id: 0x0002,
};
//# sourceMappingURL=aes.js.map