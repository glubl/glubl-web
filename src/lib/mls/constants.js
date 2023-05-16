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
// various constants
import { stringToUint8Array } from "./util";
export const EMPTY_BYTE_ARRAY = new Uint8Array(0);
// Uint8Array versions of strings
export const APPLICATION = stringToUint8Array("application");
export const AUTHENTICATION = stringToUint8Array("authentication");
export const BASE_NONCE = stringToUint8Array("base_nonce");
export const CANDIDATE = stringToUint8Array("candidate");
export const CONFIRM = stringToUint8Array("confirm");
export const DKP_PRK = stringToUint8Array("dkp_prk");
export const EAE_PRK = stringToUint8Array("eae_prk");
export const ENCRYPTION = stringToUint8Array("encryption");
export const EPOCH = stringToUint8Array("epoch");
export const EXP = stringToUint8Array("exp");
export const EXPORTER = stringToUint8Array("exporter");
export const EXTERNAL = stringToUint8Array("external");
export const HANDSHAKE = stringToUint8Array("handshake");
export const HPKE = stringToUint8Array("HPKE");
export const INFO_HASH = stringToUint8Array("info_hash");
export const INIT = stringToUint8Array("init");
export const KEY = stringToUint8Array("key");
export const MLS10 = stringToUint8Array("mls10 ");
export const MEMBER = stringToUint8Array("member");
export const MEMBERSHIP = stringToUint8Array("membership");
export const NODE = stringToUint8Array("node");
export const NONCE = stringToUint8Array("nonce");
export const PATH = stringToUint8Array("path");
export const PSK_ID_HASH = stringToUint8Array("psk_id_hash");
export const RESUMPTION = stringToUint8Array("resumption");
export const SEC = stringToUint8Array("sec");
export const SECRET = stringToUint8Array("secret");
export const SENDER_DATA = stringToUint8Array("sender data");
export const SHARED_SECRET = stringToUint8Array("shared_secret");
export const SK = stringToUint8Array("sk");
export const TREE = stringToUint8Array("tree");
export const WELCOME = stringToUint8Array("welcome");
// uint16
export var ExtensionType;
(function (ExtensionType) {
    ExtensionType[ExtensionType["Capabilities"] = 1] = "Capabilities";
    ExtensionType[ExtensionType["Lifetime"] = 2] = "Lifetime";
    ExtensionType[ExtensionType["KeyId"] = 3] = "KeyId";
    ExtensionType[ExtensionType["ParentHash"] = 4] = "ParentHash";
    ExtensionType[ExtensionType["RatchetTree"] = 5] = "RatchetTree";
    ExtensionType[ExtensionType["Generation"] = 65280] = "Generation";
})(ExtensionType || (ExtensionType = {}));
// uint16
export var CredentialType;
(function (CredentialType) {
    CredentialType[CredentialType["Basic"] = 1] = "Basic";
    CredentialType[CredentialType["X509"] = 2] = "X509";
})(CredentialType || (CredentialType = {}));
// See RFC 8446 and the IANA TLS SignatureScheme registry
export var SignatureScheme;
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
})(SignatureScheme || (SignatureScheme = {}));
// uint8
export var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion[ProtocolVersion["Reserved"] = 0] = "Reserved";
    ProtocolVersion[ProtocolVersion["Mls10"] = 1] = "Mls10";
})(ProtocolVersion || (ProtocolVersion = {}));
// uint8
export var ContentType;
(function (ContentType) {
    ContentType[ContentType["Reserved"] = 0] = "Reserved";
    ContentType[ContentType["Application"] = 1] = "Application";
    ContentType[ContentType["Proposal"] = 2] = "Proposal";
    ContentType[ContentType["Commit"] = 3] = "Commit";
})(ContentType || (ContentType = {}));
// uint8
export var SenderType;
(function (SenderType) {
    SenderType[SenderType["Reserved"] = 0] = "Reserved";
    SenderType[SenderType["Member"] = 1] = "Member";
    SenderType[SenderType["Preconfigured"] = 2] = "Preconfigured";
    SenderType[SenderType["NewMember"] = 3] = "NewMember";
})(SenderType || (SenderType = {}));
// uint8
export var ProposalType;
(function (ProposalType) {
    ProposalType[ProposalType["Reserved"] = 0] = "Reserved";
    ProposalType[ProposalType["Add"] = 1] = "Add";
    ProposalType[ProposalType["Update"] = 2] = "Update";
    ProposalType[ProposalType["Remove"] = 3] = "Remove";
    ProposalType[ProposalType["Psk"] = 4] = "Psk";
    ProposalType[ProposalType["Reinit"] = 5] = "Reinit";
    ProposalType[ProposalType["ExternalInit"] = 6] = "ExternalInit";
})(ProposalType || (ProposalType = {}));
// uint8
export var ProposalOrRefType;
(function (ProposalOrRefType) {
    ProposalOrRefType[ProposalOrRefType["Reserved"] = 0] = "Reserved";
    ProposalOrRefType[ProposalOrRefType["Proposal"] = 1] = "Proposal";
    ProposalOrRefType[ProposalOrRefType["Reference"] = 2] = "Reference";
})(ProposalOrRefType || (ProposalOrRefType = {}));
// uint8
export var NodeType;
(function (NodeType) {
    NodeType[NodeType["Reserved"] = 0] = "Reserved";
    NodeType[NodeType["Leaf"] = 1] = "Leaf";
    NodeType[NodeType["Parent"] = 2] = "Parent";
})(NodeType || (NodeType = {}));
//# sourceMappingURL=constants.js.map