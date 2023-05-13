/** A user is identified by a credential, which is a signing key.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#credentials
 */
import { CredentialType, SignatureScheme } from "./constants";
import * as tlspl from "./tlspl";
export declare abstract class Credential {
    readonly credentialType: CredentialType;
    constructor(credentialType: CredentialType);
    abstract verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
    abstract get identity(): Uint8Array;
    abstract get credentialEncoder(): tlspl.Encoder;
    static decode(buffer: Uint8Array, offset: number): [Credential, number];
    get encoder(): tlspl.Encoder;
}
export declare class BasicCredential extends Credential {
    readonly identity: Uint8Array;
    readonly signatureScheme: SignatureScheme;
    readonly signatureKey: Uint8Array;
    private publicKey;
    constructor(identity: Uint8Array, signatureScheme: SignatureScheme, signatureKey: Uint8Array);
    verify(message: Uint8Array, signature: Uint8Array): Promise<boolean>;
    static decode(buffer: Uint8Array, offset: number): [BasicCredential, number];
    get credentialEncoder(): tlspl.Encoder;
}
