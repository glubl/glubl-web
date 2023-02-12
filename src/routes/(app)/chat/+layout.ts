import { goto } from '$app/navigation';
import { userData } from '$lib/mock/users';
import * as cons from 'gun';
import type { LayoutLoad } from './$types';

type FriendsMap = {
  [id: string]: User
}

function getFriends(): FriendsMap {
  return userData
}

function getLastOpenedFriend() {
  return "laracroft#4512"
}

export const load = (({ url }) => {
  let lastOpenedFriend = getLastOpenedFriend()
  if (url.pathname == "/chat") {
    goto(`/chat/${lastOpenedFriend.replace(/#/g, '%23')}`)
  }
  let selectedFriend = (url.pathname.split("/")[2] || lastOpenedFriend).replace(/%23/g, '#')
  return {
    friends: getFriends(),
    selected: selectedFriend
  };
}) satisfies LayoutLoad;  