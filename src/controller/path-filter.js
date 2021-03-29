export class PathFilter {
    constructor() {
        // In order to give the controller to the other controllers as function, it must be bound to this.
        if (!Object.prototype.hasOwnProperty.call(this, 'controller')) {
            this.controller = this.controller.bind(this);
        }
    }

    /**
     * @abstract
     * @param {string} path The path to match.
     * @returns {object|null} If the path matches, the attributes object extracted from the path (this will still be
     * an object, even if no attributes are present on the path), or `null` if the path does not match. The returned
     * object will have `null` prototype.
     */
    match(path) {
        throw new TypeError('Invalid invocation');
    }

    /**
     * @abstract
     * @param {Request} request The request context into which the URL is generated.
     * @param {object} attributes The attribute used to generate the URL.
     * @returns {URL} The generated URL.
     */
    generate(request, attributes) {
        throw new TypeError('Invalid invocation');
    }

    /**
     * This method can be given as a function to any place expecting a controller. For example, the it can be given to
     * {@link ControllerList}, {@link ControllerChain}, or {@link Application}.
     * @param {Request} request
     * @param {object} attributes
     * @returns {boolean}
     */
    controller(request, attributes) {
        const newAttr = this.match(attributes[PathFilter.symbols.path] ?? request.location.path);
        if (newAttr != null) {
            Object.assign(attributes, newAttr);
            return true;
        }
        return false;
    }
}

Object.defineProperties(PathFilter, {
    symbols: {
        value: Object.freeze(Object.assign(Object.create(null), {
            path: Symbol('path'),
            filters: Symbol('filters'),
            base: Symbol('base')
        }))
    }
});

export class PathDirectoryFilter extends PathFilter {
}

export class PathStringFilter extends PathFilter {
}
