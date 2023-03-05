import { DecriptionFail, EncryptionFail, HashFail, SharedCreationFail, VerifyFail } from "./errors"
import dayjs from "dayjs";
import { getGun } from "./initGun";
import auth from "./auth";
import type { IGunOnEvent } from "gun";
import { friendsStore } from "./stores";

let friendEv: {[k: string]: IGunOnEvent} = {}

export const init = async () => {
  const {gun, SEA, user, pair} = getGun()
  user.get("friends")
    .map()
    .on(async (v, k, _, __) => {
      const friend = await SEA.decrypt(v, pair) as FriendProfile
      if (!friend)
        throw new DecriptionFail()
      friendsStore.update(v => {
        v = v || {}
        const fren = v[friend.pub] || friend
        v[friend.pub] = {
          ...fren, 
          pub: friend.pub, 
          epub: friend.epub, 
          space: friend.space
        }
        return v
      })
      
      const shared = await SEA.secret(friend.epub, pair)
      if (!shared)
        throw new SharedCreationFail()
      const mySpacePath = await auth.getUserSpacePath(pair.pub, shared)
      
      if (friendEv[k])
        friendEv[k].off()

      gun.get("~"+friend.pub).get("spaces")
        .get(mySpacePath)
        .get("profile")
        .on(async (vv, _, __, ee) => {
          friendEv[k] = ee
          const friendProfile = await SEA.decrypt(vv, shared) as FriendProfile
          friendsStore.update(v => {
            v = v || {}
            const fren = v[friend.pub] || friendProfile
            v[friend.pub] = {
              ...fren,
              ...friendProfile, 
              pub: fren.pub, 
              epub: fren.epub, 
              space: fren.space
            }
            return v
          })
        })
    })
}

export const deinit = () => {
  Object.values(friendEv).map(v => v.off())
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
  gun.get("#fren-req")
    .get(key)
    .put(data64)  
  
  await addFriend(pairPub)
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

  const mySpacePath = await auth.getUserSpacePath(pair.pub, shared)
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
  const friendPath = await auth.getUserSpacePath(pairPub.pub, pair.epriv)
  const pairPubEnc = await SEA.encrypt({
    ...pairPub,
    space: sharedSpace
  }, pair)
  user.get("friends")
    .get(friendPath)
    .put(pairPubEnc)
}

