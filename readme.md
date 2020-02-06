# Jaeger Client Middleware for NodeJS

A middleware for NodeJS support jaeger-client-nodejs
NodeJS 10.x recommended

```bash
npm i jaeger-client-middleware
```

## Before Setup

This package is a middleware version of jaeger-client-nodejs, without jaeger setup this package has no effect.
Please read these references:

- Ref:

  -- jaeger-client for NodeJS `https://github.com/jaegertracing/jaeger-client-node`

  -- jaeger tracing for local run `https://www.jaegertracing.io/docs/1.16/getting-started`

  -- jaeger tracing for production `https://www.jaegertracing.io/docs/1.16/deployment`

## How to use

### 1. Create jeager.js file on your project (libs directory recommended)

`libs/jaeger.js`

```javascript
const { initTracer } = require('jaeger-client');

const config = {
  serviceName: 'your-service-name': String,
  reporter: {
    name: 'your-service-name-reporter' : String,
    logSpans: true,
    agentHost: 'your-reporter-host': String,
    agentPort: 'your-report-port': Number
  },
  sampler: {
    type: 'your-sampler-type',
    param: 1.0
  }
};

const options = {
  tags: {
    'service': 'your-service-tag': String,
    'version': 'your-service-version': String,
  }
}
module.exports = initTracer(config,options);
```

example:

```javascript
import { initTracer } from "jaeger-client";

const config = {
  serviceName: "my-service",
  reporter: {
    name: "my-service-reporter",
    logSpans: true,
    agentHost: process.env.JAEGER_AGENT_HOST || "localhost",
    agentPort: process.env.JAEGER_AGENT_PORT || 6832
  },
  sampler: {
    type: "const",
    param: 1.0
  }
};
const options = {
  tags: {
    service: "my-service",
    version: process.env.npm_package_version || "1.0.0"
  }
};

export default initTracer(config, options);
```

### 2. Create Middleware file (middlewares directory recommended)

`middlewares/jaeger-middleware.js`

```javascript

const jaeger = require("path-to-libs/jaeger.js");
const JaegerMiddleware = require("jaeger-client-middleware");
const jaegerMiddleware = new JaegerMiddleware(jaeger);
module.exports = jaegerMiddleware;
```

After created, your structure should look like

```bash
├── libs
│   └── jaeger.js
├── middlewares
│   └── jaeger-middleware.js
├── package.json
├── routes
│   └── index.js
├── app.js
```

### 3. Use for API

`app.js`

```javascript
const jaegerMiddleware = require("path-to-middleware/jaeger-middleware.js");

// assume you are using express
const app = require('express')();
app.use(
  jaegerMiddleware.handleLogBeforeResponse,
  jaegerMiddleware.createSpanAfterReceivedRequest
);
```
