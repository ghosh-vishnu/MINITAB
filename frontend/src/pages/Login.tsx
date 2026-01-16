import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api/auth'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

const Login = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      // Prepare login data - use email field
      const loginData: any = {
        password: data.password,
      }
      
      // Check if email contains @ (it's an email) or it's a username
      if (data.email && data.email.includes('@')) {
        loginData.email = data.email.trim()
      } else if (data.email) {
        // If no @, treat as username
        loginData.username = data.email.trim()
      }
      
      if (!loginData.email && !loginData.username) {
        toast.error('Please enter your email or username')
        setLoading(false)
        return
      }
      
      const response = await authAPI.login(loginData)
      setAuth(response.user, response.access, response.refresh)
      toast.success('Logged in successfully')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Login error:', error)
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.detail || 
                          error.response?.data?.message ||
                          (error.response?.data && typeof error.response.data === 'object' 
                            ? JSON.stringify(error.response.data)
                            : 'Login failed')
      toast.error(Array.isArray(errorMessage) ? errorMessage[0] : errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            {/* Minitab Logo - Blue Triangle */}
            <div className="w-8 h-8 bg-blue-600 transform rotate-45 flex items-center justify-center">
              <div className="w-4 h-4 bg-white transform -rotate-45"></div>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Excel Center™
            </h1>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Sign In</h2>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email/Username Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                {...register('email', { 
                  required: 'Email or username is required'
                })}
                type="text"
                id="email"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email or username"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                {...register('password', { 
                  required: 'Password is required'
                })}
                type="password"
                id="password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Keep me signed in
            <div className="flex items-start">
              <input
                type="checkbox"
                id="keepSignedIn"
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="ml-2">
                <label htmlFor="keepSignedIn" className="text-sm text-gray-700">
                  Keep me signed in
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Not recommended on shared devices
                </p>
              </div>
            </div> */}

            {/* Forgot Password */}
            <div>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Next Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Signing in...' : 'Next'}
            </button>

          

            {/* Cookies Settings
            <div className="pt-2 text-center">
              <Link
                to="/cookies"
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Cookies Settings
              </Link>
            </div> */}
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} Excel, LLC. All Rights Reserved.
          </p>
          <select className="text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer">
            <option>English</option>
            <option>Español</option>
            <option>Français</option>
            <option>Deutsch</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export default Login
