import Gun, { type GunOptions, type GunPeer, type _GunRoot } from "gun"

type NTS = {
  start: number
  end?: number
  prom: (value: NTSResult | PromiseLike<NTSResult>) => void
  peer: GunPeer
  time?: number
  timeout: ReturnType<typeof setTimeout>
}

type NTSResult = {
  pid: string,
  drift: number
}

let dumbPeers = new Set<string>()
let pending: {[pid: string]: NTS} = {}
let mesh: any
let timeout: number = 2 * 1000

function sendNts(peer: GunPeer) {
  return new Promise<NTSResult>((res) => {
    console.log("start-sendnts")
    let nts: NTS = {
      start: Gun.state(),
      prom: res,
      peer: peer
    }
    pending[peer.id] = nts
    mesh.say({dam: "nts"}, {[peer.id]: peer})
  
    // Handle peers that don't speak NTS
    nts.timeout = setTimeout(() => {
      console.log("timeout", pending)
      if (peer.id in pending) {
        console.log("got-dumb-peer", peer)
        delete pending[peer.id]
        dumbPeers.add(peer.id)
        res({pid: peer.id, drift: 0})
      }
    }, timeout)
    console.log("end-sendnts")
  })
}

function resolveNts(nts: NTS) {
  console.log("start-resolvents", nts)
  if (!nts.end || !nts.time || !nts.start || !nts.prom) return
  const latency = (nts.end - nts.start) / 2
  const drift = nts.time - nts.end + latency
  clearTimeout(nts.timeout)
  nts.prom({pid: nts.peer.id, drift})
  console.log("end-resolvents", {pid: nts.peer.id, drift})
}

function hearNts(msg: NTS, peer: GunPeer) {
  console.log("start-hearnts", msg, peer)
  if (!msg.time) {
    mesh.say({dam: "nts", time: Gun.state()}, {[peer.id]: peer})
    return
  }
  
  let nts = pending[peer.id]
  if (!nts) return

  nts.time = msg.time
  nts.end = Gun.state()
  delete pending[peer.id]
  resolveNts(nts)
  console.log("end-hearnts")
}

async function doSync(root: _GunRoot) {
  const opt = root.opt;
  console.log("start-dosync", opt.peers)
  if (Object.keys(pending).length > 0) return
  let res = await Promise.all(
    Object.entries<GunPeer>(opt.peers)
      .filter(([n, p]) => !dumbPeers.has(n))
      .map(([n, p]) => {
        return sendNts(p)
      })
  )
  res = res.filter((v) => !dumbPeers.has(v.pid))
  if (res.length == 0) return
  let drift = res.map((a) => a.drift)
    .reduce((a, b) => a + b) / res.length
  Gun.state.drift += drift
  console.log("end-dosync", drift)
} 


Gun.on("opt", function init(root: _GunRoot) {
  this.to.next(root);
  let opt = root.opt;
  mesh = opt.mesh = opt.mesh || Gun.Mesh(root);
  mesh.hear.nts = hearNts
  setInterval(() => {
    doSync(root)
  }, root.opt.ntsInterval || 5 * 1000)
  doSync(root)
})

