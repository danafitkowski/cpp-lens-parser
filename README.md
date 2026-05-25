# @criticalpathpartners/lens-parser

JavaScript reader and writer for Primavera P6 XER files; reader for P6 XML. Pure ES modules, browser-compatible, no runtime dependencies.

Companion library to [cpp-cpm-engine](https://github.com/danafitkowski/cpp-cpm-engine). Powers the CPP Lens browser viewer at https://criticalpathpartners.ca/viewer/.

## Status

v0.x — under active development.

## Usage

```js
import { parseXer } from '@criticalpathpartners/lens-parser';
const model = parseXer(xerText);
```

## License

MIT
