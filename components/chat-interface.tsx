"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, FileText, ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Evidence {
  type: string
  image_url?: string
  file: string
  page: number
  confidence: number
}

interface ApiResponse {
  answer: string
  value_text?: string
  units?: string
  value_numeric?: number | null
  scale_used?: string | null
  evidence?: Evidence[]
  assumptions?: string[]
  confidence?: number
}

interface Message {
  role: "agent" | "user"
  content: string
  timestamp: string
  apiResponse?: ApiResponse
}

export default function ChatInterface() {
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: "Hello, I am an AI agent designed to help you get information from your documents. How may I assist you today?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ])

  const EvidenceItem = ({ evidence }: { evidence: Evidence }) => (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {evidence.image_url ? (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
          <Badge variant="secondary" className="ml-auto">
            {Math.round(evidence.confidence * 100)}% confidence
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-1">{evidence.file}</p>
        <p className="text-xs text-muted-foreground">Page {evidence.page}</p>
      </CardContent>
    </Card>
  )

  const ThinkingAnimation = () => (
    <div className="flex items-center gap-1">
      <span className="text-sm">Thinking</span>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )

  const handleSend = async () => {
    if (!input.trim() || isThinking) return

    const newMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInput("")
    setIsThinking(true)

    try {
      // Simulate API call - replace with actual API endpoint
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: newMessage.content }),
      })

      const data = await response.json()

      const newResponse: Message = {
        role: "agent",
        content: data.data?.answer || "I apologize, but I encountered an error processing your request.",
        timestamp: new Date().toLocaleTimeString(),
        apiResponse: data.data
          ? {
              answer: data.data.answer,
              value_text: data.data.value_text,
              units: data.data.units,
              value_numeric: data.data.value_numeric,
              evidence: data.data.evidence,
              assumptions: data.data.assumptions,
              confidence: data.data.confidence,
            }
          : undefined,
      }

      setMessages((prev) => [...prev, newResponse])
    } catch (error) {
      console.error("API Error:", error)
      const errorResponse: Message = {
        role: "agent",
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, errorResponse])
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={cn("flex gap-2 max-w-[80%]", message.role === "user" && "ml-auto")}>
              {message.role === "agent" && <div className="h-8 w-8 rounded-full bg-primary flex-shrink-0" />}
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.role === "agent" ? "Agent" : "You"}</span>
                  <span className="text-sm text-muted-foreground">{message.timestamp}</span>
                  {message.role === "agent" && message.apiResponse?.confidence && (
                    <Badge variant="outline" className="ml-auto">
                      {Math.round(message.apiResponse.confidence * 100)}% confident
                    </Badge>
                  )}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "agent" && message.apiResponse && (
                  <div className="space-y-3">
                    {message.apiResponse.evidence && message.apiResponse.evidence.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                            <span className="text-sm font-medium">
                              Evidence ({message.apiResponse.evidence.length} sources)
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {message.apiResponse.evidence.map((evidence, evidenceIndex) => (
                            <EvidenceItem key={evidenceIndex} evidence={evidence} />
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                    {message.apiResponse.assumptions && message.apiResponse.assumptions.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                            <span className="text-sm font-medium">
                              Assumptions ({message.apiResponse.assumptions.length})
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-2">
                          {message.apiResponse.assumptions.map((assumption, assumptionIndex) => (
                            <Card key={assumptionIndex} className="mb-2">
                              <CardContent className="p-3">
                                <p className="text-sm text-muted-foreground">{assumption}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-2 max-w-[80%]">
              <div className="h-8 w-8 rounded-full bg-primary flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Agent</span>
                  <span className="text-sm text-muted-foreground">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <ThinkingAnimation />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            className="min-h-[44px] max-h-32"
            disabled={isThinking}
          />
          <Button className="px-8" onClick={handleSend} disabled={isThinking || !input.trim()}>
            {isThinking ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}
