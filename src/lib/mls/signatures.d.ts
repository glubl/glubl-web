export interface SignatureScheme {
    generateKeyPair(): Promise<[SigningPrivateKey, SigningPublicKey]>;
    deriveKeyPair(ikm: Uint8Array): Promise<[SigningPrivateKey, SigningPublicKey]>;
    deserializePrivate(enc: Uint8Array): Promise<SigningPrivateKey>;
    deserializePublic(enc: Uint8Array): Promise<SigningPublicKey>;
    privateKeyLength: number;
    publicKeyLength: number;
}
export interface SigningPrivateKey {
    sign(message: Uint8Array): Promise<Uint8Array>;
    serialize(): Promise<Uint8Array>;
}
export interface SigningPublicKey {
    verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
    serialize(): Promise<Uint8Array>;
}
export declare const Ed25519: SignatureScheme;
