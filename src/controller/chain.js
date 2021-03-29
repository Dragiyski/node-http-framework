import Response from '../response';

/**
 * This controller factory accept chain of controllers, that must be functions. The controller iterates the chain until
 * a controller returns a response.
 *
 * The chain allow any controller to modify the request, the attributes, the response generated later in the chain, or
 * to interrupt the chain earlier. This is useful for request conditions controllers like request path filters.
 *
 * For example: ``ControllerChain(PathFilterController(['product', 'buy', {attribute:id}], onProductBuy);``
 * allows PathFilterController to return `true` if the request matches, or `false` otherwise. The function
 * `onProductBuy` will be executed only if PathFilterController returns true and does not return a response.
 *
 * Note: In ControllerChain the order of the function specified matters more and we assume they are dependent. For
 * independent processing of multiple controllers, see {@link ControllerList}.
 *
 * @param {...function} controllers
 * @returns {function(Request, object): Promise<Response|null>}
 * @constructor
 */
export default function ControllerChain(...controllers) {
    let invalidIndex = -1;
    if ((invalidIndex = controllers.findIndex(controller => typeof controller !== 'function')) >= 0) {
        throw new TypeError(`Invalid arguments[${invalidIndex}]: not a function`);
    }
    return async function (request, attributes) {
        if (attributes !== Object(attributes)) {
            attributes = Object.create(null);
        }
        const queue = [];
        let response = null;
        for (const controller of controllers) {
            response = await controller(request, attributes);
            if (typeof response === 'function') {
                queue.push(response);
                response = null;
            } else if (response instanceof Response) {
                break;
            } else if (response === false) {
                return null;
            } else if (response != null && response !== true) {
                throw new TypeError(`The controller response was not acceptable: ${Object.prototype.toString.call(response)}`);
            }
        }
        if (response instanceof Response) {
            while (queue.length > 0) {
                const responseCallback = queue.pop();
                const newResponse = await responseCallback(response);
                if (newResponse instanceof Response) {
                    response = newResponse;
                } else if (newResponse === false) {
                    return null;
                } else if (newResponse != null && newResponse !== true) {
                    throw new TypeError(`The controller response was not acceptable: ${Object.prototype.toString.call(response)}`);
                }
            }
        }
        return response;
    };
}
