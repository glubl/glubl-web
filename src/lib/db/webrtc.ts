import Gun, { type GunHookCallbackPut, type GunMesh, type GunMessagePut, type GunPeer as GP, type IGunHookContext, type IGunInstance, type _GunRoot } from "gun"
import SEA from "gun/sea"


type GunPeer = GP & RTCPeerConnection
type RTCMsg = {
  id: string
  answer?: {
    sdp: string
    type: RTCSdpType
  }
  candidate?: {
    address: string | null
    candidate: string
    component: RTCIceComponent | null
    foundation: string | null
    port: number | null
    priority: number | null
    protocol: RTCIceProtocol | null
    relatedAddress: string | null
    relatedPort: number | null
    sdpMLineIndex: number | null
    sdpMid: string | null
    tcpType: RTCIceTcpCandidateType | null
    type: RTCIceCandidateType | null
    usernameFragment: string | null
  }
  offer?: {
    sdp?: string
    type: RTCSdpType
  }
}

Gun.on("opt", init)

function init(this: IGunHookContext<_GunRoot>, root: _GunRoot) {
  this.to.next(root)
  let opt = root.opt as GunOptions
  
  if (root.once || !Gun.Mesh || (false === (opt.RTCPeerConnection as any))) {
    return
  }

  initOpt(opt)
  
  
  let gun = root.$ as IGunInstance<any>
  root.on("friend", function(this: IGunHookContext<GunHookFriend>, friend: GunHookFriend) {
    initFriend.apply(this, [friend, opt, gun])
  })
}

async function initFriend(this: IGunHookContext<GunHookFriend>, friend: GunHookFriend, opt: GunOptions, gun: IGunInstance<any>) {
  // console.log("friend ", friend)
  this.to.next(friend)
  let mesh = (opt.mesh = opt.mesh || Gun.Mesh(gun._))
  let user = gun._.user!
  let root = gun._

  if (!friend.pub || !friend.epub || !friend.path || !friend.mypath || !user || !user._.sea) return
  const pair = user._.sea!
  const secret = (await SEA.secret(friend.epub, user._.sea))!
  
  if (!secret) {
    console.error("Can't initiate shared secret with ", friend.pub)
    return
  }

  let pending: {[pid: string]: GunPeer} = {}

  function createPeer(pid: string, soul: string): GunPeer {
    // console.log("create-peer ", pid, soul)

    let peer = new (opt.RTCPeerConnection as any)(opt.rtc) as GunPeer
    peer.id = pid
    var wire = peer.wire = peer.createDataChannel('gun', opt.rtc!.dataChannel)
    pending[pid] = peer;

    wire.onclose = wire.onclose || function() { 
      // console.log("closed: ", friend.pub)
      defer = setTimeout(reconnect, 1)
      mesh.bye(peer)
      delete opt.peers[friend.pub]
    }

    wire.onerror = wire.onerror || function(err) {
      console.error("rtc-err: ", err)
      defer = setTimeout(reconnect, 1)
      mesh.bye(peer)
      delete opt.peers[friend.pub]
    }

    wire.onopen = wire.onopen || function(e) {
      // console.log("wire-open: ", friend.pub)
      clearReconnect()
      wait = 2 * 999
      mesh.hi(peer)
      delete pending[pid]
    }

    wire.onmessage = wire.onmessage || function(msg){
      clearReconnect()
      if(!msg) return
      // console.log("rtc-message");
      (mesh as any).hear(msg.data || msg, peer)
    }

    peer.onicecandidate = peer.onicecandidate || function(e){ // source: EasyRTC!
      if(!e.candidate) return
      // console.log("ice", e)
      const candidate = JSON.parse(JSON.stringify(e.candidate))
      send({
        id: pair.pub,
        candidate: candidate, 
      }, soul) 
    }

    peer.ondatachannel = peer.ondatachannel || function(e){
      // console.log("data-chan", e)
      let chan = e.channel
      if (chan.label == "gun") {
        chan.onmessage = wire.onmessage
        chan.onopen = wire.onopen
        chan.onclose = wire.onclose
      } else {
        chan.addEventListener("open", () => {
          ((peer as any).channels ??= {})[chan.label] = chan;
          (root as any).on("friend-rtc", {path: friend.path, chan: chan})
        })
        chan.addEventListener("close", () => {
          delete ((peer as any).channels ??= {})[chan.label]
        })
      }
    }
    return peer
  }

  function process(msg: RTCMsg, soul: string): GunPeer | undefined {
    if(!msg || !msg.id || msg.id === pair.pub)
      return

    let peer = (opt.peers[msg.id] || pending[msg.id] || createPeer(msg.id, soul)) as GunPeer

    switch (true) {
      case (msg.candidate !== undefined):
        // console.log("open-recv-candidate ", msg)
        if (!peer.remoteDescription) {
          // console.log("RET recv-candidate_no-remote-desc");
          (peer as any).pendingICECandidate = msg.candidate
          return
        }
        peer
          .addIceCandidate(new opt.RTCIceCandidate!(msg.candidate))
          .catch((e) => {
            console.error("open-recv-candidate: ", e)
          })
        break
      case (msg.answer !== undefined):
        // console.log("open-recv-answer ", msg)
        msg.answer!.sdp = msg.answer!.sdp.replace(/\\r\\n/g, '\r\n')
        peer!.setRemoteDescription(new opt.RTCSessionDescription!(msg.answer!))
          .then(() => {
            let ice
            if (ice = (peer as any).pendingICECandidate) {
              peer.addIceCandidate(new opt.RTCIceCandidate!(ice))
              delete (peer as any).pendingICECandidate
            }
          })
          .catch((e) => {
            console.error("open-recv-answer: ", e)
          })
        break
      case (msg.offer !== undefined):
        if (!msg.offer!.sdp)  {
          // console.log("RET open-recv-offer_no-sdp")
          break
        }
        // console.log("open-recv-offer ", msg)
        msg.offer!.sdp = msg.offer!.sdp.replace(/\\r\\n/g, '\r\n')
        peer!.setRemoteDescription(new opt.RTCSessionDescription!(msg.offer!)) 
          .then(() => peer.createAnswer(opt.rtc!.offer))
          .then((answer) => peer.setLocalDescription(answer))
          .then(() => {
            // console.log("send-answer", peer.localDescription)
            send({
              id: pair.pub,
              answer: JSON.parse(JSON.stringify(peer.localDescription)), 
            }, soul)
          })
          .catch((e) => {
            console.error("open-recv-offer: ", e)
          })
        break
      default:
        // console.log("open-send-offer")
        peer!.createOffer(opt.rtc!.offer)
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            send({
              id: pair.pub,
              offer: JSON.parse(JSON.stringify(peer.localDescription))
            }, soul)
          })
          .catch((e) => {
            console.error("RTC offer: ", e)
          })
        break
    }

    return peer
  }

  let start = +new Date
  async function send(msg: any, soul: string) {
    // console.log("send", {d: msg})
    let enc = await SEA.encrypt(msg, secret)
    let sig = await SEA.sign(enc, pair);
    (root as any).on('out', {"@": soul, "#": (root as any).ask(recieve), "ok": sig})
  }
  
  async function recieve(msg: any) {
    if("err" in msg || !msg.ok || typeof msg.ok !== 'string' || !(msg.ok as string).startsWith("SEA")) {
      return 
    }
    // console.log("recieve", msg)

    var enc = await SEA.verify(msg.ok, friend)
    if (!enc) {
      console.warn("sig fail", msg, friend)
      return
    }
    var dat = await SEA.decrypt(enc, secret)
    if (!dat) {
      console.warn("dec fil", dat, friend)
      return
    }
    resetReconnect()
    wait = maxWait
    process(dat, msg["#"])
  }

  async function announce() {
    start = +new Date
    // console.log("announce")
    gun.get(`~${pair.pub}/spaces/${friend.path}/RTC`)
      .put({'+': "+"}, function(ack: GunMessagePut) {
        recieve(ack)
      },  {acks: opt.rtc!.max} as any)
  }

  gun.get(`~${friend.pub}/spaces/${friend.mypath}/RTC`)
    .on(function(_, __, msg, e) {
      if(start > msg.put['>']) {
        // console.log("RET on-msg")
        return
      }
      // console.log("on-msg: ", {d: msg})
      process({id: friend.pub}, ''+(msg as any)['#'])
    })

  let minWait = 2 * 999
  let maxWait = 30 * 999
  let startWait = 5 * 999
  let waitInc = 2
  let wait = minWait
  let retry = 8
  let defer: ReturnType<typeof setTimeout>
  let doc = ('undefined' !== typeof document) && document
  let lastTried = 0
  let leave = false
  function reconnect(){
    if(leave || (doc && retry <= 0)){ return }
    // console.log("reconnect ", retry)
    clearTimeout(defer)
    defer = setTimeout(reconnect, wait)
    retry = retry - ((-lastTried + (lastTried = +new Date) < wait * 4) ? 1 : 0)
    wait = Math.min(wait * waitInc, maxWait)
    announce()
  }
  function resetReconnect() {
    clearReconnect()
    defer = setTimeout(reconnect, wait)
  }
  function clearReconnect() {
    clearTimeout(defer)
    retry = 60
  }

  gun._.on("leave", () => {
    clearTimeout(defer)
    leave = true
  })
  
  defer = setTimeout(reconnect, wait)
}

function initOpt(opt: GunOptions) {
  let env: typeof window | typeof globalThis = {} as any
  if (typeof window !== "undefined") {
    env = window
  }
  if (typeof global !== "undefined") {
    env = global
  }

  var rtcpc =
    opt.RTCPeerConnection ||
    env.RTCPeerConnection ||
    env.webkitRTCPeerConnection ||
    env.mozRTCPeerConnection
  var rtcsd =
    opt.RTCSessionDescription ||
    env.RTCSessionDescription ||
    env.webkitRTCSessionDescription ||
    env.mozRTCSessionDescription
  var rtcic =
    opt.RTCIceCandidate ||
    env.RTCIceCandidate ||
    env.webkitRTCIceCandidate ||
    env.mozRTCIceCandidate
  if (!rtcpc || !rtcsd || !rtcic) {
    return
  }
  opt.RTCPeerConnection = rtcpc
  opt.RTCSessionDescription = rtcsd
  opt.RTCIceCandidate = rtcic
  opt.rtc = opt.rtc || {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.sipgate.net:3478" }
    ],
  }

  opt.rtc.dataChannel = opt.rtc.dataChannel || {
    ordered: false,
    maxRetransmits: 2,
  }
  opt.rtc.offer = opt.rtc.offer || {
    offerToReceiveAudio: false, 
    offerToReceiveVideo: false 
  }
  opt.rtc.max = opt.rtc.max || 55
  opt.rtc.room =
    opt.rtc.room ||
    (Gun.window && (location.hash.slice(1) || location.pathname.slice(1)))
  return opt
}