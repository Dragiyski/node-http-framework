import node_net from 'node:net';

export function decodeIPv4(value) {
    if (!node_net.isIPv4(value)) {
        return null;
    }
    return doDecodeIPv4(value);
}

export function encodeIPv4(value) {
    if (typeof value === 'bigint') {
        if (value < 0n || value > 4294967295n) {
            throw new RangeError('IPv4 address must be a number within [0; 4294967295] range');
        }
        value = Number(value);
    } else {
        if (!Number.isSafeInteger(value)) {
            throw new TypeError('IPv4 address must be integer number');
        }
        if (value < 0 || value > 4294967295) {
            throw new RangeError('IPv4 address must be a number within [0; 4294967295] range');
        }
    }
    return doEncodeIPv4(value);
}

function doDecodeIPv4(value) {
    value = value.split('.').map(b => Number(value));
    let result = 0;
    for (const byte of value) {
        result <<= 8;
        result |= byte;
    }
    return result;
}

function doEncodeIPv4(value) {
    const ip = new Array(4);
    for (let i = 0; i < 4; ++i) {
        ip[i] = ((value >>> (3 - i) * 8) & 0xFF).toString(10);
    }
    return ip.join('.');
}
