import node_net from 'node:net';
import node_util from 'node:util';
import { EventEmitter } from 'node:events';
import Port, { ServerPort } from './port.js';

export const internal = Symbol('HttpServer');

export default class HttpServer extends EventEmitter {
    constructor(controller, options) {
        super();
        if (typeof controller !== 'function') {
            throw new TypeError('Invalid arguments[0]: expected a function');
        }
        if (options == null) {
            options = {};
        }
        if (options !== Object(options)) {
            throw new TypeError('Invalid arguments[1]: expected an object, if specified');
        }
        let ports = options.port;
        if (ports == null) {
            ports = new ServerPort(80);
        } else if (ports !== Object(ports)) {
            throw new TypeError(`Invalid options "port": expected an object`);
        }
        if (ports instanceof Port) {
            ports = [ports];
        } else if (typeof ports[Symbol.iterator] === 'function') {
            ports = [...ports];
            if (!ports.every(port => port instanceof Port)) {
                throw new TypeError(`Invalid options "port": expected an instance of Port or Iterable<Port>`);
            }
        } else {
            throw new TypeError(`Invalid options "port": expected an instance of Port or Iterable<Port>`);
        }
        this[internal] = Object.create(null);
        this[internal].ports = new Map();
        this[internal].servers = new WeakMap();
        this[internal].connections = new Set();
        for (const port of ports) {
            const server = new node_net.Server({
                allowHalfOpen: false,
                pauseOnConnect: true
            });
            this[internal].servers.set(server, port);
            this[internal].ports.set(port, server);
            server[internal] = Object.create(null);
            server[internal].onConnection = onConnection.bind(this, server);
            server.on('connection', server[internal].onConnection);
        }
    }

    async listen() {
        const jobs = [];
        for (const [port, server] of this[internal].ports) {
            jobs.push(port.listen(server).then(() => server));
        }
        const results = await Promise.allSettled(jobs);
        if (results.some(result => result.status === 'rejected')) {
            const jobs = [];
            let firstRejected;
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const server = result.value;
                    jobs.push(node_util.promisify(server.close).call(server));
                } else if (result.status === 'rejected') {
                    firstRejected ??= result.reason;
                }
            }
            await Promise.all(jobs);
            throw firstRejected;
        }
        return this;
    }
}

function onConnection(server, socket) {
    debugger;
}
