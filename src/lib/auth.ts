import type { Profile } from "./types"
import type { ISEAPair } from "gun"
import { DecriptionFail, HashFail, InvalidPairError, ProfileNotSet } from "./errors"
import { goto } from "$app/navigation"
import { gunStore } from "./stores"
import { get } from "svelte/store"
import { getGun } from "./initGun"
import { SEA } from "gun"

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
    let SEA = window.SEA
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
    
    // encrypted
    gun.user()
      .put({settings: null})
      .put({friends: null})
      .put({messages: null})
      .put({profile: userProfileEnc})

    gunStore.set(gun)
    return stringPair
  },

  async logout() {
    localStorage.clear()
    let gun = get(gunStore)
    const user = gun.user()
    user.leave();
    (user._ as any).sea = undefined
    gunStore.set(gun)
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
    const profileEnc = await user.get("profile").then()
    if (!profileEnc)
      throw new ProfileNotSet()
    const profile = await SEA.decrypt(profileEnc, pair)
    if (!profile)
      throw new DecriptionFail()
    return profile
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