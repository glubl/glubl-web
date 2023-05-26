import { DecriptionFail, EncryptionFail, HashFail, SharedCreationFail, VerifyFail } from "./errors"
import dayjs from "dayjs";
import { getGun } from "./db";
import auth from "./auth";
import type { IGunOnEvent, ISEAPair, _GunRoot } from "gun";
import { friendRTCStore, friendsStore } from "./stores";
import  _ from "lodash";
import { writable, get } from "svelte/store";
import { debounceByParam, getUserSpacePath } from "./utils";

if (typeof window !== "undefined")
  window._ = _

let friendEv: IGunOnEvent
let friendsEv: {[k: string]: IGunOnEvent} = {}
// TODO: make global and limit memory
let friendDataCache = writable<{[v: string]: FriendProfile}>({})
let initatedFriends = new Set<string>()

function equals(f1: FriendProfile, f2: FriendProfile) {
  return (
    f1.epub     === f2.epub    &&
    f1.pub      === f2.pub     &&
    f1.picture  === f2.picture &&
    f1.space    === f2.space   &&
    f1.username === f2.username
  )
}

function updateFrendData(friendData: FriendProfile) {
  if (!equals(friendData, get(friendsStore)[friendData.pub]||{})) {
    friendsStore.update(v => {
      v[friendData.pub] = {
        ...(v[friendData.pub]||{}),
        ...friendData
      }
      return v
    })
  }
}

const getDataCache = async(d: string, key: string) => {
  let friendProfile = get(friendDataCache)[d]
  if (friendProfile)
    return friendProfile

  const {SEA} = getGun()

  friendProfile = await SEA.decrypt(d, key) as FriendProfile
  if (!friendProfile)
    throw new DecriptionFail()
    
  friendDataCache.update(v => {
    v[d] = friendProfile
    return v
  })

  return friendProfile 
}

const initiateFriendData = debounceByParam(async(d: string) => {
  const {gun, SEA, pair} = getGun()

  let friendData = await getDataCache(d, pair.epriv)
  let storedData = get(friendsStore)[friendData.pub] || {}
  friendData = {
    ...storedData,
    ...friendData
  }

  if (initatedFriends.has(friendData.pub)) return
  initatedFriends.add(friendData.pub)

  const shared = await SEA.secret(friendData.epub, pair)
  if (!shared)
    throw new SharedCreationFail()

  const mySpacePath = await getUserSpacePath(pair.pub, shared)

  if (friendsEv[friendData.pub])
    friendsEv[friendData.pub].off()

  const friendDataEnc = await gun.get("~"+friendData.pub).get("spaces")
    .get(mySpacePath)
    .get("profile")
    .on(async (v, _, __, e) => {
      // console.log(v)
      if (v) {
        friendsEv[friendData.pub] = e
        friendData = await getDataCache(v, shared)
        let storedData = get(friendsStore)[friendData.pub] || {}
        friendData = {
          ...storedData,
          ...friendData
        }
      }
      updateFrendData(friendData)
    })
    .then()

  // Friend request not yet accepted
  if (!friendDataEnc) {
    updateFrendData(friendData)
  }

  const sharedSpace = await getUserSpacePath(friendData.pub, shared)

  setTimeout(() => {
    gun._.on("friend", {...friendData, path: sharedSpace, mypath: mySpacePath})
  }, 1)
  
}, (a) => a, 1000, {'leading': true, 'trailing': false})


export const init = async () => {
  const { gun, user, pair} = getGun()
  const mySpacePath = await getUserSpacePath(pair.pub, pair.epriv)
  gun._.on("rtc-peer", function (data) {
    const { peer, connected } = data
    if (connected) {
      friendRTCStore.update(v => v.set(peer.id, peer))
    } else {
      friendRTCStore.update(v => {
        v.delete(peer.id)
        return v
      })
    }
  })
  user.get("friends")
    .on((v, _, __, e) => {
      // console.log("friends-init-ev", v)
      if (!v) return
      friendEv = e
      delete v._
      Object.entries<string>(v)
        .filter(([k, _]) => k != mySpacePath)
        .map(([_, v]) => initiateFriendData(v))
    })
}

export const deinit = () => {
  if (friendEv) friendEv.off()
  Object.values(friendsEv).map(v => v.off())
  friendDataCache.set({})
  friendsStore.set({})
  initatedFriends.clear()
}

export const sendFriendRequest = async (pairPub: {pub: string, epub: string}) => {
  const {gun, SEA, pair} = getGun()

  const shared = await SEA.secret(pairPub.epub, pair)
  if (!shared)
    throw new SharedCreationFail()

  const req = {
    pub: pair.pub,
    epub: pair.epub,
  }

  const anonPair = await SEA.pair()
  const anonShared = await SEA.secret(pairPub.epub, anonPair)

  if (!anonShared)
    throw new SharedCreationFail()

  const reqEnc = await SEA.encrypt(req, anonShared)
  const reqSig = await SEA.sign(reqEnc, anonPair)
  const data = {
    pub: anonPair.pub,
    epub: anonPair.epub,
    data: reqSig,
  }

  const data64 = btoa(JSON.stringify(data))
  const hash = await SEA.work(data64, null, null, {name: "SHA-256"})

  if (!hash)
    throw new HashFail()

  const now = dayjs()
  const key = `${pairPub.pub}|${now.format("YYYY-MM-DD")}#${hash}`

  return new Promise<void>((res, rej) => {
    addFriend(pairPub)
      .then(() => {
        let defer = setTimeout(() => rej("timeout"), 30 * 1000)
        gun.get("#fren-req")
          .get(key)
          .put(data64, (ack) => {
            if ("err" in ack && !!ack.err) rej(ack.err)
            else {
              clearTimeout(defer)
              res()
            }
          })  
      })
      .catch((rea) => rej(rea))
  })
  
}


export const parseFriendRequest = async (data64: string) => {
  const {gun, SEA, user, pair} = getGun()

  const data: {pub: string, epub: string, data: string} = JSON.parse(atob(data64)) as any

  const sharedAnon = await SEA.secret(data.epub, pair)
  if (!sharedAnon)
    throw new SharedCreationFail()

  const reqEnc = await SEA.verify(data.data, data.pub)
  if (!reqEnc)
    throw new VerifyFail()

  const req = await SEA.decrypt(reqEnc, sharedAnon)
  if (!req)
    throw new DecriptionFail()

  const shared = await SEA.secret(req.epub, pair)
  if (!shared)
    throw new SharedCreationFail()

  const mySpacePath = await getUserSpacePath(pair.pub, shared)
  const otherProfileEnc = await gun.get("~"+req.pub).get("spaces")
    .get(mySpacePath)
    .get("profile")
    .then()
  if(!otherProfileEnc)
    throw new Error("Failed to get friend request profile")

  const otherProfile = await SEA.decrypt(otherProfileEnc, shared)
  if (!otherProfile)
    throw new DecriptionFail()

  return otherProfile as Profile
}

export const addFriend = async (pairPub: {pub: string, epub: string}) => {
  const {gun, SEA, user, pair} = getGun()
  
  const shared = await SEA.secret(pairPub.epub, pair)
  if (!shared)
    throw new SharedCreationFail()

  const sharedSpace = await auth.setupSharedSpace(pairPub.pub, shared)
  // const mySharedSpace = await auth.getUserSpacePath(pair.pub, shared)
  const friendPath = await getUserSpacePath(pairPub.pub, pair.epriv)
  
  const pairPubEnc = await SEA.encrypt({
    ...pairPub,
    space: sharedSpace
  }, pair)

  return new Promise<void>((res, rej) => {
    let defer = setTimeout(rej, 30 * 1000)
    user.get("friends")
      .get(friendPath)
      .put(pairPubEnc, (ack) => {
        if ("err" in ack && !!ack.err) rej(ack.err)
        else {
          clearTimeout(defer)
          res()
        }
      })
  })
}

