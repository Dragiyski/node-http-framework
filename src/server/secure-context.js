import node_tls from 'node:tls';
import callAsFunctionHandler from '../util/call-as-function-handler.js';

export const properties = {
    options: Symbol('options'),
    context: Symbol('context')
};

const secureContextOptions = [
    'ca',
    'cert',
    'ciphers',
    'clientCertEngine',
    'crl',
    'dhparam',
    'ecdhCurve',
    'key',
    'passphrase',
    'pfx',
    'privateKeyIdentifier',
    'privateKeyEngine',
    'sessionIdContext',
    'sessionTimeout',
    'sigalgs',
    'ticketKeys',
    'honorCipherOrder',
    'minVersion',
    'maxVersion',
    'secureProtocol'
];

class SecureContext {
    constructor(options = {}) {
        if (options == null) {
            options = {};
        }
        if (options !== Object(options)) {
            throw new TypeError('Invalid arguments[0]: expected an object, if specified');
        }
        const thisOptions = {};
        for (const option of secureContextOptions) {
            if (option in options) {
                thisOptions[option] = options[option];
            }
        }
        this[properties.options] = thisOptions;
    }

    apply(target) {
        if (target !== Object(target)) {
            throw new TypeError('Invalid arguments[0]: expected an object');
        }
        const options = this[properties.options];
        for (const name of Object.keys(options)) {
            target[name] = options[name];
        }
        return target;
    }

    get() {
        if (this[properties.context] == null) {
            this[properties.context] = node_tls.createSecureContext(this[properties.options]);
            // Once the context is created, it won't be changed, so future calls to this.get() just return the result.
            Object.defineProperty(this, 'get', {
                configurable: true,
                writable: true,
                value: function () {
                    return this[properties.context];
                }
            });
        }
        return this[properties.context];
    }
}

/**
 * @module
 * @param {node_tls.SecureContextOptions} options TLS/SSL options to create a context from.
 */
export default new Proxy(SecureContext, callAsFunctionHandler);
