import gun from "@lib/initGun"
import SEA from "gun/sea"
import type { Profile } from "./types"
import type { ISEAPair } from "gun"
import { InvalidPairError } from "./errors"

export const user = gun.user()

const auth = {
    /**
     * login sets key, profile, and settings, peers
     * @param keyPair
     * @returns {void}
     */
    async login(stringKeyPair: string) {
        try {
            const keyPair = JSON.parse(stringKeyPair)
            const res = user.auth(keyPair)
            if (SEA.err || res.ing) {
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
        } catch (error: any) {
            if (error.name === "SyntaxError") {
                throw new InvalidPairError()
            } else {
                throw Error("Error")
            }
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
        gun.get('users')
            .get('~'+pair.pub)
            .put({contacts: null})
            .put({messages: null})
            .put({settings: null})
            .put({profile: JSON.stringify(userProfile)})
        return stringPair
    },

    async logout() {
        localStorage.clear()
        location.hash = ""
        location.assign("/login")
        // todo more cleanup if necessary
    },


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