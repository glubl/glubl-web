import Gun, { type GunPeer, type _GunRoot } from "gun";

type NTP = {
  t1: number
  t2: number
  t3: number
  t4: number
}

type NTPResult = {
  ntp: NTP
  res: (value: NTPResult | PromiseLike<NTPResult>) => void
  peer: GunPeer
  offset: number
  roundTrip: number
  timeout: ReturnType<typeof setTimeout>
}

let pending: {[pid: string]: NTPResult} = {}
let timeoutPeers: {[pid: string]: number} = {}
let mesh: any
let timeout: number = 2 * 1000
let interval: ReturnType<typeof setInterval>
let peers: {[pid: string]: GunPeer} = {}
let smooth = 1

function sendNTP(peer: GunPeer) {
  return new Promise<NTPResult>((res) => {
    //console.log("start-sendntp")
    
    let ntp: NTPResult = {
      ntp: { t1: Gun.state(), t2: 0, t3: 0, t4: 0 },
      res: res,
      peer: peer,
      offset: 0,
      roundTrip: 0,
      // Handle peers that don't speak NTP
      timeout: setTimeout(() => {
        if (peer.id in pending) {
          //console.log("peer-timeout", peer.id)
          delete pending[peer.id]
          timeoutPeers[peer.id] = (timeoutPeers[peer.id] || 0) + 1
          res(ntp)
        }
      }, timeout)
    }
    pending[peer.id] = ntp
    mesh.say({dam: "ntp", ntp: {}}, {[peer.id]: peer})
    //console.log("end-sendntp")
  })
}

function resolveNTP(ntpres: NTPResult) {
  //console.log("start-resolventp")

  const ntp = ntpres.ntp
  ntpres.roundTrip = (ntp.t4 - ntp.t1) - (ntp.t3 - ntp.t2)
  ntpres.offset = ((ntp.t2 - ntp.t1) + (ntp.t3 - ntp.t4)) / 2
  clearTimeout(ntpres.timeout)
  delete timeoutPeers[ntpres.peer.id]
  ntpres.res(ntpres)

  //console.log("end-resolventp", ntpres)
}

function hearNTP(msg: { dam: 'ntp', ntp: NTP }, peer: GunPeer) {
  //console.log("start-hearntp", msg, peer.id)

  let asServer = false
  if (!msg.ntp.t2 && !msg.ntp.t3) {
    msg.ntp.t2 = Gun.state()
    asServer = true
  }

  if (asServer) {
    msg.ntp.t3 = Gun.state()
    mesh.say({ dam: 'ntp', ntp: msg.ntp }, {[peer.id]: peer})
    return
  }
  
  let ntpres = pending[peer.id]
  if (!ntpres) return
  delete pending[peer.id]

  ntpres.ntp.t4 = Gun.state()
  ntpres.ntp.t2 = msg.ntp.t2
  ntpres.ntp.t3 = msg.ntp.t3
  resolveNTP(ntpres)

  //console.log("end-hearntp")
}

async function doSync(root: _GunRoot) {
  if (Object.keys(pending).length > 0 || Object.keys(peers).length == 0) return
  const opt: GunOptions = root.opt as any;
  
  //console.log("start-dosync", peers)

  let all = (await Promise.all(
    Object.entries<GunPeer>(peers)
      .filter(([pid, _]) => timeoutPeers[pid] || 0 < 5)
      .map(([_, peer]) => {
        return sendNTP(peer)
      })
  )).filter((v) => !(v.peer.id in timeoutPeers))

  if (all.length == 0) return

  let drift = all.map((a) => a.offset)
    .reduce((a, b) => a + b) / (all.length + smooth);
  (Gun.state as any).drift += drift
  //console.log("end-dosync", (Gun.state as any).drift, drift)
} 


Gun.on("opt", function init(root: _GunRoot) {
  this.to.next(root);

  if ((root as any).once) {
    return;
  }
  if (!Gun.Mesh) {
    return;
  }

  root.on("hi", function(peer: GunPeer) {
    peers[peer.id] = peer
    delete timeoutPeers[peer.id]
  });
  root.on("bye", function(peer: GunPeer) {
    delete peers[peer.id]
  });

  let opt = root.opt as GunOptions;
  if (opt.ntp === false) return
  if (opt.ntp === true || opt.ntp == null)
    opt.ntp = {}
  mesh = opt.mesh = opt.mesh || (Gun as any).Mesh(root);
  mesh.hear.ntp = hearNTP
  smooth = opt.ntp.smooth ??= smooth
  interval = setInterval(() => {
    doSync(root)
  }, opt.ntp.interval ??= 10 * 1000)
  timeout = opt.ntp.timeout ??= opt.ntp.interval / 2
  doSync(root)
})

