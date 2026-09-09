import { defineStore } from 'pinia'
import { ref } from 'vue'
import router from '@/router'
import * as authService from '@/lib/services/auth'
import * as userService from '@/lib/services/users'
import { clearSession, markSessionActive } from '@/composable/useSession'

const STORE_VERSION = 3

const cachedAuth = localStorage.getItem('auth')
if (cachedAuth) {
  try {
    const parsed = JSON.parse(cachedAuth)
    if (!parsed.version || parsed.version < STORE_VERSION || !parsed.user || !parsed.user.$id) {
      localStorage.removeItem('auth')
    }
  } catch {
    localStorage.removeItem('auth')
  }
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref(null)
    const isLoggedIn = ref(false)
    const loading = ref(false)
    const error = ref(null)
    const version = ref(STORE_VERSION)

    const setUser = (data) => {
      user.value = data
      isLoggedIn.value = !!data
    }

    const initAuth = async () => {
      loading.value = true
      try {
        const { user: data } = await authService.me()
        setUser(data)
        markSessionActive()
      } catch {
        user.value = null
        isLoggedIn.value = false
        clearSession()
      } finally {
        loading.value = false
      }
    }

    const fetchUser = async () => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.me()
        setUser(data)
      } catch (err) {
        user.value = null
        isLoggedIn.value = false
        if (err?.code !== 'unauthorized') console.error('Auth error:', err)
      } finally {
        loading.value = false
      }
    }

    const login = async (email, password) => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.login({ email, password })
        setUser(data)
        markSessionActive()
      } catch (err) {
        error.value =
          err?.code === 'password_set_required'
            ? 'Check your email for a link to set your password.'
            : err?.code === 'unauthorized'
              ? 'Invalid email or password.'
              : err?.message || 'Login failed'
      } finally {
        loading.value = false
      }
    }

    const register = async (name, email, password) => {
      loading.value = true
      error.value = null
      try {
        const { user: data } = await authService.register({ name, email, password })
        setUser(data)
        markSessionActive()
      } catch (err) {
        error.value =
          err?.code === 'conflict' ? 'Email already in use.' : err?.message || 'Registration failed'
      } finally {
        loading.value = false
      }
    }

    const logout = async () => {
      loading.value = true
      try {
        await authService.logout()
      } catch (err) {
        if (err?.status !== 401) console.error('Logout error:', err)
      }
      clearSession()
      user.value = null
      isLoggedIn.value = false
      await new Promise((r) => setTimeout(r, 50))
      router.push('/login')
      loading.value = false
    }

    const updateProfile = async ({
      name,
      email,
      password,
      currentPassword,
      avatarFile,
      removeAvatar,
    }) => {
      loading.value = true
      error.value = null
      try {
        if (name && name !== user.value?.name) {
          const { user: data } = await userService.updateProfile({ name })
          setUser(data)
        }
        if ((email && email !== user.value?.email) || password) {
          const patch = {}
          if (email && email !== user.value?.email) patch.email = email
          if (password) patch.password = password
          if (currentPassword) patch.currentPassword = currentPassword
          const { user: data } = await userService.updateProfile(patch)
          setUser(data)
        }
        if (removeAvatar) {
          await userService.deleteAvatar()
          user.value.avatarUrl = null
          user.value.avatarFileId = null
        }
        if (avatarFile) {
          const { avatarUrl } = await userService.updateAvatar(avatarFile)
          user.value.avatarUrl = avatarUrl
        }
        return { success: true }
      } catch (err) {
        console.error('Error updating profile:', err)
        error.value = err?.message || 'Profile update failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    const resetPassword = async (email) => {
      loading.value = true
      error.value = null
      try {
        await authService.forgot(email)
        return { success: true }
      } catch (err) {
        error.value = err?.message || 'Password reset failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    const confirmResetPassword = async (userId, secret, newPassword) => {
      loading.value = true
      error.value = null
      try {
        await authService.reset({ userId, token: secret, newPassword })
        return { success: true }
      } catch (err) {
        error.value = err?.message || 'Password reset confirmation failed'
        return { success: false, error: error.value }
      } finally {
        loading.value = false
      }
    }

    return {
      user,
      isLoggedIn,
      loading,
      error,
      version,
      initAuth,
      fetchUser,
      login,
      register,
      logout,
      updateProfile,
      resetPassword,
      confirmResetPassword,
    }
  },
  {
    persist: {
      key: 'auth',
      storage: localStorage,
      paths: ['user', 'isLoggedIn', 'version'],
    },
  },
)
