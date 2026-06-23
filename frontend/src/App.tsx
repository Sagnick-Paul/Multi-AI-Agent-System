import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

type Status = 'idle' | 'streaming' | 'completed' | 'error'
type StepKey = 'SEARCH' | 'SCRAPE' | 'WRITE' | 'CRITIC' | 'COMPLETE' | 'none'
type MsgType = 'LOG' | 'RESULT' | 'ERROR'

interface StreamMessage {
  step: StepKey
  type: MsgType
  content: string
}

interface StepInfo {
  key: StepKey
  label: string
  desc: string
  icon: (state: 'pending' | 'active' | 'done') => JSX.Element
}

const PIPELINE_STEPS: StepInfo[] = [
  { 
    key: 'SEARCH', 
    label: 'Deep Web Search', 
    desc: 'Retrieving fresh, relevant details',
    icon: (state) => (
      <svg className={`h-6 w-6 transition-all duration-300 ${state === 'active' ? 'text-indigo-400 animate-bounce' : state === 'done' ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )
  },
  { 
    key: 'SCRAPE', 
    label: 'Source Scraper', 
    desc: 'Extracting deep text from pages',
    icon: (state) => (
      <svg className={`h-6 w-6 transition-all duration-300 ${state === 'active' ? 'text-pink-400 animate-pulse' : state === 'done' ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    key: 'WRITE',  
    label: 'Research Writer',  
    desc: 'Drafting structured markdown report',
    icon: (state) => (
      <svg className={`h-6 w-6 transition-all duration-300 ${state === 'active' ? 'text-purple-400 animate-pulse' : state === 'done' ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  },
  { 
    key: 'CRITIC', 
    label: 'Academic Critic', 
    desc: 'Strict evaluation & suggestions',
    icon: (state) => (
      <svg className={`h-6 w-6 transition-all duration-300 ${state === 'active' ? 'text-amber-400 animate-spin-slow' : state === 'done' ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  },
]

const STEP_ORDER: StepKey[] = ['SEARCH', 'SCRAPE', 'WRITE', 'CRITIC', 'COMPLETE']

function getStepState(stepKey: StepKey, currentStep: StepKey): 'pending' | 'active' | 'done' {
  if (currentStep === 'none') return 'pending'
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  const stepIdx = STEP_ORDER.indexOf(stepKey)
  if (stepIdx === -1) return 'pending'
  if (stepIdx < currentIdx) return 'done'
  if (stepIdx === currentIdx) return 'active'
  return 'pending'
}

function StepBadge({ state }: { state: 'pending' | 'active' | 'done' }) {
  if (state === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.15)] animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        Processing
      </span>
    )
  }
  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
        <svg className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Complete
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-800/40 px-2.5 py-0.5 text-xs font-semibold text-slate-500 border border-slate-700/20">
      Queued
    </span>
  )
}

export default function App() {
  const [topic, setTopic] = useState<string>('')
  const [status, setStatus] = useState<Status>('idle')
  const [currentStep, setCurrentStep] = useState<StepKey>('none')
  const [logs, setLogs] = useState<{ step: StepKey; type: MsgType; text: string; time: string }[]>([])
  const [finalReport, setFinalReport] = useState<string>('')
  const [finalFeedback, setFinalFeedback] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'report' | 'feedback'>('report')
  const [showDownload, setShowDownload] = useState(false)

  const consoleRef = useRef<HTMLDivElement>(null)   // scrolls only the console panel
  const eventSourceRef = useRef<EventSource | null>(null)

  const runPipeline = () => {
    if (!topic.trim() || status === 'streaming') return

    setStatus('streaming')
    setCurrentStep('none')
    setLogs([])
    setFinalReport('')
    setFinalFeedback('')
    setActiveTab('report')

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
    const url = `${backendUrl}/api/research/stream?topic=${encodeURIComponent(topic.trim())}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event: MessageEvent) => {
      try {
        const msg: StreamMessage = JSON.parse(event.data)
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

        setCurrentStep(msg.step)

        if (msg.type === 'LOG') {
          setLogs(prev => [...prev, { step: msg.step, type: msg.type, text: msg.content, time: timeStr }])
        } else if (msg.type === 'RESULT') {
          if (msg.step === 'WRITE') {
            setFinalReport(msg.content)
            setActiveTab('report')
          } else if (msg.step === 'CRITIC') {
            setFinalFeedback(msg.content)
            setActiveTab('feedback')
          }
        } else if (msg.type === 'ERROR') {
          setLogs(prev => [...prev, { step: msg.step, type: msg.type, text: msg.content, time: timeStr }])
        }

        if (msg.step === 'COMPLETE') {
          setStatus('completed')
          es.close()
        }
      } catch {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs(prev => [...prev, { step: 'none', type: 'ERROR', text: 'Could not parse server payload.', time: timeStr }])
      }
    }

    es.onerror = () => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setLogs(prev => [...prev, { step: 'none', type: 'ERROR', text: 'Stream disconnected unexpectedly. Check server logs.', time: timeStr }])
      setStatus('error')
      es.close()
    }
  }

  const topRef = useRef<HTMLDivElement>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  // Scroll ONLY the console panel, never the whole page
  useEffect(() => {
    const el = consoleRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const isStreaming = status === 'streaming'
  const hasOutput = finalReport !== '' || finalFeedback !== ''

  const copyLogs = () => {
    const rawText = logs.map(l => `[${l.time}] [${l.step}] ${l.text}`).join('\n')
    navigator.clipboard.writeText(rawText)
  }

  // ── Download helpers ────────────────────────────────────────────────
  const getActiveContent = () => activeTab === 'report' ? finalReport : finalFeedback
  const getActiveTitle  = () => activeTab === 'report' ? 'Research Report' : 'Critic Evaluation'

  /** Converts markdown string to a simple HTML string */
  const markdownToHtml = (md: string): string => {
    return md.split('\n').map(line => {
      if (line.startsWith('# '))   return `<h1>${line.slice(2)}</h1>`
      if (line.startsWith('## '))  return `<h2>${line.slice(3)}</h2>`
      if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
      if (line.startsWith('- '))   return `<li>${line.slice(2)}</li>`
      if (line.startsWith('> '))   return `<blockquote>${line.slice(2)}</blockquote>`
      if (line.trim() === '')      return '<br/>'
      return `<p>${line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')}</p>`
    }).join('')
  }

  const downloadPDF = () => {
    const content = getActiveContent()
    if (!content) return
    setShowDownload(false)

    const title = getActiveTitle()
    const bodyHtml = markdownToHtml(content)

    // Open a new window, write formatted HTML, then auto-print.
    // The browser's "Save as PDF" destination produces a perfect PDF
    // without any html2canvas / off-screen rendering issues.
    const pw = window.open('', '_blank', 'width=900,height=700')
    if (!pw) { alert('Please allow popups for this site to enable PDF download.'); return }

    pw.document.open()
    pw.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, Georgia, serif;
      font-size: 12pt;
      color: #111111;
      margin: 2cm 2.5cm;
      line-height: 1.75;
    }
    h1 {
      font-size: 22pt;
      border-bottom: 2px solid #cccccc;
      padding-bottom: 6pt;
      margin-bottom: 12pt;
      color: #1a1a2e;
    }
    h2 { font-size: 16pt; margin-top: 18pt; color: #1e293b; }
    h3 { font-size: 13pt; margin-top: 12pt; color: #334155; }
    p  { margin: 6pt 0; }
    li { margin: 3pt 0; }
    ul, ol { padding-left: 20pt; }
    code {
      background: #f1f5f9;
      font-family: Consolas, monospace;
      font-size: 10pt;
      padding: 1px 5px;
      border-radius: 3px;
    }
    blockquote {
      margin: 10pt 0 10pt 16pt;
      color: #475569;
      border-left: 3px solid #94a3b8;
      padding-left: 12pt;
      font-style: italic;
    }
    a { color: #2563eb; text-decoration: none; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    @media print {
      body { margin: 1.5cm 2cm; }
      h1, h2, h3 { page-break-after: avoid; }
      p, li { orphans: 3; widows: 3; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${bodyHtml}
  <script>
    // Auto-trigger print dialog; user selects "Save as PDF" destination
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`)
    pw.document.close()
  }

  const downloadDOCX = () => {
    setShowDownload(false)
    const content = getActiveContent()
    if (!content) return
    const title = getActiveTitle()
    const bodyHtml = markdownToHtml(content)

    // Full Word-compatible HTML document
    const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body { font-family: Calibri, sans-serif; font-size: 11pt; color: #111111; margin: 2cm; }
    h1 { font-size: 22pt; border-bottom: 1px solid #cccccc; padding-bottom: 4pt; }
    h2 { font-size: 16pt; }
    h3 { font-size: 13pt; }
    p, li { line-height: 1.7; margin: 4pt 0; }
    code { background: #f3f4f6; font-family: Consolas, monospace; font-size: 10pt; }
    blockquote { margin-left: 20pt; color: #555555; border-left: 3px solid #aaaaaa; padding-left: 8pt; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${bodyHtml}
</body>
</html>`

    const blob = new Blob([wordHtml], { type: 'application/msword' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${title.replace(/ /g, '_')}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <div className="relative min-h-screen bg-[#030307] bg-grid-pattern text-slate-200 antialiased overflow-x-hidden">
      {/* ── SCROLL TO TOP BUTTON ─────────────────────────────────── */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`fixed bottom-8 right-8 z-50 flex items-center justify-center h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-[0_4px_20px_rgba(99,102,241,0.45)] border border-indigo-500/30 text-white transition-all duration-300 hover:scale-110 hover:shadow-[0_4px_28px_rgba(99,102,241,0.6)] ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      {/* Decorative gradient radial blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[50%] rounded-full bg-pink-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Invisible top anchor */}
        <div ref={topRef} />
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header className="mb-10 text-center sm:text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
              Advanced Multi-Agent System
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 sm:text-5xl">
              Research Agent Lab
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-xl">
              Collaborative LangChain agents performing real-time search, scraping, synthesis, and peer evaluation.
            </p>
          </div>
          
          <div className="flex items-center justify-center sm:justify-end gap-3">
            <div className={`flex items-center gap-2 rounded-xl bg-slate-900/80 px-4 py-2 border border-slate-800 backdrop-blur-md`}>
              <span className={`h-2.5 w-2.5 rounded-full ${
                isStreaming ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                status === 'completed' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' :
                status === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-slate-600'
              }`} />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isStreaming ? 'STREAMING' : status === 'completed' ? 'READY / COMPLETED' : status === 'error' ? 'SYSTEM ERROR' : 'SYSTEM IDLE'}
              </span>
            </div>
          </div>
        </header>

        {/* ── CONTROL CARD ───────────────────────────────────────────── */}
        <section className="mb-8">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-1.5 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:border-slate-700/80">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isStreaming) runPipeline()
                  }}
                  placeholder="Ask agents to research any topic (e.g., 'Impact of generative AI on software testing')..."
                  disabled={isStreaming}
                  className="w-full bg-transparent pl-12 pr-4 py-4 text-sm sm:text-base text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                onClick={runPipeline}
                disabled={isStreaming || !topic.trim()}
                className="relative overflow-hidden group rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 px-6 py-4 text-sm font-bold text-white transition-all shadow-[0_4px_20px_rgba(99,102,241,0.25)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-indigo-600 disabled:hover:to-purple-600"
              >
                {isStreaming ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Executing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Trigger Pipeline
                    <svg className="h-4 w-4 transform transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ── PIPELINE FLOW TRACKER ───────────────────────────────────── */}
        <section className="mb-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step) => {
              const state = getStepState(step.key, currentStep)
              return (
                <div
                  key={step.key}
                  className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
                    state === 'active'
                      ? 'border-indigo-500/50 bg-indigo-950/15 shadow-[0_0_25px_rgba(99,102,241,0.12)] scale-[1.02]'
                      : state === 'done'
                      ? 'border-emerald-500/30 bg-emerald-950/5'
                      : 'border-slate-900 bg-slate-950/20'
                  }`}
                >
                  {state === 'active' && (
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-shimmer" />
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className={`p-2.5 rounded-xl ${
                      state === 'active' ? 'bg-indigo-500/10' :
                      state === 'done' ? 'bg-emerald-500/10' : 'bg-slate-900/60'
                    }`}>
                      {step.icon(state)}
                    </div>
                    <StepBadge state={state} />
                  </div>
                  
                  <div className="mt-4">
                    <h3 className={`text-base font-bold transition-colors ${state === 'active' ? 'text-white' : state === 'done' ? 'text-slate-200' : 'text-slate-400'}`}>
                      {step.label}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 leading-normal">
                      {step.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── OUTPUT GRID (LOGS + RESULT) ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* 💻 CONSOLE COLUMN */}
          <section className={`lg:col-span-5 flex flex-col ${hasOutput ? 'h-[580px]' : 'h-[360px]'} transition-all duration-500`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </span>
                <h2 className="ml-2 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Agent Pipeline Console
                </h2>
              </div>
              
              {logs.length > 0 && (
                <button 
                  onClick={copyLogs}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-slate-400 transition"
                  title="Copy console history"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Copy
                </button>
              )}
            </div>

            <div
              ref={consoleRef}
              className="flex-1 overflow-y-auto rounded-2xl border border-slate-900 bg-black/90 p-4 font-mono text-xs sm:text-[13px] leading-relaxed shadow-inner scrollbar-thin"
            >
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2 py-10">
                  <svg className="h-8 w-8 opacity-40 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Ready to stream logs...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, idx) => {
                    const isError = log.type === 'ERROR'
                    const isSystem = log.step === 'COMPLETE' || log.step === 'none'
                    return (
                      <div key={idx} className="flex items-start gap-2 border-b border-slate-950 pb-1.5 last:border-0">
                        <span className="text-[10px] text-slate-600 shrink-0 font-light mt-0.5">[{log.time}]</span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider shrink-0 px-1 py-0.5 rounded ${
                          isError ? 'bg-rose-500/10 text-rose-400' :
                          log.step === 'SEARCH' ? 'bg-indigo-500/10 text-indigo-400' :
                          log.step === 'SCRAPE' ? 'bg-pink-500/10 text-pink-400' :
                          log.step === 'WRITE' ? 'bg-purple-500/10 text-purple-400' :
                          log.step === 'CRITIC' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {log.step}
                        </span>
                        <div className={`flex-1 break-words ${isError ? 'text-rose-400' : isSystem ? 'text-slate-400' : 'text-slate-300'}`}>
                          {log.text}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 📄 RESULT COLUMN */}
          <section className={`lg:col-span-7 transition-all duration-500 ${hasOutput ? 'opacity-100 translate-y-0' : 'opacity-40 pointer-events-none'}`}>
            <div className="mb-4 flex items-center justify-between border-b border-slate-900 pb-2">
              {/* Tabs */}
              <div className="flex gap-2 p-0.5 rounded-lg bg-slate-900/60 border border-slate-800/80 backdrop-blur">
                <button
                  onClick={() => hasOutput && setActiveTab('report')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
                    activeTab === 'report'
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Research Report
                </button>
                <button
                  onClick={() => hasOutput && setActiveTab('feedback')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
                    activeTab === 'feedback'
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Critic Evaluation
                </button>
              </div>

              {/* Download dropdown */}
              {hasOutput && getActiveContent() && (
                <div className="relative">
                  <button
                    id="download-btn"
                    onClick={() => setShowDownload(v => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600/80 to-purple-600/80 hover:from-indigo-500 hover:to-purple-500 border border-indigo-500/30 text-xs font-bold text-white shadow-[0_2px_12px_rgba(99,102,241,0.25)] hover:shadow-[0_2px_18px_rgba(99,102,241,0.4)] transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                    <svg className={`h-3.5 w-3.5 transition-transform ${showDownload ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showDownload && (
                    <>
                      {/* click-outside overlay */}
                      <div className="fixed inset-0 z-40" onClick={() => setShowDownload(false)} />
                      <div className="absolute right-0 mt-2 w-44 z-50 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
                        <button
                          id="download-pdf"
                          onClick={downloadPDF}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors"
                        >
                          <svg className="h-4 w-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8.5 17v-1.3H10c.6 0 1-.1 1.3-.4.3-.3.5-.6.5-1.1 0-.5-.2-.9-.5-1.1-.3-.3-.8-.4-1.4-.4H7.8V17h.7zm0-3.9h1.4c.3 0 .6.1.7.2.2.2.2.4.2.7s-.1.5-.2.6c-.2.2-.4.2-.8.2H8.5v-1.7zm4.5 3.9v-4.3h1.6c.6 0 1 .1 1.4.3.4.2.7.5.9.9.2.4.3.8.3 1.3 0 .5-.1.9-.3 1.3-.2.4-.5.7-.9.9-.4.2-.8.3-1.4.3H13zm.7-3.6v2.9h.8c.5 0 .8-.1 1-.4.2-.3.3-.7.3-1.1 0-.4-.1-.8-.3-1-.2-.3-.6-.4-1-.4h-.8zm4.3 3.6v-4.3h2.7v.7h-2v1.1h1.9v.7H19v1.8h-.7z"/>
                          </svg>
                          Download as PDF
                        </button>
                        <button
                          id="download-docx"
                          onClick={downloadDOCX}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-semibold text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors border-t border-slate-800"
                        >
                          <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM7.5 17l-1.6-5.7h.8l1.1 4.3 1.2-4.3h.7l1.2 4.4 1.1-4.4h.8L11.1 17h-.7l-1.2-4.4L8 17H7.5z"/>
                          </svg>
                          Download as DOCX
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-900 bg-slate-950/40 p-6 min-h-[480px] max-h-[520px] overflow-y-auto backdrop-blur-xl shadow-2xl scrollbar-thin">
              {/* PDF is now generated from a dynamically created temp element — no hidden div needed */}

              {activeTab === 'report' ? (
                finalReport ? (
                  <div className="prose-custom">
                    <ReactMarkdown>{finalReport}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
                    <span>Writing draft report...</span>
                  </div>
                )
              ) : finalFeedback ? (
                <div className="prose-custom">
                  <ReactMarkdown>{finalFeedback}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
                  <span>Waiting for critic evaluation...</span>
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <footer className="mt-16 text-center text-xs text-slate-600 border-t border-slate-900/60 pt-6">
          Multi-Agent Research Laboratory · LangChain Agents · FastAPI · React 18
        </footer>
      </div>
    </div>
  )
}