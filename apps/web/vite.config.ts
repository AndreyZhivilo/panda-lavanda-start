import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      router: {
        // All paths below are resolved relative to `srcDirectory` (./src),
        // which start-plugin joins for us, so no leading `src/` here.
        entry: './app/router',
        routesDirectory: './app/routes',
        generatedRouteTree: './app/routes/routeTree.gen.ts',
        // The generated route tree lives inside routesDirectory; tell the
        // generator to ignore it so it isn't treated as a route file.
        routeFileIgnorePattern: 'routeTree\\.gen',
      },
    }),
    viteReact(),
  ],
})

export default config
