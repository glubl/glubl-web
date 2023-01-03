import type { PageLoad } from './$types';
 
export const load = (({ params }) => {
  return {
    friends: {
      "laracroft#4512": {
        profilePicture: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?cs=srgb&dl=pexels-pixabay-415829.jpg&fm=jpg&w=800&h=600",
        name: "Clara Loft",
        id: "laracroft#4512",
        lastMessageTs: 1672769690
      },
      "skytroop#1224": {
        profilePicture: "https://images.pexels.com/photos/4924538/pexels-photo-4924538.jpeg?cs=srgb&dl=pexels-dapo-abideen-4924538.jpg&fm=jpg&w=800&h=600",
        name: "Robert Johnson",
        id: "skytroop#1224",
        lastMessageTs: 1672596890
      },
      "flyingdumpling#2241": {
        profilePicture: "https://images.pexels.com/photos/7507786/pexels-photo-7507786.jpeg?cs=srgb&dl=pexels-cottonbro-studio-7507786.jpg&fm=jpg&w=800&h=600",
        name: "Ming Su",
        id: "flyingdumpling#2241",
        lastMessageTs: 1672761690
      }
    },
    chats: {
      "laracroft#4512": {
        1672761690: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761691: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761692: {
          "message": "Not leave it in Darkness"
        },
        1672761694: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761695: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761696: {
          "message": "Not leave it in Darkness"
        },
        1672761697: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761698: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761699: {
          "message": "Not leave it in Darkness"
        },
        1672761700: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761701: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761702: {
          "message": "Not leave it in Darkness"
        },
        1672761703: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761704: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761705: {
          "message": "Not leave it in Darkness"
        },
        1672761706: {
          "message": "It was said that you would, destroy the Sith, not join them."
        },
        1672761707: {
          "message": "It was you who would bring balance to the Force"
        },
        1672761708: {
          "message": "Not leave it in Darkness"
        },
      }
    }
  };
}) satisfies PageLoad;  