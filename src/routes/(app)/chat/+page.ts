import { userData, userMessages } from '$lib/mock/users';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';
import { activeCallId } from './stores';


type FriendsChat = {
  [ts: number]: Message
}

const laracroft: User = {
  profilePicture: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=pexels-pixabay-415829.jpg&fm=jpg&w=800&h=600",
  name: "Clara Loft",
  id: "laracroft#4512",
  pubKey: "MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s",
  lastMessageTs: 1672769690
}

function getFriendData(friendId: string): User | undefined {
  return userData[friendId]
}

function getFriendChat(friendId: string): FriendsChat {
  return userMessages[friendId] || {}
}

function toggleActiveCall(friendId?: string) {
  get(activeCallId) ? activeCallId.set(null) : friendId && activeCallId.set(friendId)
}

export const load = (async ({ params, url, parent }) => {
  let { friends, selected, activeCall, me } = await parent()
  return {
    chats: getFriendChat(selected),
    selectedFriend: getFriendData(selected),
    activeCallFriend: activeCall && getFriendData(activeCall),
    me: me,
    toggleCall: toggleActiveCall,
  };
}) satisfies PageLoad;
