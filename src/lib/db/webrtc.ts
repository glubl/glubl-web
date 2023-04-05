import Gun, { type GunHookCallbackPut, type GunMesh, type GunPeer as GP, type IGunHookContext, type IGunInstance, type _GunRoot } from "gun";
import SEA from "gun/sea"

let gun: IGunInstance<any>
let mesh: GunMesh
let env: typeof window | typeof globalThis
let opt: GunOptions

type GunPeer = GP & RTCPeerConnection

Gun.on("opt", init)

function init(this: IGunHookContext<_GunRoot>, root: _GunRoot) {
  this.to.next(root);
  opt = root.opt as GunOptions;
  if (root.once || !Gun.Mesh || false === (opt.RTCPeerConnection as any)) {
    return;
  }

  initOpt()
  
  mesh = (opt.mesh = opt.mesh || Gun.Mesh(root));
  gun = root.$ as any
  root.on("friend", initFriend)
}

async function initFriend(this: IGunHookContext<GunHookFriend>,  friend: GunHookFriend) {
  console.log("start-friend", friend)
  this.to.next(friend);
  var user = gun._.user!

  if (!friend.pub || !friend.epub || !friend.path || !friend.mypath || !user || !user._.sea) return
  const pair = user._.sea!
  const secret = (await SEA.secret(friend.epub, user._.sea))!
  
  if (!secret) {
    console.error("Can't initiate shared secret with ", friend.pub)
    return
  }

  type RTCMsg = {
    id: string
    answer?: {
      sdp: string;
      type: RTCSdpType;
    }
    candidate?: {
      address: string | null;
      candidate: string;
      component: RTCIceComponent | null;
      foundation: string | null;
      port: number | null;
      priority: number | null;
      protocol: RTCIceProtocol | null;
      relatedAddress: string | null;
      relatedPort: number | null;
      sdpMLineIndex: number | null;
      sdpMid: string | null;
      tcpType: RTCIceTcpCandidateType | null;
      type: RTCIceCandidateType | null;
      usernameFragment: string | null;
    }
    offer?: {
      sdp?: string;
      type: RTCSdpType;
    }
  }

  let pending: {[pid: string]: GunPeer} = {}

  function open(msg: RTCMsg): GunPeer | undefined {
    console.log("start-open", msg)
    if(!msg || !msg.id || msg.id === pair.pub)
      return
    //console.log("webrtc:", JSON.stringify(msg));
    let tmp
    if(msg.answer){
      let peer = (opt.peers[msg.id] || pending[msg.id]) as GunPeer
      if(!peer || (peer as any).remoteSet)
        return
      msg.answer.sdp = msg.answer.sdp.replace(/\\r\\n/g, '\r\n')
      peer.setRemoteDescription((peer as any).remoteSet = new opt.RTCSessionDescription!(msg.answer))
      return peer; 
    }
    if(msg.candidate){
      let peer = (opt.peers[msg.id] || pending[msg.id] || open({id: msg.id})) as GunPeer;
      peer.addIceCandidate(new opt.RTCIceCandidate!(msg.candidate))
      return peer;
    }
    //if(opt.peers[rtc.id]){ return }
    if(pending[msg.id]){ return }
    let peer = (opt.peers[msg.id] || new (opt.RTCPeerConnection as any)(opt.rtc)) as GunPeer
    peer.id = msg.id;
    var wire = peer.wire = peer.createDataChannel('dc', opt.rtc!.dataChannel);
    pending[msg.id] = peer;
    (wire as any).to = setTimeout(function(){delete pending[msg.id]},1000*60);
    wire.onclose = function(){ 
      console.log("closed: ", friend.pub)
      setTimeout(reconnect, 1)
      mesh.bye(peer)
    };
    wire.onerror = function(err){
      console.error("RTC err ", err)
      setTimeout(reconnect, 1)
    };
    wire.onopen = function(e){
      console.log("open: ", friend.pub)
      delete pending[msg.id];
      mesh.hi(peer);
      resetReconnect()
    }
    wire.onmessage = function(msg){
      if(!msg) return
      console.log("message");
      //console.log('via rtc');
      (mesh as any).hear(msg, peer);
    };
    peer.onicecandidate = function(e){ // source: EasyRTC!
      console.log("ice", e)
      if(!e.candidate){ return }
      const candidate = JSON.parse(JSON.stringify(e.candidate))
      send({candidate: candidate, id: pair.pub})
    }
    peer.ondatachannel = function(e){
      console.log("data-chan", e)
      var rc = e.channel;
      rc.onmessage = wire.onmessage;
      rc.onopen = wire.onopen;
      rc.onclose = wire.onclose;
    }
    if(msg.offer){
      if (!msg.offer.sdp) return
      msg.offer.sdp = msg.offer.sdp.replace(/\\r\\n/g, '\r\n')
      peer.setRemoteDescription(new opt.RTCSessionDescription!(msg.offer)) 
        .then(() => peer.createAnswer(opt.rtc!.rtcOpt))
        .then((answer) => peer.setLocalDescription(answer))
        .then(() => {
          console.log("answer", peer.localDescription)
          send({answer: JSON.parse(JSON.stringify(peer.localDescription)), id: pair.pub})
        })
        .catch((e) => {
          console.error("RTC answer: ", e)
        })
    } else {
      peer.createOffer(opt.rtc!.rtcOpt)
        .then((offer) => peer.setLocalDescription(offer))
        .then(() => {
          console.log("create-offer", peer.localDescription)
          send({offer: JSON.parse(JSON.stringify(peer.localDescription)), id: pair.pub})
        })
        .catch((e) => {
          console.error("RTC offer: ", e)
        })
    }
    console.log("end-open", peer)
    return peer;
  }

  let start = +new Date;
  async function send(msg: any) {
    console.log("start-send", msg)
    let enc = await SEA.encrypt(msg, secret)
    let sig = await SEA.sign(enc, pair)
    gun.get(`~${pair.pub}/spaces/${friend.path}/RTC`)
      .put({'d': sig})
    console.log("end-send", sig)
  }
  
  async function recieve(msg: any) {
    console.log("start-recieve", msg)
    var enc = await SEA.verify(msg, friend)
    if (!enc) {
      console.warn("sig fail", msg, friend)
      return
    }
    var dat = await SEA.decrypt(enc, secret)
    if (!dat) {
      console.warn("dec fil", dat, friend)
      return
    }
    open(dat)
    console.log("end-recieve", dat)
  }

  gun.get(`~${friend.pub}/spaces/${friend.mypath}/RTC`)
    .on(function(v, k, dat, e) {
      console.log("rtc-on-msg: ", v, k)
      if(start > dat.put['>'] || !v.d) 
        return
      recieve(v.d)
    })

  let wait = 2 * 999
  let waitInc = 2
  let waitLimit = 60 * 999
  let retry = 20
  let defer: ReturnType<typeof setTimeout>
  let doc = ('undefined' !== typeof document) && document;
  let lastTried = 0
  function reconnect(){
    if(doc && retry <= 0){ return }
    console.log("reconnect ", retry)
    clearTimeout(defer)
    defer = setTimeout(() => {
      reconnect()
    }, wait)
    retry = retry - ((-lastTried + (lastTried = +new Date) < wait * 4) ? 1 : 0);
    wait = Math.min(wait * waitInc, waitLimit)
    send({id: pair.pub})
  }
  function resetReconnect() {
    clearTimeout(defer)
    retry = 60
  }
  
  setTimeout(reconnect, wait)
}



function initOpt() {
  var env;
  if (typeof window !== "undefined") {
    env = window;
  }
  if (typeof global !== "undefined") {
    env = global;
  }
  env = env || {};

  var rtcpc =
    opt.RTCPeerConnection ||
    env.RTCPeerConnection ||
    env.webkitRTCPeerConnection ||
    env.mozRTCPeerConnection;
  var rtcsd =
    opt.RTCSessionDescription ||
    env.RTCSessionDescription ||
    env.webkitRTCSessionDescription ||
    env.mozRTCSessionDescription;
  var rtcic =
    opt.RTCIceCandidate ||
    env.RTCIceCandidate ||
    env.webkitRTCIceCandidate ||
    env.mozRTCIceCandidate;
  if (!rtcpc || !rtcsd || !rtcic) {
    return;
  }
  opt.RTCPeerConnection = rtcpc;
  opt.RTCSessionDescription = rtcsd;
  opt.RTCIceCandidate = rtcic;
  opt.rtc = opt.rtc || {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.sipgate.net:3478" }
      /*,
    { urls: "stun:relay.metered.ca:80" }
    {urls: "stun:stun.stunprotocol.org"},
    {urls: "stun:stun.sipgate.net:10000"},
    {urls: "stun:217.10.68.152:10000"},
    {urls: 'stun:stun.services.mozilla.com'}*/,
    ],
  };
  // TODO: Select the most appropriate stuns.
  // FIXME: Find the wire throwing ICE Failed
  // The above change corrects at least firefox RTC Peer handler where it **throws** on over 6 ice servers, and updates url: to urls: removing deprecation warning
  opt.rtc.dataChannel = opt.rtc.dataChannel || {
    ordered: false,
    maxRetransmits: 2,
  };
  opt.rtc.rtcOpt = opt.rtc.rtcOpt || {
    offerToReceiveAudio: false, 
    offerToReceiveVideo: false 
  };
  opt.rtc.max = opt.rtc.max || 55; // is this a magic number? // For Future WebRTC notes: Chrome 500 max limit, however 256 likely - FF "none", webtorrent does 55 per torrent.
  opt.rtc.room =
    opt.rtc.room ||
    (Gun.window && (location.hash.slice(1) || location.pathname.slice(1)));

}