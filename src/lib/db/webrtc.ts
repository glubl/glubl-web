import Gun, { type GunHookCallbackPut, type GunMesh, type GunPeer, type IGunHookContext, type IGunInstance, type _GunRoot } from "gun";
import SEA from "gun/sea"

let gun: IGunInstance<any>
let mesh: GunMesh
let env: typeof window | typeof globalThis
let opt: GunOptions

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

  function open(msg) {
    console.log("start-open", msg)
    if(this && this.off){ this.off() } // Ignore this, because of ask / ack.
    if(!msg.ok){ return }
    var rtc = msg.ok.rtc, peer, tmp;
    if(!rtc || !rtc.id || rtc.id === user._.sea.pub){ return }
    //console.log("webrtc:", JSON.stringify(msg));
    if(tmp = rtc.answer){
      if(!(peer = opt.peers[rtc.id] || pending[rtc.id]) || peer.remoteSet){ return }
      tmp.sdp = tmp.sdp.replace(/\\r\\n/g, '\r\n');
      return peer.setRemoteDescription(peer.remoteSet = new opt.RTCSessionDescription(tmp)); 
    }
    if(tmp = rtc.candidate){
      peer = opt.peers[rtc.id] || pending[rtc.id] || open({ok: {rtc: {id: rtc.id}}});
      return peer.addIceCandidate(new opt.RTCIceCandidate(tmp));
    }
    //if(opt.peers[rtc.id]){ return }
    if(pending[rtc.id]){ return }
    (peer = opt.peers[rtc.id] || new opt.RTCPeerConnection(opt.rtc)).id = rtc.id;
    var wire = peer.wire = peer.createDataChannel('dc', opt.rtc.dataChannel);
    pending[rtc.id] = peer;
    wire.to = setTimeout(function(){delete pending[rtc.id]},1000*60);
    wire.onclose = function(){ 
      console.log("closed: ", friend.pub)
      resetReconnect()
      mesh.bye(peer)
    };
    wire.onerror = function(err){
      resetReconnect()
    };
    wire.onopen = function(e){
      console.log("open: ", friend.pub)
      delete pending[rtc.id];
      mesh.hi(peer);
    }
    wire.onmessage = function(msg){
      console.log("message")
      if(!msg){ return }
      //console.log('via rtc');
      clearTimeout(defer)
      retry = 60
      mesh.hear(msg.data || msg, peer);
    };
    peer.onicecandidate = function(e){ // source: EasyRTC!
      console.log("ice", e)
      if(!e.candidate){ return }
      const candidate = JSON.parse(JSON.stringify(e.candidate))
      send({'@': msg['#'], ok: {rtc: {candidate: candidate, id: user._.sea.pub}}})
    }
    peer.ondatachannel = function(e){
      console.log("data-chan", e)
      var rc = e.channel;
      rc.onmessage = wire.onmessage;
      rc.onopen = wire.onopen;
      rc.onclose = wire.onclose;
    }
    if(tmp = rtc.offer){
      rtc.offer.sdp = rtc.offer.sdp.replace(/\\r\\n/g, '\r\n')
      peer.setRemoteDescription(new opt.RTCSessionDescription(tmp)); 
      peer.createAnswer(function(answer){
        console.log("answer", answer)
        peer.setLocalDescription(answer);
        send({'@': msg['#'], ok: {rtc: {answer: JSON.parse(JSON.stringify(answer)), id: user._.sea.pub}}})
      }, function(){}, opt.rtc.sdp);
      return;
    }
    peer.createOffer(function(offer){
      console.log("create-offer", offer)
      peer.setLocalDescription(offer);
      send({'@': msg['#'], '#': root.ask(recieve), ok: {rtc: {offer: JSON.parse(JSON.stringify(offer)), id: user._.sea.pub}}})
    }, function(){}, opt.rtc.sdp);
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
      recieve(v)
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
    send({rtc: {id: pair.pub}})
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
  opt.rtc.sdp = opt.rtc.sdp || {
    mandatory: { 
      OfferToReceiveAudio: false, 
      OfferToReceiveVideo: false 
    },
  };
  opt.rtc.max = opt.rtc.max || 55; // is this a magic number? // For Future WebRTC notes: Chrome 500 max limit, however 256 likely - FF "none", webtorrent does 55 per torrent.
  opt.rtc.room =
    opt.rtc.room ||
    (Gun.window && (location.hash.slice(1) || location.pathname.slice(1)));

}