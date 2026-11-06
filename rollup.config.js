// See: https://rollupjs.org/introduction/

import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const config = {
  input: 'src/index.js',
  output: {
    esModule: true,
    dir: './dist',
    format: 'es',
    sourcemap: true
  },
  // Node built-ins loaded lazily by dependencies (e.g. undici) must stay external.
  external: ['node:sqlite'],
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true })],
  onwarn(warning, warn) {
    // Ignore circular dependencies inside third-party packages (e.g. @actions/core).
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' &&
      warning.ids?.every((id) => id.includes('node_modules'))
    ) {
      return
    }
    warn(warning)
  }
}

export default config
