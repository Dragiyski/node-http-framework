import { JavaScript } from '@dragiyski/collection';

import Response from '../response.js';

export default class DataResponse extends Response {
    #data;
    #encoding;

    constructor(data, encoding = 'utf-8', ...args) {
        if (encoding != null && typeof encoding === 'number' || typeof encoding === 'object') {
            args.unshift(encoding);
            encoding = 'utf-8';
        }
        if (Buffer.isBuffer(data)) {
            encoding = 'buffer';
        } else if (typeof data !== 'string') {
            throw new TypeError(`Expected parameter 1 to be Buffer object or string, got ${JavaScript.getType(data)}`);
        }
        super(...args);
        this.#data = data;
        this.#encoding = encoding;
        if (!this.hasHeader('Content-Type')) {
            this.setHeader('Content-Length', Buffer.byteLength(data, encoding).toString(10));
        }
    }

    get data() {
        return this.#data;
    }

    get encoding() {
        return this.#encoding;
    }

    pipe(response, options) {
        options = { ...options };
        options.end ??= true;
        this.writeHead(response);
        const method = options.end ? 'end' : 'write';
        response[method](this.#data, this.#encoding);
    }
}
