import { useEffect, useState } from 'react'
import { Geolocation, PermissionStatus } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'

export const useGeolocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAndRequestPermission = async (): Promise<boolean> => {
    try {
      const platform = Capacitor.getPlatform()
      const isNative = Capacitor.isNativePlatform()
      console.log('[Geolocation] Platform:', platform, 'isNative:', isNative)

      // Vérifier le statut actuel
      console.log('[Geolocation] Checking permissions...')
      const status = await Geolocation.checkPermissions()
      console.log('[Geolocation] Current permission status:', status.location, 'coarseLocation:', status.coarseLocation)
      setPermissionStatus(status)

      if (status.location === 'granted') {
        console.log('[Geolocation] Permission already granted')
        setIsLoading(false)
        return true
      }

      // Si la permission n'est pas accordée, toujours essayer de la demander
      // (sauf si elle a été définitivement refusée)
      if (status.location !== 'denied') {
        console.log('[Geolocation] Requesting permission...')
        const requestResult = await Geolocation.requestPermissions()
        console.log('[Geolocation] Permission request result:', requestResult.location, 'coarseLocation:', requestResult.coarseLocation)
        setPermissionStatus(requestResult)
        setIsLoading(false)
        return requestResult.location === 'granted'
      }

      // Permission refusée définitivement
      console.log('[Geolocation] Permission was denied permanently')
      setIsLoading(false)
      return false
    } catch (error) {
      console.error('[Geolocation] Error checking/requesting permission:', error)
      setIsLoading(false)
      return false
    }
  }

  useEffect(() => {
    // Attendre un court instant pour que Capacitor soit prêt
    const timer = setTimeout(() => {
      console.log('[Geolocation] Starting permission check...')
      checkAndRequestPermission()
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  return {
    permissionStatus,
    isLoading,
    checkAndRequestPermission,
    isGranted: permissionStatus?.location === 'granted'
  }
}
