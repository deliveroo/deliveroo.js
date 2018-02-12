# Determinator

This is a JavaScript port of the Ruby [determinator](https://github.com/deliveroo/determinator) library.

⚠️ This version is in an extremely early stage (I'm learning how to write NPM modules) and though it makes use of [determiantor's standard tests](https://github.com/deliveroo/determinator-standard-tests) to ensure it functions correctly, the API is likely to change a lot as this gets worked on.

## Usage

```js
const d = require('determinator');
const retrieval = new d.FileRetrieval('path/to/features/');
const determinator = new d.Determinator(retrieval);

const outcome = determinator.Determinate(
  'my_experiment_name',
  'user id',
  'anonymous user id',
  {
    employee: true
  }
)
```
