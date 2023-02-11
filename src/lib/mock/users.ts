export const userData: { [id: string]: User } = {
  "laracroft#4512": {
    profilePicture: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=pexels-pixabay-415829.jpg&fm=jpg&w=800&h=600",
    name: "Clara Loft",
    id: "laracroft#4512",
    pubKey: "MIICITANBgkqhkiG9w0BAQEFAAOCAg4AMIICCQKCAgBz8ULGcPFniM%2F1HwKVOv8s",
    lastMessageTs: 1672769690
  },
  "skytroop#1224": {
    profilePicture: "https://images.pexels.com/photos/4924538/pexels-photo-4924538.jpeg?cs=srgb&dl=pexels-dapo-abideen-4924538.jpg&fm=jpg&w=800&h=600",
    name: "Robert Johnson",
    id: "skytroop#1224",
    pubKey: "MFswDQYJKoZIhvcNAQEBBQADSgAwRwJAezCva7DJuv9KzT5RQSmddpnenPSaAZLO",
    lastMessageTs: 1672596890
  },
  "flyingdumpling#2241": {
    profilePicture: "https://images.pexels.com/photos/7507786/pexels-photo-7507786.jpeg?cs=srgb&dl=pexels-cottonbro-studio-7507786.jpg&fm=jpg&w=800&h=600",
    name: "Ming Su",
    id: "flyingdumpling#2241",
    pubKey: "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKQByZi35OEaWSn+q4hF7B0tWIJv%2FEOv",
    lastMessageTs: 1672761690
  }
}

export const userMessages: { [id: string]: { [ts: string]: Message } } = {
  "laracroft#4512": {
    1675184520000: {
      "message": "It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. It was said that you would, destroy the Sith, not join them. ",
      "ts": 1675184520000,
      "by": userData["laracroft#4512"]
    },
    1675184521000: {
      "message": "It was you who would bring balance to the Force",
      "ts": 1675184521000,
      "by": userData["laracroft#4512"]
    },
    1675184525000: {
      "message": "Not leave it in Darkness",
      "ts": 1675184525000,
      "by": userData["laracroft#4512"]
    }
  }
}

for (let index = 0; index < 10; index++) {
  for (const [k,v] of Object.entries(userMessages["laracroft#4512"]).slice(-3)) {
    let kk = parseInt(k)
    userMessages["laracroft#4512"][`${kk+15000}`] = JSON.parse(JSON.stringify(v))
    userMessages["laracroft#4512"][`${kk+15000}`].ts += 15000
  }
}
