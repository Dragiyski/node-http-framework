import { STATUS_CODES } from 'http';

export const properties = {
    statusCode: Symbol('statusCode'),
    headers: Symbol('headers'),
    trailers: Symbol('trailers')
};

export default class Response {
    constructor(statusCode = 200, headers = {}) {
        this[properties.headers] = Object.create(null);
        this[properties.trailers] = Object.create(null);
        if (statusCode == null) {
            statusCode = 200;
        } else if (typeof statusCode === 'object') {
            headers = statusCode;
            statusCode = 200;
        } else if (Object.prototype.hasOwnProperty.call(STATUS_CODES, statusCode)) {
            throw new TypeError(`Invalid status code: expected one of the defined HTTP codes: [${Object.keys(STATUS_CODES).join(', ')}]`);
        }
        this[properties.statusCode] = statusCode;
        insertHeaders(this, headers);
    }

    addHeader(headerName, headerValue) {
        addEntry(this[properties.headers], headerName, headerValue);
        return this;
    }

    setHeader(headerName, headerValue) {
        setEntry(this[properties.headers], headerName, headerValue);
        return this;
    }

    hasHeader(headerName) {
        return hasEntry(this[properties.headers], headerName);
    }

    getHeader(headerName) {
        return getEntry(this[properties.headers], headerName);
    }

    getHeaderNames() {
        return Object.keys(this[properties.headers]);
    }

    getAllHeaders() {
        return copyEntries(this[properties.headers]);
    }

    removeHeader(headerName) {
        removeEntry(this[properties.headers], headerName);
    }

    addTrailer(trailerName, trailerValue) {
        addEntry(this[properties.trailers], trailerName, trailerValue);
        return this;
    }

    setTrailer(trailerName, trailerValue) {
        setEntry(this[properties.trailers], trailerName, trailerValue);
        return this;
    }

    hasTrailer(trailerName) {
        return hasEntry(this[properties.trailers], trailerName);
    }

    getTrailer(trailerName) {
        return getEntry(this[properties.trailers], trailerName);
    }

    removeTrailer(trailerName) {
        removeEntry(this[properties.trailers], trailerName);
        return this;
    }

    getTrailerNames() {
        return Object.keys(this[properties.trailers]);
    }

    getAllTrailers() {
        return copyEntries(this[properties.trailers]);
    }

    get statusCode() {
        return this[properties.statusCode];
    }

    set statusCode(value) {
        const number = parseInt(value, 10);
        if (!isFinite(number) || !Object.hasOwnProperty.call(STATUS_CODES, value)) {
            throw new TypeError(`Invalid status code: expected one of the defined HTTP codes: [${Object.keys(STATUS_CODES).join(', ')}]`);
        }
        this[properties.statusCode] = number;
    }

    writeHead(response) {
        response.statusCode = this.statusCode;
        for (const headerName in this[properties.headers]) {
            response.setHeader(headerName, this[properties.headers][headerName]);
        }
        // TODO: Write traileers here, this might need to be different in HTTP/1.1 and HTTP/2.0
        // _http_outgoing.js has addTrailer that accept two formats:
        // {<key:string>: <value:string>, ...} or [[key:string, value:string], ...]
        // internal/http2/util.js mapHeader uses: {key:string: value:string|Array}, but
        // it validates a set of headers for which only a single value is allowed and
        // throws an exception otherwise...
    }

    write(response) {}

    pipe(response, options) {
        options = { ...options };
        options.end ??= true;
        this.writeHead(response);
        if (options.end) {
            response.end();
        }
    }

    static transfer(source, target) {
        if (!(source instanceof Response)) {
            throw new TypeError(`Expected argument 1 to be a Response`);
        }
        if (!(target instanceof Response)) {
            throw new TypeError(`Expected argument 2 to be a Response`);
        }
        for (const headerName of source.getHeaderNames()) {
            target.setHeader(headerName, source.getHeader(headerName));
        }
        for (const trailerName of source.getTrailerNames()) {
            target.setTrailer(trailerName, source.getTrailer(trailerName));
        }
        for (const name of Object.keys(source)) {
            target[name] = source[name];
        }
    }
}

Object.defineProperties(Response, {
    REGEXP_HEADER_NAME: {
        value: /^[\^_`a-zA-Z\-0-9!#$%&'*+.|~]+$/
    },
    REGEXP_HEADER_VALUE: {
        value: /[^\t\x20-\x7e\x80-\xff]/
    }
});

function insertHeaders(response, headers) {
    if (Array.isArray(headers)) {
        const aggregator = Object.create(null);
        if (headers.length % 2) {
            throw new TypeError(`Array of raw headers should have even number of elements`);
        }
        for (let i = 0; i < headers.length; i += 2) {
            let headerName = headers[i];
            const headerValue = headers[i + 1];
            if (typeof headerName !== 'string' || typeof headerValue !== 'string') {
                throw new TypeError(`Array of raw headers should contain only strings`);
            }
            headerName = headerName.trim().toLowerCase();
            headerValue.trim();
            if (headerName.length <= 0) {
                throw new TypeError(`Empty header name at index ${i} of raw headers`);
            }
            if (headerValue.length <= 0) {
                throw new TypeError(`Empty header value at index ${i + 1} of raw headers`);
            }
            if (!response.constructor.REGEXP_HEADER_NAME.test(headerName)) {
                const error = new TypeError(`Invalid header name at index ${i} of raw headers: ${headerName}`);
                error.headerName = headerName;
                throw error;
            }
            if (!response.constructor.REGEXP_HEADER_VALUE.test(headerValue)) {
                const error = new TypeError(`Invalid header value at index ${i + 1} of raw headers: ${headerName}`);
                error.headerName = headerName;
                throw error;
            }
            if (headerName in aggregator) {
                if (!Array.isArray(aggregator[headerName])) {
                    aggregator[headerName] = [aggregator[headerName]];
                }
                aggregator.push(headerValue);
            } else {
                aggregator[headerName] = headerValue;
            }
        }
        for (const headerName in aggregator) {
            response.setHeader(headerName, aggregator[headerName]);
        }
    } else if (headers != null) {
        if (typeof headers !== 'object') {
            throw new TypeError('Invalid headers: expected Array (raw headers) or Object');
        }
        for (const headerName of Object.keys(headers)) {
            response.setHeader(headerName, headers[headerName]);
        }
    }
}

function addEntry(target, headerName, headerValue) {
    if (typeof headerName !== 'string') {
        throw new TypeError('Invalid header name: expected a string');
    }
    headerName = headerName.trim().toLowerCase();
    if (headerName.length <= 0) {
        throw new TypeError('Empty header name');
    }
    if (Array.isArray(headerValue)) {
        const values = [];
        for (let i = 0; i < headerValue.length; ++i) {
            if (typeof headerValue[i] !== 'string') {
                throw new TypeError(`Invalid header value at index ${i}: expected a string`);
            }
            const value = headerValue[i].trim();
            if (value.length <= 0) {
                throw new TypeError(`Empty header value at index ${i}`);
            }
            values.push(value);
        }
        if (headerName in target) {
            if (!Array.isArray(target[headerName])) {
                target[headerName] = [target[headerName]];
            }
            target[headerName].push(...values);
        } else {
            target[headerName] = values;
        }
    } else if (typeof headerValue === 'string') {
        headerValue = headerValue.trim();
        if (headerValue.length <= 0) {
            throw new TypeError(`Empty header value`);
        }
        if (headerName in target) {
            if (!Array.isArray(target[headerName])) {
                target[headerName] = [target[headerName]];
            }
            target[headerName].push(headerValue);
        } else {
            target[headerName] = headerValue;
        }
    } else {
        throw new TypeError(`Invalid header value: expected a string or Array<string>`);
    }
}

function setEntry(target, headerName, headerValue) {
    if (typeof headerName !== 'string') {
        throw new TypeError('Invalid header name: expected a string');
    }
    headerName = headerName.trim().toLowerCase();
    if (headerName.length <= 0) {
        throw new TypeError('Empty header name');
    }
    if (Array.isArray(headerValue)) {
        const values = [];
        for (let i = 0; i < headerValue.length; ++i) {
            if (typeof headerValue[i] !== 'string') {
                throw new TypeError(`Invalid header value at index ${i}: expected a string`);
            }
            const value = headerValue[i].trim();
            if (value.length <= 0) {
                throw new TypeError(`Empty header value at index ${i}`);
            }
            values.push(value);
        }
        target[headerName] = values;
    } else if (typeof headerValue === 'string') {
        headerValue = headerValue.trim();
        if (headerValue.length <= 0) {
            throw new TypeError(`Empty header value`);
        }
        target[headerName] = headerValue;
    } else {
        throw new TypeError(`Invalid header value: expected a string or Array<string>`);
    }
}

function hasEntry(target, headerName) {
    if (typeof headerName !== 'string') {
        throw new TypeError('Invalid header name: expected a string');
    }
    headerName = headerName.trim().toLowerCase();
    if (headerName.length <= 0) {
        throw new TypeError('Empty header name');
    }
    return target[headerName];
}

function getEntry(target, headerName) {
    if (typeof headerName !== 'string') {
        throw new TypeError('Invalid header name: expected a string');
    }
    headerName = headerName.trim().toLowerCase();
    if (headerName.length <= 0) {
        throw new TypeError('Empty header name');
    }
    let value = target[headerName];
    if (Array.isArray(value)) {
        value = [...value];
    }
    return value;
}

function removeEntry(target, headerName) {
    if (typeof headerName !== 'string') {
        throw new TypeError('Invalid header name: expected a string');
    }
    headerName = headerName.trim().toLowerCase();
    if (headerName.length <= 0) {
        throw new TypeError('Empty header name');
    }
    delete target[headerName];
}

function copyEntries(source) {
    const target = Object.create(null);
    for (const name of Object.keys(source)) {
        const value = source[name];
        if (Array.isArray(value)) {
            target[name] = [...value];
        } else {
            target[name] = value;
        }
    }
    return target;
}
