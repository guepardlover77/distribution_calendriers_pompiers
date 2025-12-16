// Application de carte interactive avec OpenStreetMap

/**
 * Authentication Manager
 * Handles login, logout, and session management for firefighter teams
 */
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionKey = 'pompiers_session';
    }

    /**
     * Initialize authentication system
     * Returns true if user is already logged in, false otherwise
     */
    init() {
        const savedSession = sessionStorage.getItem(this.sessionKey);
        if (savedSession) {
            try {
                this.currentUser = JSON.parse(savedSession);
                return true;
            } catch (e) {
                console.error('Invalid session data:', e);
                sessionStorage.removeItem(this.sessionKey);
            }
        }
        return false;
    }

    /**
     * Authenticate user against NocoDB Binomes table
     */
    async login(username, password) {
        if (!NOCODB_CONFIG?.baseUrl || !NOCODB_CONFIG?.apiToken) {
            throw new Error('Configuration NocoDB manquante');
        }

        try {
            // Get project ID
            const projectsResponse = await fetch(
                `${NOCODB_CONFIG.baseUrl}/api/v1/db/meta/projects/`,
                {
                    method: 'GET',
                    headers: { 'xc-token': NOCODB_CONFIG.apiToken }
                }
            );

            if (!projectsResponse.ok) {
                throw new Error('Impossible de se connecter à la base de données');
            }

            const projects = await projectsResponse.json();
            const projectId = NOCODB_CONFIG.projectId || projects.list?.[0]?.id;

            if (!projectId) {
                throw new Error('Aucun projet trouvé');
            }

            // Get Binomes table
            const tablesResponse = await fetch(
                `${NOCODB_CONFIG.baseUrl}/api/v1/db/meta/projects/${projectId}/tables`,
                {
                    method: 'GET',
                    headers: { 'xc-token': NOCODB_CONFIG.apiToken }
                }
            );

            const tables = await tablesResponse.json();
            const binomesTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.binomes);

            if (!binomesTable) {
                throw new Error('Table Binomes introuvable. Veuillez créer la table dans NocoDB.');
            }

            // Query for user
            const userResponse = await fetch(
                `${NOCODB_CONFIG.baseUrl}/api/v1/db/data/noco/${projectId}/${binomesTable.title}?where=(username,eq,${encodeURIComponent(username)})`,
                {
                    method: 'GET',
                    headers: { 'xc-token': NOCODB_CONFIG.apiToken }
                }
            );

            if (!userResponse.ok) {
                throw new Error('Erreur lors de la recherche utilisateur');
            }

            const userData = await userResponse.json();
            const user = userData.list?.[0];

            // Validate credentials
            if (!user) {
                throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
            }

            if (user.password !== password) {
                throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
            }

            // Update last_login
            const nocoId = user.Id || user.id;
            await fetch(
                `${NOCODB_CONFIG.baseUrl}/api/v1/db/data/noco/${projectId}/${binomesTable.title}/${nocoId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'xc-token': NOCODB_CONFIG.apiToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        last_login: new Date().toISOString()
                    })
                }
            );

            // Store session
            this.currentUser = {
                id: nocoId,
                username: user.username,
                binome_name: user.binome_name,
                assigned_zone: user.assigned_zone,
                is_admin: user.is_admin || false
            };

            sessionStorage.setItem(this.sessionKey, JSON.stringify(this.currentUser));

            console.log(`[AUTH] User logged in: ${this.currentUser.binome_name}`);
            return this.currentUser;

        } catch (error) {
            console.error('[AUTH] Login error:', error);
            throw error;
        }
    }

    /**
     * Logout current user
     */
    logout() {
        console.log(`[AUTH] User logged out: ${this.currentUser?.binome_name}`);
        this.currentUser = null;
        sessionStorage.removeItem(this.sessionKey);
    }

    /**
     * Get current logged-in user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if current user is admin
     * Accepte à la fois les booléens (true) et les nombres (1) de NocoDB
     */
    isAdmin() {
        return this.currentUser?.is_admin === true || this.currentUser?.is_admin === 1;
    }

    /**
     * Get assigned zone for current user
     */
    getAssignedZone() {
        return this.currentUser?.assigned_zone;
    }

    /**
     * Check if user can access a distribution
     */
    canAccessDistribution(distribution) {
        if (this.isAdmin()) {
            return true; // Admin sees everything
        }

        // Regular user can only see their own distributions
        return distribution.binome_id === this.currentUser?.username;
    }

    /**
     * Check if user can access a zone
     */
    canAccessZone(zone) {
        if (this.isAdmin()) {
            return true; // Admin sees everything
        }

        // Regular user can only see their assigned zone
        // Zone IDs should match the assigned_zone in the user record
        return zone.id === this.currentUser?.assigned_zone ||
               zone.name === this.currentUser?.assigned_zone;
    }
}

class MapApplication {
    constructor() {
        // Authentication manager (must be first)
        this.auth = new AuthManager();

        this.map = null;
        this.drawnItems = null;
        this.userMarker = null;
        this.accuracyCircle = null;
        this.watchId = null;
        this.zones = [];
        this.addressMarker = null;
        this.searchTimeout = null;
        this.citySearchTimeout = null;
        this.selectedResultIndex = -1;
        this.selectedCity = null;
        this.lastSelectedCity = null; // Mémoriser la dernière ville pour la réutiliser
        this.distributions = [];
        this.distributionMarkers = {};
        this.editingDistributionId = null;

        // Gestion des zones
        this.nextZoneId = 1; // Compteur pour numérotation auto des zones
        this.editingZoneLayer = null; // Zone en cours d'édition dans le modal
        this.binomes = []; // Liste des binômes disponibles pour assignation
        this.selectedBinome = null; // Binôme sélectionné pour la zone en cours

        // Système de filtres unifié
        this.filters = {
            status: 'all',       // 'all' | 'effectue' | 'repasser' | 'refus'
            searchQuery: '',     // Recherche texte
            dateFrom: null,      // Date début
            dateTo: null,        // Date fin
            payment: 'all',      // 'all' | 'espece' | 'cheque' | 'unspecified'
            binome: 'all',       // 'all' | username du binôme
            zone: null           // null | zone ID
        };
        this.activeFiltersCount = 0; // Compteur de filtres actifs
        this.filterDebounceTimeout = null; // Pour debounce de la recherche
        this.charts = {
            status: null,
            amount: null,
            payment: null,
            timeline: null
        };

        // NocoDB properties
        this.nocoDBReady = false;
        this.syncInProgress = false;
        this.lastSyncTime = null;

        // Performance optimization
        this.syncTimeout = null;
        this.pendingSync = false;

        this.init();
    }

    init() {
        // Check authentication first
        if (!this.auth.init()) {
            // User not logged in - show login screen
            this.showLoginScreen();
            return; // Stop initialization until user logs in
        }

        // User is logged in - proceed with normal initialization
        this.showMainApp();
        this.initMap();

        // Délai pour s'assurer que tout est bien initialisé avant les contrôles de dessin
        setTimeout(() => {
            this.initDrawControls();
        }, 100);

        this.initCitySearch();
        this.initAddressSearch();
        this.initDistributions();
        this.initTabs();
        this.initEventListeners();
        this.initOfflineMode(); // Initialize offline mode detection
        this.initNocoDBConnection(); // Initialize NocoDB integration
        this.fetchBinomes(); // Fetch binômes for zone assignment
        this.loadZonesFromStorage();
        this.loadDistributions();

        // Initialiser les icônes Lucide (avec délai pour s'assurer que le DOM est prêt)
        setTimeout(() => this.initLucideIcons(), 100);
    }

    /**
     * Show login screen
     */
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');

        if (loginScreen) {
            loginScreen.style.display = 'flex';
        }
        if (mainApp) {
            mainApp.style.display = 'none';
        }

        // Setup login form handler
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLogin();
            });
        }
    }

    /**
     * Show main application
     */
    showMainApp() {
        const loginScreen = document.getElementById('login-screen');
        const mainApp = document.getElementById('main-app');

        if (loginScreen) {
            loginScreen.style.display = 'none';
        }
        if (mainApp) {
            mainApp.style.display = 'block';
        }

        // Update user display
        const userNameDisplay = document.getElementById('user-name-display');
        if (userNameDisplay && this.auth.currentUser) {
            userNameDisplay.textContent = this.auth.currentUser.binome_name;
        }

        // Setup logout handler
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }

    /**
     * Handle login form submission
     */
    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const submitBtn = document.querySelector('.btn-login');

        // Clear previous errors
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        // Disable submit button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion en cours...';
        }

        try {
            // Attempt login
            await this.auth.login(username, password);

            // Login successful - initialize app
            this.showMainApp();

            // Initialize the main application
            this.initMap();

            // Délai pour s'assurer que tout est bien initialisé avant les contrôles de dessin
            setTimeout(() => {
                this.initDrawControls();
            }, 100);

            this.initCitySearch();
            this.initAddressSearch();
            this.initDistributions();
            this.initTabs();
            this.initEventListeners();
            this.initOfflineMode();
            this.initNocoDBConnection();
            this.fetchBinomes();
            this.loadZonesFromStorage();
            this.loadDistributions();

            this.notifyUser(`Bienvenue ${this.auth.currentUser.binome_name}`, 'success');

        } catch (error) {
            // Show error
            if (errorDiv) {
                errorDiv.textContent = error.message || 'Erreur de connexion';
                errorDiv.style.display = 'block';
            }

            console.error('Login failed:', error);
        } finally {
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Se connecter';
            }
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
            this.auth.logout();

            // Clear any cached data
            this.distributions = [];
            this.zones = [];
            this.distributionMarkers = {};
            this.lastSelectedCity = null; // Effacer la ville mémorisée lors du changement d'utilisateur/secteur

            // Reload page to reset everything
            window.location.reload();
        }
    }

    // Initialiser les onglets
    initTabs() {
        const tabBtns = document.querySelectorAll('.bottom-nav-btn[data-tab]');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Initialiser les icônes Lucide
        this.initLucideIcons();
    }

    // Initialiser les icônes Lucide de manière robuste
    initLucideIcons() {
        const tryInitIcons = (attempts = 0) => {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                try {
                    lucide.createIcons();
                    console.log('Lucide icons initialized successfully');
                } catch (error) {
                    console.error('Error initializing Lucide icons:', error);
                }
            } else if (attempts < 10) {
                // Réessayer après 100ms si Lucide n'est pas encore chargé
                setTimeout(() => tryInitIcons(attempts + 1), 100);
            } else {
                console.warn('Lucide icons could not be loaded after multiple attempts');
            }
        };
        tryInitIcons();
    }

    // Basculer entre les onglets
    switchTab(tab) {
        // Mettre à jour les boutons de la bottom nav
        document.querySelectorAll('.bottom-nav-btn[data-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Mettre à jour le contenu
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-tab`);
        });

        // Si on ouvre l'onglet stats, mettre à jour les graphiques
        if (tab === 'stats') {
            setTimeout(() => {
                this.updateStatsDashboard();
            }, 100);
        }

        // Si on ouvre l'onglet liste, rafraîchir la liste
        if (tab === 'list') {
            setTimeout(() => {
                this.renderDistributionsList();
            }, 100);
        }

        // Si on revient à la carte, forcer le redimensionnement
        if (tab === 'map') {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }

    // Initialisation de la carte
    initMap() {
        // Centrer sur la France par défaut
        const defaultLat = 46.603354;
        const defaultLng = 1.888334;
        const defaultZoom = 6;

        // Créer la carte
        this.map = L.map('map').setView([defaultLat, defaultLng], defaultZoom);

        // Ajouter la couche OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            minZoom: 3
        }).addTo(this.map);

        // Initialiser le groupe pour les formes dessinées
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);

        console.log('Carte initialisée avec succès');
    }

    // Initialisation des contrôles de dessin
    initDrawControls() {
        // Vérifier si l'utilisateur est administrateur
        // Debug: afficher l'état de l'authentification
        console.log('[ZONES] Vérification admin - auth:', this.auth);
        console.log('[ZONES] currentUser:', this.auth?.currentUser);
        console.log('[ZONES] is_admin:', this.auth?.currentUser?.is_admin);

        if (!this.auth || !this.auth.currentUser) {
            console.log('[ZONES] Auth ou currentUser non défini, contrôles désactivés');
            return;
        }

        if (!this.auth.isAdmin()) {
            console.log('[ZONES] Contrôles de dessin désactivés pour utilisateur non-admin');
            return;
        }

        console.log('[ZONES] Initialisation des contrôles de dessin pour admin');

        const drawControl = new L.Control.Draw({
            position: 'topright',
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true,
                    drawError: {
                        color: '#e74c3c',
                        message: '<strong>Erreur:</strong> Les lignes ne peuvent pas se croiser!'
                    },
                    shapeOptions: {
                        color: '#3b82f6',
                        weight: 3,
                        fillOpacity: 0.2
                    }
                },
                polyline: false,
                circle: {
                    shapeOptions: {
                        color: '#10b981',
                        weight: 3,
                        fillOpacity: 0.2
                    }
                },
                rectangle: {
                    shapeOptions: {
                        color: '#f59e0b',
                        weight: 3,
                        fillOpacity: 0.2
                    }
                },
                marker: false,
                circlemarker: false
            },
            edit: {
                featureGroup: this.drawnItems,
                remove: true
            }
        });

        this.map.addControl(drawControl);

        // Événements de dessin
        this.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            const type = e.layerType;

            // Rendre la zone non-interactive
            layer.options.interactive = false;

            // Ajouter un popup avec des informations
            this.addLayerInfo(layer, type);

            this.drawnItems.addLayer(layer);

            // Ouvrir le modal pour configurer la nouvelle zone
            this.showZoneModal(layer, false);

            this.updateZonesCount();
        });

        this.map.on(L.Draw.Event.EDITED, (e) => {
            this.updateZonesFromLayers();
            this.saveZones();
            this.scheduleSyncWithNocoDB();
            this.notifyUser('Zones modifiées', 'info');
        });

        this.map.on(L.Draw.Event.DELETED, (e) => {
            this.updateZonesFromLayers();
            this.saveZones();
            this.scheduleSyncWithNocoDB();
            this.updateZonesCount();
            this.notifyUser('Zones supprimées', 'warning');
        });

        console.log('Contrôles de dessin initialisés');
    }

    // Initialisation de la recherche de ville
    initCitySearch() {
        const cityInput = document.getElementById('city-input');
        const cityResults = document.getElementById('city-results');
        const detectCityBtn = document.getElementById('detect-city-btn');

        if (!cityInput || !cityResults) return;

        // Événement de saisie avec debounce
        cityInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Effacer le timeout précédent
            if (this.citySearchTimeout) {
                clearTimeout(this.citySearchTimeout);
            }

            this.selectedResultIndex = -1;

            if (query.length < 2) {
                cityResults.classList.remove('active');
                return;
            }

            cityResults.innerHTML = '<div class="result-loading">Recherche en cours...</div>';
            cityResults.classList.add('active');

            // Debounce de 300ms
            this.citySearchTimeout = setTimeout(() => {
                this.searchCity(query);
            }, 300);
        });

        // Navigation au clavier
        cityInput.addEventListener('keydown', (e) => {
            const items = cityResults.querySelectorAll('.result-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedResultIndex = Math.min(this.selectedResultIndex + 1, items.length - 1);
                this.updateSelectedResult(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedResultIndex = Math.max(this.selectedResultIndex - 1, -1);
                this.updateSelectedResult(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedResultIndex >= 0 && items[this.selectedResultIndex]) {
                    items[this.selectedResultIndex].click();
                }
            } else if (e.key === 'Escape') {
                cityResults.classList.remove('active');
            }
        });

        // Bouton de détection automatique
        if (detectCityBtn) {
            detectCityBtn.addEventListener('click', () => {
                this.detectCity();
            });
        }

        // Fermer les résultats en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!cityInput.contains(e.target) && !cityResults.contains(e.target)) {
                cityResults.classList.remove('active');
            }
        });

        console.log('Recherche de ville initialisée');
    }

    // Rechercher une ville via l'API BAN (type: municipality)
    async searchCity(query) {
        const cityResults = document.getElementById('city-results');

        try {
            // API BAN avec type=municipality pour ne rechercher que les communes
            const response = await fetch(
                `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&limit=10`
            );

            if (!response.ok) {
                throw new Error('Erreur lors de la recherche');
            }

            const data = await response.json();

            if (data.features && data.features.length > 0) {
                this.displayCityResults(data.features);
            } else {
                cityResults.innerHTML = '<div class="result-loading">Aucune ville trouvée</div>';
            }
        } catch (error) {
            console.error('Erreur de recherche de ville:', error);
            cityResults.innerHTML = '<div class="result-loading">Erreur lors de la recherche</div>';
        }
    }

    // Afficher les résultats de recherche de ville
    displayCityResults(features) {
        const cityResults = document.getElementById('city-results');
        cityResults.innerHTML = '';

        features.forEach((feature, index) => {
            const props = feature.properties;
            const item = document.createElement('div');
            item.className = 'result-item';

            const name = document.createElement('div');
            name.className = 'result-name';
            name.textContent = props.label || props.name;

            const context = document.createElement('div');
            context.className = 'result-context';
            context.textContent = props.context || '';

            item.appendChild(name);
            item.appendChild(context);

            item.addEventListener('click', () => {
                this.selectCity(feature);
                cityResults.classList.remove('active');
            });

            cityResults.appendChild(item);
        });

        cityResults.classList.add('active');
    }

    // Sélectionner une ville
    selectCity(feature) {
        const coords = feature.geometry.coordinates;
        const cityName = feature.properties.label || feature.properties.name;
        const cityCode = feature.properties.citycode;

        this.selectedCity = {
            name: cityName,
            lat: coords[1],
            lon: coords[0],
            citycode: cityCode
        };

        // Mémoriser cette ville pour la réutiliser aux prochains ajouts
        this.lastSelectedCity = { ...this.selectedCity };

        // Mettre à jour l'interface
        document.getElementById('city-input').value = cityName;

        // Afficher la ville sélectionnée
        const selectedCityDiv = document.getElementById('selected-city');
        selectedCityDiv.innerHTML = `
            <span class="selected-city-name">📍 ${cityName}</span>
            <button class="clear-city-btn" id="clear-city-btn">✕</button>
        `;
        selectedCityDiv.classList.add('active');

        // Attacher l'event listener au bouton clear-city
        document.getElementById('clear-city-btn').addEventListener('click', () => {
            this.clearCity();
        });

        // Activer le champ de recherche d'adresse
        const addressInput = document.getElementById('address-input');
        addressInput.disabled = false;
        addressInput.placeholder = `Rechercher une adresse à ${cityName.split(',')[0]}...`;

        // Centrer la carte sur la ville
        this.map.setView([this.selectedCity.lat, this.selectedCity.lon], 13);

        this.notifyUser(`Ville sélectionnée: ${cityName.split(',')[0]}`, 'success');
    }

    // Effacer la ville sélectionnée
    clearCity() {
        this.selectedCity = null;
        this.lastSelectedCity = null; // Effacer aussi la ville mémorisée

        document.getElementById('city-input').value = '';
        document.getElementById('selected-city').classList.remove('active');

        const addressInput = document.getElementById('address-input');
        addressInput.disabled = true;
        addressInput.value = '';
        addressInput.placeholder = 'Entrez d\'abord une ville...';

        document.getElementById('address-results').classList.remove('active');

        this.notifyUser('Ville désélectionnée', 'info');
    }

    // Détecter la ville via géolocalisation
    detectCity() {
        if (!navigator.geolocation) {
            this.notifyUser('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
            return;
        }

        this.notifyUser('Détection de votre ville en cours...', 'info');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                try {
                    // Reverse geocoding avec l'API BAN
                    const response = await fetch(
                        `https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}&type=municipality`
                    );

                    if (!response.ok) {
                        throw new Error('Erreur lors de la détection');
                    }

                    const data = await response.json();

                    if (data.features && data.features.length > 0) {
                        this.selectCity(data.features[0]);
                    } else {
                        this.notifyUser('Impossible de détecter votre ville', 'warning');
                    }
                } catch (error) {
                    console.error('Erreur de détection de ville:', error);
                    this.notifyUser('Erreur lors de la détection de la ville', 'error');
                }
            },
            (error) => {
                this.handleGeolocationError(error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // Initialisation de la recherche d'adresse avec API BAN
    initAddressSearch() {
        const input = document.getElementById('address-input');
        const resultsContainer = document.getElementById('address-results');

        if (!input || !resultsContainer) return;

        // Événement de saisie avec debounce
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            // Effacer le timeout précédent
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            // Réinitialiser l'index de sélection
            this.selectedResultIndex = -1;

            if (query.length < 3) {
                resultsContainer.classList.remove('active');
                return;
            }

            // Ajouter un indicateur de chargement
            resultsContainer.innerHTML = '<div class="address-loading">Recherche en cours...</div>';
            resultsContainer.classList.add('active');

            // Debounce de 300ms
            this.searchTimeout = setTimeout(() => {
                this.searchAddress(query);
            }, 300);
        });

        // Navigation au clavier
        input.addEventListener('keydown', (e) => {
            const items = resultsContainer.querySelectorAll('.address-result-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedResultIndex = Math.min(this.selectedResultIndex + 1, items.length - 1);
                this.updateSelectedResult(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedResultIndex = Math.max(this.selectedResultIndex - 1, -1);
                this.updateSelectedResult(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedResultIndex >= 0 && items[this.selectedResultIndex]) {
                    items[this.selectedResultIndex].click();
                }
            } else if (e.key === 'Escape') {
                resultsContainer.classList.remove('active');
            }
        });

        // Fermer les résultats en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.classList.remove('active');
            }
        });

        console.log('Recherche d\'adresse initialisée avec API BAN');
    }

    // Mettre à jour la sélection visuelle
    updateSelectedResult(items) {
        items.forEach((item, index) => {
            if (index === this.selectedResultIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // Rechercher une adresse via l'API Base Adresse Nationale
    async searchAddress(query) {
        const resultsContainer = document.getElementById('address-results');

        try {
            // Construire l'URL de l'API avec filtrage par ville si disponible
            let apiUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=10`;

            // Ajouter les coordonnées de la ville pour filtrer les résultats
            if (this.selectedCity) {
                apiUrl += `&lat=${this.selectedCity.lat}&lon=${this.selectedCity.lon}`;

                // Ajouter aussi le citycode pour un filtrage encore plus précis
                if (this.selectedCity.citycode) {
                    apiUrl += `&citycode=${this.selectedCity.citycode}`;
                }
            }

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error('Erreur lors de la recherche');
            }

            const data = await response.json();

            if (data.features && data.features.length > 0) {
                this.displayAddressResults(data.features);
            } else {
                resultsContainer.innerHTML = '<div class="result-loading">Aucun résultat trouvé</div>';
            }
        } catch (error) {
            console.error('Erreur de recherche d\'adresse:', error);
            resultsContainer.innerHTML = '<div class="result-loading">Erreur lors de la recherche</div>';
        }
    }

    // Afficher les résultats de recherche d'adresse
    displayAddressResults(features) {
        const resultsContainer = document.getElementById('address-results');
        resultsContainer.innerHTML = '';

        features.forEach((feature, index) => {
            const props = feature.properties;
            const item = document.createElement('div');
            item.className = 'result-item';

            const name = document.createElement('div');
            name.className = 'result-name';
            name.textContent = props.label;

            const context = document.createElement('div');
            context.className = 'result-context';
            context.textContent = props.context || '';

            item.appendChild(name);
            item.appendChild(context);

            // Clic sur un résultat
            item.addEventListener('click', () => {
                this.selectAddress(feature);
                resultsContainer.classList.remove('active');
            });

            resultsContainer.appendChild(item);
        });

        resultsContainer.classList.add('active');
    }

    // Sélectionner une adresse
    selectAddress(feature) {
        const coords = feature.geometry.coordinates;
        const lat = coords[1];
        const lng = coords[0];
        const label = feature.properties.label;

        // Mettre à jour le champ de recherche
        document.getElementById('address-input').value = label;

        // Mettre à jour les champs cachés des coordonnées
        document.getElementById('dist-lat').value = lat;
        document.getElementById('dist-lng').value = lng;

        // Supprimer le marqueur précédent
        if (this.addressMarker) {
            this.map.removeLayer(this.addressMarker);
        }

        // Ajouter un marqueur pour l'adresse
        this.addressMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'address-marker',
                html: '<div style="background: #ef4444; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            })
        }).addTo(this.map);

        this.addressMarker.bindPopup(`
            <strong>Adresse sélectionnée</strong><br>
            ${label}
        `).openPopup();

        // Centrer la carte sur l'adresse
        this.map.setView([lat, lng], 16);

        this.notifyUser('Adresse trouvée', 'success');
    }

    // Ajouter des informations à une forme dessinée
    addLayerInfo(layer, type) {
        try {
            let info = '';

            if (type === 'polygon' && typeof layer.getLatLngs === 'function') {
                const latLngs = layer.getLatLngs();
                // Gérer les polygons simples et complexes
                const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
                if (typeof L.GeometryUtil !== 'undefined' && L.GeometryUtil.geodesicArea) {
                    const area = L.GeometryUtil.geodesicArea(coords);
                    info = `<strong>Polygone</strong><br>Surface: ${(area / 1000000).toFixed(2)} km²`;
                } else {
                    info = `<strong>Polygone</strong>`;
                }
            } else if (type === 'circle' && typeof layer.getRadius === 'function') {
                const radius = layer.getRadius();
                const area = Math.PI * radius * radius;
                info = `<strong>Cercle</strong><br>Rayon: ${(radius / 1000).toFixed(2)} km<br>Surface: ${(area / 1000000).toFixed(2)} km²`;
            } else if (type === 'rectangle' && typeof layer.getLatLngs === 'function') {
                const latLngs = layer.getLatLngs();
                const coords = Array.isArray(latLngs[0]) ? latLngs[0] : latLngs;
                if (typeof L.GeometryUtil !== 'undefined' && L.GeometryUtil.geodesicArea) {
                    const area = L.GeometryUtil.geodesicArea(coords);
                    info = `<strong>Rectangle</strong><br>Surface: ${(area / 1000000).toFixed(2)} km²`;
                } else {
                    info = `<strong>Rectangle</strong>`;
                }
            } else {
                // Type non reconnu ou méthodes manquantes
                info = `<strong>Zone</strong>`;
            }

            if (info && typeof layer.bindPopup === 'function') {
                layer.bindPopup(info);
            }
        } catch (error) {
            console.error('Erreur dans addLayerInfo:', error);
            // Ne pas bloquer le chargement si une zone pose problème
        }
    }

    // Géolocalisation avec haute précision
    geolocateUser() {
        if (!navigator.geolocation) {
            this.notifyUser('La géolocalisation n\'est pas supportée par votre navigateur', 'error');
            return;
        }

        const options = {
            enableHighAccuracy: true,  // Haute précision
            timeout: 10000,            // Timeout de 10 secondes
            maximumAge: 0              // Ne pas utiliser de cache
        };

        // Obtenir la position actuelle
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.updateUserPosition(position);
                this.notifyUser('Position obtenue avec succès', 'success');

                // Démarrer le suivi continu
                this.startWatchingPosition(options);
            },
            (error) => {
                this.handleGeolocationError(error);
            },
            options
        );
    }

    // Démarrer le suivi continu de la position
    startWatchingPosition(options) {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateUserPosition(position);
            },
            (error) => {
                console.error('Erreur de suivi:', error);
            },
            options
        );
    }

    // Mettre à jour la position de l'utilisateur
    updateUserPosition(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Mettre à jour les informations affichées
        document.getElementById('current-lat').textContent = `Latitude: ${lat.toFixed(6)}`;
        document.getElementById('current-lng').textContent = `Longitude: ${lng.toFixed(6)}`;
        document.getElementById('current-accuracy').textContent = `Précision: ${accuracy.toFixed(0)} mètres`;

        // Supprimer les marqueurs existants
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }

        // Ajouter un cercle pour la précision
        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            className: 'accuracy-circle'
        }).addTo(this.map);

        // Ajouter un marqueur pour la position
        this.userMarker = L.circleMarker([lat, lng], {
            radius: 8,
            className: 'user-location-marker',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            weight: 3,
            color: 'white'
        }).addTo(this.map);

        this.userMarker.bindPopup(`
            <strong>Votre position</strong><br>
            Lat: ${lat.toFixed(6)}<br>
            Lng: ${lng.toFixed(6)}<br>
            Précision: ${accuracy.toFixed(0)}m
        `);

        // Centrer la carte sur la position
        this.map.setView([lat, lng], 15);
    }

    // Gestion des erreurs de géolocalisation
    handleGeolocationError(error) {
        let message = '';

        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Permission de géolocalisation refusée';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Position indisponible';
                break;
            case error.TIMEOUT:
                message = 'Délai d\'attente dépassé';
                break;
            default:
                message = 'Erreur de géolocalisation inconnue';
        }

        this.notifyUser(message, 'error');
    }

    // Générer une couleur aléatoire pour une nouvelle zone
    getRandomZoneColor() {
        const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Sauvegarder les zones dans le localStorage
    saveZones() {
        try {
            const zonesData = [];
            let index = 0;

            this.drawnItems.eachLayer((layer) => {
                const geoJSON = layer.toGeoJSON();
                const existingZone = this.zones[index] || {};

                // Créer l'objet zone avec métadonnées complètes
                let zoneData = {
                    id: existingZone.id || `zone-${Date.now()}-${index}`,
                    name: existingZone.name || `Zone ${this.nextZoneId++}`,
                    color: existingZone.color || this.getRandomZoneColor(),
                    binome_username: existingZone.binome_username || null,
                    binome_name: existingZone.binome_name || null,
                    geojson: {
                        type: 'Feature',
                        geometry: geoJSON.geometry,
                        properties: {}
                    },
                    createdAt: existingZone.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Si c'est la zone en cours d'édition et qu'un binôme est sélectionné
                if (layer === this.editingZoneLayer && this.selectedBinome) {
                    zoneData.binome_username = this.selectedBinome.username;
                    zoneData.binome_name = this.selectedBinome.binome_name;
                }

                // Ajouter les propriétés spécifiques pour les cercles
                if (layer instanceof L.Circle) {
                    zoneData.geojson.properties.radius = layer.getRadius();
                    zoneData.geojson.properties.shapeType = 'circle';
                } else if (layer instanceof L.Polygon) {
                    zoneData.geojson.properties.shapeType = 'polygon';
                } else if (layer instanceof L.Rectangle) {
                    zoneData.geojson.properties.shapeType = 'rectangle';
                }

                zonesData.push(zoneData);
                index++;
            });

            // Mettre à jour this.zones
            this.zones = zonesData;

            // Sauvegarder dans localStorage
            localStorage.setItem('mapZones', JSON.stringify(zonesData));

            this.notifyUser(`${zonesData.length} zone(s) sauvegardée(s)`, 'success');

            // Planifier la synchronisation avec NocoDB
            this.scheduleSyncWithNocoDB();
        } catch (error) {
            console.error('Erreur de sauvegarde:', error);
            this.notifyUser('Erreur lors de la sauvegarde', 'error');
        }
    }

    // Charger les zones depuis le localStorage
    loadZonesFromStorage() {
        try {
            const savedZones = localStorage.getItem('mapZones');

            if (savedZones) {
                let allZones = JSON.parse(savedZones);

                // Filter zones based on user permissions
                let zonesToLoad = allZones;
                if (!this.auth.isAdmin()) {
                    // Regular user sees only their assigned zone
                    zonesToLoad = allZones.filter((zoneData, index) => {
                        // Create a temporary zone object to check access
                        const tempZone = {
                            id: `zone-${index}`,
                            name: `Zone ${index + 1}`
                        };
                        return this.auth.canAccessZone(tempZone);
                    });
                    console.log(`[AUTH] ${this.auth.currentUser.binome_name}: ${zonesToLoad.length}/${allZones.length} zone(s) chargée(s)`);
                } else {
                    console.log(`[AUTH] Admin: ${allZones.length} zone(s) chargée(s)`);
                }

                zonesToLoad.forEach((zoneData) => {
                    let layer;

                    if (zoneData.properties.shapeType === 'circle') {
                        const coords = zoneData.geometry.coordinates;
                        layer = L.circle([coords[1], coords[0]], {
                            radius: zoneData.properties.radius,
                            color: '#10b981',
                            weight: 3,
                            fillOpacity: 0.2,
                            interactive: false
                        });
                        this.addLayerInfo(layer, 'circle');
                    } else {
                        layer = L.geoJSON(zoneData, {
                            style: (feature) => {
                                return {
                                    color: '#3b82f6',
                                    weight: 3,
                                    fillOpacity: 0.2
                                };
                            },
                            interactive: false
                        });

                        // Pour les GeoJSON, on doit extraire la couche
                        layer.eachLayer((l) => {
                            this.addLayerInfo(l, 'polygon');
                            this.drawnItems.addLayer(l);
                        });
                        return; // Éviter le double ajout
                    }

                    this.drawnItems.addLayer(layer);
                });

                // ✅ FIX: Mettre à jour this.zones après le chargement
                this.zones = zonesToLoad.map((zoneData, index) => ({
                    name: `Zone ${index + 1}`,
                    geojson: zoneData
                }));

                this.updateZonesCount();

                // Peupler le filtre zone après chargement
                this.populateZoneFilter();
            }
        } catch (error) {
            console.error('Erreur de chargement:', error);
        }
    }

    // Effacer toutes les zones
    clearAllZones() {
        if (confirm('Êtes-vous sûr de vouloir effacer toutes les zones?')) {
            this.drawnItems.clearLayers();
            this.zones = [];
            localStorage.removeItem('mapZones');
            this.updateZonesCount();
            this.notifyUser('Toutes les zones ont été effacées', 'warning');

            // ✅ FIX: Synchroniser la suppression avec NocoDB
            this.scheduleSyncWithNocoDB();
        }
    }

    // Mettre à jour les zones depuis les couches
    updateZonesFromLayers() {
        this.zones = [];
        this.drawnItems.eachLayer((layer) => {
            this.zones.push({
                data: layer.toGeoJSON()
            });
        });
    }

    // Mettre à jour le compteur de zones
    updateZonesCount() {
        const count = this.drawnItems.getLayers().length;
        const zonesCountEl = document.getElementById('zones-count');
        if (zonesCountEl) {
            zonesCountEl.textContent = count;
        }
    }

    // ============================================
    // GESTION DES ZONES - MODAL ET STATISTIQUES
    // ============================================

    /**
     * Afficher le modal des propriétés de zone
     * @param {L.Layer} layer - Le layer Leaflet dessiné
     * @param {boolean} isEdit - True si édition, false si nouvelle zone
     */
    showZoneModal(layer, isEdit = false) {
        const modal = document.getElementById('zone-modal');
        const form = document.getElementById('zone-form');
        const nameInput = document.getElementById('zone-name');
        const colorInput = document.getElementById('zone-color');
        const binomeInput = document.getElementById('zone-binome');

        // Stocker la référence du layer pour plus tard
        this.editingZoneLayer = layer;
        this.selectedBinome = null;

        // Trouver l'index de la zone existante si édition
        let zoneIndex = -1;
        let currentIndex = 0;
        this.drawnItems.eachLayer((l) => {
            if (l === layer) zoneIndex = currentIndex;
            currentIndex++;
        });

        const existingZone = this.zones[zoneIndex];

        // Pré-remplir le formulaire
        if (existingZone) {
            nameInput.value = existingZone.name || '';
            colorInput.value = existingZone.color || '#10b981';

            // Pré-remplir le binôme si assigné
            if (existingZone.binome_username) {
                const binome = this.binomes.find(b => b.username === existingZone.binome_username);
                if (binome) {
                    binomeInput.value = binome.binome_name;
                    this.selectedBinome = binome;
                }
            } else {
                binomeInput.value = '';
            }

            // Appliquer la couleur au layer
            if (layer.setStyle) {
                layer.setStyle({
                    color: existingZone.color,
                    fillColor: existingZone.color
                });
            }
        } else {
            nameInput.value = '';
            colorInput.value = '#10b981';
            binomeInput.value = '';
        }

        // Initialiser l'autocomplete
        this.initBinomeAutocomplete();

        // Calculer et afficher les statistiques
        this.updateZoneStatisticsPreview(layer);

        // Afficher le modal
        modal.classList.add('active');
    }

    /**
     * Calculer les statistiques pour une zone
     * @param {L.Layer} zoneLayer - Le layer de la zone
     * @return {Object} - Objet contenant les statistiques
     */
    calculateZoneStatistics(zoneLayer) {
        const distributionsInZone = this.getDistributionsInZone(zoneLayer);

        const stats = {
            totalDistributions: distributionsInZone.length,
            effectue: distributionsInZone.filter(d => d.status === 'effectue').length,
            repasser: distributionsInZone.filter(d => d.status === 'repasser').length,
            refus: distributionsInZone.filter(d => d.status === 'refus').length,
            totalAmount: distributionsInZone.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0),
            successRate: 0
        };

        if (stats.totalDistributions > 0) {
            stats.successRate = (stats.effectue / stats.totalDistributions * 100).toFixed(1);
        }

        return stats;
    }

    /**
     * Mettre à jour l'affichage des statistiques dans le modal
     * @param {L.Layer} zoneLayer - Le layer de la zone
     */
    updateZoneStatisticsPreview(zoneLayer) {
        const stats = this.calculateZoneStatistics(zoneLayer);

        document.getElementById('zone-stat-total').textContent = stats.totalDistributions;
        document.getElementById('zone-stat-effectue').textContent = stats.effectue;
        document.getElementById('zone-stat-repasser').textContent = stats.repasser;
        document.getElementById('zone-stat-refus').textContent = stats.refus;
        document.getElementById('zone-stat-amount').textContent = (parseFloat(stats.totalAmount) || 0).toFixed(2) + ' €';
    }

    /**
     * Gérer la soumission du formulaire de zone
     * @param {Event} e - L'événement de soumission
     */
    handleZoneFormSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('zone-name').value.trim();
        const color = document.getElementById('zone-color').value;
        const layer = this.editingZoneLayer;

        if (!name) {
            this.notifyUser('Veuillez entrer un nom pour la zone', 'warning');
            return;
        }

        if (!layer) {
            this.notifyUser('Erreur: aucune zone sélectionnée', 'error');
            return;
        }

        // Mettre à jour le style du layer avec la nouvelle couleur
        if (layer.setStyle) {
            layer.setStyle({
                color: color,
                fillColor: color,
                fillOpacity: 0.2
            });
        } else if (layer instanceof L.Circle) {
            layer.setStyle({
                color: color,
                fillColor: color,
                fillOpacity: 0.2
            });
        }

        // Sauvegarder les zones (qui va mettre à jour this.zones avec le nom et la couleur)
        this.saveZones();

        // Synchroniser avec NocoDB
        this.scheduleSyncWithNocoDB();

        // Rafraîchir le filtre zone
        this.populateZoneFilter();

        // Fermer le modal
        document.getElementById('zone-modal').classList.remove('active');
        this.editingZoneLayer = null;

        this.notifyUser(`Zone "${name}" enregistrée`, 'success');
    }

    // ============================================

    // Notification utilisateur
    notifyUser(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);

        // Créer une notification visuelle
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    // ========== GESTION DES DISTRIBUTIONS ==========

    // Initialisation du système de distributions
    initDistributions() {
        const form = document.getElementById('distribution-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveDistribution();
            });

            // Désactiver la validation HTML5 native
            form.setAttribute('novalidate', 'novalidate');
        }

        // Toggle mode automatique/manuel
        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.toggleAddressMode(mode);
            });
        });

        // Filtres par statut (mis à jour pour système unifié)
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filters.status = e.target.dataset.filter;
                this.updateFilteredView();
            });
        });

        // Recherche rapide avec debounce
        const quickSearchInput = document.getElementById('quick-search-input');
        if (quickSearchInput) {
            quickSearchInput.addEventListener('input', (e) => {
                clearTimeout(this.filterDebounceTimeout);
                this.filterDebounceTimeout = setTimeout(() => {
                    this.filters.searchQuery = e.target.value.toLowerCase();
                    this.updateFilteredView();
                }, 300);
            });
        }

        // Filtres par date
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        const resetDatesBtn = document.getElementById('reset-dates-btn');

        if (dateFrom) {
            dateFrom.addEventListener('change', (e) => {
                this.filters.dateFrom = e.target.value ? new Date(e.target.value) : null;
                this.updateFilteredView();
                this.updateStatsDashboard();
            });
        }

        if (dateTo) {
            dateTo.addEventListener('change', (e) => {
                this.filters.dateTo = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
                this.updateFilteredView();
                this.updateStatsDashboard();
            });
        }

        if (resetDatesBtn) {
            resetDatesBtn.addEventListener('click', () => {
                this.filters.dateFrom = null;
                this.filters.dateTo = null;
                if (dateFrom) dateFrom.value = '';
                if (dateTo) dateTo.value = '';
                this.updateFilteredView();
                this.updateStatsDashboard();
            });
        }

        // Nouveaux filtres avancés
        const filterPayment = document.getElementById('filter-payment');
        const filterBinome = document.getElementById('filter-binome');
        const filterZone = document.getElementById('filter-zone');
        const clearAllFiltersBtn = document.getElementById('clear-all-filters');

        if (filterPayment) {
            filterPayment.addEventListener('change', (e) => {
                this.filters.payment = e.target.value;
                this.updateFilteredView();
            });
        }

        if (filterBinome) {
            filterBinome.addEventListener('change', (e) => {
                this.filters.binome = e.target.value;
                this.updateFilteredView();
            });
        }

        if (filterZone) {
            filterZone.addEventListener('change', (e) => {
                this.filters.zone = e.target.value || null;
                this.updateFilteredView();
            });
        }

        if (clearAllFiltersBtn) {
            clearAllFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Synchroniser les champs lat/lng manuels avec le clic sur la carte
        document.getElementById('dist-lat-manual')?.addEventListener('input', () => {
            this.updateManualMarkerFromFields();
        });

        document.getElementById('dist-lng-manual')?.addEventListener('input', () => {
            this.updateManualMarkerFromFields();
        });

        console.log('Système de distributions initialisé');
    }

    // Basculer entre mode automatique et manuel
    toggleAddressMode(mode) {
        const modeBtns = document.querySelectorAll('.mode-btn');
        const autoMode = document.getElementById('auto-mode');
        const manualMode = document.getElementById('manual-mode');

        modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'manual') {
            autoMode.style.display = 'none';
            manualMode.style.display = 'block';

            // Désactiver la validation du champ auto
            document.getElementById('address-input').removeAttribute('required');

            // Activer la validation des champs manuels
            document.getElementById('dist-address-manual').setAttribute('required', 'required');
            document.getElementById('dist-lat-manual').setAttribute('required', 'required');
            document.getElementById('dist-lng-manual').setAttribute('required', 'required');

            // Activer le mode clic sur la carte
            this.enableMapClickMode();
        } else {
            autoMode.style.display = 'block';
            manualMode.style.display = 'none';

            // Activer la validation du champ auto
            document.getElementById('address-input').setAttribute('required', 'required');

            // Désactiver la validation des champs manuels
            document.getElementById('dist-address-manual').removeAttribute('required');
            document.getElementById('dist-lat-manual').removeAttribute('required');
            document.getElementById('dist-lng-manual').removeAttribute('required');

            // Désactiver le mode clic sur la carte
            this.disableMapClickMode();
        }
    }

    // Activer le mode de clic sur la carte
    enableMapClickMode() {
        this.map.getContainer().style.cursor = 'crosshair';

        if (this.mapClickHandler) {
            this.map.off('click', this.mapClickHandler);
        }

        this.mapClickHandler = (e) => {
            const { lat, lng } = e.latlng;

            // Mettre à jour les champs
            document.getElementById('dist-lat-manual').value = lat.toFixed(6);
            document.getElementById('dist-lng-manual').value = lng.toFixed(6);

            // Créer/déplacer le marqueur temporaire
            this.updateManualMarker(lat, lng);

            // Mettre à jour l'instruction
            document.getElementById('click-map-instruction').textContent =
                `Position sélectionnée: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        };

        this.map.on('click', this.mapClickHandler);
        this.notifyUser('Cliquez sur la carte pour placer le marqueur', 'info');
    }

    // Désactiver le mode de clic sur la carte
    disableMapClickMode() {
        this.map.getContainer().style.cursor = '';

        if (this.mapClickHandler) {
            this.map.off('click', this.mapClickHandler);
            this.mapClickHandler = null;
        }

        // Supprimer le marqueur temporaire
        if (this.tempManualMarker) {
            this.map.removeLayer(this.tempManualMarker);
            this.tempManualMarker = null;
        }

        document.getElementById('click-map-instruction').textContent =
            'Cliquez sur la carte pour placer le marqueur';
    }

    // Mettre à jour le marqueur manuel
    updateManualMarker(lat, lng) {
        if (this.tempManualMarker) {
            this.map.removeLayer(this.tempManualMarker);
        }

        this.tempManualMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'temp-manual-marker',
                html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.map);

        this.tempManualMarker.bindPopup('📍 Position sélectionnée').openPopup();
        this.map.setView([lat, lng], Math.max(this.map.getZoom(), 15));
    }

    // Mettre à jour le marqueur à partir des champs
    updateManualMarkerFromFields() {
        const lat = parseFloat(document.getElementById('dist-lat-manual').value);
        const lng = parseFloat(document.getElementById('dist-lng-manual').value);

        if (!isNaN(lat) && !isNaN(lng)) {
            this.updateManualMarker(lat, lng);
        }
    }

    // Ouvrir le modal d'ajout de distribution
    openDistributionModal(editId = null) {
        const modal = document.getElementById('distribution-modal');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('distribution-form');

        if (editId) {
            // Mode édition
            this.editingDistributionId = editId;
            const dist = this.distributions.find(d => d.id === editId);
            if (dist) {
                title.textContent = 'Modifier la distribution';
                document.getElementById('distribution-id').value = dist.id;
                document.getElementById('address-input').value = dist.address;
                document.getElementById('dist-lat').value = dist.lat;
                document.getElementById('dist-lng').value = dist.lng;
                document.getElementById('dist-status').value = dist.status;
                document.getElementById('dist-amount').value = dist.amount || '';
                document.getElementById('dist-payment').value = dist.payment || '';
                document.getElementById('dist-notes').value = dist.notes || '';
            }
        } else {
            // Mode ajout
            this.editingDistributionId = null;
            title.textContent = 'Ajouter une distribution';

            // Sauvegarder l'adresse et les coordonnées AVANT de réinitialiser le formulaire
            const addressInput = document.getElementById('address-input');
            const savedAddress = addressInput.value;
            let savedLat = null;
            let savedLng = null;

            if (this.addressMarker) {
                const latlng = this.addressMarker.getLatLng();
                savedLat = latlng.lat;
                savedLng = latlng.lng;
            }

            // Maintenant on peut réinitialiser le formulaire
            form.reset();

            // Restaurer l'adresse et les coordonnées après la réinitialisation
            if (savedAddress && savedLat && savedLng) {
                addressInput.value = savedAddress;
                document.getElementById('dist-lat').value = savedLat;
                document.getElementById('dist-lng').value = savedLng;
            }

            // Restaurer la ville mémorisée si elle existe
            if (this.lastSelectedCity) {
                this.selectedCity = { ...this.lastSelectedCity };

                // Mettre à jour l'interface de la ville
                const cityInput = document.getElementById('city-input');
                cityInput.value = this.lastSelectedCity.name;

                // Afficher la ville sélectionnée
                const selectedCityDiv = document.getElementById('selected-city');
                selectedCityDiv.innerHTML = `
                    <span class="selected-city-name">📍 ${this.lastSelectedCity.name}</span>
                    <button class="clear-city-btn" id="clear-city-btn">✕</button>
                `;
                selectedCityDiv.classList.add('active');

                // Attacher l'event listener au bouton clear-city
                document.getElementById('clear-city-btn').addEventListener('click', () => {
                    this.clearCity();
                });

                // Activer le champ de recherche d'adresse
                addressInput.disabled = false;
                addressInput.placeholder = `Rechercher une adresse à ${this.lastSelectedCity.name.split(',')[0]}...`;
            }
        }

        modal.classList.add('active');
    }

    // Fermer le modal
    closeDistributionModal() {
        const modal = document.getElementById('distribution-modal');
        modal.classList.remove('active');
        this.editingDistributionId = null;

        // Nettoyer le mode manuel
        this.disableMapClickMode();

        // Réinitialiser en mode automatique
        this.toggleAddressMode('auto');
    }

    // Sauvegarder une distribution
    saveDistribution() {
        // Déterminer le mode actif
        const manualMode = document.getElementById('manual-mode').style.display !== 'none';

        let address, lat, lng;

        if (manualMode) {
            // Mode manuel
            address = document.getElementById('dist-address-manual').value.trim();
            lat = parseFloat(document.getElementById('dist-lat-manual').value);
            lng = parseFloat(document.getElementById('dist-lng-manual').value);

            if (!address) {
                this.notifyUser('Veuillez entrer une adresse', 'error');
                return;
            }

            if (isNaN(lat) || isNaN(lng)) {
                this.notifyUser('Veuillez définir une position sur la carte ou entrer des coordonnées valides', 'error');
                return;
            }
        } else {
            // Mode automatique
            address = document.getElementById('address-input').value.trim();
            lat = parseFloat(document.getElementById('dist-lat').value);
            lng = parseFloat(document.getElementById('dist-lng').value);

            if (!address) {
                this.notifyUser('Veuillez sélectionner une adresse', 'error');
                return;
            }

            if (isNaN(lat) || isNaN(lng)) {
                this.notifyUser('Veuillez sélectionner une adresse avec des coordonnées valides', 'error');
                return;
            }
        }

        const status = document.getElementById('dist-status').value;
        const amount = parseFloat(document.getElementById('dist-amount').value) || 0;
        const payment = document.getElementById('dist-payment').value;
        const notes = document.getElementById('dist-notes').value;

        if (this.editingDistributionId) {
            // Mise à jour - OPTIMISÉ
            const index = this.distributions.findIndex(d => d.id === this.editingDistributionId);
            if (index !== -1) {
                const oldDist = this.distributions[index];
                this.distributions[index] = {
                    ...oldDist,
                    address,
                    lat,
                    lng,
                    status,
                    amount,
                    payment,
                    notes,
                    binome_id: oldDist.binome_id || this.auth.getCurrentUser().username, // Preserve or set
                    updatedAt: new Date().toISOString()
                };

                // Mise à jour optimisée : seulement le marqueur modifié
                this.updateSingleMarker(this.distributions[index]);
                this.updateSingleDistributionInList(this.distributions[index]);
                this.notifyUser('Distribution mise à jour', 'success');
            }
        } else {
            // Création - OPTIMISÉ
            const distribution = {
                id: Date.now().toString(),
                address,
                lat,
                lng,
                status,
                amount,
                payment,
                notes,
                binome_id: this.auth.getCurrentUser().username, // Assign to current user
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.distributions.push(distribution);

            // Ajout optimisé : seulement le nouveau marqueur
            this.addSingleMarker(distribution);
            this.addSingleDistributionToList(distribution);
            this.notifyUser('Distribution ajoutée', 'success');
        }

        // Sauvegarde immédiate en local (rapide)
        this.saveDistributionsToStorage();

        // Mise à jour stats (rapide - incrémentale)
        this.updateStatistics();

        // Fermer modal immédiatement
        this.closeDistributionModal();

        // Sync NocoDB en arrière-plan (débounce 2 secondes)
        this.scheduleSyncWithNocoDB();
    }

    // Supprimer une distribution - OPTIMISÉ
    deleteDistribution(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette distribution?')) {
            return;
        }

        this.distributions = this.distributions.filter(d => d.id !== id);

        // Suppression optimisée : seulement le marqueur et l'élément de liste concernés
        if (this.distributionMarkers[id]) {
            this.map.removeLayer(this.distributionMarkers[id]);
            delete this.distributionMarkers[id];
        }

        const element = document.querySelector(`[data-dist-id="${id}"]`);
        if (element) {
            element.remove();
        }

        // Si plus aucune distribution, afficher le message "Aucune distribution"
        if (this.distributions.length === 0) {
            const listContainer = document.getElementById('distributions-list');
            listContainer.innerHTML = '<p class="empty-state">Aucune distribution enregistrée</p>';
        }

        this.saveDistributionsToStorage();
        this.updateStatistics();
        this.notifyUser('Distribution supprimée', 'warning');

        // Sync NocoDB en arrière-plan
        this.scheduleSyncWithNocoDB();
    }

    // Charger les distributions depuis le localStorage
    loadDistributions() {
        try {
            const saved = localStorage.getItem('distributions');
            if (saved) {
                let allDistributions = JSON.parse(saved);

                // Filter distributions based on user permissions
                if (this.auth.isAdmin()) {
                    // Admin sees all distributions
                    this.distributions = allDistributions;
                    console.log(`[AUTH] Admin: ${allDistributions.length} distribution(s) chargée(s)`);
                } else {
                    // Regular user sees only their distributions
                    this.distributions = allDistributions.filter(dist =>
                        this.auth.canAccessDistribution(dist)
                    );
                    console.log(`[AUTH] ${this.auth.currentUser.binome_name}: ${this.distributions.length}/${allDistributions.length} distribution(s) chargée(s)`);
                }

                this.updateMapMarkers();
                this.updateStatistics();
                this.renderDistributionsList();
                this.centerMapOnLastDistribution();

                // Peupler le filtre binôme après chargement
                this.populateBinomeFilter();
            }
        } catch (error) {
            console.error('Erreur de chargement des distributions:', error);
        }
    }

    // Centrer la carte sur la dernière distribution au chargement
    centerMapOnLastDistribution() {
        if (this.distributions.length > 0) {
            // Trier par date de création (la plus récente en premier)
            const sorted = [...this.distributions].sort((a, b) => {
                const dateA = new Date(a.createdAt || a.updatedAt || 0);
                const dateB = new Date(b.createdAt || b.updatedAt || 0);
                return dateB - dateA;
            });

            const lastDist = sorted[0];
            if (lastDist && lastDist.lat && lastDist.lng) {
                // Centrer avec un zoom approprié
                this.map.setView([lastDist.lat, lastDist.lng], 16);

                // Ouvrir le popup du marqueur si disponible
                if (this.distributionMarkers[lastDist.id]) {
                    setTimeout(() => {
                        this.distributionMarkers[lastDist.id].openPopup();
                    }, 300);
                }

                console.log('Carte centrée sur la dernière distribution:', lastDist.address);
            }
        }
    }

    // Sauvegarder les distributions dans le localStorage
    saveDistributionsToStorage() {
        try {
            localStorage.setItem('distributions', JSON.stringify(this.distributions));
            // Rafraîchir le filtre binôme après sauvegarde
            this.populateBinomeFilter();
        } catch (error) {
            console.error('Erreur de sauvegarde des distributions:', error);
            this.notifyUser('Erreur lors de la sauvegarde', 'error');
        }
    }

    // ========================================
    // OPTIMIZED MARKER FUNCTIONS
    // ========================================

    /**
     * Ajouter un seul marqueur (OPTIMISÉ - pas de re-render complet)
     */
    addSingleMarker(dist) {
        const color = this.getStatusColor(dist.status);
        const icon = L.divIcon({
            className: 'distribution-marker',
            html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker([dist.lat, dist.lng], { icon }).addTo(this.map);
        marker.bindPopup(this.createMarkerPopup(dist));
        marker.on('click', () => {
            this.highlightDistribution(dist.id);
        });

        this.distributionMarkers[dist.id] = marker;
    }

    /**
     * Mettre à jour un seul marqueur (OPTIMISÉ)
     */
    updateSingleMarker(dist) {
        // Supprimer l'ancien marqueur
        if (this.distributionMarkers[dist.id]) {
            this.map.removeLayer(this.distributionMarkers[dist.id]);
        }

        // Ajouter le nouveau
        this.addSingleMarker(dist);
    }

    /**
     * Ajouter une seule distribution à la liste (OPTIMISÉ)
     */
    addSingleDistributionToList(dist) {
        const listContainer = document.getElementById('distributions-list');

        // Supprimer le message "Aucune distribution" si présent
        const emptyState = listContainer.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Créer et ajouter le nouvel élément
        const element = this.createDistributionElement(dist);
        listContainer.insertBefore(element, listContainer.firstChild);
    }

    /**
     * Mettre à jour une seule distribution dans la liste (OPTIMISÉ)
     */
    updateSingleDistributionInList(dist) {
        const element = document.querySelector(`[data-dist-id="${dist.id}"]`);
        if (element) {
            const newElement = this.createDistributionElement(dist);
            element.replaceWith(newElement);
        }
    }

    /**
     * Créer un élément HTML pour une distribution
     */
    createDistributionElement(dist) {
        const statusLabels = {
            effectue: '✅ Effectué',
            repasser: '🔄 À repasser',
            refus: '❌ Refus'
        };

        const paymentLabels = {
            espece: '💵 Espèces',
            cheque: '💳 Chèque'
        };

        const div = document.createElement('div');
        div.className = 'distribution-item';
        div.dataset.distId = dist.id;
        div.dataset.status = dist.status;

        let html = `
            <div class="dist-header">
                <div class="dist-address">${dist.address}</div>
                <span class="dist-status-badge ${dist.status}">${statusLabels[dist.status]}</span>
            </div>
        `;

        if (dist.amount > 0) {
            html += `<div class="dist-info">💰 <span class="dist-amount">${(parseFloat(dist.amount) || 0).toFixed(2)} €</span>`;
            if (dist.payment) {
                html += ` - ${paymentLabels[dist.payment] || dist.payment}`;
            }
            html += `</div>`;
        }

        if (dist.notes) {
            html += `<div class="dist-notes">${dist.notes}</div>`;
        }

        html += `
            <div class="dist-actions">
                <button onclick="app.openDistributionModal('${dist.id}')">Modifier</button>
                <button class="delete-btn" onclick="app.deleteDistribution('${dist.id}')">Supprimer</button>
            </div>
        `;

        div.innerHTML = html;
        return div;
    }

    /**
     * Planifier la synchronisation avec NocoDB (DEBOUNCE)
     */
    scheduleSyncWithNocoDB() {
        // Annuler la sync précédente si elle n'a pas encore eu lieu
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }

        // Marquer qu'une sync est en attente
        this.pendingSync = true;
        this.updateSyncStatus('Sync planifiée...', 'info');

        // Planifier la sync dans 2 secondes
        this.syncTimeout = setTimeout(() => {
            if (this.pendingSync) {
                this.syncWithNocoDB();
                this.pendingSync = false;
            }
        }, 2000);
    }

    // Mettre à jour les marqueurs sur la carte
    updateMapMarkers() {
        // Supprimer tous les marqueurs existants
        Object.values(this.distributionMarkers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.distributionMarkers = {};

        // Ajouter les nouveaux marqueurs
        this.distributions.forEach(dist => {
            const color = this.getStatusColor(dist.status);
            const icon = L.divIcon({
                className: 'distribution-marker',
                html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
            });

            const marker = L.marker([dist.lat, dist.lng], { icon }).addTo(this.map);

            marker.bindPopup(this.createMarkerPopup(dist));

            marker.on('click', () => {
                this.highlightDistribution(dist.id);
            });

            this.distributionMarkers[dist.id] = marker;
        });
    }

    // Créer le contenu du popup d'un marqueur
    createMarkerPopup(dist) {
        const statusLabels = {
            effectue: '✅ Effectué',
            repasser: '🔄 À repasser',
            refus: '❌ Refus'
        };

        const paymentLabels = {
            espece: '💵 Espèces',
            cheque: '💳 Chèque'
        };

        let content = `
            <div style="min-width: 200px;">
                <strong>${dist.address}</strong><br>
                <span style="display: inline-block; padding: 4px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; margin-top: 5px; background: ${this.getStatusBgColor(dist.status)}; color: ${this.getStatusTextColor(dist.status)};">
                    ${statusLabels[dist.status]}
                </span>
        `;

        if (dist.amount > 0) {
            content += `<br><strong>Montant:</strong> ${(parseFloat(dist.amount) || 0).toFixed(2)} €`;
            if (dist.payment) {
                content += ` (${paymentLabels[dist.payment] || dist.payment})`;
            }
        }

        if (dist.notes) {
            content += `<br><strong>Notes:</strong> ${dist.notes}`;
        }

        content += `
            <div style="margin-top: 10px; display: flex; gap: 5px;">
                <button onclick="app.openDistributionModal('${dist.id}')" style="flex: 1; padding: 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Modifier</button>
                <button onclick="app.deleteDistribution('${dist.id}')" style="flex: 1; padding: 5px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Supprimer</button>
            </div>
        </div>
        `;

        return content;
    }

    // Obtenir la couleur selon le status
    getStatusColor(status) {
        const colors = {
            effectue: '#10b981',
            repasser: '#f59e0b',
            refus: '#ef4444'
        };
        return colors[status] || '#6b7280';
    }

    getStatusBgColor(status) {
        const colors = {
            effectue: '#d1fae5',
            repasser: '#fef3c7',
            refus: '#fee2e2'
        };
        return colors[status] || '#f3f4f6';
    }

    getStatusTextColor(status) {
        const colors = {
            effectue: '#065f46',
            repasser: '#92400e',
            refus: '#991b1b'
        };
        return colors[status] || '#1f2937';
    }

    // Mettre à jour les statistiques
    updateStatistics() {
        const stats = {
            effectue: 0,
            repasser: 0,
            refus: 0,
            totalAmount: 0,
            cashAmount: 0,
            checkAmount: 0
        };

        this.distributions.forEach(dist => {
            stats[dist.status]++;
            if (dist.amount > 0) {
                stats.totalAmount += dist.amount;
                if (dist.payment === 'espece') {
                    stats.cashAmount += dist.amount;
                } else if (dist.payment === 'cheque') {
                    stats.checkAmount += dist.amount;
                }
            }
        });

        // Mise à jour sécurisée - vérifier que les éléments existent
        const statEffectue = document.getElementById('stat-effectue');
        if (statEffectue) statEffectue.textContent = stats.effectue;

        const statRepasser = document.getElementById('stat-repasser');
        if (statRepasser) statRepasser.textContent = stats.repasser;

        const statRefus = document.getElementById('stat-refus');
        if (statRefus) statRefus.textContent = stats.refus;

        const totalAmount = document.getElementById('total-amount');
        if (totalAmount) totalAmount.textContent = stats.totalAmount.toFixed(2) + ' €';

        const cashAmount = document.getElementById('cash-amount');
        if (cashAmount) cashAmount.textContent = stats.cashAmount.toFixed(2) + ' €';

        const checkAmount = document.getElementById('check-amount');
        if (checkAmount) checkAmount.textContent = stats.checkAmount.toFixed(2) + ' €';
    }

    // Afficher/masquer le panneau latéral
    // Afficher la liste des distributions
    renderDistributionsList() {
        const container = document.getElementById('distributions-list');

        // Appliquer tous les filtres
        let filtered = this.distributions;

        // Filtre par statut
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(d => d.status === this.currentFilter);
        }

        // Filtre par recherche
        if (this.searchQuery) {
            filtered = filtered.filter(d =>
                d.address.toLowerCase().includes(this.searchQuery) ||
                (d.notes && d.notes.toLowerCase().includes(this.searchQuery))
            );
        }

        // Filtre par date
        if (this.dateFrom || this.dateTo) {
            filtered = filtered.filter(d => {
                const distDate = new Date(d.createdAt || d.updatedAt);
                if (this.dateFrom && distDate < this.dateFrom) return false;
                if (this.dateTo && distDate > this.dateTo) return false;
                return true;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucune distribution trouvée</p>';
            return;
        }

        const statusLabels = {
            effectue: '✅ Effectué',
            repasser: '🔄 À repasser',
            refus: '❌ Refus'
        };

        const paymentLabels = {
            espece: '💵 Espèces',
            cheque: '💳 Chèque'
        };

        container.innerHTML = filtered.map(dist => `
            <div class="distribution-item status-${dist.status}" data-id="${dist.id}">
                <div class="dist-address">${dist.address}</div>
                <div class="dist-info">
                    <span class="dist-status ${dist.status}">${statusLabels[dist.status]}</span>
                    ${dist.amount > 0 ? `<span><strong>${(parseFloat(dist.amount) || 0).toFixed(2)} €</strong></span>` : ''}
                    ${dist.payment ? `<span>${paymentLabels[dist.payment]}</span>` : ''}
                </div>
                ${dist.notes ? `<div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${dist.notes}</div>` : ''}
                <div class="dist-actions">
                    <button class="btn-edit" onclick="app.openDistributionModal('${dist.id}')">Modifier</button>
                    <button class="btn-delete" onclick="app.deleteDistribution('${dist.id}')">Supprimer</button>
                </div>
            </div>
        `).join('');

        // Ajouter un gestionnaire de clic pour centrer la carte
        container.querySelectorAll('.distribution-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-edit') && !e.target.classList.contains('btn-delete')) {
                    const id = item.dataset.id;
                    const dist = this.distributions.find(d => d.id === id);
                    if (dist) {
                        this.map.setView([dist.lat, dist.lng], 18);
                        if (this.distributionMarkers[id]) {
                            this.distributionMarkers[id].openPopup();
                        }
                    }
                }
            });
        });
    }

    // Mettre en surbrillance une distribution
    highlightDistribution(id) {
        // Passer à l'onglet liste
        this.switchTab('list');

        setTimeout(() => {
            const item = document.querySelector(`.distribution-item[data-id="${id}"]`);
            if (item) {
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.style.animation = 'pulse 0.5s ease 2';
            }
        }, 300);
    }

    // ========== STATISTIQUES ET GRAPHIQUES ==========

    // Mettre à jour le dashboard de statistiques
    updateStatsDashboard() {
        this.updateStatsCards();
        this.updateDetailedStats();
        this.createStatusChart();
        this.createAmountChart();
        this.createPaymentChart();
        this.createTimelineChart();
    }

    // Mettre à jour les cartes de statistiques
    updateStatsCards() {
        const stats = this.calculateStats();
        const filteredDistributions = this.getFilteredDistributions();

        const totalDist = document.getElementById('total-distributions');
        if (totalDist) totalDist.textContent = filteredDistributions.length;

        const statsEffectue = document.getElementById('stats-effectue');
        if (statsEffectue) statsEffectue.textContent = stats.effectue;

        const statsRepasser = document.getElementById('stats-repasser');
        if (statsRepasser) statsRepasser.textContent = stats.repasser;

        const statsRefus = document.getElementById('stats-refus');
        if (statsRefus) statsRefus.textContent = stats.refus;
    }

    // Mettre à jour les statistiques détaillées
    updateDetailedStats() {
        const stats = this.calculateStats();
        const total = this.getFilteredDistributions().length;

        // Montant moyen
        const avgAmount = total > 0 ? stats.totalAmount / stats.countWithAmount : 0;
        const avgAmountEl = document.getElementById('avg-amount');
        if (avgAmountEl) avgAmountEl.textContent = avgAmount.toFixed(2) + ' €';

        // Taux
        const successRate = document.getElementById('success-rate');
        if (successRate) successRate.textContent = total > 0 ? ((stats.effectue / total) * 100).toFixed(1) + '%' : '0%';

        const repasserRate = document.getElementById('repasser-rate');
        if (repasserRate) repasserRate.textContent = total > 0 ? ((stats.repasser / total) * 100).toFixed(1) + '%' : '0%';

        const refusRate = document.getElementById('refus-rate');
        if (refusRate) refusRate.textContent = total > 0 ? ((stats.refus / total) * 100).toFixed(1) + '%' : '0%';

        // Parts espèces/chèques
        const totalMoney = stats.cashAmount + stats.checkAmount;
        const cashPercent = document.getElementById('cash-percent');
        if (cashPercent) cashPercent.textContent = totalMoney > 0 ? ((stats.cashAmount / totalMoney) * 100).toFixed(1) + '%' : '0%';

        const checkPercent = document.getElementById('check-percent');
        if (checkPercent) checkPercent.textContent = totalMoney > 0 ? ((stats.checkAmount / totalMoney) * 100).toFixed(1) + '%' : '0%';
    }

    /**
     * Get filtered distributions (based on date filters)
     * Used for statistics calculation
     */
    getFilteredDistributions() {
        let filtered = this.distributions;

        // Filtre par date seulement (pas les autres filtres pour les stats)
        if (this.dateFrom || this.dateTo) {
            filtered = filtered.filter(d => {
                const distDate = new Date(d.createdAt || d.updatedAt);
                if (this.dateFrom && distDate < this.dateFrom) return false;
                if (this.dateTo && distDate > this.dateTo) return false;
                return true;
            });
        }

        return filtered;
    }

    // Calculer les statistiques
    calculateStats() {
        const stats = {
            effectue: 0,
            repasser: 0,
            refus: 0,
            totalAmount: 0,
            cashAmount: 0,
            checkAmount: 0,
            countWithAmount: 0
        };

        // Utiliser les distributions filtrées par date
        const distributions = this.getFilteredDistributions();

        distributions.forEach(dist => {
            stats[dist.status]++;
            if (dist.amount > 0) {
                stats.totalAmount += dist.amount;
                stats.countWithAmount++;
                if (dist.payment === 'espece') {
                    stats.cashAmount += dist.amount;
                } else if (dist.payment === 'cheque') {
                    stats.checkAmount += dist.amount;
                }
            }
        });

        return stats;
    }

    // Créer le graphique de répartition par status
    createStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        const stats = this.calculateStats();

        if (this.charts.status) {
            this.charts.status.destroy();
        }

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Effectué', 'À repasser', 'Refus'],
                datasets: [{
                    data: [stats.effectue, stats.repasser, stats.refus],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    }

    // Créer le graphique des montants collectés
    createAmountChart() {
        const ctx = document.getElementById('amountChart');
        if (!ctx) return;

        const stats = this.calculateStats();

        if (this.charts.amount) {
            this.charts.amount.destroy();
        }

        this.charts.amount = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Effectué', 'À repasser', 'Refus'],
                datasets: [{
                    label: 'Montant total (€)',
                    data: [
                        this.getAmountByStatus('effectue'),
                        this.getAmountByStatus('repasser'),
                        this.getAmountByStatus('refus')
                    ],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => value + ' €'
                        }
                    }
                }
            }
        });
    }

    // Créer le graphique des moyens de paiement
    createPaymentChart() {
        const ctx = document.getElementById('paymentChart');
        if (!ctx) return;

        const stats = this.calculateStats();

        if (this.charts.payment) {
            this.charts.payment.destroy();
        }

        this.charts.payment = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Espèces', 'Chèques'],
                datasets: [{
                    data: [stats.cashAmount, stats.checkAmount],
                    backgroundColor: ['#10b981', '#3b82f6'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: { size: 12, weight: '600' }
                        }
                    }
                }
            }
        });
    }

    // Créer le graphique d'évolution dans le temps
    createTimelineChart() {
        const ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        const timelineData = this.getTimelineData();

        if (this.charts.timeline) {
            this.charts.timeline.destroy();
        }

        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timelineData.labels,
                datasets: [
                    {
                        label: 'Effectué',
                        data: timelineData.effectue,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'À repasser',
                        data: timelineData.repasser,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Refus',
                        data: timelineData.refus,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { size: 12, weight: '600' }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Obtenir le montant par status
    getAmountByStatus(status) {
        const distributions = this.getFilteredDistributions();
        return distributions
            .filter(d => d.status === status)
            .reduce((sum, d) => sum + (d.amount || 0), 0);
    }

    // Obtenir les données de la timeline
    getTimelineData() {
        const distributions = this.getFilteredDistributions();

        if (distributions.length === 0) {
            return {
                labels: ['Aucune donnée'],
                effectue: [0],
                repasser: [0],
                refus: [0]
            };
        }

        // Grouper par date
        const byDate = {};
        distributions.forEach(dist => {
            const date = new Date(dist.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short'
            });
            if (!byDate[date]) {
                byDate[date] = { effectue: 0, repasser: 0, refus: 0 };
            }
            byDate[date][dist.status]++;
        });

        // Trier par date et créer les arrays
        const dates = Object.keys(byDate).sort((a, b) => {
            const dateA = new Date(a.split(' ').reverse().join(' '));
            const dateB = new Date(b.split(' ').reverse().join(' '));
            return dateA - dateB;
        });

        return {
            labels: dates,
            effectue: dates.map(d => byDate[d].effectue),
            repasser: dates.map(d => byDate[d].repasser),
            refus: dates.map(d => byDate[d].refus)
        };
    }

    // ============================================
    // UTILITAIRES GÉOSPATIAUX
    // ============================================

    /**
     * Vérifie si un point est à l'intérieur d'une zone
     * @param {Object} point - {lat, lng}
     * @param {L.Layer} zoneLayer - Leaflet layer (polygon, circle, rectangle)
     * @return {boolean}
     */
    isPointInZone(point, zoneLayer) {
        if (zoneLayer instanceof L.Circle) {
            const center = zoneLayer.getLatLng();
            const radius = zoneLayer.getRadius();
            const distance = this.map.distance([point.lat, point.lng], center);
            return distance <= radius;
        } else if (zoneLayer instanceof L.Polygon || zoneLayer instanceof L.Rectangle) {
            // Utiliser le ray casting algorithm pour les polygones
            const latLng = L.latLng(point.lat, point.lng);
            const bounds = zoneLayer.getBounds();

            // Vérification rapide avec bounding box
            if (!bounds.contains(latLng)) return false;

            // Ray casting pour détection précise
            return this.raycastPointInPolygon(latLng, zoneLayer.getLatLngs()[0]);
        }
        return false;
    }

    /**
     * Algorithme de ray casting pour déterminer si un point est dans un polygone
     * @param {L.LatLng} point - Point à tester
     * @param {Array} polygon - Array de L.LatLng représentant le polygone
     * @return {boolean}
     */
    raycastPointInPolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat, yi = polygon[i].lng;
            const xj = polygon[j].lat, yj = polygon[j].lng;

            const intersect = ((yi > point.lng) !== (yj > point.lng))
                && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Récupère toutes les distributions dans une zone donnée
     * @param {L.Layer} zoneLayer - La zone Leaflet
     * @return {Array} - Array des distributions dans la zone
     */
    getDistributionsInZone(zoneLayer) {
        return this.distributions.filter(dist =>
            this.isPointInZone({lat: dist.lat, lng: dist.lng}, zoneLayer)
        );
    }

    // ============================================
    // SYSTÈME DE FILTRAGE MULTI-CRITÈRES
    // ============================================

    /**
     * Appliquer tous les filtres actifs aux distributions
     * @return {Array} - Array des distributions filtrées
     */
    applyAllFilters() {
        let filtered = [...this.distributions];

        // Filtre par statut
        if (this.filters.status !== 'all') {
            filtered = filtered.filter(d => d.status === this.filters.status);
        }

        // Filtre par recherche texte
        if (this.filters.searchQuery) {
            const query = this.filters.searchQuery.toLowerCase();
            filtered = filtered.filter(d =>
                d.address.toLowerCase().includes(query) ||
                (d.notes && d.notes.toLowerCase().includes(query))
            );
        }

        // Filtre par plage de dates
        if (this.filters.dateFrom || this.filters.dateTo) {
            filtered = filtered.filter(d => {
                const distDate = new Date(d.createdAt || d.updatedAt);
                if (this.filters.dateFrom && distDate < this.filters.dateFrom) return false;
                if (this.filters.dateTo && distDate > this.filters.dateTo) return false;
                return true;
            });
        }

        // Filtre par moyen de paiement
        if (this.filters.payment !== 'all') {
            if (this.filters.payment === 'unspecified') {
                filtered = filtered.filter(d => !d.payment || d.payment === '');
            } else {
                filtered = filtered.filter(d => d.payment === this.filters.payment);
            }
        }

        // Filtre par binôme
        if (this.filters.binome !== 'all') {
            filtered = filtered.filter(d => d.binome_id === this.filters.binome);
        }

        // Filtre par zone géographique
        if (this.filters.zone !== null) {
            const zone = this.zones.find(z => z.id === this.filters.zone);
            if (zone) {
                // Trouver le layer correspondant
                let zoneLayer = null;
                let index = 0;
                this.drawnItems.eachLayer((layer) => {
                    if (this.zones[index]?.id === this.filters.zone) {
                        zoneLayer = layer;
                    }
                    index++;
                });

                if (zoneLayer) {
                    filtered = filtered.filter(d =>
                        this.isPointInZone({lat: d.lat, lng: d.lng}, zoneLayer)
                    );
                }
            }
        }

        return filtered;
    }

    /**
     * Mettre à jour la vue filtrée (liste ET carte)
     */
    updateFilteredView() {
        const filtered = this.applyAllFilters();

        // Mettre à jour la liste
        this.renderFilteredList(filtered);

        // Mettre à jour les marqueurs sur la carte
        this.updateFilteredMarkers(filtered);

        // Mettre à jour le compteur de filtres actifs
        this.updateActiveFiltersCount();
    }

    /**
     * Afficher la liste filtrée
     * @param {Array} filtered - Distributions filtrées
     */
    renderFilteredList(filtered) {
        const container = document.getElementById('distributions-list');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-state">Aucune distribution trouvée</p>';
            return;
        }

        const statusLabels = {
            effectue: '✅ Effectué',
            repasser: '🔄 À repasser',
            refus: '❌ Refus'
        };

        const paymentLabels = {
            espece: '💵 Espèces',
            cheque: '💳 Chèque'
        };

        container.innerHTML = filtered.map(dist => `
            <div class="distribution-item status-${dist.status}" data-id="${dist.id}">
                <div class="dist-address">${dist.address}</div>
                <div class="dist-info">
                    <span class="dist-status ${dist.status}">${statusLabels[dist.status]}</span>
                    ${dist.amount > 0 ? `<span><strong>${(parseFloat(dist.amount) || 0).toFixed(2)} €</strong></span>` : ''}
                    ${dist.payment ? `<span>${paymentLabels[dist.payment]}</span>` : ''}
                </div>
                ${dist.notes ? `<div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${dist.notes}</div>` : ''}
                <div class="dist-actions">
                    <button class="btn-edit" onclick="app.openDistributionModal('${dist.id}')">Modifier</button>
                    <button class="btn-delete" onclick="app.deleteDistribution('${dist.id}')">Supprimer</button>
                </div>
            </div>
        `).join('');

        // Ajouter les event listeners pour centrer sur la carte au click
        container.querySelectorAll('.distribution-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn-edit') && !e.target.classList.contains('btn-delete')) {
                    const id = item.dataset.id;
                    const dist = this.distributions.find(d => d.id === id);
                    if (dist) {
                        // Switcher vers l'onglet carte
                        document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
                            btn.classList.remove('active');
                            if (btn.dataset.tab === 'map') {
                                btn.classList.add('active');
                            }
                        });
                        document.querySelectorAll('.tab-content').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        document.getElementById('map-tab').classList.add('active');

                        // Centrer sur la distribution
                        this.map.setView([dist.lat, dist.lng], 18);
                        if (this.distributionMarkers[id]) {
                            this.distributionMarkers[id].openPopup();
                        }
                    }
                }
            });
        });
    }

    /**
     * Mettre à jour les marqueurs sur la carte (opacité selon filtre)
     * @param {Array} filtered - Distributions filtrées
     */
    updateFilteredMarkers(filtered) {
        const filteredIds = new Set(filtered.map(d => d.id));

        // Parcourir tous les marqueurs
        Object.keys(this.distributionMarkers).forEach(id => {
            const marker = this.distributionMarkers[id];
            if (marker) {
                if (filteredIds.has(id)) {
                    marker.setOpacity(1); // Visible
                } else {
                    marker.setOpacity(0.2); // Dim (grisé)
                }
            }
        });
    }

    /**
     * Calculer et afficher le nombre de filtres actifs
     */
    updateActiveFiltersCount() {
        let count = 0;

        if (this.filters.status !== 'all') count++;
        if (this.filters.searchQuery) count++;
        if (this.filters.dateFrom || this.filters.dateTo) count++;
        if (this.filters.payment !== 'all') count++;
        if (this.filters.binome !== 'all') count++;
        if (this.filters.zone !== null) count++;

        this.activeFiltersCount = count;

        // Mettre à jour le badge UI
        const badge = document.getElementById('active-filters-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Réinitialiser tous les filtres
     */
    clearAllFilters() {
        this.filters = {
            status: 'all',
            searchQuery: '',
            dateFrom: null,
            dateTo: null,
            payment: 'all',
            binome: 'all',
            zone: null
        };

        // Réinitialiser l'UI
        const paymentSelect = document.getElementById('filter-payment');
        if (paymentSelect) paymentSelect.value = 'all';

        const binomeSelect = document.getElementById('filter-binome');
        if (binomeSelect) binomeSelect.value = 'all';

        const zoneSelect = document.getElementById('filter-zone');
        if (zoneSelect) zoneSelect.value = '';

        const searchInput = document.getElementById('quick-search-input');
        if (searchInput) searchInput.value = '';

        const dateFrom = document.getElementById('date-from');
        if (dateFrom) dateFrom.value = '';

        const dateTo = document.getElementById('date-to');
        if (dateTo) dateTo.value = '';

        // Réinitialiser les boutons de statut
        document.querySelectorAll('[data-filter-type="status"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filterValue === 'all');
        });

        this.updateFilteredView();
        this.notifyUser('Filtres réinitialisés', 'info');
    }

    /**
     * Peupler le filtre binôme avec les valeurs uniques depuis les distributions
     */
    populateBinomeFilter() {
        const binomeSelect = document.getElementById('filter-binome');
        if (!binomeSelect) return;

        // Récupérer les binômes uniques
        const uniqueBinomes = [...new Set(
            this.distributions
                .map(d => d.binome)
                .filter(b => b && b.trim() !== '')
        )].sort();

        // Vider les options existantes (sauf "Tous")
        binomeSelect.innerHTML = '<option value="all">Tous</option>';

        // Ajouter les binômes
        uniqueBinomes.forEach(binome => {
            const option = document.createElement('option');
            option.value = binome;
            option.textContent = binome;
            binomeSelect.appendChild(option);
        });

        console.log(`${uniqueBinomes.length} binôme(s) chargé(s) dans le filtre`);
    }

    /**
     * Peupler le filtre zone avec les zones existantes
     */
    populateZoneFilter() {
        const zoneSelect = document.getElementById('filter-zone');
        if (!zoneSelect) return;

        // Vider les options existantes (sauf "Toutes les zones")
        zoneSelect.innerHTML = '<option value="">Toutes les zones</option>';

        // Parcourir les zones dessinées
        this.drawnItems.eachLayer(layer => {
            const zoneId = layer._leaflet_id;
            let zoneName = `Zone ${zoneId}`;
            let zoneColor = '#10b981';

            // Chercher les métadonnées dans localStorage
            const savedZones = JSON.parse(localStorage.getItem('zones') || '[]');
            const savedZone = savedZones.find(z => z.id === `zone-${zoneId}`);
            if (savedZone) {
                zoneName = savedZone.name || zoneName;
                zoneColor = savedZone.color || zoneColor;
            }

            const option = document.createElement('option');
            option.value = zoneId;
            option.textContent = zoneName;
            option.style.color = zoneColor;
            zoneSelect.appendChild(option);
        });

        console.log(`${this.drawnItems.getLayers().length} zone(s) chargée(s) dans le filtre`);
    }

    // ============================================
    // INITIALISATION
    // ============================================

    // Initialiser les écouteurs d'événements
    initEventListeners() {
        // Bouton Ajouter dans la bottom nav
        const addBtnBottom = document.getElementById('add-distribution-btn-bottom');
        if (addBtnBottom) {
            addBtnBottom.addEventListener('click', () => {
                this.openDistributionModal();
            });
        }

        // Fermer le modal distribution
        document.getElementById('close-modal-btn').addEventListener('click', () => {
            this.closeDistributionModal();
        });

        document.getElementById('cancel-modal-btn').addEventListener('click', () => {
            this.closeDistributionModal();
        });

        // Fermer le modal en cliquant à l'extérieur
        document.getElementById('distribution-modal').addEventListener('click', (e) => {
            if (e.target.id === 'distribution-modal') {
                this.closeDistributionModal();
            }
        });

        // ============================================
        // EVENT LISTENERS MODAL ZONE
        // ============================================

        // Soumettre le formulaire de zone
        const zoneForm = document.getElementById('zone-form');
        if (zoneForm) {
            zoneForm.addEventListener('submit', (e) => this.handleZoneFormSubmit(e));
        }

        // Fermer le modal zone
        const closeZoneModal = document.getElementById('close-zone-modal');
        if (closeZoneModal) {
            closeZoneModal.addEventListener('click', () => {
                document.getElementById('zone-modal').classList.remove('active');
                this.editingZoneLayer = null;
            });
        }

        // Annuler le modal zone
        const cancelZoneModal = document.getElementById('cancel-zone-modal');
        if (cancelZoneModal) {
            cancelZoneModal.addEventListener('click', () => {
                document.getElementById('zone-modal').classList.remove('active');
                this.editingZoneLayer = null;
            });
        }

        // Boutons de preset de couleur
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                document.getElementById('zone-color').value = color;
            });
        });

        // Fermer le modal zone en cliquant à l'extérieur
        const zoneModal = document.getElementById('zone-modal');
        if (zoneModal) {
            zoneModal.addEventListener('click', (e) => {
                if (e.target.id === 'zone-modal') {
                    zoneModal.classList.remove('active');
                    this.editingZoneLayer = null;
                }
            });
        }
    }

    /**
     * Initialize offline mode detection
     */
    initOfflineMode() {
        // Fonction pour mettre à jour le statut
        const updateConnectionStatus = () => {
            const isOnline = navigator.onLine;
            const indicator = document.getElementById('status-indicator');
            const statusText = document.getElementById('status-text');
            const pendingCount = document.getElementById('pending-count');

            if (indicator) {
                if (isOnline) {
                    indicator.classList.remove('offline');
                    statusText.textContent = 'En ligne';
                } else {
                    indicator.classList.add('offline');
                    statusText.textContent = 'Hors ligne';
                }
            }

            // Afficher le nombre de modifications en attente (simulé)
            // Dans une vraie implémentation, on compterait les modifications non synchronisées
            if (pendingCount && !isOnline) {
                const pendingChanges = this.getPendingChangesCount();
                if (pendingChanges > 0) {
                    pendingCount.textContent = `${pendingChanges} en attente`;
                    pendingCount.style.display = 'inline';
                } else {
                    pendingCount.style.display = 'none';
                }
            } else if (pendingCount) {
                pendingCount.style.display = 'none';
            }
        };

        // Écouter les changements de statut réseau
        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);

        // Mise à jour initiale
        updateConnectionStatus();

        console.log('[OFFLINE MODE] Detection initialized');
    }

    /**
     * Get count of pending changes (not yet synced)
     */
    getPendingChangesCount() {
        // Dans une implémentation réelle, on vérifierait quelles distributions
        // ont été modifiées localement mais pas encore synchronisées
        // Pour l'instant, on retourne 0
        return 0;
    }

    // ========================================
    // NOCODB INTEGRATION
    // ========================================

    /**
     * Initialize NocoDB connection
     */
    initNocoDBConnection() {
        // Check if config is loaded
        if (typeof NOCODB_CONFIG === 'undefined') {
            console.warn('NocoDB config not found. Please create nocodb-config.js');
            this.updateSyncStatus('Configuration manquante', 'error');
            return;
        }

        // Check required config
        if (!NOCODB_CONFIG.baseUrl || !NOCODB_CONFIG.apiToken) {
            console.error('NocoDB baseUrl and apiToken are required in nocodb-config.js');
            this.updateSyncStatus('Configuration incomplète', 'error');
            return;
        }

        // NocoDB is ready immediately - no OAuth needed
        this.nocoDBReady = true;
        console.log('NocoDB ready:', NOCODB_CONFIG.baseUrl);

        // Setup sync button event (if button exists)
        const syncBtn = document.getElementById('sync-now-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                this.syncWithNocoDB();
            });
        }

        // Auto-sync on startup
        setTimeout(() => {
            this.syncWithNocoDB();
        }, 1000);
    }

    /**
     * Initialize binôme autocomplete for zone assignment
     */
    initBinomeAutocomplete() {
        const input = document.getElementById('zone-binome');
        const suggestionsContainer = document.getElementById('zone-binome-suggestions');

        if (!input || !suggestionsContainer) return;

        let selectedIndex = -1;

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();

            if (query.length === 0) {
                suggestionsContainer.classList.remove('active');
                return;
            }

            // Filter binômes based on query
            const matches = this.binomes.filter(binome =>
                binome.binome_name.toLowerCase().includes(query) ||
                binome.username.toLowerCase().includes(query)
            );

            if (matches.length === 0) {
                suggestionsContainer.classList.remove('active');
                return;
            }

            // Display suggestions
            suggestionsContainer.innerHTML = matches.map((binome, index) => `
                <div class="autocomplete-suggestion" data-index="${index}" data-username="${binome.username}">
                    <span class="binome-name">${binome.binome_name}</span>
                    <span class="binome-username">@${binome.username}</span>
                </div>
            `).join('');

            suggestionsContainer.classList.add('active');
            selectedIndex = -1;

            // Add click handlers to suggestions
            suggestionsContainer.querySelectorAll('.autocomplete-suggestion').forEach(el => {
                el.addEventListener('click', () => {
                    const username = el.dataset.username;
                    const binome = matches.find(b => b.username === username);
                    this.selectBinome(binome, input, suggestionsContainer);
                });
            });
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            const suggestions = suggestionsContainer.querySelectorAll('.autocomplete-suggestion');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                this.highlightSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                this.highlightSuggestion(suggestions, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                suggestions[selectedIndex].click();
            } else if (e.key === 'Escape') {
                suggestionsContainer.classList.remove('active');
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.remove('active');
            }
        });
    }

    /**
     * Highlight a suggestion in the autocomplete
     */
    highlightSuggestion(suggestions, index) {
        suggestions.forEach((el, i) => {
            if (i === index) {
                el.classList.add('selected');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('selected');
            }
        });
    }

    /**
     * Select a binôme from autocomplete
     */
    selectBinome(binome, input, suggestionsContainer) {
        this.selectedBinome = binome;
        input.value = binome.binome_name;
        suggestionsContainer.classList.remove('active');
        console.log(`[BINOMES] Selected: ${binome.binome_name} (@${binome.username})`);
    }

    /**
     * Fetch all binômes from NocoDB for zone assignment
     */
    async fetchBinomes() {
        try {
            const baseUrl = NOCODB_CONFIG.baseUrl;
            const apiToken = NOCODB_CONFIG.apiToken;

            // Get project ID
            const projectsResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });
            const projects = await projectsResponse.json();
            const projectId = NOCODB_CONFIG.projectId || projects.list?.[0]?.id;

            if (!projectId) {
                console.error('No project found in NocoDB');
                return;
            }

            // Get Binomes table
            const tablesResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/${projectId}/tables`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });
            const tables = await tablesResponse.json();
            const binomesTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.binomes);

            if (!binomesTable) {
                console.error('Binomes table not found');
                return;
            }

            // Fetch all binômes
            const binomesResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${binomesTable.title}`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });
            const data = await binomesResponse.json();
            this.binomes = data.list || [];

            console.log(`[BINOMES] Loaded ${this.binomes.length} binômes for zone assignment`);
        } catch (error) {
            console.error('[BINOMES] Error fetching binômes:', error);
        }
    }

    /**
     * Update sync status message
     */
    updateSyncStatus(message, type = 'info') {
        const syncStatus = document.getElementById('sync-status');
        if (!syncStatus) {
            // Si l'élément n'existe pas, afficher dans la console
            console.log(`[SYNC] ${message} (${type})`);
            return;
        }

        syncStatus.textContent = message;
        syncStatus.className = 'sync-status';

        if (type === 'syncing') {
            syncStatus.classList.add('syncing');
        } else if (type === 'success') {
            syncStatus.classList.add('synced');
        } else if (type === 'error') {
            syncStatus.classList.add('error');
        }
    }

    /**
     * Sync data with NocoDB
     */
    async syncWithNocoDB() {
        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        this.syncInProgress = true;
        this.updateSyncStatus('Synchronisation en cours...', 'syncing');

        try {
            // Read data from NocoDB
            const nocoDBData = await this.readFromNocoDB();

            // Merge with local data
            await this.mergeData(nocoDBData);

            // Write local data back to NocoDB
            await this.writeToNocoDB();

            this.lastSyncTime = new Date();
            this.updateSyncStatus(`Dernière sync: ${this.lastSyncTime.toLocaleTimeString()}`, 'success');

            console.log('Sync completed successfully');
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('Erreur de synchronisation', 'error');
            alert('Erreur lors de la synchronisation: ' + error.message);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Read data from NocoDB
     */
    async readFromNocoDB() {
        const baseUrl = NOCODB_CONFIG.baseUrl;
        const apiToken = NOCODB_CONFIG.apiToken;

        try {
            // First, get the list of projects to find our project ID
            const projectsResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/`, {
                method: 'GET',
                headers: {
                    'xc-token': apiToken
                }
            });

            if (!projectsResponse.ok) {
                throw new Error(`Failed to fetch projects: ${projectsResponse.statusText}`);
            }

            const projects = await projectsResponse.json();
            console.log('NocoDB Projects:', projects);

            // Use the first project if not specified in config
            const projectId = NOCODB_CONFIG.projectId || (projects.list && projects.list[0]?.id);

            if (!projectId) {
                throw new Error('No project found in NocoDB');
            }

            // Get tables metadata
            const tablesResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/${projectId}/tables`, {
                method: 'GET',
                headers: {
                    'xc-token': apiToken
                }
            });

            if (!tablesResponse.ok) {
                throw new Error(`Failed to fetch tables: ${tablesResponse.statusText}`);
            }

            const tables = await tablesResponse.json();
            console.log('NocoDB Tables:', tables);

            // Find Distributions and Zones tables
            const distributionsTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.distributions);
            const zonesTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.zones);

            const result = {
                distributions: [],
                zones: []
            };

            // Read distributions
            if (distributionsTable) {
                const distResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}`, {
                    method: 'GET',
                    headers: {
                        'xc-token': apiToken
                    }
                });

                if (distResponse.ok) {
                    const distData = await distResponse.json();
                    let allDistributions = distData.list || distData.pageInfo?.totalRows > 0 ? distData.list : [];

                    // Filter based on user permissions
                    if (this.auth.isAdmin()) {
                        result.distributions = allDistributions;
                    } else {
                        result.distributions = allDistributions.filter(dist =>
                            dist.binome_id === this.auth.getCurrentUser().username
                        );
                    }
                    console.log(`[SYNC] Loaded ${result.distributions.length}/${allDistributions.length} distributions from NocoDB`);
                }
            }

            // Read zones
            if (zonesTable) {
                const zonesResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${zonesTable.title}`, {
                    method: 'GET',
                    headers: {
                        'xc-token': apiToken
                    }
                });

                if (zonesResponse.ok) {
                    const zonesData = await zonesResponse.json();
                    let allZones = zonesData.list || zonesData.pageInfo?.totalRows > 0 ? zonesData.list : [];

                    // Filter based on user permissions (zones don't have direct filtering in current implementation)
                    // For now, load all zones and let client-side filtering handle it
                    result.zones = allZones;
                    console.log(`[SYNC] Loaded ${result.zones.length} zones from NocoDB`);
                }
            }

            console.log('Read from NocoDB:', result);
            return result;
        } catch (error) {
            console.error('Error reading from NocoDB:', error);
            throw error;
        }
    }

    /**
     * Write data to NocoDB - SMART SYNC
     */
    async writeToNocoDB() {
        const baseUrl = NOCODB_CONFIG.baseUrl;
        const apiToken = NOCODB_CONFIG.apiToken;

        try {
            // First, get project and tables info
            const projectsResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/`, {
                method: 'GET',
                headers: {
                    'xc-token': apiToken
                }
            });

            if (!projectsResponse.ok) {
                throw new Error(`Failed to fetch projects: ${projectsResponse.statusText}`);
            }

            const projects = await projectsResponse.json();
            const projectId = NOCODB_CONFIG.projectId || (projects.list && projects.list[0]?.id);

            if (!projectId) {
                throw new Error('No project found in NocoDB');
            }

            // Get tables
            const tablesResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/${projectId}/tables`, {
                method: 'GET',
                headers: {
                    'xc-token': apiToken
                }
            });

            if (!tablesResponse.ok) {
                throw new Error(`Failed to fetch tables: ${tablesResponse.statusText}`);
            }

            const tables = await tablesResponse.json();
            const distributionsTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.distributions);
            const zonesTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.zones);

            // NOUVELLE APPROCHE: Utiliser l'ID local comme clé unique
            if (distributionsTable) {
                // Get existing records from NocoDB
                const existingDistResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}?limit=1000`, {
                    method: 'GET',
                    headers: {
                        'xc-token': apiToken
                    }
                });

                let existingRecords = [];
                if (existingDistResponse.ok) {
                    const data = await existingDistResponse.json();
                    existingRecords = data.list || [];
                    console.log(`[SYNC] Found ${existingRecords.length} existing distribution(s) in NocoDB`);
                }

                // Créer des maps des enregistrements existants
                const existingByNocoId = {};
                const existingByLocalId = {};
                const existingByAddress = {};

                existingRecords.forEach(record => {
                    const nocoId = record.Id || record.id;
                    existingByNocoId[nocoId] = record;

                    // Indexer par l'ID local si disponible
                    if (record.localId) {
                        existingByLocalId[record.localId] = record;
                    }

                    // Indexer par adresse pour la migration (fallback)
                    if (record.address) {
                        existingByAddress[record.address] = record;
                    }
                });

                // Créer un Set des IDs locaux
                const localIds = new Set(this.distributions.map(d => d.id));
                const localAddresses = new Set(this.distributions.map(d => d.address));
                console.log(`[SYNC] Found ${this.distributions.length} local distribution(s)`);

                // DELETE: Supprimer les enregistrements qui n'existent plus localement
                for (const record of existingRecords) {
                    const nocoId = record.Id || record.id;

                    // Si le record a un localId, vérifier s'il existe encore localement
                    // Sinon, vérifier par adresse (pour les anciens records)
                    let shouldDelete = false;

                    if (record.localId) {
                        shouldDelete = !localIds.has(record.localId);
                    } else {
                        // Ancien record sans localId: vérifier par adresse
                        shouldDelete = !localAddresses.has(record.address);
                    }

                    if (shouldDelete) {
                        console.log(`[DELETE] ${record.address} (Local ID: ${record.localId || 'N/A'}, NocoDB ID: ${nocoId})`);
                        const deleteResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}/${nocoId}`, {
                            method: 'DELETE',
                            headers: {
                                'xc-token': apiToken
                            }
                        });
                        if (deleteResponse.ok) {
                            console.log(`  ✓ Deleted successfully`);
                        } else {
                            console.error(`  ✗ Delete failed: ${deleteResponse.statusText}`);
                        }
                    }
                }

                // CREATE or UPDATE: Traiter chaque distribution locale
                for (const dist of this.distributions) {
                    // Chercher l'enregistrement existant:
                    // 1. D'abord par localId (nouveau système)
                    // 2. Sinon par adresse (migration depuis ancien système)
                    let existingRecord = existingByLocalId[dist.id];

                    if (!existingRecord && dist.address) {
                        existingRecord = existingByAddress[dist.address];
                        if (existingRecord) {
                            console.log(`[MIGRATION] Matching "${dist.address}" by address (will add localId)`);
                        }
                    }

                    const distData = {
                        localId: dist.id,  // IMPORTANT: Stocker l'ID local
                        address: dist.address,
                        lat: dist.lat,
                        lng: dist.lng,
                        status: dist.status,
                        amount: dist.amount || 0,
                        payment: dist.payment || '',
                        notes: dist.notes || '',
                        updatedAt: dist.updatedAt || new Date().toISOString()
                    };

                    // DEBUG: Afficher les données envoyées
                    console.log(`[DEBUG] Distribution data:`, {
                        id: dist.id,
                        address: dist.address,
                        lat: dist.lat,
                        lng: dist.lng,
                        hasAddress: !!dist.address,
                        addressLength: dist.address?.length
                    });

                    if (existingRecord) {
                        // UPDATE: L'enregistrement existe déjà
                        const nocoId = existingRecord.Id || existingRecord.id;
                        console.log(`[UPDATE] ${dist.address} (Local ID: ${dist.id}, NocoDB ID: ${nocoId})`);
                        console.log(`[DEBUG] Update payload:`, JSON.stringify(distData, null, 2));

                        const updateResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}/${nocoId}`, {
                            method: 'PATCH',
                            headers: {
                                'xc-token': apiToken,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(distData)
                        });

                        if (updateResponse.ok) {
                            const responseData = await updateResponse.json();
                            console.log(`  ✓ Updated successfully`, responseData);
                        } else {
                            const errorText = await updateResponse.text();
                            console.error(`  ✗ Update failed: ${updateResponse.statusText} - ${errorText}`);
                        }
                    } else {
                        // CREATE: Nouvel enregistrement
                        console.log(`[CREATE] ${dist.address} (Local ID: ${dist.id})`);
                        distData.createdAt = dist.createdAt || new Date().toISOString();
                        console.log(`[DEBUG] Create payload:`, JSON.stringify(distData, null, 2));

                        const createResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}`, {
                            method: 'POST',
                            headers: {
                                'xc-token': apiToken,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(distData)
                        });

                        if (createResponse.ok) {
                            const responseData = await createResponse.json();
                            console.log(`  ✓ Created successfully`, responseData);
                        } else {
                            const errorText = await createResponse.text();
                            console.error(`  ✗ Create failed: ${createResponse.statusText} - ${errorText}`);
                        }
                    }
                }
            }

            // Write zones
            console.log('[ZONES SYNC] zonesTable:', zonesTable);
            console.log('[ZONES SYNC] this.zones:', this.zones);
            console.log('[ZONES SYNC] zones count:', this.zones.length);

            if (zonesTable) {
                console.log('[ZONES SYNC] Writing zones to NocoDB...');
                // Get existing records
                const existingZonesResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${zonesTable.title}`, {
                    method: 'GET',
                    headers: {
                        'xc-token': apiToken
                    }
                });

                if (existingZonesResponse.ok) {
                    const existingZones = await existingZonesResponse.json();

                    // Delete existing records
                    for (const record of (existingZones.list || [])) {
                        // Utiliser Id (majuscule) ou id (minuscule) selon ce que NocoDB retourne
                        const recordId = record.Id || record.id;
                        await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${zonesTable.title}/${recordId}`, {
                            method: 'DELETE',
                            headers: {
                                'xc-token': apiToken
                            }
                        });
                    }
                }

                // Insert new zones
                console.log('[ZONES SYNC] Inserting', this.zones.length, 'zones...');
                for (let i = 0; i < this.zones.length; i++) {
                    const zone = this.zones[i];
                    console.log('[ZONES SYNC] Zone', i, ':', zone);

                    const payload = {
                        name: zone.name || `Zone ${i + 1}`,
                        geojson: JSON.stringify(zone.geojson),
                        color: zone.color || '#10b981',
                        binome_username: zone.binome_username || null,
                        binome_name: zone.binome_name || null
                    };
                    console.log('[ZONES SYNC] Payload:', payload);

                    const response = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${zonesTable.title}`, {
                        method: 'POST',
                        headers: {
                            'xc-token': apiToken,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('[ZONES SYNC] ✓ Zone inserted:', result);
                    } else {
                        const error = await response.text();
                        console.error('[ZONES SYNC] ✗ Failed to insert zone:', error);
                    }
                }
                console.log('[ZONES SYNC] All zones written successfully');
            }

            console.log('Written to NocoDB successfully');
        } catch (error) {
            console.error('Error writing to NocoDB:', error);
            throw error;
        }
    }

    /**
     * UTILITAIRE: Nettoyer les doublons dans NocoDB
     * À utiliser une fois pour nettoyer la base de données
     */
    async cleanupDuplicatesInNocoDB() {
        const baseUrl = NOCODB_CONFIG.baseUrl;
        const apiToken = NOCODB_CONFIG.apiToken;

        try {
            console.log('[CLEANUP] Starting duplicate cleanup...');

            // Get project and tables info
            const projectsResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });

            const projects = await projectsResponse.json();
            const projectId = NOCODB_CONFIG.projectId || (projects.list && projects.list[0]?.id);

            const tablesResponse = await fetch(`${baseUrl}/api/v1/db/meta/projects/${projectId}/tables`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });

            const tables = await tablesResponse.json();
            const distributionsTable = tables.list?.find(t => t.title === NOCODB_CONFIG.tables.distributions);

            if (!distributionsTable) {
                throw new Error('Distributions table not found');
            }

            // Get all records
            const response = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}?limit=1000`, {
                method: 'GET',
                headers: { 'xc-token': apiToken }
            });

            const data = await response.json();
            const allRecords = data.list || [];

            console.log(`[CLEANUP] Found ${allRecords.length} total records`);

            // Group by address
            const addressGroups = {};
            allRecords.forEach(record => {
                const addr = record.address;
                if (!addressGroups[addr]) {
                    addressGroups[addr] = [];
                }
                addressGroups[addr].push(record);
            });

            // Find and delete duplicates
            let deletedCount = 0;
            for (const [address, records] of Object.entries(addressGroups)) {
                if (records.length > 1) {
                    console.log(`[CLEANUP] Found ${records.length} duplicates for: ${address}`);

                    // Garder le premier, supprimer les autres
                    for (let i = 1; i < records.length; i++) {
                        const record = records[i];
                        const nocoId = record.Id || record.id;

                        console.log(`  - Deleting duplicate (ID: ${nocoId})`);
                        const deleteResponse = await fetch(`${baseUrl}/api/v1/db/data/noco/${projectId}/${distributionsTable.title}/${nocoId}`, {
                            method: 'DELETE',
                            headers: { 'xc-token': apiToken }
                        });

                        if (deleteResponse.ok) {
                            deletedCount++;
                            console.log(`    ✓ Deleted`);
                        } else {
                            console.error(`    ✗ Failed: ${deleteResponse.statusText}`);
                        }
                    }
                }
            }

            console.log(`[CLEANUP] Finished! Deleted ${deletedCount} duplicate(s)`);
            alert(`Nettoyage terminé! ${deletedCount} doublon(s) supprimé(s)`);

        } catch (error) {
            console.error('[CLEANUP] Error:', error);
            alert('Erreur lors du nettoyage: ' + error.message);
        }
    }

    /**
     * Merge data from NocoDB with local data
     */
    async mergeData(nocoDBData) {
        // SMART MERGE: Only update from NocoDB on initial load
        // After initial load, local changes take precedence

        // If NocoDB has data, merge it intelligently
        if (nocoDBData.distributions && nocoDBData.distributions.length > 0) {
            // Only fully replace if local storage is empty (first load)
            if (this.distributions.length === 0) {
                console.log('[MERGE] Initial load: Using NocoDB data');
                // Map NocoDB fields to local format
                this.distributions = nocoDBData.distributions.map(dist => ({
                    // Utiliser localId si disponible, sinon générer un nouvel ID
                    id: dist.localId || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    address: dist.address,
                    lat: dist.lat,
                    lng: dist.lng,
                    status: dist.status,
                    amount: dist.amount || 0,
                    payment: dist.payment || '',
                    notes: dist.notes || '',
                    createdAt: dist.createdAt,
                    updatedAt: dist.updatedAt
                }));

                this.updateMapMarkers();
                this.updateStatistics();
                this.renderDistributionsList();
                this.saveDistributionsToStorage();
            } else {
                // If we have local data, don't overwrite it
                // The sync from local -> NocoDB already happened in writeToNocoDB()
                console.log('[MERGE] Local data exists: Keeping local changes');
            }
        }

        // Merge zones
        if (nocoDBData.zones && nocoDBData.zones.length > 0) {
            // Only merge zones if we don't have local zones already
            // (to avoid overwriting zones that were just created)
            const hasLocalZones = this.drawnItems.getLayers().length > 0;

            if (!hasLocalZones) {
                console.log('[MERGE ZONES] Loading zones from NocoDB');
                this.drawnItems.clearLayers();
                this.zones = [];

                nocoDBData.zones.forEach(zoneData => {
                // Parse GeoJSON if it's a string
                const geojson = typeof zoneData.geojson === 'string'
                    ? JSON.parse(zoneData.geojson)
                    : zoneData.geojson;

                const zoneColor = zoneData.color || '#10b981';
                const layer = L.geoJSON(geojson, {
                    interactive: false,
                    style: {
                        color: zoneColor,
                        fillColor: zoneColor,
                        fillOpacity: 0.2,
                        weight: 2
                    }
                });

                layer.eachLayer(l => {
                    this.drawnItems.addLayer(l);
                });

                this.zones.push({
                    id: zoneData.id || `zone-${Date.now()}-${this.zones.length}`,
                    name: zoneData.name,
                    color: zoneData.color || '#10b981',
                    binome_username: zoneData.binome_username || null,
                    binome_name: zoneData.binome_name || null,
                    geojson: geojson,
                    createdAt: zoneData.createdAt || new Date().toISOString(),
                    updatedAt: zoneData.updatedAt || new Date().toISOString()
                });
                });

                this.updateZonesCount();

            // Sauvegarder dans localStorage SANS déclencher de nouvelle sync
            // (on est déjà en train de synchroniser !)
            try {
                const zonesData = [];
                this.drawnItems.eachLayer((layer) => {
                    const geoJSON = layer.toGeoJSON();
                    let layerData = {
                        type: 'Feature',
                        geometry: geoJSON.geometry,
                        properties: {}
                    };
                    if (layer instanceof L.Circle) {
                        layerData.properties.radius = layer.getRadius();
                        layerData.properties.shapeType = 'circle';
                    }
                    zonesData.push(layerData);
                });
                    localStorage.setItem('mapZones', JSON.stringify(zonesData));
                } catch (error) {
                    console.error('Erreur de sauvegarde locale des zones:', error);
                }
            } else {
                // Local zones exist, keep them and don't overwrite
                console.log('[MERGE ZONES] Local zones exist, keeping them');
            }
        }
    }
}

// Ajouter des styles pour les animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }

    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
        }
        50% {
            transform: scale(1.02);
            box-shadow: 0 0 20px 10px rgba(102, 126, 234, 0);
        }
    }
`;
document.head.appendChild(style);

// Initialiser l'application au chargement de la page
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MapApplication();
    window.app = app; // Rendre app globale pour les event handlers
    console.log('Application de carte interactive initialisée');
});
