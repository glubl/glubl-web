import type { Profile } from "./types"
import type { GunSchema, IGunChain, IGunInstanceRoot, ISEA, ISEAPair } from "gun"
import { DecriptionFail, HashFail, InvalidPairError, ProfileNotSet } from "./errors"
import { goto } from "$app/navigation"
import { clear, gunStore } from "./stores"
import { get } from "svelte/store"
import { getGun } from "./gun"
import { SEA } from "gun"

import * as stores from "./stores"
import * as db from "./gun"
import * as friends from "./friends"

import { uniqueNamesGenerator, adjectives, colors, animals, type Config } from 'unique-names-generator';
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
      // console.log(stringKeyPair)
      const { user } = getGun()
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
      stores.profileStore.set({
        ...myProfile,
        space: await this.getUserSpacePath(keyPair.pub, keyPair.epriv)
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
    const { gun, SEA } = getGun()
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

    return stringPair
  },

  async logout() {

    // Buggy
    const { gun } = getGun()
    const user = gun.user()
    user.leave();
    (user._ as any).sea = undefined

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
      // user.get("profile").put(await SEA.encrypt(profile, pair))
    }
    return profile
  },

  createDefaultProfile() {
    let {pair} = getGun()
    return {
      pub: pair.pub, 
      epub: pair.epub, 
      picture: "",
      username: uniqueNamesGenerator({...randNameConfig, seed: pair.pub}).toTitleCase()
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

  // TODO: Use shared pair instead
  async setupSharedSpace(theirPub: string, sharedKey: string) {
    const {SEA, user, pair} = getGun()
  
    const profile = await auth.getProfile()
    const sharedPath = await auth.getUserSpacePath(theirPub, sharedKey)
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