import { isAbsolute } from 'path';
import { createReadStream } from 'fs';

import Response from '../response.js';

export default class FileResponse extends Response {
    #filename;

    constructor(filename, ...args) {
        if (!isAbsolute(filename)) {
            throw new TypeError('Expected argument 1 to be absolute path');
        }
        super(...args);
        this.#filename = filename;
    }

    get filename() {
        return this.#filename;
    }

    pipe(response, options) {
        this.writeHead(response);
        createReadStream(this.#filename).pipe(response, options);
    }
}
