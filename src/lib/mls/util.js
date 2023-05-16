/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
export function concatUint8Array(arrays) {
    const len = arrays.reduce((acc, arr) => acc + arr.byteLength, 0);
    const ret = new Uint8Array(len);
    let pos = 0;
    for (const arr of arrays) {
        ret.set(arr, pos);
        pos = pos + arr.byteLength;
    }
    return ret;
}
export function eqUint8Array(a, b) {
    if (a.length != b.length) {
        return false;
    }
    // FIXME: this should probably be constant-time instead of short-circuited
    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}
// is the first array greater or equal to the second array
export function geUint8Array(a, b) {
    if (a.length != b.length) {
        throw new Error("Length must be the same");
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] > b[i]) {
            return true;
        }
        else if (a[i] < b[i]) {
            return false;
        }
    }
    return true;
}
export function stringToUint8Array(str) {
    const ret = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        ret[i] = str.charCodeAt(i);
    }
    return ret;
}
const hexMap = {};
for (let i = 0; i < 256; i++) {
    let hex = i.toString(16);
    if (hex.length < 2) {
        hex = "0" + hex;
    }
    hexMap[hex] = i;
}
export function hexToUint8Array(str) {
    const ret = new Uint8Array(str.length / 2);
    for (let i = 0; 2 * i < str.length; i++) {
        ret[i] = hexMap[str.substring(2 * i, 2 * i + 2)];
    }
    return ret;
}
function keyToString(key) {
    // `toString` returns different things if `key` is a `Uint8Array` or a
    // `Buffer`, so do this to make it consistent
    return key.join(",");
}
// map that uses Uint8Array as keys
export class Uint8ArrayMap {
    map = new Map();
    keyMap = new Map();
    constructor(iterable) {
        if (iterable) {
            for (const [k, v] of iterable) {
                this.set(k, v);
            }
        }
    }
    get size() { return this.map.size; }
    clear() {
        this.map.clear();
        this.keyMap.clear();
    }
    delete(key) {
        const keyStr = keyToString(key);
        this.map.delete(keyStr);
        this.keyMap.delete(keyStr);
    }
    entries() {
        return {
            [Symbol.iterator]: () => {
                return new Uint8ArrayMapIterator(this);
            },
        };
    }
    forEach(f, thisarg = this) {
        this.map.forEach((val, key) => f(val, this.keyMap.get(key), thisarg));
    }
    get(key) {
        const keyStr = keyToString(key);
        return this.map.get(keyStr);
    }
    has(key) {
        const keyStr = keyToString(key);
        return this.map.has(keyStr);
    }
    keys() {
        return this.keyMap.values();
    }
    set(key, value) {
        const keyStr = keyToString(key);
        this.map.set(keyStr, value);
        this.keyMap.set(keyStr, Uint8Array.from(key));
    }
    values() {
        return this.map.values();
    }
    [Symbol.iterator]() {
        return new Uint8ArrayMapIterator(this);
    }
}
class Uint8ArrayMapIterator {
    map;
    keyIterator;
    constructor(map) {
        this.map = map;
        this.keyIterator = map.keys()[Symbol.iterator]();
    }
    next() {
        const k = this.keyIterator.next();
        if (k.done) {
            return { done: true, value: undefined };
        }
        else {
            return {
                done: false,
                value: [k.value, this.map.get(k.value)],
            };
        }
    }
}
//# sourceMappingURL=util.js.map