import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pompiers.calendriers',
  appName: 'Calendriers Pompiers',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'db.cam137.org',
      '*.openstreetmap.org',
      'unpkg.com',
      'cdnjs.cloudflare.com',
      'cdn.jsdelivr.net',
      'api-adresse.data.gouv.fr'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3b82f6',
      showSpinner: true,
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#3b82f6'
    }
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  }
}

export default config
