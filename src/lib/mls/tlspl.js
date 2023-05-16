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
/** Encode things using TLS presentation language from
 * https://tools.ietf.org/html/rfc8446#section-3
 */
import { EMPTY_BYTE_ARRAY } from "./constants";
export class Static {
    buffer;
    constructor(buffer) {
        this.buffer = buffer;
    }
    get length() {
        return this.buffer.byteLength;
    }
    writeToBuffer(buffer, offset) {
        buffer.set(this.buffer, offset);
    }
}
export const empty = new Static(EMPTY_BYTE_ARRAY);
export function uint8(num) {
    return {
        length: 1,
        writeToBuffer(buffer, offset) {
            buffer[offset] = num;
        },
    };
}
export function uint16(num) {
    return {
        length: 2,
        writeToBuffer(buffer, offset) {
            (new DataView(buffer.buffer)).setUint16(offset + buffer.byteOffset, num);
        },
    };
}
export function uint24(num) {
    return new Static(Uint8Array.of(num >> 16 & 0xff, num >> 8 & 0xff, num & 0xff));
}
export function uint32(num) {
    return {
        length: 4,
        writeToBuffer(buffer, offset) {
            (new DataView(buffer.buffer)).setUint32(offset + buffer.byteOffset, num);
        },
    };
}
export function uint64(num) {
    return {
        length: 8,
        writeToBuffer(buffer, offset) {
            const view = new DataView(buffer.buffer);
            view.setUint32(offset + buffer.byteOffset, num & 0xffffffff);
            view.setUint32(offset + 4 + buffer.byteOffset, num >> 32 & 0xffffffff);
        },
    };
}
export function opaque(src) {
    return new Static(src);
}
export function variableOpaque(src, lengthBytes) {
    if (![1, 2, 4, 8].includes(lengthBytes)) {
        throw new Error("Invalid size for length");
    }
    return {
        length: lengthBytes + src.length,
        writeToBuffer(buffer, offset) {
            switch (lengthBytes) {
                case 1:
                    buffer[offset] = src.length;
                    break;
                case 2:
                    (new DataView(buffer.buffer)
                        .setUint16(offset + buffer.byteOffset, src.length));
                    break;
                case 4:
                    (new DataView(buffer.buffer)
                        .setUint32(offset + buffer.byteOffset, src.length));
                    break;
                case 8: {
                    const view = new DataView(buffer.buffer);
                    view.setUint32(offset + buffer.byteOffset, src.length >> 32 & 0xffffffff);
                    view.setUint32(offset + 4 + buffer.byteOffset, src.length & 0xffffffff);
                    break;
                }
            }
            buffer.set(src, offset + lengthBytes);
        },
    };
}
// a struct is a concatenation of the fields
export function struct(items) {
    const length = items.reduce((acc, item) => acc + item.length, 0);
    return {
        length,
        writeToBuffer(buffer, offset) {
            let pos = offset;
            for (const item of items) {
                item.writeToBuffer(buffer, pos);
                pos += item.length;
            }
        },
    };
}
// a vector is the total length of items, followed by each item
export function vector(items, lengthBytes) {
    if (![1, 2, 4, 8].includes(lengthBytes)) {
        throw new Error("Invalid size for length");
    }
    const length = items.reduce((acc, item) => acc + item.length, 0);
    const lengthEncoder = lengthBytes === 1 ? uint8(length) :
        lengthBytes === 2 ? uint16(length) :
            lengthBytes === 4 ? uint32(length) :
                uint64(length);
    return struct([lengthEncoder].concat(items));
}
export function encode(items) {
    const length = items.reduce((acc, item) => acc + item.length, 0);
    const out = new Uint8Array(length);
    let pos = 0;
    for (const item of items) {
        item.writeToBuffer(out, pos);
        pos += item.length;
    }
    return out;
}
export function decodeUint8(buffer, offset) {
    return [buffer[offset], offset + 1];
}
export function decodeUint16(buffer, offset) {
    return [(new DataView(buffer.buffer)).getUint16(offset + buffer.byteOffset), offset + 2];
}
export function decodeUint32(buffer, offset) {
    return [(new DataView(buffer.buffer)).getUint32(offset + buffer.byteOffset), offset + 4];
}
export function decodeUint64(buffer, offset) {
    const view = new DataView(buffer.buffer);
    return [
        view.getUint32(offset + buffer.byteOffset) << 32 |
            view.getUint32(offset + 4 + buffer.byteOffset),
        offset + 8,
    ];
}
export function decodeOpaque(length) {
    return (buffer, offset) => {
        return [buffer.subarray(offset, offset + length), offset + length];
    };
}
export function decodeVariableOpaque(lengthBytes) {
    if (![1, 2, 4, 8].includes(lengthBytes)) {
        throw new Error("Invalid size for length");
    }
    return (buffer, offset) => {
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [length,] = lengthBytes == 1 ? decodeUint8(buffer, offset) :
            lengthBytes == 2 ? decodeUint16(buffer, offset) :
                lengthBytes == 4 ? decodeUint32(buffer, offset) :
                    decodeUint64(buffer, offset);
        return [
            buffer.subarray(offset + lengthBytes, offset + lengthBytes + length),
            offset + lengthBytes + length,
        ];
    };
}
export function decodeStruct(decoders) {
    return (buffer, offset) => {
        const values = [];
        for (const decoder of decoders) {
            const [val, newOffset] = decoder(buffer, offset);
            values.push(val);
            offset = newOffset;
        }
        return [values, offset];
    };
}
export function decodeVector(decoder, lengthBytes, numElems) {
    if (![1, 2, 4, 8].includes(lengthBytes)) {
        throw new Error("Invalid size for length");
    }
    return (buffer, offset) => {
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        let [length,] = lengthBytes == 1 ? decodeUint8(buffer, offset) :
            lengthBytes == 2 ? decodeUint16(buffer, offset) :
                lengthBytes == 4 ? decodeUint32(buffer, offset) :
                    decodeUint64(buffer, offset);
        const vec = [];
        offset += lengthBytes;
        while (length > 0) {
            const [elem, newOffset] = decoder(buffer, offset);
            vec.push(elem);
            length -= newOffset - offset;
            offset = newOffset;
        }
        if (length !== 0) {
            throw new Error("Claimed vector size does not match actual size");
        }
        if (numElems !== undefined && vec.length !== numElems) {
            throw new Error("Wrong number of elements");
        }
        return [vec, offset];
    };
}
export function decodeOptional(decoder) {
    return (buffer, offset) => {
        // eslint-disable-next-line comma-dangle, array-bracket-spacing
        const [present,] = decodeUint8(buffer, offset);
        if (present) {
            return decoder(buffer, offset + 1);
        }
        else {
            return [undefined, offset + 1];
        }
    };
}
export function decode(decoders, buffer, offset = 0) {
    const values = [];
    for (const decoder of decoders) {
        const [val, newOffset] = decoder(buffer, offset);
        values.push(val);
        offset = newOffset;
    }
    return [values, offset];
}
//# sourceMappingURL=tlspl.js.map