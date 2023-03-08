import type { Profile } from "./types"
import type { ISEA, ISEAPair } from "gun"
import { DecriptionFail, HashFail, InvalidPairError, ProfileNotSet } from "./errors"
import { goto } from "$app/navigation"
import { clear, gunStore } from "./stores"
import { get } from "svelte/store"
import { getGun } from "./initGun"
import { SEA } from "gun"

import * as stores from "./stores"
import * as db from "./initGun"
import * as friends from "./friends"

const auth = {
  /**
   * login sets key, profile, and settings, peers
   * @param keyPair
   * @returns {void}
   */
  async login(stringKeyPair: string) {
    try {
      let gun = get(gunStore)
      const keyPair = JSON.parse(stringKeyPair)
      await this.verifyPair(keyPair)
      let authResp: any;
      const res = gun.user().auth(keyPair, (o) => authResp = o)
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
       
      gunStore.set(gun)
      const {pair} = getGun()
      const myProfile = await this.getProfile()
      stores.profileStore.set({
        ...myProfile,
        space: await this.getUserSpacePath(pair.pub, pair.epriv)
      })

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
    let gun = get(gunStore)
    let SEA: ISEA = window.SEA
    const pair : ISEAPair = await SEA.pair()
    const stringPair : string = JSON.stringify(pair).replace(/\%22/g,'"')
    await this.login(stringPair)
    const userProfile: Profile = {
      picture: '',
      username: username,
      pub: pair.pub, 
      epub: pair.epub
    }
    const userProfileEnc = await SEA.encrypt(userProfile, pair)
    const mySpacePath = await this.getUserSpacePath(pair.pub, pair.epriv)

    const profileWithSPace = {
      ...userProfile,
      space: mySpacePath
    }
    stores.profileStore.set(profileWithSPace)
    
    // encrypted
    gun.user()
      .put({settings: null})
      .put({friends: {
        // Must have at least 1 obj else gun won't listen with on()
        [mySpacePath]: await SEA.encrypt(profileWithSPace, pair.epriv) 
      }})
      .put({messages: null})
      .put({profile: userProfileEnc})

    gunStore.set(gun)
    return stringPair
  },

  async logout() {

    // Buggy
    const gun = get(gunStore)
    const user = gun.user()
    user.leave();
    (user._ as any).sea = undefined
    gunStore.set(gun)

    localStorage.clear()
    friends.deinit()
    stores.clear()

    await db.init()
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

  async getProfile(): Promise<Profile> {
    let {SEA, user, pair} = getGun()
    const profileEnc: string | Profile = await user.get("profile").then()
    let profile: Profile | undefined
    if (profileEnc && (profileEnc as Profile).pub) {
      console.warn("Profile is not encrypted, encrypting...")
      profile = profileEnc as Profile
      user.get("profile").put(await SEA.encrypt(profile, pair))
    } else {
      profile = await SEA.decrypt(profileEnc as string, pair)
    }
    if (!profile) {
      console.warn("Profile not set, creating a new one...")
      profile = this.createDefaultProfile()
      user.get("profile").put(await SEA.encrypt(profile, pair))
    }
    return profile
  },

  createDefaultProfile() {
    let {pair} = getGun()
    return {
      pub: pair.pub, 
      epub: pair.epub, 
      picture: "",
      username: String.random(8)
    } as Profile
  },

  async getUserSpacePath(path: string, salt: string) {
    const {SEA} = getGun()
  
    const pathHash1 = await SEA.work(path, null, null, {encode: "utf8", salt: salt || ""})
    const pathHash2 = await SEA.work(pathHash1, null, null, {name: "SHA-256"})

    if (!pathHash2)
      throw new HashFail()
    return pathHash2
  },

  async setupSharedSpace(theirPub: string, sharedKey: string) {
    const {SEA, user, pair} = getGun()
  
    const profile = await auth.getProfile()
    const sharedPath = await auth.getUserSpacePath(theirPub, sharedKey)
    const certificate = await SEA.certify([theirPub], [{"*": "notifications"}, {"*": "messages"}], pair, undefined)
    user.get("spaces")
      .get(sharedPath)
      .put({
        profile: await SEA.encrypt(profile, sharedKey),
        certificate: await SEA.encrypt(certificate, sharedKey),
        "#notifications": null,
        "#messages": null
      })
    return sharedPath
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