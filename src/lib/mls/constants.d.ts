export declare const EMPTY_BYTE_ARRAY: Uint8Array;
export declare const APPLICATION: Uint8Array;
export declare const AUTHENTICATION: Uint8Array;
export declare const BASE_NONCE: Uint8Array;
export declare const CANDIDATE: Uint8Array;
export declare const CONFIRM: Uint8Array;
export declare const DKP_PRK: Uint8Array;
export declare const EAE_PRK: Uint8Array;
export declare const ENCRYPTION: Uint8Array;
export declare const EPOCH: Uint8Array;
export declare const EXP: Uint8Array;
export declare const EXPORTER: Uint8Array;
export declare const EXTERNAL: Uint8Array;
export declare const HANDSHAKE: Uint8Array;
export declare const HPKE: Uint8Array;
export declare const INFO_HASH: Uint8Array;
export declare const INIT: Uint8Array;
export declare const KEY: Uint8Array;
export declare const MLS10: Uint8Array;
export declare const MEMBER: Uint8Array;
export declare const MEMBERSHIP: Uint8Array;
export declare const NODE: Uint8Array;
export declare const NONCE: Uint8Array;
export declare const PATH: Uint8Array;
export declare const PSK_ID_HASH: Uint8Array;
export declare const RESUMPTION: Uint8Array;
export declare const SEC: Uint8Array;
export declare const SECRET: Uint8Array;
export declare const SENDER_DATA: Uint8Array;
export declare const SHARED_SECRET: Uint8Array;
export declare const SK: Uint8Array;
export declare const TREE: Uint8Array;
export declare const WELCOME: Uint8Array;
export declare enum ExtensionType {
    Capabilities = 1,
    Lifetime = 2,
    KeyId = 3,
    ParentHash = 4,
    RatchetTree = 5,
    Generation = 65280
}
export declare enum CredentialType {
    Basic = 1,
    X509 = 2
}
export declare enum SignatureScheme {
    rsa_pkcs1_sha256 = 1025,
    rsa_pkcs1_sha384 = 1281,
    rsa_pkcs1_sha512 = 1537,
    ecdsa_secp256r1_sha256 = 1027,
    ecdsa_secp384r1_sha384 = 1283,
    ecdsa_secp521r1_sha512 = 1539,
    rsa_pss_rsae_sha256 = 2052,
    rsa_pss_rsae_sha384 = 2053,
    rsa_pss_rsae_sha512 = 2054,
    ed25519 = 2055,
    ed448 = 2056,
    rsa_pss_pss_sha256 = 2057,
    rsa_pss_pss_sha384 = 2058,
    rsa_pss_pss_sha512 = 2059,
    rsa_pkcs1_sha1 = 513,
    ecdsa_sha1 = 515
}
export declare enum ProtocolVersion {
    Reserved = 0,
    Mls10 = 1
}
export declare enum ContentType {
    Reserved = 0,
    Application = 1,
    Proposal = 2,
    Commit = 3
}
export declare enum SenderType {
    Reserved = 0,
    Member = 1,
    Preconfigured = 2,
    NewMember = 3
}
export declare enum ProposalType {
    Reserved = 0,
    Add = 1,
    Update = 2,
    Remove = 3,
    Psk = 4,
    Reinit = 5,
    ExternalInit = 6
}
export declare enum ProposalOrRefType {
    Reserved = 0,
    Proposal = 1,
    Reference = 2
}
export declare enum NodeType {
    Reserved = 0,
    Leaf = 1,
    Parent = 2
}
