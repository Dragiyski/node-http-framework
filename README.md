# HTTP Framework

This package contains helper functions to handle common HTTP tasks and ease the
interface over how HTTP requests are handled.

Normally, in NodeJS there are two streams received for HTTP request:
``request`` and ``response``. Usually framework implementation uses something
similar to:

```javascript
function controller(req, res, next) {
    if (cannot_handle()) {
        next();
    }
    if (error) {
        next(error);
    }
    req.property = something;
    res.property = something;
    // ...
}
```
or better it uses promises:
```javascript
async function controller(req, res) {
    if (cannot_handle()) {
        return;
    }
    if (error) {
        throw error;
    }
    req.property = something;
    res.property = something;
    // ...
}
```

Both scenarios have problems. They modify the response directly, leaving no
option for chaining. A chaining is a way to make a response based on another
response. For example, a GZip controller might read the body written from
another controller and compress it, before it writes it to the ``res``.
This could allow GZip based on path, method or other request properties.

To solve this, we implement architecture based on return values. An example
controller in this framework would look like:

```javascript
async function controller(request) {
    if (cannot_handle()) {
        return;
    }
    if (error) {
        throw error;
    }
    return new Response(something);
}
```
here the controller can still modify the request and return `null` or 
`undefined`, throw an error or just return a response. If the controller
needs to modify the response, it can return a `function`:
```javascript
async function controller(request) {
    return function(response) {
        const modifiedResponse = new Response();
        return modifiedResponse;
    };
}
```
This controller would be queued up, because it returns a `function` and not a
`Response` object. The framework will continue with the next controller,
queueing up all controllers that return a function and ignoring all controllers
that return `undefined` or `null`. The first one that returns `Response` object
would stop the routing process and all queued controllers would be called in
reverse order. So each one has the chance to modify the response. Doing this
would guarantee that no properties on ``res`` are modified and response headers
are not sent until all controllers did their job.

Because the controllers are simple function they can exist in their own
modules, allowing you to write well-structured application with one controller
per file, or combining multiple simple controller into one module.

# Routing

Routing is a two-way process containing matching and generating.

In the matching phase, the router read properties of the request like the request
method and the request path and filter controllers. The matching process
can also extract attributes from the requested path.

In the generating phase, the router accept properties and generate a request
object that would match the given route. While the request object is not
complete request (it won't contain all necessary headers), it would contain
initial information to set up a client request. Alternatively, a request
property can be used in the generation of response. For example, the request
location can be used to write an absolute or relative URL for a route to
an HTML.

The router can also extract attributes from the path. This can be used to
create fancy URLs.

# Response

This framework contains basic setup for multiple response variants:
`FileResponse`, `DataResponse`, `StreamResponse`. All classes inherit from
`Response`, which contains the status code and the response headers (and
footers, if any).

* `DataResponse` is suitable for responses generated in-memory.
* `FileResponse` is suitable for a response with content of a file.
* `StreamResponse` is suitable for NodeJS streams. While it can be used
for files, the better use case would be a child process like FastCGI.