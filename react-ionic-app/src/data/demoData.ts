import { Distribution } from '@/services/storage'

// Coordonnees autour de Paris pour la demo
const DEMO_DISTRIBUTIONS: Distribution[] = [
  {
    id: 'demo-1',
    address: '12 Rue de la Paix, 75002 Paris',
    lat: 48.8698,
    lng: 2.3308,
    status: 'effectue',
    amount: 15,
    payment_method: 'especes',
    notes: 'Tres gentil, a demande un calendrier supplementaire',
    binome_id: 'demo',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-2',
    address: '45 Avenue des Champs-Elysees, 75008 Paris',
    lat: 48.8714,
    lng: 2.3056,
    status: 'effectue',
    amount: 20,
    payment_method: 'cheque',
    notes: '',
    binome_id: 'demo',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-3',
    address: '8 Place de la Concorde, 75008 Paris',
    lat: 48.8656,
    lng: 2.3212,
    status: 'effectue',
    amount: 10,
    payment_method: 'especes',
    notes: 'Habitue, donne chaque annee',
    binome_id: 'demo',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-4',
    address: '1 Rue de Rivoli, 75001 Paris',
    lat: 48.8606,
    lng: 2.3376,
    status: 'repasser',
    amount: 0,
    payment_method: undefined,
    notes: 'Absent, repasser en soiree',
    binome_id: 'demo',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-5',
    address: '25 Boulevard Haussmann, 75009 Paris',
    lat: 48.8738,
    lng: 2.3316,
    status: 'refus',
    amount: 0,
    payment_method: undefined,
    notes: 'Ne souhaite pas de calendrier',
    binome_id: 'demo',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'demo-6',
    address: '33 Rue du Faubourg Saint-Honore, 75008 Paris',
    lat: 48.8704,
    lng: 2.3171,
    status: 'effectue',
    amount: 25,
    payment_method: 'especes',
    notes: 'Genereux donateur',
    binome_id: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-7',
    address: '18 Rue de la Boetie, 75008 Paris',
    lat: 48.8729,
    lng: 2.3099,
    status: 'maison_vide',
    amount: 0,
    payment_method: undefined,
    notes: 'Maison apparemment inoccupee',
    binome_id: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-8',
    address: '56 Avenue Montaigne, 75008 Paris',
    lat: 48.8664,
    lng: 2.3044,
    status: 'effectue',
    amount: 30,
    payment_method: 'cheque',
    notes: '',
    binome_id: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-9',
    address: '72 Rue de Courcelles, 75008 Paris',
    lat: 48.8795,
    lng: 2.3042,
    status: 'repasser',
    amount: 0,
    payment_method: undefined,
    notes: 'Demande de repasser samedi matin',
    binome_id: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'demo-10',
    address: '14 Rue Marbeuf, 75008 Paris',
    lat: 48.8695,
    lng: 2.3024,
    status: 'effectue',
    amount: 15,
    payment_method: 'especes',
    notes: '',
    binome_id: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

// Zones de demo
export const DEMO_ZONES = [
  {
    Id: 'demo-zone-1',
    id: 'demo-zone-1',
    name: 'Secteur Champs-Elysees',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [2.295, 48.862],
        [2.295, 48.878],
        [2.320, 48.878],
        [2.320, 48.862],
        [2.295, 48.862]
      ]]
    }),
    color: '#10b981',
    binome_id: 'demo',
    binome_name: 'Equipe Demo'
  },
  {
    Id: 'demo-zone-2',
    id: 'demo-zone-2',
    name: 'Secteur Opera',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [2.325, 48.865],
        [2.325, 48.876],
        [2.345, 48.876],
        [2.345, 48.865],
        [2.325, 48.865]
      ]]
    }),
    color: '#3b82f6',
    binome_id: 'demo',
    binome_name: 'Equipe Demo'
  }
]

export { DEMO_DISTRIBUTIONS }
