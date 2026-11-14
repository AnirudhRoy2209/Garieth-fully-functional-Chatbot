"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AiMascotInput, {
  AIModel,
  ChatSubmitData,
  OpenAiIcon,
  AnthropicIcon,
  GeminiIcon,
  RobotBeta,
} from "@/components/ui/ai-mascot-input";
import { Announcement } from "@/components/ui/announcement";
import {
  Plus,
  LogOut,
  LogIn,
  User as UserIcon,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Check,
  Download,
  Maximize2,
  Volume2,
  Sparkles,
  Globe,
  FileText,
  Brain,
  Terminal,
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Pencil,
  Trash2,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BACKEND_MODELS: AIModel[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    tag: "BYOK",
    icon: GeminiIcon,
    badgeColor: "text-blue-400",
    accentColor: "#3b82f6",
    reasoningTitle: "Thinking effort",
    defaultLevel: "medium",
    levels: [
      { id: "low", label: "Low", desc: "Fast multimodal response", multiplier: 1.5 },
      { id: "medium", label: "Medium", desc: "Balanced reasoning", multiplier: 2.4 },
      { id: "high", label: "High", desc: "Deep analytical synthesis", multiplier: 3.5 },
    ],
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    tag: "BYOK",
    icon: OpenAiIcon,
    badgeColor: "text-emerald-400",
    accentColor: "#10a37f",
    reasoningTitle: "Reasoning effort",
    defaultLevel: "medium",
    levels: [
      { id: "low", label: "Low", desc: "Concise response", multiplier: 1.6 },
      { id: "medium", label: "Medium", desc: "Standard depth", multiplier: 2.5 },
      { id: "high", label: "High", desc: "Maximum reasoning", multiplier: 3.6 },
    ],
  },
  {
    id: "claude-3-5-sonnet-latest",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tag: "BYOK",
    icon: AnthropicIcon,
    badgeColor: "text-orange-400",
    accentColor: "#f97316",
    reasoningTitle: "Thinking budget",
    defaultLevel: "high",
    levels: [
      { id: "low", label: "Low", desc: "Quick synthesis", multiplier: 1.6 },
      { id: "medium", label: "Medium", desc: "Balanced coding & logic", multiplier: 2.6 },
      { id: "high", label: "High", desc: "Deep architectural analysis", multiplier: 3.8 },
    ],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    provider: "OpenAI",
    tag: "Reasoning",
    icon: OpenAiIcon,
    badgeColor: "text-emerald-400",
    accentColor: "#10a37f",
    reasoningTitle: "Reasoning effort",
    defaultLevel: "high",
    levels: [
      { id: "low", label: "Low", desc: "Fast responses with concise analysis", multiplier: 1.8 },
      { id: "medium", label: "Medium", desc: "Balanced step-by-step reasoning", multiplier: 2.6 },
      { id: "high", label: "High", desc: "Exhaustive reasoning for complex tasks", multiplier: 3.6 },
    ],
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B",
    provider: "OpenAI",
    tag: "Fast",
    icon: OpenAiIcon,
    badgeColor: "text-emerald-400",
    accentColor: "#10a37f",
    reasoningTitle: "Reasoning effort",
    defaultLevel: "medium",
    levels: [
      { id: "low", label: "Low", desc: "High velocity with essential logic", multiplier: 1.6 },
      { id: "medium", label: "Medium", desc: "Balanced analytical flow", multiplier: 2.4 },
      { id: "high", label: "High", desc: "Deep verification", multiplier: 3.2 },
    ],
  },
  {
    id: "qwen/qwen3.8-27b",
    name: "Qwen 3.8 27B",
    provider: "Alibaba Cloud",
    tag: "Agentic",
    icon: GeminiIcon,
    badgeColor: "text-amber-300",
    accentColor: "#f59e0b",
    reasoningTitle: "Extended thinking",
    defaultLevel: "medium",
    levels: [
      { id: "low", label: "Low", desc: "Minimal latency and direct responses", multiplier: 1.6 },
      { id: "medium", label: "Medium", desc: "Balanced multimodal reasoning", multiplier: 2.6 },
      { id: "high", label: "High", desc: "Extended thinking with cross-verification", multiplier: 3.8 },
    ],
  },
];

const QUICK_STARTERS = [
  {
    icon: Sparkles,
    label: "Generate FLUX Art",
    prompt: "Generate an image of a futuristic cyberpunk samurai standing in neon rain, 16:9 cinematic lighting",
  },
  {
    icon: Globe,
    label: "Live Web Research",
    prompt: "Search the web for the biggest AI breakthroughs this week and summarize the top 3",
  },
  {
    icon: Brain,
    label: "Cross-Thread Memory",
    prompt: "Remember that I am building an Agentic AI portfolio project named Gareith using Next.js and FastAPI",
  },
  {
    icon: FileText,
    label: "Analyze Code / Math",
    prompt: "Write a clean Python async generator example for Server-Sent Events (SSE) and calculate 256 * 1024",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConvoItem {
  thread_id: string;
  title: string;
}

interface UserApiKeys {
  google: string;
  groq: string;
  openai: string;
  claude: string;
}

/* -------------------------------------------------------------------------- */
/* RICH MESSAGE RENDERER (Handles FLUX Images, Code Blocks, & Bold Text)      */
/* -------------------------------------------------------------------------- */
function RichMessageContent({
  content,
  onOpenLightbox,
}: {
  content: string;
  onOpenLightbox: (url: string, alt: string) => void;
}) {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(idx);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const downloadImage = async (url: string, alt: string) => {
    try {
      setDownloadingUrl(url);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `gareith-${alt.slice(0, 20).replace(/[^a-z0-9]/gi, "_")}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloadingUrl(null);
    }
  };

  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const segments: Array<{ type: "text" | "code"; lang?: string; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      lang: match[1] || "code",
      value: match[2].trimEnd(),
    });
    lastIndex = codeBlockRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  const renderTextWithImages = (text: string, segIdx: number) => {
    const imgRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let imgMatch: RegExpExecArray | null;

    while ((imgMatch = imgRegex.exec(text)) !== null) {
      if (imgMatch.index > lastIdx) {
        parts.push(
          <span key={`txt-${segIdx}-${lastIdx}`}>
            {formatBoldAndInlineCode(text.slice(lastIdx, imgMatch.index))}
          </span>
        );
      }
      const altText = imgMatch[1] || "Generated AI Artwork";
      const imageUrl = imgMatch[2];

      parts.push(
        <div
          key={`img-${segIdx}-${imgMatch.index}`}
          className="my-4 group relative overflow-hidden rounded-2xl border border-[#fffce1]/15 bg-[#0e0e0e] shadow-2xl max-w-lg"
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#fffce1]/10 bg-[#141413] text-[11px] font-mono text-[#a8a590]">
            <span className="flex items-center gap-1.5 text-[#fffce1]">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              FLUX Studio Render
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenLightbox(imageUrl, altText)}
                className="px-2 py-1 rounded-md hover:bg-[#fffce1]/10 text-[#fffce1] flex items-center gap-1 transition-colors cursor-pointer"
                title="View Fullscreen"
              >
                <Maximize2 className="h-3 w-3" />
                Expand
              </button>
              <button
                type="button"
                onClick={() => downloadImage(imageUrl, altText)}
                className="px-2 py-1 rounded-md bg-[#fffce1] text-[#0e0e0e] font-semibold flex items-center gap-1 hover:bg-[#fffce1]/90 transition-colors cursor-pointer"
                title="Download Image"
              >
                <Download className="h-3 w-3" />
                {downloadingUrl === imageUrl ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="relative min-h-[260px] bg-[#111110] flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={altText}
              onClick={() => onOpenLightbox(imageUrl, altText)}
              className="w-full h-auto object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </div>

          <div className="px-3.5 py-2 bg-[#141413]/90 text-[11px] text-[#a8a590] truncate border-t border-[#fffce1]/10">
            Prompt: &ldquo;{altText}&rdquo;
          </div>
        </div>
      );

      lastIdx = imgRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(
        <span key={`txt-end-${segIdx}`}>
          {formatBoldAndInlineCode(text.slice(lastIdx))}
        </span>
      );
    }

    return parts;
  };

  const formatBoldAndInlineCode = (raw: string) => {
    const tokens = raw.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return tokens.map((tok, i) => {
      if (tok.startsWith("**") && tok.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-[#fffce1]">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      if (tok.startsWith("`") && tok.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-[#fffce1]/10 border border-[#fffce1]/15 font-mono text-xs text-emerald-300"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      return tok;
    });
  };

  return (
    <div className="space-y-3">
      {segments.map((seg, idx) =>
        seg.type === "code" ? (
          <div
            key={idx}
            className="my-3 rounded-xl overflow-hidden border border-[#fffce1]/15 bg-[#0a0a09] shadow-lg"
          >
            <div className="flex items-center justify-between px-3.5 py-2 bg-[#141413] border-b border-[#fffce1]/10 text-xs font-mono text-[#a8a590]">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#fffce1]">
                <Terminal className="h-3 w-3 text-emerald-400" />
                {seg.lang}
              </span>
              <button
                type="button"
                onClick={() => copyCode(seg.value, idx)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#fffce1]/10 hover:bg-[#fffce1]/20 text-[#fffce1] text-[11px] transition-colors cursor-pointer"
              >
                {copiedCodeIdx === idx ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-[#fffce1]/90 overflow-x-auto leading-relaxed">
              <code>{seg.value}</code>
            </pre>
          </div>
        ) : (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed">
            {renderTextWithImages(seg.value, idx)}
          </div>
        )
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN PAGE COMPONENT                                                        */
/* -------------------------------------------------------------------------- */
export default function ChatPage() {
  const [threadId, setThreadId] = useState<string>("");
  const [conversations, setConversations] = useState<ConvoItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [promptInput, setPromptInput] = useState("");
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ url: string; alt: string } | null>(null);

  // Smooth Shuttle Reload State
  const [isReloading, setIsReloading] = useState(false);
  const [reloadCycle, setReloadCycle] = useState(0);

  // BYOK API Keys Modal State
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<UserApiKeys>({
    google: "",
    groq: "",
    openai: "",
    claude: "",
  });
  const [visibleKeys, setVisibleKeys] = useState<Record<keyof UserApiKeys, boolean>>({
    google: false,
    groq: false,
    openai: false,
    claude: false,
  });
  const [keysSavedToast, setKeysSavedToast] = useState(false);

  // Auth State
  const [user, setUser] = useState<{ user_id: number; email: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authError, setAuthError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger initial smooth shuttle animation on mount
    triggerShuttleReload(false);

    let savedThread = localStorage.getItem("thread_id");
    if (!savedThread) {
      savedThread = crypto.randomUUID();
      localStorage.setItem("thread_id", savedThread);
    }
    setThreadId(savedThread);

    // Load saved API keys from localStorage
    const savedKeys = localStorage.getItem("gareith_api_keys");
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch {}
    }

    checkUserSession(savedThread);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function triggerShuttleReload(reinitializeData = true) {
    setIsReloading(true);
    setReloadCycle((prev) => prev + 1);
    if (reinitializeData && threadId) {
      loadConversations();
      loadHistory(threadId);
    }
    setTimeout(() => {
      setIsReloading(false);
    }, 650);
  }

  function handleSaveApiKeys(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("gareith_api_keys", JSON.stringify(apiKeys));
    setKeysSavedToast(true);
    setTimeout(() => {
      setKeysSavedToast(false);
      setShowApiModal(false);
    }, 900);
  }

  const configuredKeyCount = Object.values(apiKeys).filter((k) => k.trim().length > 0).length;

  async function checkUserSession(activeThread: string) {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        await loadConversations();
        await loadHistory(activeThread);
      }
    } catch {}
  }

  async function loadConversations() {
    try {
      const res = await fetch(`${API_BASE}/conversations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {}
  }

  async function loadHistory(targetThreadId: string) {
    setThreadId(targetThreadId);
    localStorage.setItem("thread_id", targetThreadId);
    try {
      const res = await fetch(`${API_BASE}/history/${targetThreadId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {}
  }

  function startNewChat() {
    const newId = crypto.randomUUID();
    setThreadId(newId);
    localStorage.setItem("thread_id", newId);
    setMessages([]);
    triggerShuttleReload(false);
  }

  async function handleRenameChat(targetThreadId: string, currentTitle: string, e: React.MouseEvent) {
    e.stopPropagation();
    const newTitle = window.prompt("Rename conversation:", currentTitle);
    if (!newTitle || !newTitle.trim()) return;

    const res = await fetch(`${API_BASE}/conversations/${targetThreadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      await loadConversations();
    }
  }

  async function handleDeleteChat(targetThreadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`${API_BASE}/conversations/${targetThreadId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      if (targetThreadId === threadId) {
        startNewChat();
      }
      await loadConversations();
    }
  }

  function copyMessage(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  }

  function speakMessage(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/!\[[^\]]*\]\([^)]+\)/g, "Generated image.");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const endpoint = authMode === "login" ? "/auth/login" : "/auth/signup";
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          authMode === "login" ? { email, password } : { email, password, name }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        return;
      }
      setShowAuthModal(false);
      setEmail("");
      setPassword("");
      await checkUserSession(threadId);
    } catch {
      setAuthError("Could not connect to FastAPI server on port 8000.");
    }
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setConversations([]);
    setMessages([]);
  }

  async function handleChatSubmit(data: ChatSubmitData) {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setPromptInput("");
    setIsStreaming(true);

    if (data.attachedFile?.file) {
      const file = data.attachedFile.file;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: `📎 Uploaded: ${file.name}` },
      ]);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("thread_id", threadId);

      try {
        const upRes = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        const upData = await upRes.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: upData.message || `Uploaded ${file.name} into RAG memory.`,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Failed to upload document." },
        ]);
      }
    }

    if (data.prompt) {
      const finalPrompt = data.useWebSearch
        ? `[Use Web Search] ${data.prompt}`
        : data.prompt;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: data.prompt },
        { role: "assistant", content: "" },
      ]);

      try {
        const response = await fetch(`${API_BASE}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: finalPrompt,
            thread_id: threadId,
            model: data.model.id,
            effort: data.effort,
            api_keys: apiKeys,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Stream request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split(/\r?\n\r?\n/);
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part
              .split(/\r?\n/)
              .find((l) => l.trim().startsWith("data:"));
            if (!line) continue;
            const jsonStr = line.replace(/^data:\s*/, "").trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.token) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: updated[lastIdx].content + parsed.token,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
        await loadConversations();
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content =
            "⚠️ Error connecting to FastAPI stream.";
          return updated;
        });
      }
    }

    setIsStreaming(false);
  }

  return (
    <div className="dark relative flex h-screen w-screen overflow-hidden bg-[#0e0e0e] text-[#fffce1]">
      {/* Top Shuttle Reload Sweep Bar */}
      <AnimatePresence>
        {isReloading && (
          <motion.div
            key="shuttle-bar"
            initial={{ x: "-100%", opacity: 1 }}
            animate={{ x: "100%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 left-0 z-50 h-[2px] w-full bg-gradient-to-r from-transparent via-[#fffce1] to-transparent shadow-[0_0_16px_#fffce1]"
          />
        )}
      </AnimatePresence>

      {/* Subtle Ambient Top Cream Spotlight */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-64 bg-[radial-gradient(ellipse_at_top,rgba(255,252,225,0.05)_0%,transparent_70%)]" />

      {/* COLLAPSIBLE LEFT SIDEBAR */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 268, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 flex h-full shrink-0 flex-col border-r border-[#fffce1]/10 bg-[#111110] px-3 py-4 select-none overflow-hidden"
          >
            {/* Brand Header + Close Toggle */}
            <div className="flex items-center justify-between px-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-array text-2xl tracking-wider text-[#fffce1]">
                  Gareith
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Close Sidebar"
                className="p-1.5 rounded-lg text-[#a8a590] hover:text-[#fffce1] hover:bg-[#fffce1]/10 transition-colors cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Primary Actions: New Chat + API Keys Configuration */}
            <nav className="space-y-2">
              <button
                type="button"
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold bg-[#fffce1] text-[#0e0e0e] hover:bg-[#fffce1]/90 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                New Chat
              </button>

              <button
                type="button"
                onClick={() => setShowApiModal(true)}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-medium bg-[#181816] hover:bg-[#1f1f1c] text-[#fffce1] border border-[#fffce1]/12 hover:border-[#fffce1]/25 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                  API Keys (BYOK)
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] ${
                    configuredKeyCount > 0
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-[#fffce1]/10 text-[#a8a590]"
                  }`}
                >
                  {configuredKeyCount}/4
                </span>
              </button>
            </nav>

            {/* Smooth Scrolling Recent Chats List */}
            <div className="mt-5 pt-4 border-t border-[#fffce1]/10 flex-1 flex flex-col min-h-0 relative">
              <div className="flex items-center justify-between mb-2 px-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#a8a590]">
                  Recent Chats
                </span>
                <span className="text-[10px] font-mono text-[#a8a590]/70">
                  {conversations.length}
                </span>
              </div>

              <div className="relative flex-1 overflow-y-auto smooth-scroll-area pr-1 space-y-1 py-1">
                {conversations.length === 0 ? (
                  <p className="px-2 text-xs text-[#a8a590]/60">
                    {user ? "No chats yet" : "Sign in to sync chats"}
                  </p>
                ) : (
                  conversations.map((chat, idx) => (
                    <motion.div
                      key={chat.thread_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.025 }}
                      onClick={() => loadHistory(chat.thread_id)}
                      className={`group w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 text-sm rounded-lg transition-all cursor-pointer ${
                        chat.thread_id === threadId
                          ? "bg-[#fffce1]/12 text-[#fffce1] font-medium border border-[#fffce1]/15"
                          : "text-[#a8a590] hover:text-[#fffce1] hover:bg-[#fffce1]/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{chat.title || "New Chat"}</span>
                      </div>

                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleRenameChat(chat.thread_id, chat.title, e)}
                          title="Rename Chat"
                          className="p-1 rounded hover:bg-[#fffce1]/15 text-[#a8a590] hover:text-[#fffce1] transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteChat(chat.thread_id, e)}
                          title="Delete Chat"
                          className="p-1 rounded hover:bg-red-500/20 text-[#a8a590] hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Announcement Card */}
            {showAnnouncement && (
              <div className="mt-2">
                <Announcement
                  title="FLUX + LangGraph Ready"
                  description="Bring your own API keys or use default cloud routing."
                  onClose={() => setShowAnnouncement(false)}
                />
              </div>
            )}

            {/* User Account Footer */}
            <div className="mt-3 pt-3 border-t border-[#fffce1]/10">
              {user ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-[#181816] border border-[#fffce1]/12">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#fffce1] flex items-center justify-center text-[#0e0e0e] font-bold text-xs shrink-0">
                      {user.email[0].toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[#fffce1] truncate">
                        {user.email.split("@")[0]}
                      </div>
                      <div className="text-[10px] text-[#a8a590] truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-1.5 text-[#a8a590] hover:text-red-400 hover:bg-[#fffce1]/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setShowAuthModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#fffce1] hover:bg-[#fffce1]/90 text-[#0e0e0e] font-semibold text-xs transition-colors cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Log In / Sign Up
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* MAIN WORKSPACE */}
      <main className="relative flex-1 flex flex-col h-full overflow-hidden bg-[#0e0e0e]">
        {/* Persistent Top Control Bar (Sidebar Toggle + Shuttle Reload + API Keys Shortcut) */}
        <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[#fffce1]/10 bg-[#0e0e0e]/85 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title={sidebarOpen ? "Close Sidebar" : "Open Sidebar"}
              className="p-2 rounded-xl bg-[#161614] border border-[#fffce1]/12 text-[#fffce1] hover:bg-[#fffce1]/10 transition-colors cursor-pointer"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => triggerShuttleReload(true)}
              title="Reload Workspace"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#161614] border border-[#fffce1]/12 text-xs text-[#a8a590] hover:text-[#fffce1] hover:bg-[#fffce1]/10 transition-all cursor-pointer"
            >
              <motion.span
                animate={{ rotate: isReloading ? 360 : 0 }}
                transition={{ duration: 0.55, ease: "easeInOut" }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </motion.span>
              <span className="hidden sm:inline">Reload</span>
            </button>

            {messages.length > 0 && (
              <span className="font-array text-xl tracking-wider text-[#fffce1] ml-1">
                Gareith
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowApiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161614] hover:bg-[#1f1f1c] border border-[#fffce1]/15 text-xs font-medium text-[#fffce1] transition-colors cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-300" />
              <span>API Keys</span>
              {configuredKeyCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </button>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={startNewChat}
                className="text-xs px-3 py-1.5 rounded-xl bg-[#fffce1] text-[#0e0e0e] font-semibold hover:bg-[#fffce1]/90 transition-colors cursor-pointer"
              >
                + New Chat
              </button>
            )}
          </div>
        </header>

        {/* Shuttle-Animated Workspace Body */}
        <motion.div
          key={reloadCycle}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {messages.length === 0 ? (
            /* HERO MODE: Larger "Gareith" Array Title + Mascot Input + Quick Starters */
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto smooth-scroll-area">
              <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
                <AnimatePresence>
                  <motion.div
                    key="gareith-hero-brand"
                    initial={{ opacity: 0, y: -20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -70, scale: 0.9, filter: "blur(6px)" }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-6 text-center select-none"
                  >
                    <h1 className="font-array text-7xl sm:text-9xl tracking-wide text-[#fffce1] leading-none drop-shadow-[0_0_35px_rgba(255,252,225,0.16)]">
                      Gareith
                    </h1>
                  </motion.div>
                </AnimatePresence>

                <div className="w-full">
                  <AiMascotInput
                    models={BACKEND_MODELS}
                    defaultModelId="openai/gpt-oss-120b"
                    value={promptInput}
                    onChange={setPromptInput}
                    title="How can I help you today?"
                    subtitle="Generate FLUX art, query documents via RAG, or search the live web"
                    showWelcome={true}
                    isProcessing={isStreaming}
                    onSubmit={handleChatSubmit}
                    className="!bg-[#151513] !border-[#fffce1]/15 focus-within:!border-[#fffce1]/35"
                  />

                  {/* Quick-Starter Bento Pills */}
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {QUICK_STARTERS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPromptInput(item.prompt)}
                        className="group flex items-center gap-3 p-3 rounded-2xl bg-[#141413]/80 hover:bg-[#1c1c19] border border-[#fffce1]/10 hover:border-[#fffce1]/25 text-left transition-all cursor-pointer"
                      >
                        <div className="p-2 rounded-xl bg-[#fffce1]/5 group-hover:bg-[#fffce1] group-hover:text-[#0e0e0e] text-[#fffce1] transition-colors shrink-0">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#fffce1] tracking-wide">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-[#a8a590] truncate">
                            {item.prompt}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT MODE */
            <div className="flex-1 flex flex-col h-full min-h-0">
              <div className="flex-1 overflow-y-auto smooth-scroll-area px-4 sm:px-8 pt-6 pb-8 space-y-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex gap-3.5 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="shrink-0 scale-75 -mt-2 -ml-3">
                          <RobotBeta
                            emotion={
                              isStreaming && i === messages.length - 1
                                ? "thinking"
                                : "reading"
                            }
                          />
                        </div>
                      )}

                      <div className="flex flex-col max-w-[85%] min-w-0">
                        <div
                          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-[#fffce1] text-[#0e0e0e] font-medium shadow-sm"
                              : "bg-[#161614] text-[#fffce1] border border-[#fffce1]/12"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            msg.content ? (
                              <RichMessageContent
                                content={msg.content}
                                onOpenLightbox={(url, alt) =>
                                  setLightboxImg({ url, alt })
                                }
                              />
                            ) : (
                              <div className="flex items-center gap-2 text-xs font-mono text-[#a8a590] py-1">
                                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                                Routing tools & generating response...
                              </div>
                            )
                          ) : (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          )}
                        </div>

                        {msg.role === "assistant" && msg.content && (
                          <div className="flex items-center gap-2 mt-1.5 px-1 text-[11px] text-[#a8a590]">
                            <button
                              type="button"
                              onClick={() => copyMessage(msg.content, i)}
                              className="flex items-center gap-1 hover:text-[#fffce1] transition-colors cursor-pointer"
                            >
                              {copiedMsgIdx === i ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  Copy
                                </>
                              )}
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={() => speakMessage(msg.content)}
                              className="flex items-center gap-1 hover:text-[#fffce1] transition-colors cursor-pointer"
                            >
                              <Volume2 className="h-3 w-3" />
                              Read Aloud
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="w-full bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/95 to-transparent pt-2 pb-5 px-4 sm:px-8">
                <div className="max-w-3xl mx-auto">
                  <AiMascotInput
                    models={BACKEND_MODELS}
                    defaultModelId="openai/gpt-oss-120b"
                    value={promptInput}
                    onChange={setPromptInput}
                    showWelcome={false}
                    isProcessing={isStreaming}
                    onSubmit={handleChatSubmit}
                    className="!bg-[#151513] !border-[#fffce1]/15 focus-within:!border-[#fffce1]/35"
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* BYOK API KEYS MODAL (Google, Groq, OpenAI, Claude) */}
      <AnimatePresence>
        {showApiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-[#141413] border border-[#fffce1]/15 p-6 shadow-2xl text-[#fffce1]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-array tracking-wider text-[#fffce1] flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-amber-300" />
                  Provider API Keys
                </h3>
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="text-[#a8a590] hover:text-[#fffce1] text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-[#a8a590] mb-5">
                Insert your personal API keys for custom model routing. Keys are stored locally and sent securely per request.
              </p>

              <form onSubmit={handleSaveApiKeys} className="space-y-3.5">
                {(
                  [
                    {
                      id: "google",
                      label: "Google Gemini API Key",
                      placeholder: "AIzaSy...",
                      icon: GeminiIcon,
                      color: "text-blue-400",
                    },
                    {
                      id: "groq",
                      label: "Groq Cloud API Key",
                      placeholder: "gsk_...",
                      icon: Sparkles,
                      color: "text-amber-400",
                    },
                    {
                      id: "openai",
                      label: "OpenAI API Key",
                      placeholder: "sk-proj-...",
                      icon: OpenAiIcon,
                      color: "text-emerald-400",
                    },
                    {
                      id: "claude",
                      label: "Anthropic Claude API Key",
                      placeholder: "sk-ant-...",
                      icon: AnthropicIcon,
                      color: "text-orange-400",
                    },
                  ] as const
                ).map((provider) => {
                  const Icon = provider.icon;
                  const isVisible = visibleKeys[provider.id];
                  return (
                    <div key={provider.id} className="space-y-1">
                      <label className="flex items-center justify-between text-xs font-medium text-[#fffce1]">
                        <span className="flex items-center gap-1.5">
                          <Icon size={13} className={provider.color} />
                          {provider.label}
                        </span>
                        {apiKeys[provider.id].trim() && (
                          <span className="text-[10px] font-mono text-emerald-400">
                            ● Configured
                          </span>
                        )}
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={isVisible ? "text" : "password"}
                          placeholder={provider.placeholder}
                          value={apiKeys[provider.id]}
                          onChange={(e) =>
                            setApiKeys((prev) => ({
                              ...prev,
                              [provider.id]: e.target.value,
                            }))
                          }
                          className="w-full rounded-xl bg-[#0e0e0e] border border-[#fffce1]/15 pl-3.5 pr-10 py-2.5 text-xs font-mono text-[#fffce1] placeholder:text-[#a8a590]/40 outline-none focus:border-[#fffce1]/50"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleKeys((prev) => ({
                              ...prev,
                              [provider.id]: !prev[provider.id],
                            }))
                          }
                          className="absolute right-3 text-[#a8a590] hover:text-[#fffce1] cursor-pointer"
                        >
                          {isVisible ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const empty = { google: "", groq: "", openai: "", claude: "" };
                      setApiKeys(empty);
                      localStorage.removeItem("gareith_api_keys");
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-[#fffce1]/15 text-xs text-[#a8a590] hover:text-red-400 hover:border-red-400/30 transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>

                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#fffce1] hover:bg-[#fffce1]/90 text-[#0e0e0e] font-semibold py-2.5 text-xs transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {keysSavedToast ? "Keys Saved!" : "Save API Keys"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImg(null)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 cursor-zoom-out"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImg.url}
              alt={lightboxImg.alt}
              className="max-h-[82vh] max-w-[90vw] rounded-2xl border border-[#fffce1]/20 shadow-2xl object-contain"
            />
            <p className="mt-4 max-w-xl text-center text-xs text-[#a8a590]">
              {lightboxImg.alt}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOGIN / SIGNUP MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141413] border border-[#fffce1]/15 p-6 shadow-2xl text-[#fffce1]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-array tracking-wider text-[#fffce1] flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-[#fffce1]" />
                {authMode === "login" ? "Welcome Back" : "Join Gareith"}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-[#a8a590] hover:text-[#fffce1] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "signup" && (
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl bg-[#0e0e0e] border border-[#fffce1]/15 px-3.5 py-2.5 text-sm text-[#fffce1] placeholder:text-[#a8a590]/50 outline-none focus:border-[#fffce1]"
                />
              )}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl bg-[#0e0e0e] border border-[#fffce1]/15 px-3.5 py-2.5 text-sm text-[#fffce1] placeholder:text-[#a8a590]/50 outline-none focus:border-[#fffce1]"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl bg-[#0e0e0e] border border-[#fffce1]/15 px-3.5 py-2.5 text-sm text-[#fffce1] placeholder:text-[#a8a590]/50 outline-none focus:border-[#fffce1]"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-[#fffce1] hover:bg-[#fffce1]/90 text-[#0e0e0e] font-semibold py-2.5 text-sm transition-colors cursor-pointer"
              >
                {authMode === "login" ? "Sign In" : "Sign Up"}
              </button>
            </form>

            <div className="my-4 flex items-center gap-2 text-xs text-[#a8a590]">
              <div className="h-px flex-1 bg-[#fffce1]/10" />
              <span>OR</span>
              <div className="h-px flex-1 bg-[#fffce1]/10" />
            </div>

            <a
              href={`${API_BASE}/auth/google/login`}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#fffce1]/5 hover:bg-[#fffce1]/10 border border-[#fffce1]/15 py-2.5 text-xs font-medium text-[#fffce1] transition-colors"
            >
              Continue with Google
            </a>

            <p className="mt-4 text-center text-xs text-[#a8a590]">
              {authMode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() =>
                  setAuthMode(authMode === "login" ? "signup" : "login")
                }
                className="text-[#fffce1] hover:underline font-medium cursor-pointer"
              >
                {authMode === "login" ? "Sign Up" : "Log In"}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
