import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
   plugins: [react()],
   server: {
      host: '0.0.0.0',
      port: 5000,
      allowedHosts: true
   },
   resolve: {

      dedupe: ['react', 'react-dom'],
      alias: {
         '@': '/src/',
         '@pages': '/src/pages/',
         '@assets': '/src/assets/',
         '@components': '/src/components/',
         '@styles': '/src/assets/stylesheets/',
         '@utilities': '/src/utilities/',
         '@services': '/src/services/',
         '@hooks': '/src/hooks/',
         '@images': '/src/assets/images/'
      }
   },
   build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
         output: {
            manualChunks(id){
               if(!id.includes('node_modules')) return;

               if(id.includes('@xterm') || id.includes('xterm')) return 'xterm';
               if(id.includes('three') || id.includes('@react-three')) return 'three';
               if(id.includes('gsap')) return 'gsap';

               return 'vendor';
            }
         }
      }
   },
});