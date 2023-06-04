import { SEA, type IGunInstanceRoot, type ISEAPair } from "gun";
import { GroupNode } from "./circle-channel";
import { getGun } from "./db";
import { sendNotification } from "./notification";
import { friendNotifStore, groupStore } from "./stores";
import { get } from "svelte/store";

export interface GroupInvite {
    id: string,
    path: string,
    owner: {
        pub: string,
        epub: string
    }
}

export async function init() {
    const { gun, pair } = getGun()
    const root: IGunInstanceRoot<any, any> = (gun as any).back(-1)
    root.get(`~${pair.pub}/g`).map().on(async (v, k, meta, eve) => {
        let dat: GroupInvite = await SEA.decrypt(await SEA.verify(v, pair), pair)
        if (!dat) {
            console.warn("Can't decrypt group info")
            return
        }
        if (get(groupStore)[dat.id]) return
        insertGroupData(dat, pair, root)
    })
    friendNotifStore.subscribe(m => {
        for (const [k, v] of m.entries()) {
            if (v.type !== 'group') return
            let dat = v.data as GroupInvite
            if (!dat.id || !dat.owner || !dat.path || !!get(groupStore)[dat.id]) return
            insertGroupData(dat, pair, root)
        }
    })
}

function insertGroupData(dat: GroupInvite, pair: ISEAPair, root: IGunInstanceRoot<any, any>) {
    groupStore.update(v => {
        if (v[dat.id]) return v
        let node = new GroupNode(root as any, dat.path, dat.owner, pair)
        node.once('statechange', s => {
            if (s !== 'ready') console.warn(`Group ${dat.id} failed to be ready`)
            else node.listen(root.get(`~${pair.pub}/gd`).get(dat.id))
        })
        v[dat.id] = node; 
        return v
    })
}

export async function createGroup(name: string, members: Profile[]) {
    const { gun, pair } = getGun()
    const { groupId, groupPair, groupPath } = await GroupNode.createNew(gun as any, pair, members, undefined, undefined, { name: name })
    const root: IGunInstanceRoot<any, any> = (gun as any).back(-1)
    const invite = {
        id: groupId,
        path: groupPath,
        owner: {
            pub: pair.pub,
            epub: pair.epub
        }
    }
    members.forEach(m => {
        sendNotification(m, {
            t: 'group',
            d: invite
        })
    })
    root.get(`~${pair.pub}/g`).get(groupId).put(await SEA.sign(await SEA.encrypt(invite, pair), pair))
}

// friendNotifStore.subscribe()