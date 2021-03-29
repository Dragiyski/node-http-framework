// eslint-disable-next-line camelcase
import { constants as http2_const } from 'http2';
import Request, { validateSNI } from './request.js';

export const properties = {};

export default class Application {
    async handle(req, res) {
        try {
            let duration = process.hrtime.bigint();
            const request = Request.fromHttpRequest(req);
            // Early checks and initialization, errors are not logged in intentionally,
            // because request can be from malicious users that DDoS the server.
            request.location = Request.getLocation(req);
            if (request.location == null || !validateSNI(req, request.location)) {
                // This is most likely because the host is invalid,
                // for HTTP/1.1 the host header must be present.
                // for HTTP/2.0 the :authority header must be present.
                res.statusCode = 400;
                return void res.end();
            }
            request.method = req.method;
            let readLength = 0;
            let writeLength = 0;
            const byteCounter = {
                requestData(data, encoding) {
                    readLength += Buffer.byteLength(data, encoding);
                },
                requestEnd() {
                    this.off('data', byteCounter.requestData).off('end', byteCounter.requestEnd).off('error', byteCounter.requestEnd);
                },
                responseData(data, encoding) {
                    writeLength += Buffer.byteLength(data, encoding);
                    return responseWrite.apply(this, arguments);
                },
                responseEnd() {
                    if (this.write === byteCounter.responseData) {
                        this.write = responseWrite;
                    }
                    res.off('finish', byteCounter.responseEnd).off('close', byteCounter.responseEnd);
                },
                report() {
                    duration = process.hrtime.bigint() - duration;
                    console.log(`[${(new Date()).toISOString()}][server.request]: ${(Number(duration) / 1e6).toFixed(3)}ms ${request.remoteAddress} ${request.remotePort} ${request.localAddress} ${request.localPort} ${readLength} ${writeLength} ${res.statusCode} HTTP/${request.httpVersion} ${request.method} ${request.location}`)
                }
            };
            req.on('data', byteCounter.requestData).once('end', byteCounter.requestEnd).once('error', byteCounter.requestEnd);
            req.pause();
            const responseWrite = res.write;
            res.write = byteCounter.responseData;
            res.once('finish', byteCounter.responseEnd).once('close', byteCounter.responseEnd);
            res.once('close', byteCounter.report);
            res.statusCode = 501;
            res.end();
        } catch (e) {
            if (res.headersSent) {
                if (res.stream != null) {
                    res.stream.close(http2_const.NGHTTP2_INTERNAL_ERROR);
                } else {
                    res.destroy();
                }
            } else {
                for (const headerName of res.getHeaderNames()) {
                    res.removeHeader(headerName);
                }
                res.statusCode = 500;
                res.end();
            }
            throw e;
        }
    }
}
