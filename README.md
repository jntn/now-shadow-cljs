# now-shadow-cljs
A ▲ Now 2.0 builder for ClojureScript projects using shadow-clj. The builder will build your shadow-cljs targets and deploy them to ▲ Now.

## Usage

1. Create a shadow-cljs project. This builder supports building `:browser` and `:node-library` targets. If the target is `:browser` it will be deployed as a static page and if it is `:node-library` it will be deployed as a lambda function.

2. Write a `now.json` file that uses `@jntn/now-shadow-cljs`. **Note:** If you do not specify a `routes` section, the build output will be available under the specified output folder. For `:node-library` it is the `:output-to` path and for `:browser` it is the `:output-dir` path.

For an example using both browser and node builds, see [github.com/jntn/haiku](https://github.com/jntn/haiku)

### Example `now.json`
``` json
{
    "version": 2,
    "name": "haiku",
    "builds": [
        {
            "src": "shadow-cljs.edn",
            "use": "@jntn/now-shadow-cljs"
        }
    ],
    "routes": [
        {
            "src": "/(.*)",
            "dest": "/public/$1"
        },
        {
            "src": "/api/(.*)",
            "dest": "/api/$1"
        }
    ]
}
```

### Example `shadow-cljs.edn`
``` clojure
{:builds {:haikus {:target :node-library
                   ;; Will be available at "/api/haikus"
                   :output-to "api/haikus/index.js"
                   :exports-var jntn.api.haikus/handler}
          :app {:target :browser
                ;; Will by default be available at "/public" but
                ;; using the now.json above it is reached at "/"
                :output-dir "public/js"
                :asset-path "js"
                :modules {:main {:entries [jntn.app.core]}}
                :devtools {:http-root "public"
                           :proxy-url "http://localhost:3000"
                           :http-port 8000}}}}
```


## Caveats
* Right now the only supported build targets are `:browser` and `:node-library`.
* The builder does not currently work with `:deps true` in `shadow-cljs.edn`.