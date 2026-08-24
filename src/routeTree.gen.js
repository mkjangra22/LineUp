import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuthRouteImport } from './routes/auth'
import { Route as DashboardRouteImport } from './routes/dashboard'
import { Route as QSlugRouteImport } from './routes/q.$slug'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
})
const AuthRoute = AuthRouteImport.update({
  id: '/auth',
  path: '/auth',
  getParentRoute: () => rootRouteImport,
})
const DashboardRoute = DashboardRouteImport.update({
  id: '/dashboard',
  path: '/dashboard',
  getParentRoute: () => rootRouteImport,
})
const QSlugRoute = QSlugRouteImport.update({
  id: '/q/$slug',
  path: '/q/$slug',
  getParentRoute: () => rootRouteImport,
})

const rootRouteChildren = {
  IndexRoute: IndexRoute,
  AuthRoute: AuthRoute,
  DashboardRoute: DashboardRoute,
  QSlugRoute: QSlugRoute,
}

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)
