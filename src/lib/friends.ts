import type { ISEAPair } from "gun"
import SEA from "gun/sea"
import { HashFail, NotAuthenticated, SharedCreationFail } from "./errors"
import { gun } from "./initGun"
import * as dayjs from "dayjs";

export const sendFriendRequest = async (otherEpub: string) => {
  const user = gun.user()
  const pair = (user._ as any).sea as ISEAPair

  if (!pair) 
    throw new NotAuthenticated()

  const profile = await user.get("profile").then()
  const shared = await SEA.secret(otherEpub, pair)

  if (!shared)
    throw new SharedCreationFail()

  const req = {
    name: profile.username,
    pub: pair.pub,
    epub: pair.epub,
    proof: await SEA.sign(await SEA.encrypt("alice", shared), pair),
    // Optional message
    // message: await SEA.sign(await SEA.encrypt("Hello Bob! Please accept my friend request, thank you!", shared), alice),
  }

  const anonPair = await SEA.pair()
  const anonShared = await SEA.secret(otherEpub, anonPair)

  if (!anonShared)
    throw new SharedCreationFail()

  const encr = await SEA.encrypt(req, anonShared)
  const data = {
    d: encr,
    ep: pair.epub
  }

  const hash = await SEA.work(data, null, null, {name: "SHA-256"})

  if (!hash)
    throw new HashFail()

  const now = new dayjs.Dayjs()
  gun.get(`fren-req@${pair.epub}/${now.format("YYYY-MM-DD")}#`)
    .get(hash)
    .put(data)
}