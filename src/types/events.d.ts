declare module "events" {
    export type EventMap = Record<string | number, any[]>
    export type EventKey<T extends EventMap> = string & keyof T
    export type EventReceiver<T> = (...args: T) => void;
    export class EventEmitter<T extends EventMap> {
        static listenerCount(emitter: EventEmitter, type: EventKey<T>): number;
        static defaultMaxListeners: number;
        on<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this
        once<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this
        off<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): void
        emit<K extends EventKey<T>>(type: K, ...args: T[K]): boolean
        addListener<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this
        eventNames(): Array<keyof T>
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        prependListener<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this;
        prependOnceListener<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this;
        removeListener<K extends EventKey<T>>(type: K, listener: EventReceiver<T[K]>): this;
        removeAllListeners<K extends EventKey<T>>(type?: K): this;
        listeners<K extends EventKey<T>>(type: K): Array<EventReceiver<T[K]>>;
        listenerCount<K extends EventKey<T>>(type: K): number;
        rawListeners<K extends EventKey<T>>(type: K): Array<EventReceiver<T[K]>>
    }
   
}