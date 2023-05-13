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
exports.NodeType = exports.ProposalOrRefType = exports.ProposalType = exports.SenderType = exports.ContentType = exports.ProtocolVersion = exports.SignatureScheme = exports.CredentialType = exports.ExtensionType = exports.WELCOME = exports.TREE = exports.SK = exports.SHARED_SECRET = exports.SENDER_DATA = exports.SECRET = exports.SEC = exports.RESUMPTION = exports.PSK_ID_HASH = exports.PATH = exports.NONCE = exports.NODE = exports.MEMBERSHIP = exports.MEMBER = exports.MLS10 = exports.KEY = exports.INIT = exports.INFO_HASH = exports.HPKE = exports.HANDSHAKE = exports.EXTERNAL = exports.EXPORTER = exports.EXP = exports.EPOCH = exports.ENCRYPTION = exports.EAE_PRK = exports.DKP_PRK = exports.CONFIRM = exports.CANDIDATE = exports.BASE_NONCE = exports.AUTHENTICATION = exports.APPLICATION = exports.EMPTY_BYTE_ARRAY = void 0;
// various constants
const util_1 = require("./util");
exports.EMPTY_BYTE_ARRAY = new Uint8Array(0);
// Uint8Array versions of strings
exports.APPLICATION = (0, util_1.stringToUint8Array)("application");
exports.AUTHENTICATION = (0, util_1.stringToUint8Array)("authentication");
exports.BASE_NONCE = (0, util_1.stringToUint8Array)("base_nonce");
exports.CANDIDATE = (0, util_1.stringToUint8Array)("candidate");
exports.CONFIRM = (0, util_1.stringToUint8Array)("confirm");
exports.DKP_PRK = (0, util_1.stringToUint8Array)("dkp_prk");
exports.EAE_PRK = (0, util_1.stringToUint8Array)("eae_prk");
exports.ENCRYPTION = (0, util_1.stringToUint8Array)("encryption");
exports.EPOCH = (0, util_1.stringToUint8Array)("epoch");
exports.EXP = (0, util_1.stringToUint8Array)("exp");
exports.EXPORTER = (0, util_1.stringToUint8Array)("exporter");
exports.EXTERNAL = (0, util_1.stringToUint8Array)("external");
exports.HANDSHAKE = (0, util_1.stringToUint8Array)("handshake");
exports.HPKE = (0, util_1.stringToUint8Array)("HPKE");
exports.INFO_HASH = (0, util_1.stringToUint8Array)("info_hash");
exports.INIT = (0, util_1.stringToUint8Array)("init");
exports.KEY = (0, util_1.stringToUint8Array)("key");
exports.MLS10 = (0, util_1.stringToUint8Array)("mls10 ");
exports.MEMBER = (0, util_1.stringToUint8Array)("member");
exports.MEMBERSHIP = (0, util_1.stringToUint8Array)("membership");
exports.NODE = (0, util_1.stringToUint8Array)("node");
exports.NONCE = (0, util_1.stringToUint8Array)("nonce");
exports.PATH = (0, util_1.stringToUint8Array)("path");
exports.PSK_ID_HASH = (0, util_1.stringToUint8Array)("psk_id_hash");
exports.RESUMPTION = (0, util_1.stringToUint8Array)("resumption");
exports.SEC = (0, util_1.stringToUint8Array)("sec");
exports.SECRET = (0, util_1.stringToUint8Array)("secret");
exports.SENDER_DATA = (0, util_1.stringToUint8Array)("sender data");
exports.SHARED_SECRET = (0, util_1.stringToUint8Array)("shared_secret");
exports.SK = (0, util_1.stringToUint8Array)("sk");
exports.TREE = (0, util_1.stringToUint8Array)("tree");
exports.WELCOME = (0, util_1.stringToUint8Array)("welcome");
// uint16
var ExtensionType;
(function (ExtensionType) {
    ExtensionType[ExtensionType["Capabilities"] = 1] = "Capabilities";
    ExtensionType[ExtensionType["Lifetime"] = 2] = "Lifetime";
    ExtensionType[ExtensionType["KeyId"] = 3] = "KeyId";
    ExtensionType[ExtensionType["ParentHash"] = 4] = "ParentHash";
    ExtensionType[ExtensionType["RatchetTree"] = 5] = "RatchetTree";
    ExtensionType[ExtensionType["Generation"] = 65280] = "Generation";
})(ExtensionType = exports.ExtensionType || (exports.ExtensionType = {}));
// uint16
var CredentialType;
(function (CredentialType) {
    CredentialType[CredentialType["Basic"] = 1] = "Basic";
    CredentialType[CredentialType["X509"] = 2] = "X509";
})(CredentialType = exports.CredentialType || (exports.CredentialType = {}));
// See RFC 8446 and the IANA TLS SignatureScheme registry
var SignatureScheme;
(function (SignatureScheme) {
    SignatureScheme[SignatureScheme["rsa_pkcs1_sha256"] = 1025] = "rsa_pkcs1_sha256";
    SignatureScheme[SignatureScheme["rsa_pkcs1_sha384"] = 1281] = "rsa_pkcs1_sha384";
    SignatureScheme[SignatureScheme["rsa_pkcs1_sha512"] = 1537] = "rsa_pkcs1_sha512";
    /* ECDSA algorithms */
    SignatureScheme[SignatureScheme["ecdsa_secp256r1_sha256"] = 1027] = "ecdsa_secp256r1_sha256";
    SignatureScheme[SignatureScheme["ecdsa_secp384r1_sha384"] = 1283] = "ecdsa_secp384r1_sha384";
    SignatureScheme[SignatureScheme["ecdsa_secp521r1_sha512"] = 1539] = "ecdsa_secp521r1_sha512";
    /* RSASSA-PSS algorithms with public key OID rsaEncryption */
    SignatureScheme[SignatureScheme["rsa_pss_rsae_sha256"] = 2052] = "rsa_pss_rsae_sha256";
    SignatureScheme[SignatureScheme["rsa_pss_rsae_sha384"] = 2053] = "rsa_pss_rsae_sha384";
    SignatureScheme[SignatureScheme["rsa_pss_rsae_sha512"] = 2054] = "rsa_pss_rsae_sha512";
    /* EdDSA algorithms */
    SignatureScheme[SignatureScheme["ed25519"] = 2055] = "ed25519";
    SignatureScheme[SignatureScheme["ed448"] = 2056] = "ed448";
    /* RSASSA-PSS algorithms with public key OID RSASSA-PSS */
    SignatureScheme[SignatureScheme["rsa_pss_pss_sha256"] = 2057] = "rsa_pss_pss_sha256";
    SignatureScheme[SignatureScheme["rsa_pss_pss_sha384"] = 2058] = "rsa_pss_pss_sha384";
    SignatureScheme[SignatureScheme["rsa_pss_pss_sha512"] = 2059] = "rsa_pss_pss_sha512";
    /* Legacy algorithms */
    SignatureScheme[SignatureScheme["rsa_pkcs1_sha1"] = 513] = "rsa_pkcs1_sha1";
    SignatureScheme[SignatureScheme["ecdsa_sha1"] = 515] = "ecdsa_sha1";
})(SignatureScheme = exports.SignatureScheme || (exports.SignatureScheme = {}));
// uint8
var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion[ProtocolVersion["Reserved"] = 0] = "Reserved";
    ProtocolVersion[ProtocolVersion["Mls10"] = 1] = "Mls10";
})(ProtocolVersion = exports.ProtocolVersion || (exports.ProtocolVersion = {}));
// uint8
var ContentType;
(function (ContentType) {
    ContentType[ContentType["Reserved"] = 0] = "Reserved";
    ContentType[ContentType["Application"] = 1] = "Application";
    ContentType[ContentType["Proposal"] = 2] = "Proposal";
    ContentType[ContentType["Commit"] = 3] = "Commit";
})(ContentType = exports.ContentType || (exports.ContentType = {}));
// uint8
var SenderType;
(function (SenderType) {
    SenderType[SenderType["Reserved"] = 0] = "Reserved";
    SenderType[SenderType["Member"] = 1] = "Member";
    SenderType[SenderType["Preconfigured"] = 2] = "Preconfigured";
    SenderType[SenderType["NewMember"] = 3] = "NewMember";
})(SenderType = exports.SenderType || (exports.SenderType = {}));
// uint8
var ProposalType;
(function (ProposalType) {
    ProposalType[ProposalType["Reserved"] = 0] = "Reserved";
    ProposalType[ProposalType["Add"] = 1] = "Add";
    ProposalType[ProposalType["Update"] = 2] = "Update";
    ProposalType[ProposalType["Remove"] = 3] = "Remove";
    ProposalType[ProposalType["Psk"] = 4] = "Psk";
    ProposalType[ProposalType["Reinit"] = 5] = "Reinit";
    ProposalType[ProposalType["ExternalInit"] = 6] = "ExternalInit";
})(ProposalType = exports.ProposalType || (exports.ProposalType = {}));
// uint8
var ProposalOrRefType;
(function (ProposalOrRefType) {
    ProposalOrRefType[ProposalOrRefType["Reserved"] = 0] = "Reserved";
    ProposalOrRefType[ProposalOrRefType["Proposal"] = 1] = "Proposal";
    ProposalOrRefType[ProposalOrRefType["Reference"] = 2] = "Reference";
})(ProposalOrRefType = exports.ProposalOrRefType || (exports.ProposalOrRefType = {}));
// uint8
var NodeType;
(function (NodeType) {
    NodeType[NodeType["Reserved"] = 0] = "Reserved";
    NodeType[NodeType["Leaf"] = 1] = "Leaf";
    NodeType[NodeType["Parent"] = 2] = "Parent";
})(NodeType = exports.NodeType || (exports.NodeType = {}));
//# sourceMappingURL=constants.js.map