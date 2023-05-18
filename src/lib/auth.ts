import type { ISEAPair } from "gun"
import { HashFail, InvalidPairError } from "./errors"
import { gunStore } from "./stores"
import { get } from "svelte/store"
import { getGun } from "./db"
import SEA from "gun/sea"

import * as stores from "./stores"
import * as friends from "./friends"

import { uniqueNamesGenerator, adjectives, colors, animals, type Config } from 'unique-names-generator';
import { getUserSpacePath, makeKeyPackage, uint8ArraytoBase64 } from "./utils"

import * as tlspl from "@src/lib/mls/tlspl"
import type { KeyPackage } from "@src/lib/mls/keypackage"
import type { BasicCredential } from "@src/lib/mls/credential"
import type { SigningPrivateKey } from "@src/lib/mls/signatures"
import type { KEMPrivateKey } from "@src/lib/mls/hpke/base"


const randNameConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: ' ',
};


const auth = {
  /**
   * login sets key, profile, and settings, peers
   * @param keyPair
   * @returns {void}
   */
  async login(stringKeyPair: string) {
    try {
      const gun = get(gunStore)
      const user = gun.user()
      const keyPair = JSON.parse(stringKeyPair)
      await this.verifyPair(keyPair)
      let authResp: any;
      const res = user.auth(keyPair, (o) => authResp = o)
      if (authResp.err || res.ing) {
          throw new InvalidPairError()
      }
      const isUser = res.is !== undefined
      const gunUser = res.is
      /**
       * @warn @todo hide private from local storage
      */
      window.localStorage.setItem('key', stringKeyPair)
      window.localStorage.setItem('currentUser', JSON.stringify(gunUser).replace(/\%22/g,'"'))
      window.localStorage.setItem('loggedIn', `${isUser}`)
       
      // gunStore.set(gun)
      const myProfile = await this.getProfile()
      stores.myProfileStore.set({
        ...myProfile,
        space: await getUserSpacePath(myProfile.pub, keyPair.epriv)
      })
      this.listenProfile()

      await friends.init()

      console.log("Logged in")
    } catch (error: any) {
      if (error.name === "SyntaxError") {
        throw new InvalidPairError()
      }
      throw error
    }
  },

  /**
   * @param {string}
   * @returns {string}
   */
  async register(username: string) {
    const gun = get(gunStore)
    const user = gun.user()
    const pair : ISEAPair = await SEA.pair()
    user.auth(pair)

    const stringPair : string = JSON.stringify(pair).replace(/\%22/g,'"')
    const keyPackage = await this.createAndSaveKeyPackage(username, pair)
    const userProfile: Profile = {
      picture: '',
      username: username,
      pub: pair.pub, 
      epub: pair.epub,
      keyPackage: keyPackage
    }
    const userProfileEnc = await SEA.encrypt(userProfile, pair)
    const mySpacePath = await getUserSpacePath(pair.pub, pair.epriv)

    const profileWithSPace = {
      ...userProfile,
      space: mySpacePath
    }
    stores.myProfileStore.set(profileWithSPace)
    
    // encrypted
    gun.user()
      .put({settings: null})
      .put({friends: {
        // Must have at least 1 obj else gun won't listen with on()
        [mySpacePath]: await SEA.encrypt(profileWithSPace, pair.epriv) 
      }})
      .put({messages: null})
      .put({profile: userProfileEnc})

    await this.login(stringPair)

    return stringPair
  },

  async logout() {
    const gun = get(gunStore)
    
    // db.deinit()
    localStorage.clear()
    stores.clear()
    friends.deinit()
    gun._.on('leave', gun._)
    gun._.user?.leave()
    location.assign("/login")
    
    // await db.init()
    // todo more cleanup if necessary
  },

  async verifyPair(pair: ISEAPair) {
    const SEA = window.SEA
    let err = "Invalid key-pair!"
    let msg = "DINGUS123"
    let enc = await SEA.encrypt(msg, pair)
    if (!enc) throw err
    let sig = await SEA.sign(enc, pair)
    if (!sig) throw err
    enc = await SEA.verify(sig, pair)
    if (!enc) throw err
    let msg2 = await SEA.decrypt(enc, pair)
    if (msg !== msg2) throw err
  },

  async parseProfile(profileEnc: string | Profile) {
    let {SEA, user, pair} = getGun()
    let profile: Profile | undefined
    if (profileEnc && (profileEnc as Profile).pub) {
      console.warn("Profile is not encrypted, encrypting...")
      profile = profileEnc as Profile
      if (!profile.keyPackage) {
        profile.keyPackage = await this.createAndSaveKeyPackage(profile.username, pair)
      }
      user.get("profile").put(await SEA.encrypt(profile, pair))
    } else {
      profile = await SEA.decrypt(profileEnc as string, pair)
      if (profile && !profile.keyPackage) {
        profile.keyPackage = await this.createAndSaveKeyPackage(profile.username, pair)
        const userProfileEnc = await SEA.encrypt(profile, pair);
        user.put({ profile: userProfileEnc });
      } 
    }
    if (!profile) {
      console.warn("Profile not set, creating a new one...")
      profile = this.createDefaultProfile()
      // user.get("profile").put(await SEA.encrypt(profile, pair))
      const userProfileEnc = await SEA.encrypt(profile, pair);
      user.put({profile: userProfileEnc})
    }
    return profile
  },

  async getProfile(): Promise<Profile> {
    let {user} = getGun()
    const profileEnc: string | Profile = await user.get("profile").then()
    return await this.parseProfile(profileEnc)
  },

  listenProfile() {
    let {user, pair} = getGun()
    user.get("profile").on(async (p: string | Profile) => {
      let profile = await this.parseProfile(p)
      stores.myProfileStore.set({
        ...profile,
        space: await getUserSpacePath(pair.pub, pair.epriv)
      })
    })
  },

  async getUserProfile() {
    let {user} = getGun()
    return await user.get('profile').then()
  },

  defaultProfiles: <{[pub: string]: Profile}>{},
  async createDefaultProfile(): Profile {
    let {pair} = getGun()
    const username: string = uniqueNamesGenerator({...randNameConfig, seed: pair.pub}).toTitleCase()
    const keyPackageBase64 = await this.createAndSaveKeyPackage(username, pair) 
    return (this.defaultProfiles[pair.pub] ??= {
      pub: pair.pub, 
      epub: pair.epub, 
      picture: "",
      username: username,
      keyPackage: keyPackageBase64
    })
  },

  async createAndSaveKeyPackage(username: string, pair: ISEAPair) {
    let {user} = getGun()
    const [signingPrivKey, hpkePrivKey, credential, keyPackage] =
      await makeKeyPackage(`${username}:${pair.pub}`)

    const [signingPrivKeyEncoded, hpkePrivKeyEncoded, credentialEncoded, keyPackageEncoded]: Uint8Array[] = [
      await(signingPrivKey as SigningPrivateKey).serialize(),
      await(hpkePrivKey as KEMPrivateKey).serialize(),
      tlspl.encode([(credential as BasicCredential).credentialEncoder]),
      tlspl.encode([(keyPackage as KeyPackage).encoder]),
    ]
    const [signingPrivKeyBase64, hpkePrivKeyBase64, credentialBase64, keyPackageBase64] = [
      uint8ArraytoBase64(signingPrivKeyEncoded),
      uint8ArraytoBase64(hpkePrivKeyEncoded),
      uint8ArraytoBase64(credentialEncoded),
      uint8ArraytoBase64(keyPackageEncoded),
    ]
    user
      .put({signingPrivKey: signingPrivKeyBase64})
      .put({hpkePrivKey: hpkePrivKeyBase64})
      .put({credential: credentialBase64})
    return keyPackageBase64
  },

  // TODO: Use shared pair instead
  async setupSharedSpace(theirPub: string, sharedKey: string) {
    const {SEA, user, pair} = getGun()
  
    const profile = await auth.getProfile()
    const sharedPath = await getUserSpacePath(theirPub, sharedKey)
    user.get("spaces")
      .get(sharedPath)
      .put({
        profile: await SEA.encrypt(profile, sharedKey), // My profile
        status: await SEA.encrypt({ 
          message: "", // My status message
          ts: 0 // My last status timestamp (also for online status)
        }, sharedKey),
        messageStatus: await SEA.encrypt({
          readTs: 0, // My last timestamp read message
          unread: 0, // My unread count
          scanTs: 0, // My last timestamp scan messsage
        }, sharedKey),
        
        // `${ts ISO}|${space path}#${hash}`
        notifications: null, // My notification to them
        messages: null, // My messages to them
      })
    return sharedPath
  },

  async putData(data: string | number): Promise<any> {
    const { gun, SEA, user } = getGun()
    const uuidFn = (gun as any).back("opt.uuid") as (l?: number) => string
    const hash = await SEA.work(data, null, null, {name: "SHA-256"})
    if (!hash)
    throw new HashFail()
    const uuid = uuidFn()
    const frozen = user.get("#"+uuid)
    frozen.get(hash).put(data)
    return frozen as any
  }
}

export function canAuthenticate() {
  return localStorage.getItem("loggedIn") 
    && localStorage.getItem("currentUser")
    && localStorage.getItem("key")
}

export async function protectedRedirect() {
  // current pathname
  let pathname = location.pathname
  let loggedIn = localStorage.getItem("loggedIn") 
  let currentUser = localStorage.getItem("currentUser") 
  if (
    !loggedIn 
    && !currentUser
    && pathname !== "/login" 
    && pathname !== "/register"
  ) {
    location.hash = ""
    location.assign("/login")
    return
  }

  if (loggedIn && currentUser) 
    await auth.login(localStorage.getItem("key")!)
}

export default auth;