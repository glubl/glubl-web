import type { IGunInstanceRoot, IGunOnEvent } from "gun";
import { getGun } from "./db";
import { getUserSpacePath } from "./utils";

import dayjs from 'dayjs'
import dayjsParse from 'dayjs/plugin/customParseFormat'
import dayjsUtc from 'dayjs/plugin/utc'
import dayjsFormat from "dayjs/plugin/advancedFormat";
import { friendNotifStore } from "./stores";
dayjs.extend(dayjsParse)
dayjs.extend(dayjsUtc)
dayjs.extend(dayjsFormat)

export interface NotificationGun {
    t: 'group' | 'call'
    d: any
}

export interface Notification {
    type: 'group' | 'call'
    data: any
    from: Profile
}

const DEFAULT_KEY_FORMAT = "x[|[UUID]]"

export async function sendNotification(target: Profile, data: NotificationGun, keyFormat?: string, path?: string) {
    const { SEA, gun, pair } = getGun()
    const root: IGunInstanceRoot<any, any> = (gun as any).back(-1)
    const shared = await SEA.secret(target, pair)
    if (!shared)
        throw "Can't create shared key"
    const spacePath = await getUserSpacePath(target.pub, shared)
    keyFormat ??= DEFAULT_KEY_FORMAT
    const date = dayjs.utc()
    const key = date.format(keyFormat).replace("[UUID]", (gun as any).back("opt.uuid")())
    const enc = await SEA.encrypt(data, shared)
    const sig = await SEA.sign(enc, pair)
    return new Promise(res => root.get(path??`~${pair.pub}/n/${spacePath}`).get(key).put(sig, res))
}

export async function receiveNotification(from: Profile, sig: string, key: string) {
    const { SEA, pair } = getGun()
    const shared = await SEA.secret(from, pair)
    if (!shared)
        throw "Can't create shared key"
    const dat: NotificationGun = await SEA.decrypt(await SEA.verify(sig, from), shared)
    if (!dat)
        throw "Can't decrypt notification!"
    const notif = {
        type: dat.t,
        data: dat.d,
        from: from
    }
    friendNotifStore.update(map => map.set(key, notif))
}
var notificationListeners: {[pub: string]: () => void} = {}
export async function listenNotification(from: Profile, path?: string) {
    if (from.pub in notificationListeners) return notificationListeners[from.pub]
    const { SEA, gun, pair } = getGun()
    var eve: IGunOnEvent
    const shared = await SEA.secret(from, pair)
    if (!shared)
        throw "Can't create shared key"
    const spacePath = await getUserSpacePath(pair.pub, shared)
    gun.get(path??`~${from.pub}/n/${spacePath}`).map().on((v, k, m, e) => {
        eve = e
        receiveNotification(from, v, k)
    })
    return notificationListeners[from.pub] = () => {
        if (eve)
            eve.off()
    }
}