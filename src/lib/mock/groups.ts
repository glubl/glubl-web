import type { Group, GroupState } from "@src/lib/mls/group";

function stringToUint8Array(str: string) {
    const ret = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        ret[i] = str.charCodeAt(i);
    }
    return ret;
}

const dummyGroups: { [groupId: string]: Partial<Group> } = {
    "groupid91": {
        groupId: stringToUint8Array("groupid91"),
        states: <Map<string, GroupState>>{},
        extremities: <Map<string, [number, Uint8Array]>>{},
    },
    "groupid92": {
        groupId: stringToUint8Array("groupid92"),
        states: <Map<string, GroupState>>{},
        extremities: <Map<string, [number, Uint8Array]>>{},
    },
    "groupid93": {
        groupId: stringToUint8Array("groupid93"),
        states: <Map<string, GroupState>>{},
        extremities: <Map<string, [number, Uint8Array]>>{},
    },
    "groupid94": {
        groupId: stringToUint8Array("groupid94"),
        states: <Map<string, GroupState>>{},
        extremities: <Map<string, [number, Uint8Array]>>{},
    },
}
export default dummyGroups
