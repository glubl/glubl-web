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
}


import {  } from "gun"
declare module "gun" {
  export interface IGunInstanceHookHandler {
    sea?: ISEAPair;
    $: { _: _GunRoot };
  
    on(event: 'friend', data: {pub: string, epub: string, path: string, mypath: string}): void;
    on(event: 'friend', callback: (friend: {pub: string, epub: string, path: string, mypath: string}) => void)
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