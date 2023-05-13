import { HPKE } from "./hpke/base";
export declare const kem: {
    p256HkdfSha256: import("./hpke/base").KEM;
    p384HkdfSha384: import("./hpke/base").KEM;
    p521HkdfSha512: import("./hpke/base").KEM;
    x25519HkdfSha256: import("./hpke/base").KEM;
};
export declare const kdf: {
    hkdfSha256: import("./hpke/base").KDF;
    hkdfSha384: import("./hpke/base").KDF;
    hkdfSha512: import("./hpke/base").KDF;
};
export declare const aead: {
    aes128Gcm: import("./hpke/base").AEAD;
    aes256Gcm: import("./hpke/base").AEAD;
};
export declare const dh: {
    p256: import("./hpke/base").DH;
    p384: import("./hpke/base").DH;
    p521: import("./hpke/base").DH;
};
export declare const p256HkdfSha256Aes128Gcm: HPKE;
export declare const x25519HkdfSha256Aes128Gcm: HPKE;
