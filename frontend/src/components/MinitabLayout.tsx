/**
 * Minitab-like Layout Component
 * Mimics Minitab Statistical Software interface
 */

import { Outlet, Link, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../api/auth'
import toast from 'react-hot-toast'
import { useState, useEffect, useRef } from 'react'
import GraphBuilder from './GraphBuilder'
import { spreadsheetsAPI, Cell, Spreadsheet } from '../api/spreadsheets'

const MinitabLayout = () => {
  const { user, logout: logoutStore, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const { id: spreadsheetId } = useParams<{ id?: string }>()
  const [cells, setCells] = useState<Cell[]>([])
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
  const [showNavigator, setShowNavigator] = useState(true)
  const [showNavigatorDropdown, setShowNavigatorDropdown] = useState(false)
  const [groupByWorksheet, setGroupByWorksheet] = useState(true)
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('oldest')
  const [showDataMenu, setShowDataMenu] = useState(false)
  const [showGraphMenu, setShowGraphMenu] = useState(false)
  const [showGraphBuilder, setShowGraphBuilder] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dataMenuRef = useRef<HTMLDivElement>(null)
  const graphMenuRef = useRef<HTMLDivElement>(null)

  // Load spreadsheet and cells data when spreadsheet ID is available
  useEffect(() => {
    const loadData = async () => {
      if (spreadsheetId && spreadsheetId !== 'undefined') {
        try {
          const spreadsheetData = await spreadsheetsAPI.get(spreadsheetId)
          setSpreadsheet(spreadsheetData)
          
          const cellsData = await spreadsheetsAPI.getCells(spreadsheetId)
          setCells(cellsData || [])
        } catch (error: any) {
          console.warn('Failed to load spreadsheet data:', error)
          setCells([])
        }
      } else {
        setCells([])
        setSpreadsheet(null)
      }
    }
    loadData()
    
    // Refresh cells periodically when GraphBuilder is open or every 2 seconds
    const intervalId = setInterval(() => {
      if (spreadsheetId && spreadsheetId !== 'undefined' && showGraphBuilder) {
        loadCells()
      }
    }, 2000) // Refresh every 2 seconds when GraphBuilder is open
    
    return () => clearInterval(intervalId)
  }, [spreadsheetId, showGraphBuilder])
  
  // Also refresh cells when GraphBuilder opens
  useEffect(() => {
    if (showGraphBuilder && spreadsheetId && spreadsheetId !== 'undefined') {
      const refreshCells = async () => {
        try {
          const cellsData = await spreadsheetsAPI.getCells(spreadsheetId)
          setCells(cellsData || [])
        } catch (error: any) {
          console.warn('Failed to refresh cells:', error)
        }
      }
      refreshCells()
    }
  }, [showGraphBuilder, spreadsheetId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNavigatorDropdown(false)
      }
      if (dataMenuRef.current && !dataMenuRef.current.contains(event.target as Node)) {
        setShowDataMenu(false)
      }
      if (graphMenuRef.current && !graphMenuRef.current.contains(event.target as Node)) {
        setShowGraphMenu(false)
      }
    }

    if (showNavigatorDropdown || showDataMenu || showGraphMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNavigatorDropdown, showDataMenu, showGraphMenu])

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authAPI.logout(refreshToken)
      }
      logoutStore()
      navigate('/login')
      toast.success('Logged out successfully')
    } catch (error) {
      console.error('Logout error:', error)
      logoutStore()
      navigate('/login')
    }
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="minitab-layout h-screen bg-white flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-300">
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            {/* Green Minitab Logo */}
            <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-800">Excel® Statistical Software</span>
            
            {/* File Name Dropdown */}
            <div className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-sm">
              <span className="text-gray-700">{spreadsheet?.name || 'Untitled'} -</span>
              {false && (
                <>
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-600 text-xs">Not currently saved</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Help, Settings, User */}
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded" title="Help">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <Link
              to="/minitab/profile"
              className="p-2 hover:bg-gray-100 rounded"
              title="Settings"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <Link
              to="/minitab/profile"
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium hover:bg-blue-700 cursor-pointer"
            >
              {getUserInitials()}
            </Link>
          </div>
        </div>

        {/* Menu Bar */}
        <div className="border-t border-gray-200 bg-white px-4 py-1 flex items-center justify-between relative">
          <nav className="flex items-center gap-1">
            {/* Navigator Button - Toggles Sidebar */}
            <button
              onClick={() => {
                setShowNavigator(!showNavigator)
                setShowNavigatorDropdown(false)
              }}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                showNavigator
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Navigator
              <svg
                className={`w-4 h-4 transition-transform ${showNavigator ? '' : 'rotate-180'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Navigator Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNavigatorDropdown(!showNavigatorDropdown)}
                className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                  showNavigatorDropdown
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showNavigatorDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showNavigatorDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-20 min-w-[240px] py-1">
                  <button
                    onClick={() => {
                      toast.success('Create New Report feature coming soon')
                      setShowNavigatorDropdown(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Create New Report
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button
                    onClick={() => {
                      setGroupByWorksheet(!groupByWorksheet)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>Group Commands By Worksheet</span>
                    {groupByWorksheet && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button
                    onClick={() => {
                      setSortOrder('newest')
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      sortOrder === 'newest' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    <span>Sort Newest To Oldest</span>
                    {sortOrder === 'newest' && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setSortOrder('oldest')
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      sortOrder === 'oldest' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    <span>Sort Oldest To Newest</span>
                    {sortOrder === 'oldest' && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setSortOrder('name')
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      sortOrder === 'name' ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                    }`}
                  >
                    <span>Sort By Command Name</span>
                    {sortOrder === 'name' && (
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Data Menu */}
            <div className="relative" ref={dataMenuRef}>
              <button
                onClick={() => {
                  setShowDataMenu(!showDataMenu)
                  setShowNavigatorDropdown(false)
                }}
                className={`px-3 py-1.5 text-sm rounded ${
                  showDataMenu
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Data
              </button>

              {/* Data Dropdown Menu */}
              {showDataMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-30 min-w-[200px] py-1">
                  <button
                    onClick={() => {
                      toast.success('Subset Worksheet feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Subset Worksheet...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Split Worksheet feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Split Worksheet...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Stack Worksheets feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Stack Worksheets...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Merge Worksheets feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Merge Worksheets
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      toast.success('Copy feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Unstack Columns feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Unstack Columns...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Stack feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Stack
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Transpose Columns feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Transpose Columns...
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      toast.success('Sort feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sort...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Rank feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Rank...
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      toast.success('Delete Rows feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Delete Rows...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Erase Variables feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Erase Variables...
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      toast.success('Recode feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Recode
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Change Data Type feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Change Data Type...
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Date/Time feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Date/Time
                  </button>
                  <button
                    onClick={() => {
                      toast.success('Concatenate feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Concatenate...
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={() => {
                      toast.success('Display Data feature coming soon')
                      setShowDataMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Display Data...
                  </button>
                </div>
              )}
            </div>

            <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Calc</button>
            <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Stat</button>

            {/* Graph Menu */}
            <div className="relative" ref={graphMenuRef}>
              <button
                onClick={() => {
                  setShowGraphMenu(!showGraphMenu)
                  setShowNavigatorDropdown(false)
                  setShowDataMenu(false)
                }}
                className={`px-3 py-1.5 text-sm rounded ${
                  showGraphMenu
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Graph
              </button>

              {/* Graph Dropdown Menu */}
              {showGraphMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-30 min-w-[220px] py-1 max-h-[600px] overflow-y-auto">
                  <button
                    onClick={() => {
                      setShowGraphBuilder(true)
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Graph Builder...
                  </button>
                  
                  <button
                    onClick={() => {
                      toast.info('Scatterplot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Scatterplot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Binned Scatterplot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Binned Scatterplot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Matrix Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Matrix Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Correlogram... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Correlogram...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Bubble Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Bubble Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Marginal Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Marginal Plot...
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button
                    onClick={() => {
                      toast.info('Histogram... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Histogram...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Dotplot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Dotplot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Stem-and-Leaf... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Stem-and-Leaf...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Probability Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Probability Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Empirical CDF... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Empirical CDF...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Probability Distribution Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Probability Distribution Plot...
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button
                    onClick={() => {
                      toast.info('Boxplot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Boxplot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Interval Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Interval Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Individual Value Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Individual Value Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Line Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Line Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Parallel Coordinates Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Parallel Coordinates Plot...
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <div className="relative group">
                    <button
                      onClick={() => {
                        toast.info('Bar Chart submenu coming soon')
                        setShowGraphMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                    >
                      <span>Bar Chart</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      toast.info('Heatmap... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Heatmap...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Pie Chart... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Pie Chart...
                  </button>
                  
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  <button
                    onClick={() => {
                      toast.info('Time Series Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Time Series Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Area Graph... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Area Graph...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('Contour Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Contour Plot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('3D Scatterplot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    3D Scatterplot...
                  </button>
                  <button
                    onClick={() => {
                      toast.info('3D Surface Plot... coming soon')
                      setShowGraphMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    3D Surface Plot...
                  </button>
                </div>
              )}
            </div>

            <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">View</button>
            <button className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">Predictive Analytics Module</button>
            <button className="px-2 py-1.5 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </nav>

          {/* Right: Search and Layout Icons */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <svg className="absolute right-2 top-1.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {/* Layout Icons */}
            <button className="p-1.5 hover:bg-gray-100 rounded" title="Single Sheet View">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="Multiple Sheets View">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded" title="Blank">
              <div className="w-5 h-5 border border-gray-400"></div>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Navigator with Slide Animation */}
        <aside
          className={`bg-white border-r border-gray-300 flex flex-col transition-all duration-300 ease-in-out ${
            showNavigator ? 'w-64' : 'w-0'
          }`}
          style={{
            transform: showNavigator ? 'translateX(0)' : 'translateX(-100%)',
            opacity: showNavigator ? 1 : 0,
            overflow: showNavigator ? 'visible' : 'hidden',
          }}
        >
          <div className="p-3 border-b border-gray-200 min-w-[256px]">
            <div className="flex items-center justify-between w-full text-sm font-medium text-gray-700">
              <span>Navigator</span>
              <button
                onClick={() => setShowNavigator(!showNavigator)}
                className="p-1 hover:bg-gray-100 rounded"
                title="Toggle Navigator"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 min-w-[256px]">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home</span>
              </Link>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>Navigator</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <span>Open from Excel Connect®</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span>Open</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Untitled</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Learn</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded mb-1 cursor-pointer">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Discover</span>
              </div>
            </nav>
          </aside>

        {/* Main Content Area */}
        <main
          className="flex-1 flex flex-col overflow-auto bg-white transition-all duration-300"
          style={{
            marginLeft: showNavigator ? '256px' : '0',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Status Bar */}
      <footer className="bg-gray-100 border-t border-gray-300 px-4 py-1 text-xs text-gray-600 flex items-center justify-between">
        <span>Ready</span>
        <span>NaN Days Remaining</span>
      </footer>

      {/* Graph Builder Modal */}
      <GraphBuilder
        isOpen={showGraphBuilder}
        onClose={() => setShowGraphBuilder(false)}
        cells={cells}
        spreadsheetId={spreadsheetId}
      />
    </div>
  )
}

export default MinitabLayout
