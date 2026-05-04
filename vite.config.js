import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      output: {
        // No manualChunks for `markdown` / `dnd` — those packages
        // are now reached only through lazy() dynamic imports
        // (MarkdownPreviewLazy, SortableListDnd, SectionToggleListDnd).
        // Letting Rollup auto-split at the lazy boundary lets Vite
        // recognise them as truly on-demand and skip the modulepreload
        // hint, so the bytes don't download until they're first
        // rendered (typically never on the eager Editor paint, since
        // analysts rarely toggle "Preview" on a markdown field).
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
