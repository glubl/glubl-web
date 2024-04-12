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

  interface IGunChain<TNode, TChainParent, TGunInstance, TKey> {
    back(path: "opt"): GunOptions 
  }

  interface IGunInstance<any> {
    back(path: "opt"): GunOptions 
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

  var webkitRTCPeerConnection: typeof RTCPeerConnection
  var mozRTCPeerConnection: typeof RTCPeerConnection
  var webkitRTCSessionDescription: typeof RTCSessionDescription
  var mozRTCSessionDescription: typeof RTCSessionDescription
  var webkitRTCIceCandidate: typeof RTCIceCandidate
  var mozRTCIceCandidate: typeof RTCIceCandidate

  declare type CallChannel = {
    endTs: number
    startTs: number
    key: string
  }
  
  declare type MenuScreen = {
    name: string
    icon: IconSource
    menuComponent?: ComponentType
    contentComponent?: ComponentType
    type: "top" | "bottom"
  }
  
  
  declare type Profile = {
    pub: string
    epub: string
    picture: string
    username: string
  }
  
  declare type FriendProfile = Profile & {
    space: string
  }
  
  declare type FriendRequest = {
    pub: string
    epub: string
    profile: Profile
  }
  
  declare type ChatMessage = {
    msg: string
    ts: number
    by: FriendProfile
    to: FriendProfile
  }
  
  declare type ChatMessageGun = {
    msg: string
    ts: number
    by: string
    to: string
  }
  
  declare interface Window {
    SEA: ISEA;
    gun: IGunInstance<any>
  }
  
  
  interface String {
    toTitleCase(): string;
  }

  export interface RTCPeerConnection {
    channels: {[name: string]: RTCDataChannel}
  }
}



