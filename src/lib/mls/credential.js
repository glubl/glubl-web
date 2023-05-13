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
exports.BasicCredential = exports.Credential = void 0;
/** A user is identified by a credential, which is a signing key.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#credentials
 */
const constants_1 = require("./constants");
const signatures_1 = require("./signatures");
const tlspl = require("./tlspl");
class Credential {
    constructor(credentialType) {
        this.credentialType = credentialType;
    }
    static decode(buffer, offset) {
        const [[credentialType], offset1] = tlspl.decode([tlspl.decodeUint16], buffer, offset);
        switch (credentialType) {
            case constants_1.CredentialType.Basic:
                return BasicCredential.decode(buffer, offset1);
            default:
                throw new Error("Unknown credential type");
        }
    }
    get encoder() {
        return tlspl.struct([
            tlspl.uint16(this.credentialType),
            this.credentialEncoder,
        ]);
    }
}
exports.Credential = Credential;
class BasicCredential extends Credential {
    constructor(identity, signatureScheme, signatureKey) {
        super(constants_1.CredentialType.Basic);
        this.identity = identity;
        this.signatureScheme = signatureScheme;
        this.signatureKey = signatureKey;
    }
    verify(message, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.publicKey) {
                switch (this.signatureScheme) {
                    case constants_1.SignatureScheme.ed25519:
                        this.publicKey = yield signatures_1.Ed25519.deserializePublic(this.signatureKey);
                        break;
                    // FIXME: other signature schemes
                    default:
                        throw new Error("Unsupported signature scheme");
                }
            }
            return this.publicKey.verify(message, signature);
        });
    }
    static decode(buffer, offset) {
        const [[identity, signatureScheme, signatureKey], offset1] = tlspl.decode([
            tlspl.decodeVariableOpaque(2),
            tlspl.decodeUint16,
            tlspl.decodeVariableOpaque(2),
        ], buffer, offset);
        return [new BasicCredential(identity, signatureScheme, signatureKey), offset1];
    }
    get credentialEncoder() {
        return tlspl.struct([
            tlspl.variableOpaque(this.identity, 2),
            tlspl.uint16(this.signatureScheme),
            tlspl.variableOpaque(this.signatureKey, 2),
        ]);
    }
}
exports.BasicCredential = BasicCredential;
// FIXME: x509 certificate
//# sourceMappingURL=credential.js.map