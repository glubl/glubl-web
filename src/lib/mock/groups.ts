function stringToUint8Array(str: string) {
    const ret = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        ret[i] = str.charCodeAt(i);
    }
    return ret;
}

let date = new Date()
let time = date.toISOString()

type GroupNotification = {
        groupId: string,
        groupName: string,
        createdAt: string,
        keyEnc: string,
        sender: string,
        action: "add" | "update",
}

export const dummyGroupUpdate: GroupNotification[] = [
    {
        groupId: "groupid91",
        groupName: "Savanna",
        createdAt: time,
        keyEnc: "encryptedKey",
        sender: "treefrog",
        action: "update",
    },
    {
        groupId: "groupid92",
        groupName: "Rain Forest",
        createdAt: time,
        keyEnc: "encryptedKey",
        sender: "treefrog",
        action: "add",
    },
    {
        groupId: "groupid92",
        groupName: "Rain Forest",
        createdAt: time,
        keyEnc: "encryptedKey",
        sender: "treefrog",
        action: "update",
    },
]


const dummyGroups: { [groupId: string]: any } = {
    "groupid91": {
        groupId: stringToUint8Array("groupid91"),
        state: {
            members: {
                "pub-1": {
                    username: "treefrog",
                    pub: "pub-1",
                    epub: "epub-1",
                    picture: "",
                } as Profile | FriendProfile,
                "pub-2": {
                    username: "polarbear",
                    pub: "pub-2",
                    epub: "epub-2",
                    picture: "",
                } as Profile | FriendProfile,
            },
        }, 
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
