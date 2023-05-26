import * as g from "gun/types/gun"
import type { GunRTC } from "../lib/webrtc"
import type { Tunnel, TunnelConnection, Path } from "@src/lib/db/tunnel"

declare module "gun" {
  
  export interface GunHookFriend {
    pub: string,
    epub: string,
    path: string,
    mypath: string
  }

  export type GunPeer = {
      id: string;
      url: string;
      queue: string[];
      wire: RTCDataChannel | WebSocket | {
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
        close?: () => void
      } | null;
      rtc?: {
        send(this: GunPeer["friendRtc"], msg: any): void;
        receive(this: GunPeer["friendRtc"], sig: string): void;
        rtc: RTCPeer;
        tunPeer: TunnelPeer;
    }
  }

  export type MeshSayFn = (
    msg: {
      dam: string,
      [k: string]: any
    },
    peers: GunPeer | GunPeer[] | { [pid: string]: GunPeer }
  ) => void

  export type MeshHearFn = (
    msg: {
      dam: string,
      [k: string]: any
    },
    peer: GunPeer
  ) => void

  export interface _GunRoot {
    $: IGunInstance<any>
    opt: GunOptions
    user?: IGunUserInstance
    once?: any
    ask(callback?: (ack: g.GunMessagePut) => void): string
  }
  
  export type GunOptions = Partial<{
    /** Undocumented but mentioned. Write data to a JSON. */
    file: string;

    /** Undocumented but mentioned. Create a websocket server */
    web: any;

    /** Undocumented but mentioned. Amazon S3 */
    s3: {
      key: string;
      secret: string;
      bucket: string;
      region?: string;
      fakes3?: any;
    };

    /** default: true, creates and persists local (nodejs) data using Radisk. */
    radisk: boolean;

    /** default: true, persists local (browser) data to localStorage. */
    localStorage: boolean;

    /** uuid allows you to override the default 24 random alphanumeric soul generator with your own function. */
    uuid(): string;

    WebSocket: boolean
    ws: boolean

    rtcInstance: GunRTC

    file: string
    ntp: {
      interval?: number
      timeout?: number
      smooth?: number
      on?: boolean
    } | boolean
    
    mesh: GunMesh
    RTCPeerConnection?: typeof RTCPeerConnection | boolean
    RTCSessionDescription?: typeof RTCSessionDescription
    RTCIceCandidate?: typeof RTCIceCandidate
    rtc?: {
      max?: number,
      room?: string,

      peerConfig?: RTCConfiguration
      dataChannel?: RTCDataChannelInit 
      offer?: RTCOfferOptions
    }

    Tunnel?: false | {
      instance?: Tunnel
      hc?: number
      startHc?: number
      maxRetry?: number
    }
    peers: { [pid: string]: GunPeer }
  }>
  
  

  export interface GunMesh {
    hi(peer: GunPeer): unknown
    bye(peer: GunPeer): unknown
    say: MeshSayFn
    hear: { 
      [k: string]: MeshHearFn,
      (data: any, peer: GunPeer): void
    }
  }

  export interface IGun {
    Mesh: function (_GunRoot): GunMesh
  }

  export interface GunHookRTCChannel {
    id: string
    peer: RTCPeerConnection
    channel: RTCDataChannel
  }

  export interface GunHookRTCConnect {
    peerId: string
    myId: string
    send: (data: RTCMsg, init?: boolean) => void
  }

  export interface GunHookRTCPeer {
    peer: GunPeer
    connected: boolean
  }

  export interface GunHookTunnelCreate {

  }

  export interface IGunInstanceHookHandler {
    sea?: ISEAPair;
    $: { _: _GunRoot };

    on(event: 'out', data: {'#'?:string, '@'?: string, 'ok'?: any}): void

    on(event: 'friend', data: GunHookFriend): void;
    on(event: 'friend', callback: (this: g.IGunHookContext<GunHookFriend>, d: GunHookFriend) => void): void
    on(event: 'leave', data: _GunRoot): void
    on(event: 'leave', callback: (this: g.IGunHookContext<_GunRoot>, root: _GunRoot) => void): void

    on(event: 'rtc-channel', data: GunHookRTCChannel): void
    on(event: 'rtc-channel', callback: (this: g.IGunHookContext<GunHookRTCChannel>, d: GunHookRTCChannel) => void): void
    on(event: 'rtc-connect', data: GunHookRTCConnect): void
    on(event: 'rtc-connect', callback: (this: g.IGunHookContext<GunHookRTCConnect>, d: GunHookRTCConnect) => void): void

    on(event: 'rtc-peer', data: GunHookRTCPeer): void
    on(event: 'rtc-peer', callback: (this: g.IGunHookContext<GunHookRTCPeer>, d: GunHookRTCPeer) => void): void

    on(event: 'tun-instance', tunnel: Tunnel): void
    on(event: 'tun-instance', callback: (this: g.IGunHookContext<Tunnel>, tun: Tunnel) => void): void
    on(event: 'tun-create', data: {path: Path, connect?: boolean, callback: (connection: TunnelConnection) => void}): void
    on(event: 'tun-create', callback: (this: g.IGunHookContext<{path: Path, connect?: boolean, callback: (connection: TunnelConnection) => void}>, data: {path: Path, connect?: boolean, callback: (connection: TunnelConnection) => void}) => void): void
    on(event: 'tun-connection', data: TunnelConnection): void
    on(event: 'tun-connection', callback: (this: g.IGunHookContext<TunnelConnection>, con: TunnelConnection) => void): void
  }
}
