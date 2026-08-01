import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/register', component: () => import('../views/Register.vue') },
  {
    path: '/dashboard',
    component: () => import('../views/DashBoard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    component: () => import('@/views/Settings/Profile.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/forgot-password', component: () => import('@/views/ForgotPassword.vue') },
  { path: '/reset-password', component: () => import('@/views/ResetPassword.vue') },
  {
    path: '/groupSettings',
    component: () => import('@/views/Settings/GroupSettings.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/group/:id',
    component: () => import('../views/Group.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/join/:id', component: () => import('../views/Join.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

let authInitialized = false

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Ensure the session is fully restored before routing
  if (!authInitialized) {
    try {
      await authStore.initAuth() // fetch session + user data
    } catch (err) {
      console.warn('Auth initialization failed:', err)
    } finally {
      authInitialized = true
    }
  }

  // Redirect to login if route requires auth and user is not logged in
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { path: '/login' }
  }

  // Redirect logged-in users away from login/register
  if (['/login', '/register'].includes(to.path) && authStore.isLoggedIn) {
    return { path: '/dashboard' }
  }

  return true
})

export default router
