import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      include: [/\.[jt]sx?(\?.*)?$/], // allows .js, .jsx, .ts, .tsx
    }),
  ],
})