# now-shadow-cljs
A ▲ Now builder for ClojureScript projects using shadow-cljs

The builder will build your shadow-cljs targets and deploy to ▲ Now. If the target is `:browser` it will be deployed as a static page and if it is `:node-script` it will be deployed as a lambda function.

For an example using both browser and node builds, see [github.com/jntn/haiku](https://github.com/jntn/haiku)

### Example `now.json`
``` json
{
    "version": 2,
    "name": "my-shadow-cljs-project",
    "builds": [
        {
            "src": "shadow-cljs.edn",
            "use": "@jntn/now-shadow-cljs"
        }
    ]
}
```

## Caveats
* Right now the only supported build targets are `:browser` and `:node-script`.
* The builder does not currently work with `:deps true` in `shadow-cljs.edn`