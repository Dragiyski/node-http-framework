import node_net from 'node:net';
import regexp_hostname from './regexp-hostname.js';
import callAsFunctionHandler from '../util/call-as-function-handler.js';

export const internal = Symbol('Port');

export default class Port {
    constructor() {
        if (new.target === Port) {
            throw new TypeError(`Illegal constructor: class Port is abstract`);
        }
        this[internal] = Object.create(null);
    }

    listen() {
        throw new TypeError(`Illegal invocation: method Port.listen is abstract`);
    }
}

class NetworkStreamPort extends Port {
    constructor(port, hostname) {
        super();
        if (!Number.isSafeInteger(port) || port <= 0 || port > 65536) {
            throw new TypeError('Invalid arguments[0]: expected integer between 1 and 65535');
        }
        if (hostname != null) {
            if (typeof hostname !== 'string') {
                throw new TypeError(`Invalid arguments[1]: expected a string, if specified`);
            }
            if (['#any', '#IPv4', '#IPv6'].indexOf(hostname) < 0) {
                const ip = node_net.isIP(hostname);
                if (ip === 0) {
                    const segments = hostname.split('.');
                    if (!segments.every(segment => regexp_hostname.test(segment))) {
                        throw new TypeError('Invalid arguments[0]: expected valid hostname string');
                    }
                }
            }
        } else {
            hostname = '#any';
        }
        this[internal].port = port;
        this[internal].hostname = hostname;
    }

    get port() {
        return this[internal].port;
    }

    get hostname() {
        return this[internal].hostname;
    }

    async listen(server) {
        const hostname = this[internal].hostname;
        const port = this[internal].port;
        const defer = {
            this: this
        };
        defer.promise = new Promise((resolve, reject) => {
            defer.resolve = resolve;
            defer.reject = reject;
        });
        server.once('listening', onListening);
        server.once('error', onError);
        const options = {
            port,
            exclusive: true,
            ipv6Only: false
        };
        if (hostname === '#any') {
            options.host = '::';
        } else if (hostname === '#IPv4') {
            options.host = '0.0.0.0';
        } else if (hostname === '#IPv6') {
            options.host = '::';
            options.ipv6Only = true;
        }
        server.listen(options);
        return defer.promise;

        function onListening() {
            server.off('error', onError);
            defer.resolve(defer.this);
        }

        function onError(error) {
            server.off('listening', onListening);
            defer.reject(error);
        }
    }
}

const proxyNetworkStreamPort = new Proxy(NetworkStreamPort, callAsFunctionHandler);

export {
    proxyNetworkStreamPort as NetworkStreamPort
};
