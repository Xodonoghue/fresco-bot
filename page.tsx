"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { Card, CardContent } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { Database, FileText, Upload, X, Loader2 } from "lucide-react"
import ChatInterface from "./components/chat-interface"
import axios from "axios"

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadedAt: Date
}

export default function KnowledgeChatbot() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadingFiles, setLoadingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadComplete, setUploadComplete] = useState(false)


  const uploadFiles = async (files: File[]) => {
    setUploading(true)
    setUploadProgress(0)
    setLoadingFiles(files)

    const formData = new FormData();
    files.forEach((file, i) => {
        formData.append("files", file); // all under "files" field
        // or formData.append(`file_${i}`, file); if you want unique keys
    });
    try {
        if (uploadedFiles.length === 0) {
          await axios.post("/api/delete-all", {})
        }
        const res = await axios.post("/api/ingest", formData)
        if (res.data.files){
            setUploadedFiles((prevFiles) => [...prevFiles, ...res.data.files])
        }
    } catch {
        console.log("error")
    }
    setLoadingFiles([])
}

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files!)
      if (files && files.length > 0) {
        uploadFiles(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [uploadFiles],
  )

  const handleBrowseFiles = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const files = e.dataTransfer.files
      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type === "application/pdf")
      if (files.length > 0) {
        uploadFiles(droppedFiles)
      }
    },
    [uploadFiles],
  )

  const removeFile = useCallback(async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return; 
  
    try {
      await axios.post("/api/delete-specific", { file: file.name });
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [uploadedFiles]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="h-full dark:from-slate-950 dark:to-slate-900 bg-fixed">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fresco Construction Agent</h1>
              <p className="text-slate-600 dark:text-slate-400">Upload documents and get specific answers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6 h-[calc(100vh-140px)]">
          {/* Chat Section */}
          <div className="flex flex-col mx-auto w-7/12">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Chat with Agent</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Ask questions about your uploaded documents</p>
            </div>
            <div className="flex-1 overflow-hidden">
              {uploadedFiles.length > 0 ? (
                <div className="h-full flex flex-col">
                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-blue-600" />
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          Knowledge Base ({uploadedFiles.length} files)
                        </h3>
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            >
                              <X className="w-3 h-3 text-slate-400" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div
                          className={`border-2 border-dashed rounded-lg p-3 transition-colors cursor-pointer ${
                            isDragOver
                              ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                              : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                          }`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={handleBrowseFiles}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Upload className={`w-4 h-4 ${isDragOver ? "text-blue-500" : "text-slate-400"}`} />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {isDragOver ? "Drop more files here" : "Upload more documents"}
                            </span>
                          </div>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                        {loadingFiles.map((file, i) => (
                          <div
                            key={i}
                            className="mt-4 flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Loader2 className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">Processing...</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="mb-4">
                    <ChatInterface />
                  </Card>
                </div>
              ) : (
                <Card
                  className={`h-full flex items-center justify-center border-dashed border-2 transition-colors ${
                    isDragOver
                      ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <CardContent className="text-center p-8">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${
                        isDragOver ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {isDragOver ? (
                        <Upload className="w-8 h-8 text-blue-500" />
                      ) : (
                        <Database className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                      {isDragOver ? "Drop files here" : "No Knowledge Base Yet"}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                      {isDragOver
                        ? "Release to upload PDF files"
                        : "Upload documents or drag and drop PDF files here to start chatting"}
                    </p>
                    {!isDragOver && (
                      <>
                        <Button onClick={handleBrowseFiles} className="gap-2 mb-4">
                          <Upload className="w-4 h-4" />
                          Browse Files
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={handleFileInputChange}
                          className="hidden"
                        />
                      </>
                    )}
                    {loadingFiles.map((file, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Loader2 className="w-4 h-4 text-blue-500 flex-shrink-0 animate-spin" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                  {file.name}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">Processing...</p>
                              </div>
                            </div>
                          </div>
                        ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

