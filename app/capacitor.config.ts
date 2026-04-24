import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pagodeservicios.app',
  appName: 'Pago de Servicios',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // En desarrollo con "npx cap run android --livereload" usar:
    // url: 'http://TU_IP_LOCAL:5173',
    // cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#2563EB',
      showSpinner: false,
    },
  },
};

export default config;
