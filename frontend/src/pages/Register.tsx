import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api/auth'
import toast from 'react-hot-toast'

interface RegisterForm {
  username: string
  email: string
  password: string
  password_confirm: string
  first_name: string
  last_name: string
  language_preference?: string
  user_type?: string
  organization?: string
  country?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  postal_code?: string
}

const Register = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>()

  const password = watch('password')

  const onSubmit = async (data: RegisterForm) => {
    if (data.password !== data.password_confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      // Prepare registration data - backend requires password_confirm
      const registerData: any = {
        username: data.username,
        email: data.email,
        password: data.password,
        password_confirm: data.password_confirm, // Required by backend
        first_name: data.first_name || '',
        last_name: data.last_name || '',
      }

      // Add optional fields if provided (backend doesn't need these, but we can keep for future)
      // Note: Backend serializer only accepts: username, email, password, password_confirm, first_name, last_name

      const response = await authAPI.register(registerData)
      setAuth(response.user, response.access, response.refresh)
      toast.success('Account created successfully')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Registration error:', error)
      let errorMessage = 'Registration failed'
      
      if (error.response?.data) {
        // Handle Django REST Framework validation errors
        if (error.response.data.password) {
          errorMessage = Array.isArray(error.response.data.password) 
            ? error.response.data.password[0] 
            : error.response.data.password
        } else if (error.response.data.email) {
          errorMessage = Array.isArray(error.response.data.email) 
            ? error.response.data.email[0] 
            : error.response.data.email
        } else if (error.response.data.username) {
          errorMessage = Array.isArray(error.response.data.username) 
            ? error.response.data.username[0] 
            : error.response.data.username
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (typeof error.response.data === 'object') {
          // Get first error message from object
          const firstKey = Object.keys(error.response.data)[0]
          const firstError = error.response.data[firstKey]
          errorMessage = Array.isArray(firstError) ? firstError[0] : firstError
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const countries = [
    'United States of America',
    'India',
    'United Kingdom',
    'Canada',
    'Australia',
    'Germany',
    'France',
    'Spain',
    'Italy',
    'Japan',
    'China',
    'Brazil',
    'Mexico',
    'Other'
  ]

  const languages = [
    'English',
    'Español',
    'Français',
    'Deutsch',
    'Italiano',
    'Português',
    '中文',
    '日本語'
  ]

  const userTypes = [
    'Select...',
    'Student',
    'Academic Researcher',
    'Business Professional',
    'Consultant',
    'Other'
  ]

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* Minitab Logo */}
            <div className="w-8 h-8 bg-blue-600 transform rotate-45 flex items-center justify-center">
              <div className="w-4 h-4 bg-white transform -rotate-45"></div>
            </div>
            <h1 className="text-3xl font-semibold text-gray-900">Minitab</h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Create your Minitab account
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            With your Minitab account, you get access to your Minitab web products, licensing tools, and user account information—all from one convenient location.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Personal Information
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      {...register('first_name', { required: 'First name is required' })}
                      type="text"
                      id="first_name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="First Name"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      {...register('last_name', { required: 'Last name is required' })}
                      type="text"
                      id="last_name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Last Name"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    id="email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Email"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    {...register('username', { required: 'Username is required' })}
                    type="text"
                    id="username"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Username"
                  />
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="language_preference" className="block text-sm font-medium text-gray-700 mb-1">
                      Language Preference
                    </label>
                    <select
                      {...register('language_preference')}
                      id="language_preference"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      defaultValue="English"
                    >
                      {languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="user_type" className="block text-sm font-medium text-gray-700 mb-1">
                      Which best describes you?
                    </label>
                    <select
                      {...register('user_type')}
                      id="user_type"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      defaultValue=""
                    >
                      {userTypes.map((type) => (
                        <option key={type} value={type === 'Select...' ? '' : type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Organization Information Section */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Organization Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization
                  </label>
                  <input
                    {...register('organization')}
                    type="text"
                    id="organization"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Organization"
                  />
                </div>

                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    {...register('country')}
                    id="country"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    defaultValue="United States of America"
                  >
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-1">
                    Address 1
                  </label>
                  <input
                    {...register('address1')}
                    type="text"
                    id="address1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Address 1"
                  />
                </div>

                <div>
                  <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-1">
                    Address 2 (optional)
                  </label>
                  <input
                    {...register('address2')}
                    type="text"
                    id="address2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Address 2 (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City / Town
                    </label>
                    <input
                      {...register('city')}
                      type="text"
                      id="city"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="City / Town"
                    />
                  </div>
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State / Region
                    </label>
                    <select
                      {...register('state')}
                      id="state"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      defaultValue=""
                    >
                      <option value="">Select...</option>
                      <option value="AL">Alabama</option>
                      <option value="AK">Alaska</option>
                      <option value="CA">California</option>
                      <option value="NY">New York</option>
                      <option value="TX">Texas</option>
                      <option value="FL">Florida</option>
                      {/* Add more states as needed */}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    {...register('postal_code')}
                    type="text"
                    id="postal_code"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Postal Code"
                  />
                </div>
              </div>
            </div>

            {/* Password Fields */}
            <div className="pt-6 border-t border-gray-200 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                  })}
                  type="password"
                  id="password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password_confirm" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  {...register('password_confirm', {
                    required: 'Please confirm your password',
                    validate: (value) =>
                      value === password || 'Passwords do not match',
                  })}
                  type="password"
                  id="password_confirm"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm Password"
                />
                {errors.password_confirm && (
                  <p className="mt-1 text-sm text-red-600">{errors.password_confirm.message}</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating Account...' : 'Create Your Account'}
              </button>
            </div>

            {/* Return to Sign In */}
            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Return to Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register
