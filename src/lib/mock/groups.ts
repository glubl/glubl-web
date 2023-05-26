function stringToUint8Array(str: string) {
    const ret = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        ret[i] = str.charCodeAt(i);
    }
    return ret;
}

const dummyGroups: { [groupId: string]: any } = {
    "groupid91": {
        groupId: stringToUint8Array("groupid91"),
    },
    "groupid92": {
        groupId: stringToUint8Array("groupid92"),
    },
    "groupid93": {
        groupId: stringToUint8Array("groupid93"),
    },
    "groupid94": {
        groupId: stringToUint8Array("groupid94"),
    },
}
export default dummyGroups
