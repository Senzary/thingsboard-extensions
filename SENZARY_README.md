# 🧩 Senzary thingsboard extensions

## 🚀 set up

### requirements

- nodeJS v.22+
- yarn@latest

### steps

- `$yarn install`
- add `widget-extension` to package.json start & build scripts:
```json
    {
        "start": "yarn run build:scss && node --max_old_space_size=8048 ./node_modules/@angular/cli/bin/ng serve widget-extension",
        "build": "yarn run build:scss && node --max_old_space_size=8048 ./node_modules/@angular/cli/bin/ng build widget-extension && node install.js"
    }
```
- `$yarn start` or `$npm run start` 
- check terminal for errors; if none, check server is up `curl http://127.0.0.1:8080` should reply with `cannot GET/`

## 🐱‍👤 use

- open your custom widget editor on thingsboard
- go to `Resources` tab and add local widget-extensions resource url: 

```js
const url = "http://<host>:<port>/static/widgets/thingsboard-extension-widgets.js";
```
```js
// usually something like 
const url = "http://127.0.0.1:8080/static/widgets/thingsboard-extension-widgets.js";
```
- work on your widget component (build required files, i.e.: html template, component styles, component.ts, module.ts, and so on)
- save your work and check how it behaves by clicking `Run` in thingsboard custom widget IDE
- once satisfied push your changes to your branch and build your pull request to develop

> 🚧 unit testing is desired but requires checking effort/value ratio to set up angular testing environment/variables; check is pending 🚧

## build

### manually

- run `yarn build` or `npm run build`
- go to thingsboard `Javascript Library` menu option
- find `senzary-extensions` library (or create if it doesn't exist)
- remove current file for `senzary-extensions` library
- upload file generated on root folder @`/target/generated-resources/thingsboard-extension-widgets.js`
- save

### repo action

> 🚧 pending work to automate building on merging to senzary main branch on this repo; we should be able to point Javascript library module to repo file, so it would be automated once pull requests are accepted to merge into main branch 🚧

## 🔧 troubleshooting 

### if using wsl and cannot reach 127.0.0.1:8080 on windows host

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