import type { IconSource } from "@steeze-ui/heroicons/types";
import { GunPeer, IGunInstance, ISEA, ISEAPair, _GunRoot, type IGunUserInstance } from "gun"
import * as gun from "gun"
import { ComponentType } from "svelte";

declare global {
  type User = {
    profilePicture: string
    name: string
    id: string
    pubKey: string
    lastMessageTs: number
  }
  
  type Message = {
    message: string
    ts: number
    by: User
  }
  
  type MenuScreen = {
    name: string
    icon: IconSource
    menuComponent?: ComponentType
    contentComponent?: ComponentType
    type: "top" | "bottom"
  }
  
  type Profile = {
    pub: string
    epub: string
    picture: string
    username: string
  }
  
  type FriendProfile = Profile & {
    space: string
  }
  
  type FriendRequest = {
    pub: string
    epub: string
    profile: Profile
  }
  
  type ChatMessage = {
    msg: string
    ts: number
    by: FriendProfile
    to: FriendProfile
  }
  
  type ChatMessageGun = {
    msg: string
    ts: number
    by: string
    to: string
  }

  interface String {
    toTitleCase(): string;
  }

  interface Window {
    SEA: ISEA;
    gun: IGunInstance<any>
  }
  
  export type GunOptions = gun.GunOptions & {
    ntp?: {
      interval?: number
      timeout?: number
      smooth?: number
      on?: boolean
    } | boolean
    peers: {[pid: string]: GunPeer }
    mesh: {
      say: gun.MeshSayFn
      hear: { [k: string]: gun.MeshSayFn }
    }
    RTCPeerConnection?: typeof RTCPeerConnection
    RTCSessionDescription?: typeof RTCSessionDescription
    RTCIceCandidate?: typeof RTCIceCandidate
    rtc?: RTCConfiguration | {
      dataChannel?: RTCDataChannelInit
      announce?: {
        interval?: number
        retry?: number
      }
    }
  }

  var webkitRTCPeerConnection: typeof RTCPeerConnection
  var mozRTCPeerConnection: typeof RTCPeerConnection
  var webkitRTCSessionDescription: typeof RTCSessionDescription
  var mozRTCSessionDescription: typeof RTCSessionDescription
  var webkitRTCIceCandidate: typeof RTCIceCandidate
  var mozRTCIceCandidate: typeof RTCIceCandidate

  export interface GunHookFriend {
    pub: string, 
    epub: string, 
    path: string, 
    mypath: string
  }
}

declare module "gun" {
  type MeshSayFn = (
    msg: {
      dam: string, 
      [k: string]: any
    }, 
    peers: { [pid: string]: GunPeer }
  ) => void
  export interface _GunRoot {
    opt: GunOptions
    user?: IGunUserInstance
  }
  export interface IGunInstanceHookHandler {
    sea?: ISEAPair;
    $: { _: _GunRoot };
  
    on(event: 'friend', data: GunHookFriend): void;
    on(event: 'friend', callback: (friend: GunHookFriend) => void)
  }
  
}


declare type UserDatabase = {
  settings: {

  },
  friends: {
    [pub: string]: {
      pub: string
      epub: string
    }
  },
  profile: Profile & {
    pub: string
    epub: string
    picture: string
    username: string
  }
}