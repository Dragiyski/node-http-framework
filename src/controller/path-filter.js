export const properties = {
    items: Symbol('items')
};

export const methods = {
    processItems: Symbol('processItems')
};

export class PathFilter {
    constructor() {
        if (new.target === PathFilter) {
            throw new TypeError('Illegal constructor');
        }
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
    constructor(...items) {
        super();
        this[properties.items] = this[methods.processItems](items);
    }

    [methods.processItems](items) {
        const list = [];
        for (let i = 0; i < items.length; ++i) {
            const item = items[i];
            if (typeof item === 'string') {
                if (item.length <= 0) {
                    throw new TypeError(`arguments[${i}] is an empty string`);
                }
                list.push(item);
            } else if (item != null && typeof item === 'object') {
                if (!['string', 'symbol'].includes(typeof item.name)) {
                    throw new TypeError(`arguments[${i}]: attribute name must be string or symbol`);
                }
                const attribute = Object.create(null);
                if (item.min != null) {
                    if (!['number', 'bigint'].indexOf(item.min)) {
                        throw new TypeError(`arguments[${i}]: attribute min must be number or bigint, if present`);
                    }
                    if (item.min < 0) {
                        throw new RangeError(`arguments[${i}]: attribute min must be greater than or equal to zero (0).`);
                    }
                    attribute.min = item.min;
                } else {
                    attribute.min = 1;
                }
                if (item.max != null) {
                    if (!['number', 'bigint'].indexOf(item.max)) {
                        throw new TypeError(`arguments[${i}]: attribute max must be number or bigint, if present`);
                    }
                    attribute.max = item.max;
                } else {
                    attribute.max = attribute.min;
                }
                if (attribute.min > attribute.max) {
                    throw new RangeError(`arguments[${i}]: attribute min must be less than attribute max`);
                }
            }
        }
    }

    match(path) {
        const pathList = path.split('/').filter(directory => directory.length > 0);
        const itemList = [...this[properties.items]];
        const attributes = Object.create(null);
        let pathIndex = 0;
        let itemIndex = 0;
        while (itemIndex < itemList.length && pathIndex < pathList.length) {
            if (!againstItem()) {
                return false;
            }
        }

        function againstItem() {
            const item = itemList[itemIndex];
            if (typeof item === 'string') {
                const entry = pathList[pathIndex];
                if (entry === item) {
                    ++pathIndex;
                    ++itemIndex;
                    return true;
                }
                return false;
            }
            return againstAttribute();
        }

        function againstAttribute() {
            const item = itemList[itemIndex++];
            const found = [];
            for (let count = 0; count < item.max; ++count) {
                if (pathIndex + count >= pathList.length) {
                    return false;
                }
                let value = pathList[pathIndex + count];
                let key = null;
                if (item.key != null) {
                    key = value;
                    const keyMatch = valueAgainstMatch(key, item.key);
                    if (keyMatch == null) {
                        break;
                    }
                    if (pathIndex + ++count >= pathList.length) {
                        break;
                    }
                    value = pathList[pathList + count];
                }
                const valueMatch = valueAgainstMatch(value, item.value);
                if (valueMatch == null) {
                    break;
                }
                if (typeof item.toValue === 'function') {
                    try {
                        value = item.toValue(value, ...valueMatch);
                    } catch {
                        break;
                    }
                }
                found.push({ key, value });
            }
            if (found < item.min) {
                return false;
            }
            pathIndex += found.length;
            let data;
            if (item.key != null) {
                data = Object.create(null);
                for (const { key, value } of found) {
                    data[key] = value;
                }
            } else {
                data = [];
                for (const { value } of found) {
                    data.push(value);
                }
            }
            if (item.name in attributes) {
                if (!Array.isArray(attributes[item.name])) {
                    attributes[item.name] = [attributes[item.name]];
                }
                attributes[item.name].concat(data);
            } else {
                if (!Array.isArray(data) && item.array) {
                    data = [data];
                }
                attributes[item.name] = data;
            }
            return true;
        }

        function valueAgainstMatch(value, match) {
            for (const item of match) {
                if (typeof item === 'string') {
                    if (value === item) {
                        return [];
                    }
                } else if (item instanceof RegExp) {
                    const result = item.exec(value);
                    if (result != null) {
                        return result;
                    }
                }
            }
            return null;
        }
    }
}

export class PathStringFilter extends PathFilter {
    constructor(...items) {
        super();
        this[properties.items] = items;
    }
}
