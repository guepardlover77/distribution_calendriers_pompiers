import { SessionData, Distribution } from '@/services/storage'

// Coordonnées centrales : Cherveux, Deux-Sèvres (79410)
const CENTER_LAT = 46.3833
const CENTER_LNG = -0.2167

// Utilisateur démo (admin)
export const DEMO_USER: SessionData = {
  id: 'demo-user',
  username: 'demo',
  binome_name: 'Utilisateur Démo',
  assigned_zone: 'Cherveux Centre',
  is_admin: true,
  sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

// Interface Binome pour le mode démo (compatible avec Binome du store)
export interface DemoBinome {
  Id: string
  id: string
  username: string
  password: string
  binome_name: string
  assigned_zone: string
  is_admin: boolean | number | string
  last_login?: string
}

// Interface Zone pour le mode démo
export interface DemoZone {
  Id: string
  id: string
  name: string
  color: string
  binome_id?: string
  binome_name?: string
  geojson: string
}

// Binômes de démonstration
export const DEMO_BINOMES: DemoBinome[] = [
  {
    Id: 'demo-binome-1',
    id: 'demo-binome-1',
    username: 'demo',
    password: '***',
    binome_name: 'Utilisateur Démo',
    assigned_zone: 'Cherveux Centre',
    is_admin: true,
    last_login: new Date().toISOString()
  },
  {
    Id: 'demo-binome-2',
    id: 'demo-binome-2',
    username: 'jean.martin',
    password: '***',
    binome_name: 'Jean Martin',
    assigned_zone: 'Cherveux Nord',
    is_admin: false,
    last_login: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    Id: 'demo-binome-3',
    id: 'demo-binome-3',
    username: 'marie.dupont',
    password: '***',
    binome_name: 'Marie Dupont',
    assigned_zone: 'Cherveux Sud',
    is_admin: false,
    last_login: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    Id: 'demo-binome-4',
    id: 'demo-binome-4',
    username: 'pierre.bernard',
    password: '***',
    binome_name: 'Pierre Bernard',
    assigned_zone: '',
    is_admin: false
  }
]

// Zones de démonstration avec GeoJSON
export const DEMO_ZONES: DemoZone[] = [
  {
    Id: 'demo-zone-1',
    id: 'demo-zone-1',
    name: 'Cherveux Centre',
    color: '#10b981',
    binome_id: 'demo',
    binome_name: 'Utilisateur Démo',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [CENTER_LNG - 0.01, CENTER_LAT - 0.01],
        [CENTER_LNG + 0.01, CENTER_LAT - 0.01],
        [CENTER_LNG + 0.01, CENTER_LAT + 0.01],
        [CENTER_LNG - 0.01, CENTER_LAT + 0.01],
        [CENTER_LNG - 0.01, CENTER_LAT - 0.01]
      ]]
    })
  },
  {
    Id: 'demo-zone-2',
    id: 'demo-zone-2',
    name: 'Cherveux Nord',
    color: '#3b82f6',
    binome_id: 'jean.martin',
    binome_name: 'Jean Martin',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [CENTER_LNG - 0.02, CENTER_LAT + 0.01],
        [CENTER_LNG + 0.02, CENTER_LAT + 0.01],
        [CENTER_LNG + 0.02, CENTER_LAT + 0.03],
        [CENTER_LNG - 0.02, CENTER_LAT + 0.03],
        [CENTER_LNG - 0.02, CENTER_LAT + 0.01]
      ]]
    })
  },
  {
    Id: 'demo-zone-3',
    id: 'demo-zone-3',
    name: 'Cherveux Sud',
    color: '#ef4444',
    binome_id: 'marie.dupont',
    binome_name: 'Marie Dupont',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [CENTER_LNG - 0.02, CENTER_LAT - 0.03],
        [CENTER_LNG + 0.02, CENTER_LAT - 0.03],
        [CENTER_LNG + 0.02, CENTER_LAT - 0.01],
        [CENTER_LNG - 0.02, CENTER_LAT - 0.01],
        [CENTER_LNG - 0.02, CENTER_LAT - 0.03]
      ]]
    })
  },
  {
    Id: 'demo-zone-4',
    id: 'demo-zone-4',
    name: 'Cherveux Est',
    color: '#f59e0b',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [CENTER_LNG + 0.01, CENTER_LAT - 0.01],
        [CENTER_LNG + 0.03, CENTER_LAT - 0.01],
        [CENTER_LNG + 0.03, CENTER_LAT + 0.01],
        [CENTER_LNG + 0.01, CENTER_LAT + 0.01],
        [CENTER_LNG + 0.01, CENTER_LAT - 0.01]
      ]]
    })
  },
  {
    Id: 'demo-zone-5',
    id: 'demo-zone-5',
    name: 'Cherveux Ouest',
    color: '#8b5cf6',
    geojson: JSON.stringify({
      type: 'Polygon',
      coordinates: [[
        [CENTER_LNG - 0.03, CENTER_LAT - 0.01],
        [CENTER_LNG - 0.01, CENTER_LAT - 0.01],
        [CENTER_LNG - 0.01, CENTER_LAT + 0.01],
        [CENTER_LNG - 0.03, CENTER_LAT + 0.01],
        [CENTER_LNG - 0.03, CENTER_LAT - 0.01]
      ]]
    })
  }
]

// Adresses fictives réalistes pour Cherveux et environs
const DEMO_ADDRESSES = [
  '1 Rue de la Mairie, 79410 Cherveux',
  '3 Place de l\'Église, 79410 Cherveux',
  '5 Rue du Château, 79410 Cherveux',
  '7 Chemin des Vignes, 79410 Cherveux',
  '12 Route de Niort, 79410 Cherveux',
  '15 Rue des Jardins, 79410 Cherveux',
  '18 Allée des Tilleuls, 79410 Cherveux',
  '22 Rue de la Fontaine, 79410 Cherveux',
  '25 Impasse du Moulin, 79410 Cherveux',
  '28 Rue du Commerce, 79410 Cherveux',
  '31 Route de Saint-Maixent, 79410 Cherveux',
  '34 Chemin de la Croix, 79410 Cherveux',
  '37 Rue des Écoles, 79410 Cherveux',
  '40 Place du Marché, 79410 Cherveux',
  '43 Rue de la Gare, 79410 Cherveux',
  '46 Allée des Chênes, 79410 Cherveux',
  '49 Rue du Lavoir, 79410 Cherveux',
  '52 Chemin des Prés, 79410 Cherveux',
  '55 Route de Parthenay, 79410 Cherveux',
  '58 Rue de la Liberté, 79410 Cherveux'
]

// Noms de destinataires fictifs
const DEMO_NAMES = [
  'M. Durand',
  'Mme Lefebvre',
  'M. et Mme Moreau',
  'Famille Petit',
  'M. Roux',
  'Mme Garcia',
  'M. Thomas',
  'Mme Robert',
  'Famille Leroy',
  'M. Simon',
  'Mme Michel',
  'M. Laurent',
  'Mme Richard',
  'M. Bertrand',
  'Mme David',
  'Famille Morel',
  'M. Fournier',
  'Mme Girard',
  'M. Bonnet',
  'Mme Lambert'
]

// Notes de démonstration
const DEMO_NOTES = [
  'Très sympathique, a demandé 2 calendriers',
  'Pas de réponse malgré voiture dans l\'allée',
  'A donné pour les voisins absents',
  'Revenir après 18h',
  'Sonnette en panne, frapper à la porte',
  'Chien dans le jardin, attention',
  '',
  'Personnes âgées très accueillantes',
  'A payé par chèque, nom sur le chèque différent',
  ''
]

// Générer une position aléatoire autour du centre
function randomPosition(): { lat: number; lng: number } {
  const latOffset = (Math.random() - 0.5) * 0.04
  const lngOffset = (Math.random() - 0.5) * 0.04
  return {
    lat: CENTER_LAT + latOffset,
    lng: CENTER_LNG + lngOffset
  }
}

// Générer les distributions de démonstration
function generateDemoDistributions(): Distribution[] {
  const distributions: Distribution[] = []
  const statuses: Array<'effectue' | 'repasser' | 'refus' | 'maison_vide'> = [
    'effectue', 'effectue', 'effectue', 'effectue', 'effectue', 'effectue', 'effectue', 'effectue',
    'repasser', 'repasser', 'repasser', 'repasser', 'repasser',
    'refus', 'refus', 'refus',
    'maison_vide', 'maison_vide', 'maison_vide', 'maison_vide'
  ]
  const paymentMethods = ['espece', 'cheque', 'cb', 'virement']
  const binomes = ['demo', 'jean.martin', 'marie.dupont']

  for (let i = 0; i < 20; i++) {
    const status = statuses[i]
    const position = randomPosition()
    const amount = status === 'effectue' ? Math.floor(Math.random() * 26) + 5 : 0
    const paymentMethod = status === 'effectue' && amount > 0
      ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
      : undefined

    const createdDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)

    distributions.push({
      id: `demo-dist-${i + 1}`,
      address: DEMO_ADDRESSES[i],
      lat: position.lat,
      lng: position.lng,
      status,
      amount,
      payment_method: paymentMethod,
      notes: DEMO_NOTES[i % DEMO_NOTES.length] || undefined,
      binome_id: binomes[Math.floor(Math.random() * binomes.length)],
      recipient_name: DEMO_NAMES[i],
      createdAt: createdDate.toISOString(),
      updatedAt: createdDate.toISOString()
    })
  }

  return distributions
}

export const DEMO_DISTRIBUTIONS: Distribution[] = generateDemoDistributions()
