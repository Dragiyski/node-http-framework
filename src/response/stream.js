import Response from '../response.js';

export default class StreamResponse extends Response {
    #stream;

    constructor(stream, ...args) {
        if (stream == null || typeof stream !== 'object') {
            throw new TypeError('Expected argument 1 to be an object');
        }
        if (!stream.readable || typeof stream.pipe !== 'function') {
            throw new TypeError('Expected argument 1 to look like readable stream');
        }
        super(...args);
        this.#stream = stream;
    }

    get stream() {
        return this.#stream;
    }

    pipe(response, options) {
        this.writeHead(response);
        this.#stream.pipe(response, options);
    }
}
