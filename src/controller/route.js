export const properties = {
    definition: Symbol('definition'),
    parent: Symbol('parent')
};

export const methods = {
    processDefinition: Symbol('processDefinition'),
    match: Symbol('match'),
    generate: Symbol('generate')
};

export class Route {
    /**
     * @param {RouteDefinitionList} definition
     * @param {RouteOptions} options
     */
    constructor(definition, options) {
        if (new.target === Route) {
            throw new TypeError('Illegal constructor: abstract class');
        }
        this[properties.definition] = this[methods.processDefinition](definition);
        options = { ...options };
        if (options.parent != null) {
            if (!(options.parent instanceof Route)) {
                throw new TypeError(`Invalid option.parent: expected instance of Route class, if specified.`);
            }
            this[properties.parent] = options.parent;
        }
    }

    /**
     * Matches a path against the current definition and return the remaining path or `null` if the definition does not
     * match. It also fills-in any attribute encountered during the matching. However, if the match fails the attributes
     * remain unchanged.
     *
     * If this route has a parent, the parent would be called and this will operate on the remaining path returned from
     * the parent. If the parent returns `null`, this will also return `null`.
     *
     * Because attributes need to be aggregated and only assign after successful match, including those from the parent,
     * a separate object would aggregate attributes. This allows us to extract attributes that were used in the match.
     * We can then potentially extract only unhandled paremeters from URL object. This could be controlled by a
     * query option which can be a boolean, or perhaps an object defining named attributes with possible conversion
     * `toValue`. For now this is not essential.
     *
     * @abstract
     * @param {string} path The request path to match.
     * @param {object} attributes The receiver for the attributes encountered on the path.
     * @returns {string|null} Returns the remaining path or null if not a match. If remaining path is empty, it will be
     * an empty string or slash depending on whether directories are matched or exact path.
     */
    match(path, attributes) {
        throw new TypeError(`Illegal invocation: abstract method`);
    }

    /**
     * This should generate an path that will match the current definition exactly. To do this, all variable parts
     * of the path will be deterministically defined by the specified attributes. If this cannot be done (possibly,
     * due to a missing attribute), an exception must be thrown.
     *
     * The generator must generate full path, potentially calling the parent route. This will return the base path.
     *
     * @param {object} attributes
     */
    generate(attributes) {
        throw new TypeError(`Illegal invocation: abstract method`);
    }

    [methods.processDefinition](items) {
        if (items !== Object(items) || typeof items[Symbol.iterator] !== 'function') {
            items = [items];
        }

        return items.map(processRouteDefinitionList);

        function processRouteDefinitionList(item, index) {
            if (typeof item === 'string') {
                if (item.length <= 0) {
                    throw new TypeError(`Invalid definition[${index}]: empty string`);
                }
                return item;
            } else if (item != null && typeof item === 'object') {
                if (!['string', 'symbol'].includes(typeof item.name)) {
                    throw new TypeError(`Invalid definition[${index}]: expected [object String] or [object Symbol] for attribute name, got ${Object.prototype.toString.call(item.name)}`);
                }
                const attribute = Object.create(null);
                attribute.name = item.name;
                if (item.min != null) {
                    if (!['number', 'bigint'].indexOf(item.min)) {
                        throw new TypeError(`Invalid definition[${index}][min]: expected [object Number] or [object BigInt], got ${Object.prototype.toString.call(item.min)}`);
                    }
                    if (item.min < 0) {
                        throw new RangeError(`Invalid definition[${index}][min]: must be greater than or equal to zero: ${item.min}`);
                    }
                    attribute.min = item.min;
                } else {
                    attribute.min = 1;
                }
                if (item.max != null) {
                    if (!['number', 'bigint'].indexOf(item.max)) {
                        throw new TypeError(`Invalid definition[${index}][max]: expected [object Number] or [object BigInt], got ${Object.prototype.toString.call(item.max)}`);
                    }
                    if (attribute.max < attribute.min) {
                        throw new RangeError(`Invalid definition[${index}][min]: must be greater than or equal to min (${attribute.min}): ${item.max}`);
                    }
                    attribute.max = item.max;
                } else {
                    attribute.max = attribute.min;
                }
                if (item.key != null) {
                    attribute.key = processAttributeMatch(index, 'key', item.key, []);
                }
                if (item.value == null) {
                    throw new TypeError(`Invalid definition[${index}]: missing definition value`);
                }
                attribute.value = processAttributeMatch(index, 'value', item.value, []);
                if (typeof item.toValue === 'function') {
                    attribute.toValue = item.toValue.bind(item);
                }
                if (typeof item.toPath === 'function') {
                    attribute.toPath = item.toPath.bind(item);
                }
                return attribute;
            }
        }

        function processAttributeMatch(index, property, value, target, ...stack) {
            if (typeof value === 'string' || value instanceof RegExp) {
                target.push(value);
                return target;
            }
            if (typeof value[Symbol.iterator] === 'function') {
                if (stack.includes(value)) {
                    throw new TypeError(`Invalid definition[${index}][${property}]: circular reference detected`);
                }
                for (const item of value) {
                    processAttributeMatch(index, property, item, target, ...stack, value);
                }
                return target;
            }
            throw new TypeError(`arguments[${index}][${property}]: Expected string, RegExp or Iterable<string, RegExp>, got ${Object.prototype.toString.call(value)}`);
        }
    }
}

export class DirectoryRoute extends Route {
    match(path, attributes) {
        const attr = Object.create(null);
        if (this[properties.parent] != null) {
            const parent = this[properties.parent];
            path = parent.match(path, attr);
            if (path == null) {
                return null;
            }
        }
        const remainingPath = this[methods.match](path, attr);
        if (remainingPath == null) {
            return null;
        }
        Object.assign(attributes, attr);
        return '/' + remainingPath.join('/');
    }

    [methods.match](path, attributes) {
        const pathList = path.split('/').filter(directory => directory.length > 0);
        const definitionList = [...this[properties.definition]];
        let pathIndex = 0;
        let definitionIndex = 0;
        while (definitionIndex < definitionList.length && pathIndex < pathList.length) {
            if (!againstItem()) {
                return null;
            }
        }
        return pathList.slice(pathIndex);

        function againstItem() {
            const definition = definitionList[definitionIndex];
            if (typeof definition === 'string') {
                const entry = pathList[pathIndex];
                if (entry === definition) {
                    ++pathIndex;
                    ++definitionIndex;
                    return true;
                }
                return false;
            }
            return againstAttribute();
        }

        function againstAttribute() {
            const attribute = definitionList[definitionIndex++];
            const found = [];
            for (let count = 0; count < attribute.max; ++count) {
                if (pathIndex + count >= pathList.length) {
                    return false;
                }
                let value = pathList[pathIndex + count];
                let key = null;
                if (attribute.key != null) {
                    key = value;
                    const keyMatch = valueAgainstMatch(key, attribute.key);
                    if (keyMatch == null) {
                        break;
                    }
                    if (pathIndex + ++count >= pathList.length) {
                        break;
                    }
                    value = pathList[pathList + count];
                }
                const valueMatch = valueAgainstMatch(value, attribute.value);
                if (valueMatch == null) {
                    break;
                }
                if (typeof attribute.toValue === 'function') {
                    try {
                        value = attribute.toValue(value, ...valueMatch);
                    } catch {
                        break;
                    }
                }
                found.push({ key, value });
            }
            if (found < attribute.min) {
                return false;
            }
            pathIndex += found.length;
            let data;
            if (attribute.key != null) {
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
            if (data.length > 0) {
                if (data.length <= 1) {
                    data = data[0];
                }
                if (attribute.name in attributes) {
                    if (!Array.isArray(attributes[attribute.name])) {
                        attributes[attribute.name] = [attributes[attribute.name]];
                    }
                    attributes[attribute.name].concat(data);
                } else {
                    if (!Array.isArray(data) && attribute.array) {
                        data = [data];
                    }
                    attributes[attribute.name] = data;
                }
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

/**
 * @typedef {string|RegExp} MatchDefinition
 */

/**
 * @typedef {MatchDefinition|Array<MatchDefinition>} MatchDefinitionList
 */

/**
 * @typedef AttributeDefinition
 * @property {string} name
 * @property {number|bigint} [min]
 * @property {number|bigint} [max]
 * @property {MatchDefinitionList} [key]
 * @property {MatchDefinitionList} value
 */

/**
 * @typedef {string|AttributeDefinition} RouteDefinition
 */

/**
 * @typedef {RouteDefinition|Array<RouteDefinition>} RouteDefinitionList
 */

/**
 * @typedef {object} RouteOptions
 * @property {Route} [parent]
 */

/* TODO
 * Route will replace PathFilter by handling routes. Route will handle only request path, not a request method.
 *
 * When will provide a controller to execute, which can be attached to chain/list or called from another controller
 * easily. This will just call the match function.
 *
 * The routes are linked internally by allowing a route to specify its parent. This is useful for example if a route
 * defines the path:
 * /admin
 *
 * Followed by another route, that has the parent mentioned above defining:
 * /product
 *
 * Following by another route that has the parent for "/product" and route "/create".
 *
 * Then generate must generate "/admin/product/create" when called on "/create" route. However, it is not guarantee
 * that the path would exist. It is up to the package user (usually a dev) to put the specific filter into the proper
 * controller chain.
 */
