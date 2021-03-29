import DataResponse from './data.js';

export default class JsonResponse extends DataResponse {
    constructor(data, options, ...args) {
        if (options != null && typeof options === 'number') {
            args.unshift(options);
            options = null;
        }
        options = { ...options };
        options.encoding ??= 'utf-8';
        super(JSON.stringify(data, options.replacer, options.indent), options.encoding, ...args);
        this.setHeader('Content-Type', `application/json;charset=${options.encoding}`);
    }
}
