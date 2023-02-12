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