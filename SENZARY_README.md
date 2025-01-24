# 🔧 troubleshooting 

## if using wsl and cannot reach 127.0.0.1:8080 on windows host

go to `node_modules/@tb/custom-builder/static-serve` and update code to use `host=0.0.0.0`

```ts
119 -> const host = '0.0.0.0' // could use options.host, but then have to update schema.json and pass option variable from angular.json
124 -> context.logger.info(`==> 🌎  Listening on port ${options.port}. Open up http://${host}:${options.port}/ in your browser.`);
```

alternative would be:

```ts
119 -> const host = options.host || '0.0.0.0' // could use options.host, but then have to update schema.json and pass option variable from angular.json
124 -> context.logger.info(`==> 🌎  Listening on port ${options.port}. Open up http://${host}:${options.port}/ in your browser.`);
```

add to schema.json

```json
    "host": {
      "type": "string"
    }
```

add to angular.json

```json
    "serve": {
        "options": {
            "host": "0.0.0.0"
        }
    }
```