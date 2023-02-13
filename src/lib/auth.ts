import gun from "@lib/initGun"
import SEA from "gun/sea"
import type { Profile } from "./types"
import type { ISEAPair } from "gun"
import { currentUser, loggedIn, key } from "./stores"

export const user = gun.user()

const auth = {
    /**
     * login sets key, profile, and settings, peers
     * @param keyPair
     * @returns {void}
     */
    async login(stringKeyPair: string) {
        const keyPair = JSON.parse(stringKeyPair)
        const res = user.auth(keyPair)
        const isUser = res.is !== undefined
        const gunUser = res.is
        loggedIn.set(true)
        key.set(keyPair)
        currentUser.set(gunUser)
        /**
         * @warn @todo hide private from local storage
        */
        window.localStorage.setItem('key', stringKeyPair)
        window.localStorage.setItem('currentUser', JSON.stringify(gunUser).replace(/\%22/g,'"'))
        window.localStorage.setItem('loggedIn', `${isUser}`)
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
            .put({key: JSON.stringify(pair)})
            .put({contacts: null})
            .put({messages: null})
            .put({settings: null})
            .put({profile: JSON.stringify(userProfile)})
        gun.get('users').get('profiles').put(userProfile)

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
    if (!localStorage.getItem("loggedIn") && pathname !== "/login" && pathname !== "/register") {
        location.hash = ""
        location.assign("/login")
    }
}

export default auth;