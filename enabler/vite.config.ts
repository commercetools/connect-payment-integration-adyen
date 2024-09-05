import { resolve } from 'path'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import path from 'path';

export default defineConfig({
  plugins: [
    cssInjectedByJsPlugin(),
  ],
  resolve: {
    alias: {
      '@adyen-css': path.resolve(__dirname, 'node_modules/@adyen/adyen-web/dist/es/adyen.css')
    }
  },
  build: {
    outDir: resolve(__dirname, 'public'),
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/main.ts'),
      
      name: 'Connector',
      formats: ['es','umd'],
      // the proper extensions will be added
      fileName: (format) => `connector-enabler.${format}.js`,
    },
  },
})
