"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FileText, Upload, CheckCircle, X } from "lucide-react"
import axios from "axios"

export default function PDFUploadPage() {
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  useEffect(() => {
    setFiles([])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type === "application/pdf")
    setFiles((prev) => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((file) => file.type === "application/pdf")
      setFiles((prev) => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    files.forEach((file, i) => {
      formData.append("files", file) // all under "files" field
      // or formData.append(`file_${i}`, file); if you want unique keys
    })
    try {
      axios.post("/api/ingest", formData)
    } catch {
      console.log("error")
    }
    setUploadProgress(100)

    setUploading(false)
    setUploadComplete(true)

    // Reset after 3 seconds
    setTimeout(() => {
      setUploadComplete(false)
      setFiles([])
      setUploadProgress(0)
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* Upload Area */}
        <Card className="mb-8 border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-800/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardContent className="p-8 md:p-12">
            <div
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                dragActive
                  ? "border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.02] shadow-lg shadow-blue-500/20"
                  : "border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              <div className="space-y-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform hover:scale-110">
                  <Upload className="w-10 h-10 text-white" />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Drop your files here</h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-6 text-lg">
                    or click anywhere to browse from your device
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-950 dark:hover:to-cyan-950 transition-all duration-300 px-8 py-3 text-base font-semibold bg-transparent"
                  >
                    Browse Files
                  </Button>
                </div>
              </div>
            </div>

            {/* Upload Instructions */}
            <div className="mt-8 p-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Upload Guidelines
              </h4>
              <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  PDF files only
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">10</span>
                  </div>
                  Max 10MB per file
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                  Multiple files supported
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File List */}
        {files.length > 0 && (
          <Card className="mb-8 border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-800/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-900 dark:text-white">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                Selected Files ({files.length})
              </h3>

              <div className="space-y-4">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Progress */}
        {uploading && (
          <Card className="mb-8 border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-800/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-slate-900 dark:text-white">Uploading files...</span>
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full h-3 bg-slate-200 dark:bg-slate-700" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {uploadComplete && (
          <Card className="mb-8 border-0 shadow-xl shadow-green-200/50 dark:shadow-green-800/50 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-green-800 dark:text-green-200">Upload Complete!</h3>
                  <p className="text-green-600 dark:text-green-300">
                    Your PDF files have been successfully uploaded and processed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Button */}
        {files.length > 0 && !uploading && !uploadComplete && (
          <div className="text-center">
            <Button
              onClick={uploadFiles}
              size="lg"
              className="px-12 py-4 text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
            >
              <Upload className="w-6 h-6 mr-3" />
              Upload {files.length} File{files.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
