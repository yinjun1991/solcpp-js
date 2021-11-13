[![CircleCI](https://img.shields.io/circleci/project/github/ethereum/solc-js/master.svg?style=flat-square)](https://circleci.com/gh/ethereum/solc-js/tree/master)
[![Coverage Status](https://img.shields.io/coveralls/ethereum/solc-js.svg?style=flat-square)](https://coveralls.io/r/ethereum/solc-js)

# solc-js

JavaScript bindings for the [Solidity compiler](https://github.com/ethereum/solidity).

Uses the Emscripten compiled Solidity found in the [solc-bin repository](https://github.com/ethereum/solc-bin).

## Node.js Usage

To use the latest stable version of the Solidity compiler via Node.js you can install it via npm:

```bash
npm install solc
```

### Usage on the Command-Line

If this package is installed globally (`npm install -g solc`), a command-line tool called `solcjs` will be available.

To see all the supported features, execute:

```bash
solcjs --help
```

To compile a contract that imports other contracts via relative paths:
```bash
solcjs --bin --include-path node_modules/ --base-path . MainContract.sol
```
Use the ``--base-path`` and ``--include-path`` options to describe the layout of your project.
``--base-path`` represents the root of your own source tree while ``--include-path`` allows you to
specify extra locations containing external code (e.g. libraries installed with a package manager).

Note: ensure that all the files you specify on the command line are located inside the base path or
one of the include paths.
The compiler refers to files from outside of these directories using absolute paths.
Having absolute paths in contract metadata will result in your bytecode being reproducible only
when it's placed in these exact absolute locations.

Note: this commandline interface is not compatible with `solc` provided by the Solidity compiler package and thus cannot be
used in combination with an Ethereum client via the `eth.compile.solidity()` RPC method. Please refer to the
[Solidity compiler documentation](https://solidity.readthedocs.io/) for instructions to install `solc`.
Furthermore, the commandline interface to solc-js provides fewer features than the binary release.

### Usage in Projects

There are two ways to use `solc`:

1. Through a high-level API giving a uniform interface to all compiler versions
2. Through a low-level API giving access to all the compiler interfaces, which depend on the version of the compiler

#### High-level API

The high-level API consists of a single method, `compile`, which expects the [Compiler Standard Input and Output JSON](https://solidity.readthedocs.io/en/v0.5.0/using-the-compiler.html#compiler-input-and-output-json-description).

It also accepts an optional set of callback functions, which include the ``import`` and the ``smtSolver`` callbacks.
Starting 0.6.0 it only accepts an object in place of the callback to supply the callbacks.

The ``import`` callback function is used to resolve unmet dependencies.
This callback receives a path and must synchronously return either an error or the content of the dependency
as a string.  It cannot be used together with callback-based, asynchronous,
filesystem access. A workaround is to collect the names of dependencies, return
an error, and keep re-running the compiler until all of them are resolved.

#### Example usage without the import callback

Example:

```javascript
var solc = require('solc');

var input = {
  language: 'Solidity',
  sources: {
    'test.sol': {
      content: 'contract C { function f() public { } }'
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

var output = JSON.parse(solc.compile(JSON.stringify(input)));

// `output` here contains the JSON output as specified in the documentation
for (var contractName in output.contracts['test.sol']) {
  console.log(
    contractName +
      ': ' +
      output.contracts['test.sol'][contractName].evm.bytecode.object
  );
}
```

#### Example usage with import callback

```javascript
var solc = require('solc');

var input = {
  language: 'Solidity',
  sources: {
    'test.sol': {
      content: 'import "lib.sol"; contract C { function f() public { L.f(); } }'
    }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['*']
      }
    }
  }
};

function findImports(path) {
  if (path === 'lib.sol')
    return {
      contents:
        'library L { function f() internal returns (uint) { return 7; } }'
    };
  else return { error: 'File not found' };
}

// New syntax (supported from 0.5.12, mandatory from 0.6.0)
var output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports })
);

// `output` here contains the JSON output as specified in the documentation
for (var contractName in output.contracts['test.sol']) {
  console.log(
    contractName +
      ': ' +
      output.contracts['test.sol'][contractName].evm.bytecode.object
  );
}
```

The ``smtSolver`` callback function is used to solve SMT queries generated by
Solidity's SMTChecker.  If you have an SMT solver installed locally, it can
be used to solve the given queries, where the callback must synchronously
return either an error or the result from the solver.  A default
``smtSolver`` callback is distributed by ``solc-js``, which relies on either
Z3 or CVC4 being installed locally.

#### Example usage with smtSolver callback

```javascript
var solc = require('solc');
var smt = require('smtsolver');
// Note that this example only works via node and not in the browser.

var input = {
  language: 'Solidity',
  sources: {
    'test.sol': {
      content: 'pragma experimental SMTChecker; contract C { function f(uint x) public { assert(x > 0); } }'
    }
  }
};

var output = JSON.parse(
  solc.compile(JSON.stringify(input), { smtSolver: smt.smtSolver })
);

```
The assertion is clearly false, and an ``assertion failure`` warning
should be returned.

#### Low-level API

The low-level API is as follows:

- `solc.lowlevel.compileSingle`: the original entry point, supports only a single file
- `solc.lowlevel.compileMulti`: this supports multiple files, introduced in 0.1.6
- `solc.lowlevel.compileCallback`: this supports callbacks, introduced in 0.2.1
- `solc.lowlevel.compileStandard`: this works just like `compile` above, but is only present in compilers after (and including) 0.4.11

For examples how to use them, please refer to the README of the above mentioned solc-js releases.

### Using with Electron

**Note:**
If you are using Electron, `nodeIntegration` is on for `BrowserWindow` by default. If it is on, Electron will provide a `require` method which will not behave as expected and this may cause calls, such as `require('solc')`, to fail.

To turn off `nodeIntegration`, use the following:

```javascript
new BrowserWindow({
  webPreferences: {
    nodeIntegration: false
  }
});
```

### Using a Legacy Version

In order to compile contracts using a specific version of Solidity, the `solc.loadRemoteVersion(version, callback)` method is available. This returns a new `solc` object that uses a version of the compiler specified.

You can also load the "binary" manually and use `setupMethods` to create the familiar wrapper functions described above:
`var solc = solc.setupMethods(require("/my/local/soljson.js"))`.

### Using the Latest Development Snapshot

By default, the npm version is only created for releases. This prevents people from deploying contracts with non-release versions because they are less stable and harder to verify. If you would like to use the latest development snapshot (at your own risk!), you may use the following example code.

```javascript
var solc = require('solc');

// getting the development snapshot
solc.loadRemoteVersion('latest', function(err, solcSnapshot) {
  if (err) {
    // An error was encountered, display and quit
  } else {
    // NOTE: Use `solcSnapshot` here with the same interface `solc` has
  }
});
```

### Linking Bytecode

When using libraries, the resulting bytecode will contain placeholders for the real addresses of the referenced libraries. These have to be updated, via a process called linking, before deploying the contract.

The `linker` module (`require('solc/linker')`) offers helpers to accomplish this.

The `linkBytecode` method provides a simple helper for linking:

```javascript
var linker = require('solc/linker');

bytecode = linker.linkBytecode(bytecode, { MyLibrary: '0x123456...' });
```

As of Solidity 0.4.11 the compiler supports [standard JSON input and output](https://solidity.readthedocs.io/en/develop/using-the-compiler.html#compiler-input-and-output-json-description) which outputs a _link references_ map. This gives a map of library names to offsets in the bytecode to replace the addresses at. It also doesn't have the limitation on library file and contract name lengths.

There is a method available in the `linker` module called `findLinkReferences` which can find such link references in bytecode produced by an older compiler:

```javascript
var linker = require('solc/linker');

var linkReferences = linker.findLinkReferences(bytecode);
```

### Updating the ABI

The ABI generated by Solidity versions can differ slightly, due to new features introduced. There is a tool included which aims to translate the ABI generated by an older Solidity version to conform to the latest standard.

It can be used as:

```javascript
var abi = require('solc/abi');

var inputABI = [
  {
    constant: false,
    inputs: [],
    name: 'hello',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    type: 'function'
  }
];
var outputABI = abi.update('0.3.6', inputABI);
// Output contains: [{"constant":false,"inputs":[],"name":"hello","outputs":[{"name":"","type":"string"}],"payable":true,"type":"function"},{"type":"fallback","payable":true}]
```

### Formatting old JSON assembly output

There is a helper available to format old JSON assembly output into a text familiar to earlier users of Remix IDE.

```
var translate = require('solc/translate')

// assemblyJSON refers to the JSON of the given assembly and sourceCode is the source of which the assembly was generated from
var output = translate.prettyPrintLegacyAssemblyJSON(assemblyJSON, sourceCode)
```

## Browser Usage

Add the version of `solc` you want to use into `index.html`:

```html
<script
  type="text/javascript"
  src="https://solc-bin.ethereum.org/bin/{{ SOLC VERSION }}.js"
></script>
```

(Alternatively use `https://solc-bin.ethereum.org/bin/soljson-latest.js` to get the latests version.)

This will load `solc` into the global variable `window.Module`. Then use this inside Javascript as:

```javascript
var wrapper = require('solc/wrapper');
var solc = wrapper(window.Module);
```

Or in ES6 syntax:

```javascript
import * as wrapper from 'solc/wrapper';
const solc = wrapper(window.Module);
```

Alternatively, to iterate the releases, one can load `list.js` from `solc-bin`:

```html
<script
  type="text/javascript"
  src="https://solc-bin.ethereum.org/bin/list.js"
></script>
```

This will result in two global variables, `window.soljsonReleases` listing all releases and `window.soljsonSources` listing all nightly builds and releases.
