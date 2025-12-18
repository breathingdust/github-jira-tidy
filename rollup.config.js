// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const config = {
  input: 'src/index.js',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  external: [/^node:/, '@actions/core', '@octokit/action', 'node-fetch'],
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true })]
}

export default config
