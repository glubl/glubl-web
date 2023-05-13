export declare const kem: {
    p256HkdfSha256: import("./hpke/base").KEM;
};
export declare const kdf: {
    hkdfSha256: import("./hpke/base").KDF;
};
export declare const aead: {
    aes128Gcm: import("./hpke/base").AEAD;
    aes256Gcm: import("./hpke/base").AEAD;
};
export declare const dh: {
    p256: import("./hpke/base").DH;
};
