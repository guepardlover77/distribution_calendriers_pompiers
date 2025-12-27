import React from 'react'
import { Redirect, Route } from 'react-router-dom'
import {
  IonRouterOutlet,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { mapOutline, listOutline, statsChartOutline, settingsOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/authStore'

// Pages
import Login from '@/pages/Login'
import Map from '@/pages/Map'
import List from '@/pages/List'
import Stats from '@/pages/Stats'
import Admin from '@/pages/Admin'
import AdminBinomes from '@/pages/AdminBinomes'
import AdminZones from '@/pages/AdminZones'
import AdminLogs from '@/pages/AdminLogs'

// Protected Route wrapper
interface ProtectedRouteProps {
  component: React.ComponentType
  path: string
  exact?: boolean
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ component: Component, ...rest }) => {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn())
  const initialized = useAuthStore(state => state.initialized)

  if (!initialized) {
    return null
  }

  return (
    <Route
      {...rest}
      render={() => (isLoggedIn ? <Component /> : <Redirect to="/login" />)}
    />
  )
}

// Admin Route wrapper
const AdminRoute: React.FC<ProtectedRouteProps> = ({ component: Component, ...rest }) => {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn())
  const isAdmin = useAuthStore(state => state.isAdmin())

  return (
    <Route
      {...rest}
      render={() =>
        isLoggedIn && isAdmin ? (
          <Component />
        ) : isLoggedIn ? (
          <Redirect to="/tabs/map" />
        ) : (
          <Redirect to="/login" />
        )
      }
    />
  )
}

// Main Tabs component
const MainTabs: React.FC = () => {
  const isAdmin = useAuthStore(state => state.isAdmin())

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/map" component={Map} />
        <Route exact path="/tabs/list" component={List} />
        <Route exact path="/tabs/stats" component={Stats} />
        <AdminRoute exact path="/tabs/admin" component={Admin} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/map" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="map" href="/tabs/map">
          <IonIcon icon={mapOutline} />
          <IonLabel>Carte</IonLabel>
        </IonTabButton>

        <IonTabButton tab="list" href="/tabs/list">
          <IonIcon icon={listOutline} />
          <IonLabel>Liste</IonLabel>
        </IonTabButton>

        <IonTabButton tab="stats" href="/tabs/stats">
          <IonIcon icon={statsChartOutline} />
          <IonLabel>Stats</IonLabel>
        </IonTabButton>

        {isAdmin && (
          <IonTabButton tab="admin" href="/tabs/admin">
            <IonIcon icon={settingsOutline} />
            <IonLabel>Admin</IonLabel>
          </IonTabButton>
        )}
      </IonTabBar>
    </IonTabs>
  )
}

// App Router
const AppRouter: React.FC = () => {
  const isLoggedIn = useAuthStore(state => state.isLoggedIn())
  const initialized = useAuthStore(state => state.initialized)

  if (!initialized) {
    return null
  }

  return (
    <IonReactRouter>
      <IonRouterOutlet>
        <Route exact path="/login">
          {isLoggedIn ? <Redirect to="/tabs/map" /> : <Login />}
        </Route>

        {/* Routes Admin (hors tabs) */}
        <AdminRoute exact path="/admin/binomes" component={AdminBinomes} />
        <AdminRoute exact path="/admin/zones" component={AdminZones} />
        <AdminRoute exact path="/admin/logs" component={AdminLogs} />

        <ProtectedRoute path="/tabs" component={MainTabs} />

        <Route exact path="/">
          <Redirect to="/tabs/map" />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  )
}

export default AppRouter
