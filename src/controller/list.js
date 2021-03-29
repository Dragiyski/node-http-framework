import Response from '../response';

/**
 * This controller factory accept list of controllers, that must be functions. The controller iterates the list and
 * execute each function asynchronously, until one of the functions returns a {@link Response}.
 *
 * The controllers called by this controller can also return a function, in which case the function is called back
 * with the response found (if any). The response callback can modify the response, return the same response, or
 * return `null` to indicate that the response found is unprocessable, so a new response is needed.
 *
 * Note: We assume each controller is independent for the others, therefore if one controller says `false` (which means
 * break), we continue with the next. For dependent controllers use {@link ControllerChain}.
 *
 * Note: It is possible to create {@link ControllerList} of {@link ControllerChain} objects and {@link ControllerChain}
 * of {@link ControllerList} objects.
 *
 * Note: Attributes are unique for each entry and will not be transported between entries.
 *
 * @param {...function} controllers
 * @returns {function(Request, object): Promise<Response|null>}
 * @constructor
 */
export default function ControllerList(...controllers) {
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
        controllerLoop: for (const controller of controllers) {
            response = await controller(request, Object.create(attributes));
            if (typeof response === 'function') {
                queue.push(response);
                response = null;
            } else if (response instanceof Response) {
                for (let i = queue.length - 1; i >= 0; --i) {
                    const responseCallback = queue[i];
                    const newResponse = await responseCallback(response);
                    if (newResponse instanceof Response) {
                        response = newResponse;
                    } else if (newResponse === false) {
                        continue controllerLoop;
                    } else if (newResponse != null && newResponse !== true) {
                        throw new TypeError(`The controller response was not acceptable: ${Object.prototype.toString.call(response)}`);
                    }
                }
                break;
            } else if (response != null && response !== false && response !== true) {
                throw new TypeError(`The controller response was not acceptable: ${Object.prototype.toString.call(response)}`);
            }
        }
        return response;
    };
}
