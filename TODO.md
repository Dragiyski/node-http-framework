# Modes of operation

There should be several modes of operations supported by the script.

## Server mode

In the server mode, there are two special objects (non-transferable): `req`
and `res`.  The `req` contains information about the request and can be
converted to `Request` object, while it is an input stream for the request
body. The `res` is the response and must be written by `Response` object
obtained from the application processing. It is also an output stream, while
it contains the HTTP status code of the request.

## Process mode

In process mode, the current process is spawned by another NodeJS process. The
current process will not initiate any servers, but receive a request headers
information from the IPC channel. All input will be read from the IPC channel
and all output will be written to the IPC channel. There must be a way to
distinguish between requests, since a single process might need to handle
multiple requests.

## Worker mode

In worker mode, similarly to process mode, request is received by IPC. In both
modes we can use serialization to send request and receive response.

## Proxy mode

In proxy mode, the request must be repeated to another server with minimal
amount of modification. It is possible to receive a request on HTTPS server and
send it to HTTP server. A useful example of this would be to have multiple apps
on multiple dockers listening on HTTP 80 within the internal docker network,
and the host (or another container with exposed ports to the host) to listen
at HTTPS port. In this case we might need to add some headers (like the
`X-Forwarded-For` header) and send the request to the server.

# BootStrap

In all modes of operations there should be a mode neutral objects `Request` and
`Response`. As an interface, those objects should be neutral, but the
processing of those object would be different depending on which mode of
operation the server is currently operating.

Both server and proxy mode are basically the same, the `request` is formed
from `req` object that contains the version, header, method, path and it is an
input stream for the body. In both server and proxy mode the `response` from
the front controller is written to output stream `res` (which includes setting
up the headers).

In process and worker mode, there must be an unique ID for the request object
received from the IPC.
