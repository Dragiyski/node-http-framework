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

Controllers are useful, but not all controllers must be executed for all
request. The application can add routes with filters. There will be at least
two types of filters: `MethodFilter` and `PathFilter`. The `PathFilter` must
offer a way to describe attributes as path of the filter.

To support chaining the controllers and filters must be separate from the
application class. This will allow controllers to be a list of filters that
will filter the request more. For example, an application may have two
controllers for `/store` and `/admin`. The controller for `/store` might be
a collection of controllers for `/store/product` and `/store/category`, etc.

Allowing such chaining will allow controllers to create a tree.
In other words the router must be controller itself. The app can have a
single front controller which will be most likely controller list.

Because `PathFilter` instances are objects, they can be referenced by
multiple objects. A map can be created to store a named `PathFilter`. Those
filters can be used to generate an URL. Filters can be controller themselves.

# Response

This framework contains basic setup for multiple response variants:
`FileResponse`, `DataResponse`, `StreamResponse`. All classes inherit from
`Response`, which contains the status code and the response headers (and
footers, if any).

* `DataResponse` is suitable for responses generated in-memory.
* `FileResponse` is suitable for a response with content of a file.
* `StreamResponse` is suitable for NodeJS streams. While it can be used
for files, the better use case would be a child process like FastCGI.
