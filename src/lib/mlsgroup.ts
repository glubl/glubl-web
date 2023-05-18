import auth from "./auth"
import { base64toUint8Array } from "./utils"
import { getGun } from "./db"
import { mls10_128_DhKemX25519Aes128GcmSha256Ed25519 as cipherSuite } from "@src/lib/mls/ciphersuite"
import { stringToUint8Array } from "@src/lib/mls/util"
import { Group } from "@src/lib/mls/group"
import { KeyPackage } from "@src/lib/mls/keypackage"
import { ProfileNotSet } from "./errors"
import { ProtocolVersion } from "@src/lib/mls/constants"
import * as tlspl from "@src/lib/mls/tlspl"
import type { BasicCredential } from "@src/lib/mls/credential"
import type { KEMPrivateKey } from "@src/lib/mls/hpke/base"
import type { MLSPlaintext } from "@src/lib/mls/message"
import type { SigningPrivateKey } from "@src/lib/mls/signatures"
import type { Welcome } from "@src/lib/mls/welcome"


export async function create(name: string, members: FriendProfile[]): Promise<[Group, MLSPlaintext, Welcome]> {
  let {user} = getGun()
  let keyBase64s: string[] = members.map((profile) => profile.keyPackage).filter((keyBase64) => !!keyBase64 )
  let keyPackages: KeyPackage[] = keyBase64s.map(keyBase64 => 
    tlspl.decode([KeyPackage.decode], base64toUint8Array(keyBase64))[0][0]
  )
  
  const profile: Profile = await auth.getProfile().then()
  const keyPackageBase64 = profile.keyPackage
  if (!keyPackageBase64) {
    console.log(new ProfileNotSet())
    return Promise.reject(new ProfileNotSet())
  }
  
  const hpkePrivKeyBase64: string = await user.get("hpkePrivKey").then()
  const hpkePrivKeyEncoded: Uint8Array = base64toUint8Array(hpkePrivKeyBase64)
  const keyPackageEncoded: Uint8Array = base64toUint8Array(keyPackageBase64)
  
  const keyPackage = tlspl.decode([KeyPackage.decode], keyPackageEncoded)[0][0]
  const kem = keyPackage.cipherSuite.hpke.kem
  const credential: BasicCredential = keyPackage.credential
  const signingPrivKey: SigningPrivateKey = await kem.deserializePrivate?.(hpkePrivKeyEncoded),

  const [group, plaintext, welcome] = await Group.createNew(
    ProtocolVersion.Mls10,
    cipherSuite,
    stringToUint8Array(name),
    credential,
    signingPrivKey,
    keyPackages
  )

  return [group, plaintext, welcome]
}


export async function createWelcome(welcome: Welcome): Promise<[string, Group] | undefined> {
  let { user } = getGun()
  const profile: Profile = await auth.getProfile().then()
  const keyPackageBase64 = profile.keyPackage
  if (!keyPackageBase64) {
    return Promise.reject(new ProfileNotSet())
  }
  const hpkePrivKeyBase64 = await user.get("hpkePrivKey").then()

  const [
    hpkePrivKeyEncoded,
    keyPackageEncoded,
  ]: Uint8Array[] = [
    base64toUint8Array(hpkePrivKeyBase64),
    base64toUint8Array(keyPackageBase64),
  ]
  const keyPackage = tlspl.decode([KeyPackage.decode], keyPackageEncoded)[0][0]
  const kem = keyPackage.cipherSuite.hpke.kem
  const hpkePrivKey: KEMPrivateKey = await kem.deserializePrivate?.(hpkePrivKeyEncoded)
  if (hpkePrivKey && keyPackage) {
    let record: Record<string, [KeyPackage, KEMPrivateKey]> = {};
    record[profile.username] = [keyPackage, hpkePrivKey]
    return Group.createFromWelcome(welcome, record)
  }
}

