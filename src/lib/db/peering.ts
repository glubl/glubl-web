import type { } from "gun";

export function makePeerFrom(gun: IGunInstance<any> | IGunChain<any, any, any, any>) {
    let { mesh, pid } = gun.back("opt"), peer: any = {
       id: pid,
       wire: {
         send(msg: any) { if (msg) mesh.hear(msg, peer); }
       }
    }
    return peer
  }
  
export function doPeering(gun1: IGunInstance<any> | IGunChain<any, any, any, any>, gun2: IGunInstance<any> | IGunChain<any, any, any, any>) {
    let [peer1, peer2] = [makePeerFrom(gun1), makePeerFrom(gun2)]
    let [{mesh: mesh1}, {mesh: mesh2}] = [gun1.back("opt"), gun2.back("opt")]
    mesh1.hi(peer2)
    mesh2.hi(peer1)
}