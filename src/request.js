import { isIPv6, isIP } from 'net';
import { Stream } from 'stream';
import { URL } from "url";

export const properties = {
    stream: Symbol('stream')
};

export default class Request {
    constructor(stream) {
        if (!(stream instanceof Stream) || !stream.readable) {
            throw new TypeError(`arguments[0]: not a readable stream, or stream already destroyed/closed`);
        }
        this[properties.stream] = stream;
    }

    /**
     * Reads an IP/Host address and decode IPv6 encoded IPv4.
     * @param {string} source
     * @returns {string}
     */
    static readAddress(source) {
        if (typeof source !== 'string') {
            return null;
        }
        if (!isIPv6(source)) {
            return source;
        }
        const address = parseIPv6(source);
        if (address != null) {
            if (address[0] === 0 && address[1] === 0 && address[2] === 0 && address[3] === 0 && address[4] === 0 && address[5] === 65535) {
                return (address[6] >> 8) + '.' + (address[6] & 0xFF) + '.' + (address[7] >> 8) + '.' + (address[7] & 0xFF);
            }
        }
        return source;
    }

    static fromHttpRequest(req) {
        const request = new this(req);
        request.httpVersion = req.httpVersion;
        request.httpVersionMajor = req.httpVersionMajor;
        request.httpVersionMinor = req.httpVersionMinor;
        request.headers = Object.assign(Object.create(null), req.headers);
        request.rawHeaders = [...req.rawHeaders];
        request.localAddress = this.readAddress(req.socket.localAddress);
        request.remoteAddress = this.readAddress(req.socket.remoteAddress);
        request.localPort = req.socket.localPort;
        request.remotePort = req.socket.remotePort;
        request.localFamily = isIP(req.socket.localAddress);
        request.remoteFamily = isIP(req.socket.remoteAddress);
        request.ssl = req.socket?.ssl ?? null;
        return request;
    }

    /**
     * Get a full URL from an HTTP request.
     * @param {IncomingMessage} request
     * @param {object} options
     * @param {string} options.defaultHost
     * @returns {module:url.URL|null}
     */
    static getLocation(request, options = {}) {
        options = { ...options };
        const location = new URL('http://localhost');
        if (request.socket.ssl != null) {
            location.protocol = 'https:';
        }
        if (request.authority) {
            location.host = request.authority;
        } else if (request.headers[':authority']) {
            location.host = request.headers[':authority'];
        } else if (request.headers.host) {
            location.host = request.headers.host;
        } else if (options.defaultHost != null) {
            location.host = options.defaultHost;
        } else {
            return null;
        }
        {
            let url = request.url.split('?');
            location.pathname = url.shift();
            url = url.join('?');
            location.search = url;
        }
        return location;
    }
}

function parseIPv6(ip) {
    ip = ip.split('::');
    let g = 0;
    for (let i = 0; i < ip.length; ++i) {
        ip[i] = ip[i].split(':');
        g += ip[i].length;
    }
    const ip4 = /([0-9]+)\.([0-9]+)\.([0-9]+)\.([0-9]+)/.exec(ip[ip.length - 1][ip[ip.length - 1].length - 1]);
    if (ip4) {
        ip[ip.length - 1].pop();
        ip[ip.length - 1].push(ip4[1] * 256 + (ip4[2] | 0));
        ip[ip.length - 1].push(ip4[3] * 256 + (ip4[4] | 0));
    }
    if (ip.length === 2 && g < 8) {
        if (ip[0].length === 1 && ip[0][0] === '') {
            ip[0].length = 0;
        }
        ip[2] = ip[1];
        ip[1] = [];
        while (g < 8) {
            ip[1].push(0);
            ++g;
        }
    }
    ip = Array.prototype.concat.apply([], ip);
    if (ip.length !== 8) {
        return null;
    }
    for (let i = 0; i < ip.length; ++i) {
        ip[i] = typeof ip[i] === 'number' ? ip[i] : ip[i].length > 0 ? parseInt(ip[i], 16) : 0;
        if (!isFinite(ip[i])) {
            return null;
        }
    }
    return ip;
}

/**
 * Validates the Server-Name Identification (SNI). SNI is used in SSL to get the proper certificate.
 *
 * SSL has a chicken-and-egg problem. The whole HTTP request (including the path requested) is encrypted.
 * In order to decrypt the request to read it, the server need to have a proper key.
 *
 * However, there could be multiple keys for multiple subdomains, so which key should decode the request?
 * In other words you need to know the host/:authority header to get the key and you need the key to get the host/:authority header.
 *
 * Instead, SSL uses SNI, which sends the host unencrypted, so SSL can lookup one of the server certificates to decrypt the request.
 * Once the HTTP request is decrypted the server can read the host header.
 *
 * A known "attack" (which is an actual attack on shared host) is to abuse that property giving different name in SNI and the host header.
 * A bug in most servers exists, because SSL is processed by different module than the virtual hosts, so the server happily send out
 * the request to the specific virtual host for processing even it was decrypted from different certificate.
 *
 * In NodeJS we can handle this.
 *
 * @param {IncomingMessage} request
 * @param {URL} location
 * @return {boolean}
 */
export function validateSNI(request, location) {
    const socket = request.socket;
    const ssl = socket.ssl;
    if (ssl == null) {
        return true; // Non-SSL do not have SNI.
    }
    const servername = socket.servername;
    if (!servername) {
        return true;
    }
    return location.host === servername;
}
