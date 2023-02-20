import { gun } from "@lib/initGun"

import SEA from "gun/sea"
import type { Profile } from "./types"
import type { ISEAPair } from "gun"
import { InvalidPairError } from "./errors"

const auth = {
    /**
     * login sets key, profile, and settings, peers
     * @param keyPair
     * @returns {void}
     */
    async login(stringKeyPair: string) {
        try {
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
            console.log(await gun.user().get("profile").then())
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
        const pair : ISEAPair = await SEA.pair()
        const stringPair : string = JSON.stringify(pair).replace(/\%22/g,'"')
        await this.login(stringPair)
        const userProfile: Profile = {'picture': '','username': username,'pub': pair.pub}
        gun.user()
          .put({contacts: null})
          .put({messages: null})
          .put({settings: null})
          .put({profile: userProfile})
        return stringPair
    },

    async logout() {
        localStorage.clear()
        location.hash = ""
        location.assign("/login")
        const user = gun.user()
        user.leave();
        (user._ as any).sea = undefined
        // todo more cleanup if necessary
    },

    async verifyPair(pair: ISEAPair) {
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
    }
}

export function protectedRedirect() {
    // current pathname
    let pathname = location.pathname
    if (
        !localStorage.getItem("loggedIn") 
        && !localStorage.getItem("currentUser") 
        && pathname !== "/login" 
        && pathname !== "/register"
    ) {
        location.hash = ""
        location.assign("/login")
    }
}

export default auth;