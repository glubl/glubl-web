import _ from "lodash"
import SEA from "gun/sea"
import { HashFail } from "./errors"

import { ProtocolVersion } from "@src/lib/mls/constants"
import { mls10_128_DhKemX25519Aes128GcmSha256Ed25519 as cipherSuite } from "@src/lib/mls/ciphersuite"
import { stringToUint8Array } from "@src/lib/mls/util"
import { BasicCredential } from "@src/lib/mls/credential"
import { KeyPackage } from "@src/lib/mls/keypackage"

export const debounceByParam = (targetFunc: any, resolver: (...args: any) => any, ...debounceParams: any) =>
    _.wrap(
        _.memoize(
            () => _.debounce(targetFunc, ...debounceParams),
            resolver
        ),
        (getMemoizedFunc: any, ...params: any) =>
            getMemoizedFunc(...params)(...params)
    )

export async function getUserSpacePath(path: string, salt: string) {
    
    const pathHash1 = await SEA.work(path, null, null, {encode: "utf8", salt: salt || ""})
    const pathHash2 = await SEA.work(pathHash1, null, null, {name: "SHA-256"})

    if (!pathHash2)
        throw new HashFail()
    return pathHash2
}


export function uint8ArraytoBase64(arr: Uint8Array): string {
  return btoa(arr.reduce((data, byte) => data + String.fromCharCode(byte), ""))
}

export function base64toUint8Array(base64str: string): Uint8Array {
  return Uint8Array.from(
    atob(base64str)
      .split("")
      .map((c) => c.charCodeAt(0)),
  )
}


export async function makeKeyPackage(userId: string) {
  const [signingPrivKey, signingPubKey] =
    await cipherSuite.signatureScheme.generateKeyPair()
  const credential = new BasicCredential(
    stringToUint8Array(userId),
    cipherSuite.signatureSchemeId,
    await signingPubKey.serialize(),
  )
  const [hpkePrivKey, hpkePubKey] =
    await cipherSuite.hpke.kem.generateKeyPair()
  const keyPackage = await KeyPackage.create(
    ProtocolVersion.Mls10,
    cipherSuite,
    await hpkePubKey.serialize(),
    credential,
    [],
    signingPrivKey,
  )
  return [signingPrivKey, hpkePrivKey, credential, keyPackage]
}
