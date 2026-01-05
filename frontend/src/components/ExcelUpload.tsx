/**
 * ExcelUpload Component - Production-ready file upload for Excel/CSV
 * Supports drag & drop, file selection, and parsing
 */

import { useState, useRef, useCallback } from 'react'
import { parseExcelFile, parseCSVFile, ExcelData } from '../utils/excelUtils'
import toast from 'react-hot-toast'

interface ExcelUploadProps {
  onFileParsed: (data: ExcelData | ExcelData[]) => void
  acceptedFormats?: string[]
  maxFileSize?: number // in MB
  multiple?: boolean
}

const ExcelUpload = ({
  onFileParsed,
  acceptedFormats = ['.xlsx', '.xls', '.csv'],
  maxFileSize = 10, // 10MB default
  multiple = false,
}: ExcelUploadProps) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxFileSize) {
      toast.error(`File size exceeds ${maxFileSize}MB limit`)
      return false
    }

    // Check file extension
    const fileName = file.name.toLowerCase()
    const isValidFormat = acceptedFormats.some((format) =>
      fileName.endsWith(format.toLowerCase())
    )

    if (!isValidFormat) {
      toast.error(`Invalid file format. Accepted: ${acceptedFormats.join(', ')}`)
      return false
    }

    return true
  }

  const processFile = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return

      setIsProcessing(true)

      try {
        const fileName = file.name.toLowerCase()

        if (fileName.endsWith('.csv')) {
          const csvData = await parseCSVFile(file)
          onFileParsed(csvData)
          toast.success('CSV file imported successfully')
        } else {
          const excelData = await parseExcelFile(file)
          if (excelData.length > 0) {
            onFileParsed(multiple ? excelData : excelData[0])
            toast.success(`Excel file imported successfully (${excelData.length} sheet${excelData.length > 1 ? 's' : ''})`)
          } else {
            toast.error('No data found in Excel file')
          }
        }
      } catch (error: any) {
        console.error('File processing error:', error)
        toast.error(error.message || 'Failed to process file')
      } finally {
        setIsProcessing(false)
      }
    },
    [onFileParsed, multiple, maxFileSize, acceptedFormats]
  )

  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const fileArray = Array.from(files)
      if (multiple) {
        fileArray.forEach((file) => processFile(file))
      } else {
        processFile(fileArray[0])
      }
    },
    [processFile, multiple]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      handleFileSelect(files)
    },
    [handleFileSelect]
  )

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files)
      // Reset input to allow same file selection
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFileSelect]
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="excel-upload">
      <div
        className={`
          upload-area
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Processing file...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <svg
              className="w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-2">
              {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-sm text-gray-500">
              {acceptedFormats.join(', ').toUpperCase()} (max {maxFileSize}MB)
            </p>
            {multiple && (
              <p className="text-xs text-gray-400 mt-1">Multiple files supported</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExcelUpload



