import regexp_hostname from './regexp-hostname.js';
import SecureContext from './secure-context.js';
import callAsFunctionHandler from '../util/call-as-function-handler.js';

export const properties = {
    name: Symbol('name'),
    context: Symbol('context')
};

class SecureServerName {
    /**
     * @param {string} name
     * @param {SecureContext} context
     */
    constructor(name, context) {
        if (typeof name !== 'string') {
            throw new TypeError('Invalid arguments[0]: expected string');
        }
        {
            const segments = name.split('.');
            if (!segments.every(segment => regexp_hostname.test(segment))) {
                throw new TypeError('Invalid arguments[0]: expected valid hostname string');
            }
        }
        if (!(context instanceof SecureContext)) {
            throw new TypeError('Invalid arguments[1]: expected an instance of SecureContext');
        }
        this[properties.name] = name;
        this[properties.context] = context;
    }

    /**
     * @returns {string}
     */
    get name() {
        return this[properties.name];
    }

    /**
     * @returns {SecureContext}
     */
    get context() {
        return this[properties.context];
    }
}

/**
 * @module
 * @param {string} name The server hostname to which the context applies to.
 * @param {SecureContext} context The context containing the TLS/SSL information (usually x509 certificate and key file).
 * @return SecureServerName
 */
export default new Proxy(SecureServerName, callAsFunctionHandler);
