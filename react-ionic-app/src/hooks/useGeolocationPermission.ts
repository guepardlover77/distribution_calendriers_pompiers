import { useEffect, useState } from 'react'
import { Geolocation, PermissionStatus } from '@capacitor/geolocation'

export const useGeolocationPermission = () => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAndRequestPermission = async (): Promise<boolean> => {
    try {
      console.log('[Geolocation] Checking permissions...')

      // Vérifier le statut actuel
      const status = await Geolocation.checkPermissions()
      console.log('[Geolocation] Current permission status:', status.location)
      setPermissionStatus(status)

      if (status.location === 'granted') {
        setIsLoading(false)
        return true
      }

      // Si la permission n'est pas accordée, toujours essayer de la demander
      // (sauf si elle a été définitivement refusée)
      if (status.location !== 'denied') {
        console.log('[Geolocation] Requesting permission...')
        const requestResult = await Geolocation.requestPermissions()
        console.log('[Geolocation] Permission request result:', requestResult.location)
        setPermissionStatus(requestResult)
        setIsLoading(false)
        return requestResult.location === 'granted'
      }

      // Permission refusée définitivement
      console.log('[Geolocation] Permission was denied')
      setIsLoading(false)
      return false
    } catch (error) {
      console.error('[Geolocation] Error checking/requesting permission:', error)
      setIsLoading(false)
      return false
    }
  }

  useEffect(() => {
    // Demander la permission au montage du composant
    checkAndRequestPermission()
  }, [])

  return {
    permissionStatus,
    isLoading,
    checkAndRequestPermission,
    isGranted: permissionStatus?.location === 'granted'
  }
}
