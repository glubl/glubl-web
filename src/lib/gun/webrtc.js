(function () {
  var Gun = typeof window !== "undefined" ? window.Gun : require("../gun");
  Gun.on("opt", function (root) {
    this.to.next(root);
    var opt = root.opt;
    if (root.once) {
      return;
    }
    if (!Gun.Mesh) {
      return;
    }
    if (false === opt.RTCPeerConnection) {
      return;
    }

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
        { urls: "stun:stun.sipgate.net:3478" },
        { urls: "stun:relay.metered.ca:80" }
        /*,
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
      mandatory: { OfferToReceiveAudio: false, OfferToReceiveVideo: false },
    };
    opt.rtc.max = opt.rtc.max || 55; // is this a magic number? // For Future WebRTC notes: Chrome 500 max limit, however 256 likely - FF "none", webtorrent does 55 per torrent.
    opt.rtc.room =
      opt.rtc.room ||
      (Gun.window && (location.hash.slice(1) || location.pathname.slice(1)));
    var mesh = (opt.mesh = opt.mesh || Gun.Mesh(root));

    ack = {
      ok: { // encrypted - signed
        rtc: { 
          id: p.pub,
          answer: {},
          candidate: {}
        }
      }
    }

    var pending =  opt.rtc.pending = {}
    const SEA = Gun.SEA || GUN.SEA || window?.SEA
    
    root.on("friend", async function (friend) {
      var start = +new Date; // handle room logic:
      this.to.next(friend);
      var gun = root.$
      var user = root.user
      if (!friend.pub || !friend.epub || !friend.path || !friend.mypath || !user || !user._.sea) return
      const secret = await SEA.secret(friend.epub, user._.sea)
      async function send(msg) {
        let enc = await SEA.encrypt(msg.ok, secret)
        let sig = await SEA.sign(enc, user._.sea)
        msg.ok = sig
        root.on('out', msg)
      }
      function open(msg) {
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
        (peer = new opt.RTCPeerConnection(opt.rtc)).id = rtc.id;
        var wire = peer.wire = peer.createDataChannel('dc', opt.rtc.dataChannel);
        pending[rtc.id] = peer;
        wire.to = setTimeout(function(){delete pending[rtc.id]},1000*60);
        wire.onclose = function(){ mesh.bye(peer) };
        wire.onerror = function(err){ };
        wire.onopen = function(e){
          delete pending[rtc.id];
          mesh.hi(peer);
        }
        wire.onmessage = function(msg){
          if(!msg){ return }
          //console.log('via rtc');
          mesh.hear(msg.data || msg, peer);
        };
        peer.onicecandidate = function(e){ // source: EasyRTC!
          if(!e.candidate){ return }
          send({'@': msg['#'], ok: {rtc: {candidate: e.candidate, id: opt.pid}}})
        }
        peer.ondatachannel = function(e){
          var rc = e.channel;
          rc.onmessage = wire.onmessage;
          rc.onopen = wire.onopen;
          rc.onclose = wire.onclose;
        }
        if(tmp = rtc.offer){
          rtc.offer.sdp = rtc.offer.sdp.replace(/\\r\\n/g, '\r\n')
          peer.setRemoteDescription(new opt.RTCSessionDescription(tmp)); 
          peer.createAnswer(function(answer){
            peer.setLocalDescription(answer);
            send({'@': msg['#'], ok: {rtc: {answer: answer, id: opt.pid}}})
          }, function(){}, opt.rtc.sdp);
          return;
        }
        peer.createOffer(function(offer){
          peer.setLocalDescription(offer);
          send({'@': msg['#'], '#': root.ask(recieve), ok: {rtc: {offer: offer, id: opt.pid}}})
        }, function(){}, opt.rtc.sdp);
        return peer;
      }
      
      async function recieve(ack) {
        if(!ack.ok){ return }
        var enc = await SEA.verify(ack.ok, friend)
        if (!enc) return
        var dat = await SEA.decrypt(enc, secret)
        if (!dat) return
        ack.ok = dat
        open(ack)
      }
      function announce() {
        user.get("spaces")
          .get(friend.path)
          .get("RTC")
          .put("+", recieve, {acks: opt.rtc.max})
        gun.get("~"+friend.pub).get("spaces")
          .get(friend.mypath)
          .get("RTC")
          .on(function(v, k, msg) {
            if(start > msg.put['>']) return
            open({'#': ''+msg['#'], ok: {rtc: {id: friend.pub}}})
          })
      }
      setTimeout(announce, 1);
    })
  });
})();
