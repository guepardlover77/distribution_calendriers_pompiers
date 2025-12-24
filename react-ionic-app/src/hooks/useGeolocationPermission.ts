import { useEffect, useState } from 'react'
import { Geolocation, PermissionStatus } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'

export const useGeolocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAndRequestPermission = async (): Promise<boolean> => {
    // Sur le web, la permission est demandée automatiquement lors de l'utilisation
    if (!Capacitor.isNativePlatform()) {
      setIsLoading(false)
      return true
    }

    try {
      // Vérifier le statut actuel
      const status = await Geolocation.checkPermissions()
      console.log('[Geolocation] Current permission status:', status.location)
      setPermissionStatus(status)

      if (status.location === 'granted') {
        setIsLoading(false)
        return true
      }

      // Si la permission n'est pas accordée, la demander
      if (status.location === 'prompt' || status.location === 'prompt-with-rationale') {
        console.log('[Geolocation] Requesting permission...')
        const requestResult = await Geolocation.requestPermissions()
        console.log('[Geolocation] Permission request result:', requestResult.location)
        setPermissionStatus(requestResult)
        setIsLoading(false)
        return requestResult.location === 'granted'
      }

      // Permission refusée
      setIsLoading(false)
      return false
    } catch (error) {
      console.error('[Geolocation] Error checking/requesting permission:', error)
      setIsLoading(false)
      return false
    }
  }

  useEffect(() => {
    checkAndRequestPermission()
  }, [])

  return {
    permissionStatus,
    isLoading,
    checkAndRequestPermission,
    isGranted: permissionStatus?.location === 'granted'
  }
}
