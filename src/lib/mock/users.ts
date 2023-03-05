export const userData: User = {
  profilePicture: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?cs=srgb&dl=pexels-pixabay-220453.jpg",
  name: "Andrew McEuler",
  id: "andrewmc#2718",
  pubKey: ((typeof window !== "undefined") && JSON.parse(localStorage.getItem("currentUser")!).pub) || "TsRMyecmURD8iqH9A_qDRYDOfQp7xQN68m8z3QstG48.zWVVasKlG9E2Kx2wf1UFyEiphnAnyw8EyQXNGaP1uBI",
  lastMessageTs: 1672718281828
}

export const friendData: { [id: string]: User } = {
  "MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s": {
    profilePicture: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=pexels-pixabay-415829.jpg&fm=jpg&w=800&h=600",
    name: "Clara Loft",
    id: "laracroft#4512",
    pubKey: "MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s",
    lastMessageTs: 1672769690
  },
  "MFswDQYJKoZIhvcNAQEBBQADSgAwRwJAezCva7DJuv9KzT5RQSmddpnenPSaAZLO": {
    profilePicture: "https://images.pexels.com/photos/4924538/pexels-photo-4924538.jpeg?cs=srgb&dl=pexels-dapo-abideen-4924538.jpg&fm=jpg&w=800&h=600",
    name: "Robert Johnson",
    id: "skytroop#1224",
    pubKey: "MFswDQYJKoZIhvcNAQEBBQADSgAwRwJAezCva7DJuv9KzT5RQSmddpnenPSaAZLO",
    lastMessageTs: 1672596890
  },
  "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKQByZi35OEaWSn+q4hF7B0tWIJv%2FEOv": {
    profilePicture: "https://images.pexels.com/photos/7507786/pexels-photo-7507786.jpeg?cs=srgb&dl=pexels-cottonbro-studio-7507786.jpg&fm=jpg&w=800&h=600",
    name: "Ming Su",
    id: "flyingdumpling#2241",
    pubKey: "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKQByZi35OEaWSn+q4hF7B0tWIJv%2FEOv",
    lastMessageTs: 1672761690
  }
}

export const friendMessages: { [id: string]: { [ts: string]: Message } } = {
  "MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s": {
    1675184520000: {
      "message": "It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. ",
      "ts": 1675184520000,
      "by": friendData["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"]
    },
    1675184521000: {
      "message": "It was you who would bring balance to the Force",
      "ts": 1675184521000,
      "by": friendData["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"]
    },
    1675184525000: {
      "message": "Not leave it in Darkness",
      "ts": 1675184525000,
      "by": friendData["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"]
    }
  }
}

for (let index = 0; index < 10; index++) {
  for (const [k,v] of Object.entries(friendMessages["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"]).slice(-3)) {
    let kk = parseInt(k)
    friendMessages["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"][`${kk+15000}`] = JSON.parse(JSON.stringify(v))
    friendMessages["MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s"][`${kk+15000}`].ts += 15000
  }
}
