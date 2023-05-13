import { HPKE } from "./hpke/base";
import { SignatureScheme } from "./signatures";
import { SignatureScheme as SignatureSchemeId } from "./constants";
import { Hash } from "./hash";
export interface CipherSuite {
    hpke: HPKE;
    signatureScheme: SignatureScheme;
    hash: Hash;
    id: number;
    signatureSchemeId: SignatureSchemeId;
}
export declare const mls10_128_DhKemX25519Aes128GcmSha256Ed25519: CipherSuite;
export declare const cipherSuiteById: Record<number, CipherSuite>;
