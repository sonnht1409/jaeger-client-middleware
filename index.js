const { stringify } = require("flatted/cjs");
const { FORMAT_HTTP_HEADERS, FORMAT_TEXT_MAP } = require("opentracing");
const { tagObject, isExcludedPath } = require("./helper");
const { getContext, setContext } = require("./context");
const opentracing = require("opentracing");

const buildSpanName = req => {
  const params = req.pathParams || req.params;
  const methodPrefix = `${req.method}_`;
  let baseSpanName = methodPrefix + req.originalUrl;
  if (!isEmpty(req.query)) {
    baseSpanName = methodPrefix + req.baseUrl + req.path;
  }

  if (!isEmpty(params)) {
    for (const key in params) {
      baseSpanName = baseSpanName.replace(params[key], `:${key}`);
    }
  }
  return baseSpanName;
};

process.on("unhandledRejection", error => {
  const errorSpan = opentracing.globalTracer().startSpan("unhandledRejection");
  errorSpan.setTag("error", true);
  errorSpan.setTag("http.status_code", error.statusCode || 500);
  errorSpan.log({
    error: JSON.stringify(error.stack)
  });
  errorSpan.finish();
});

const isEmpty = (obj = {}) => {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
};

class JaegerMiddleware {
  constructor(jaeger, options = {}) {
    opentracing.initGlobalTracer(jaeger);
    this._jaeger = jaeger;
    this.options = options;
    this.handleLogBeforeResponse = this.handleLogBeforeResponse.bind(this);
    this.jaegerLog = this.jaegerLog.bind(this);
    this.createSpanAfterReceivedRequest = this.createSpanAfterReceivedRequest.bind(
      this
    );
    this.initSpanForWorker = this.initSpanForWorker.bind(this);
    this.buildHeaderBeforePublishMessage = this.buildHeaderBeforePublishMessage.bind(
      this
    );
    this.spawnNewSpanWithData = this.spawnNewSpanWithData.bind(this)
    this.buildHeaderForHTTPRequest = this.buildHeaderForHTTPRequest.bind(this);
  }

  createSpanAfterReceivedRequest(req, res, next) {
    if (isExcludedPath(req.originalUrl, this.options)) return next();
    // must always call next()
    try {
      const parentSpan = this._jaeger.extract(FORMAT_HTTP_HEADERS, req.headers);
      // let spanName = buildSpanName(req);
      const span = parentSpan
        ? this._jaeger.startSpan(`${req.originalUrl}`, {
            // references: [opentracing.followsFrom(parentSpan)]
            childOf: parentSpan
          })
        : this._jaeger.startSpan(`${req.originalUrl}`);
      req.span = span;
      setContext(span.context());
    } catch (error) {
      console.log(error);
    } finally {
      next();
    }
  }

  handleLogBeforeResponse(req, res, next) {
    if (isExcludedPath(req.originalUrl, this.options)) return next();
    try {
      let send = res.send;
      const resClone = res;
      // overwrite send method
      res.send = resBody => {
        res.resBody = resBody;
        this.jaegerLog(req, res);
        send.call(resClone, resBody);
        return resClone;
      };
    } catch (error) {
      console.log(error);
    } finally {
      next();
    }
  }

  initSpanForWorker(spanName,data, deliveryInfo={}) {
    const { headers={} } = deliveryInfo;
    const parentSpan = this._jaeger.extract(FORMAT_TEXT_MAP, headers);
    const span = parentSpan
      ? this._jaeger.startSpan(spanName, {
          childOf: parentSpan
        })
      : this._jaeger.startSpan(spanName);
    const spanContext = span.context();
    tagObject(span,data)
    setContext(spanContext);
    return span;
  }

  spawnNewSpanWithData(spanName = "children-span",data={}) {
    const newSpan = this._jaeger.startSpan(spanName)
    tagObject(newSpan,data)
    setContext(newSpan.context());
    return newSpan;
  }

  buildHeaderForHTTPRequest(headers = {}) {
    const spanContext = getContext();
    this._jaeger.inject(spanContext, FORMAT_HTTP_HEADERS, headers);
    return headers;
  }

  static setContext(value) {
    setContext(value);
  }

  static tagObject(span, value) {
    try {
      tagObject(span, value);
    } catch (error) {
      console.log(error);
    }
  }

  static getContext() {
    return getContext();
  }

  jaegerLog(req, res) {
    try {
      const span = this._jaeger.startSpan("jaeger-middleware", {
        childOf: req.span
      });
      if (res.statusCode !== 200) {
        span.setTag("error", true);
      }
      tagObject(span, req.query);
      tagObject(span, req.params);
      tagObject(span, req.body);
      const requestInfo = {
        path: req.path,
        body: req.body,
        query: req.query,
        params: req.params
      };

      const info = {
        request: JSON.stringify(requestInfo),
        "response.body": stringify(res.resBody)
      };
      span.log(info);

      span.finish();
    } catch (error) {
      console.log(error);
    } finally {
      const newSpanName = buildSpanName(req);
      req.span.setOperationName(newSpanName);
      req.span.finish();
    }
  }
}

module.exports = JaegerMiddleware;
