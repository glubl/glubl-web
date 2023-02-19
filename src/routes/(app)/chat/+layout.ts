import { userData } from '$lib/mock/users';
import type { LayoutLoad } from './$types';
import "@src/lib/initGun"
import { selectedId } from './stores';
import { get } from 'svelte/store';

type FriendsMap = {
  [id: string]: User
}

function getFriends(): FriendsMap {
  return userData
}

function getLastOpenedFriend() {
  return "laracroft#4512"
}

function getSelectedFriend() {
  return get(selectedId) || getLastOpenedFriend()
}

const me: User = {
  profilePicture: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?cs=srgb&dl=pexels-pixabay-220453.jpg",
  name: "Andrew McEuler",
  id: "andrewmc#2718",
  pubKey: ((typeof window !== "undefined") && JSON.parse(localStorage.getItem("currentUser")!).pub) || "TsRMyecmURD8iqH9A_qDRYDOfQp7xQN68m8z3QstG48.zWVVasKlG9E2Kx2wf1UFyEiphnAnyw8EyQXNGaP1uBI",
  lastMessageTs: 1672718281828
}

export const load = (({ url }) => {
  let selected = getSelectedFriend()
  return {
    friends: getFriends(),
    selected: selected,
    me: me,
  };
}) satisfies LayoutLoad;  