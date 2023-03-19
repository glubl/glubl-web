declare type User = {
  profilePicture: string
  name: string
  id: string
  pubKey: string
  lastMessageTs: number
}

declare type Message = {
  message: string
  ts: number
  by: User
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

declare interface _GunRoot extends IGunInstanceHookHandler {
  sea?: ISEAPair
  $: { _: _GunRoot };

  /**
   * Current GUN options
   */
  opt: GunOptions;
}

declare interface Window {
  SEA: ISEA;
  gun: IGunInstance<any>
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

interface String {
  toTitleCase(): string;
}
