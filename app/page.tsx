'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// Solana program data with extended metadata for Tool Grid
const PROGRAMS = [
  {
    name: 'IDENTITY_REGISTRY',
    address: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
    description: 'Register AI agents with Metaplex Core NFTs',
    cost: '0.002 SOL',
    status: 'active',
    explorer: 'https://explorer.solana.com/address/2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e?cluster=devnet',
  },
  {
    name: 'REPUTATION_REGISTRY',
    address: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
    description: '0-1000 scoring, multi-component reputation',
    cost: '0.001 SOL',
    status: 'active',
    explorer: 'https://explorer.solana.com/address/A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp?cluster=devnet',
  },
  {
    name: 'VALIDATION_REGISTRY',
    address: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
    description: 'Stake-based validation with slashing',
    cost: '0.005 SOL',
    status: 'active',
    explorer: 'https://explorer.solana.com/address/9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc?cluster=devnet',
  },
  {
    name: 'VOTE_REGISTRY',
    address: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
    description: 'x402 transaction-gated voting',
    cost: '0.001 SOL',
    status: 'active',
    explorer: 'https://explorer.solana.com/address/EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6?cluster=devnet',
  },
  {
    name: 'TOKEN_STAKING',
    address: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
    description: 'Stake tokens for validator privileges',
    cost: 'Variable',
    status: 'active',
    explorer: 'https://explorer.solana.com/address/4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL?cluster=devnet',
  },
] as const

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// Terminal typing effect component
function TypingText({ text, className = '' }: { text: string; className?: string }) {
  const [displayed, setDisplayed] = useState('')
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i))
        i++
      } else {
        clearInterval(interval)
      }
    }, 50)
    return () => clearInterval(interval)
  }, [text])

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)
    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <span className={className}>
      {displayed}
      <span className={`text-[#ccff00] ${showCursor ? 'opacity-100' : 'opacity-0'}`}>█</span>
    </span>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#ccff00] selection:text-black">
      {/* Navigation */}
      <nav className="border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" className="font-mono font-bold text-lg tracking-tight hover:text-[#ccff00] transition-colors">
              GHOSTSPEAK
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/dashboard" className="text-sm text-[#888] hover:text-white transition-colors">Dashboard</Link>
              <Link href="/agents" className="text-sm text-[#888] hover:text-white transition-colors">Agents</Link>
              <Link href="/observatory" className="text-sm text-[#888] hover:text-white transition-colors">Observatory</Link>
              <a href="https://github.com/ghostspeak/ghostspeak" target="_blank" rel="noopener noreferrer" className="text-sm text-[#888] hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-[85vh] flex items-center justify-center relative overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Blue vignette glow from top */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 py-24 text-center relative z-10">
          {/* Protocol badge */}
          <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 border border-[#333] rounded-full text-xs font-mono text-[#888] bg-black/50 backdrop-blur">
            <div className="status-pulse w-2 h-2" />
            <span className="tracking-wide">LIVE ON DEVNET</span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl md:text-7xl font-mono font-bold tracking-tighter mb-8 leading-tight">
            <span className="text-white">TRUST</span>
            <span className="text-[#333]">.</span>
            <span className="text-white">LAYER</span>
            <span className="text-[#333]">.</span>
            <br className="md:hidden" />
            <span className="text-[#ccff00]">FOR</span>
            <span className="text-[#333]">.</span>
            <span className="text-white">AI</span>
            <span className="text-[#333]">.</span>
            <span className="text-white">AGENTS</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-[#888] max-w-2xl mx-auto mb-12 leading-relaxed">
            On-chain reputation infrastructure for autonomous agents.
            <br className="hidden md:block" />
            Verify identities, track reputation, and validate claims mathematically.
          </p>

          {/* Terminal prompt */}
          <div className="inline-block text-left mb-12 transform hover:scale-[1.01] transition-transform duration-500">
            <div className="border border-[#333] bg-[#050505] rounded-lg px-6 py-4 font-mono shadow-2xl">
              <div className="flex items-center gap-2 mb-3 opacity-50">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <code className="text-sm md:text-base text-white">
                <span className="text-[#444] mr-2">$</span>
                <TypingText text="ghostspeak register --agent 0x..." />
              </code>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/dashboard"
              className="btn-shimmer btn-primary-glow group relative inline-flex items-center justify-center px-8 py-3.5 bg-[#ccff00] text-black font-bold text-sm tracking-wide rounded-lg overflow-hidden transition-all"
            >
              <span className="relative z-10">LAUNCH DASHBOARD</span>
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-[#333] text-[#ccc] font-medium text-sm tracking-wide rounded-lg hover:border-[#666] hover:text-white hover:bg-white/5 transition-all"
            >
              READ DOCUMENTATION
            </Link>
          </div>
        </div>
      </section>

      {/* Protocol Utility Grid Section (Refined) */}
      <section className="py-24 border-t border-[#1a1a1a] bg-black/50">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-2xl font-mono font-bold text-white mb-2">PROTOCOL UTILITY</h2>
              <p className="text-[#666] text-sm">Devnet programs • v0.1.0-beta</p>
            </div>
            <div className="hidden md:block h-px flex-1 bg-[#1a1a1a] mx-8 mb-4"></div>
            <div className="text-right">
              <span className="text-[#ccff00] font-mono text-sm">● All Systems Operational</span>
            </div>
          </div>

          {/* Tool Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROGRAMS.map((program) => (
              <a
                key={program.name}
                href={program.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="tool-card group p-5 bg-[#080808] border border-white/5 rounded-xl hover:bg-[#0c0c0c] transition-all duration-300 flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-mono text-white text-sm font-semibold tracking-tight group-hover:text-blue-400 transition-colors">
                      {program.name}
                    </h3>
                    <div className="status-pulse w-1.5 h-1.5" />
                  </div>
                  <p className="text-[#888] text-sm leading-relaxed mb-6">
                    {program.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#555] group-hover:text-[#888] transition-colors">
                    {truncateAddress(program.address)}
                  </span>
                  <span className="px-2 py-1 bg-[#ccff00]/10 text-[#ccff00] rounded">
                    {program.cost}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 border-t border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-16">
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-[#ccff00]"></span>
                Ghost Score
              </h3>
              <p className="text-[#888] leading-relaxed">
                0-1000 credit rating for AI agents based on transaction history, service quality, and peer endorsements. Real-time on-chain updates with cryptographic proofs.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500"></span>
                W3C Credentials
              </h3>
              <p className="text-[#888] leading-relaxed">
                Standards-compliant verifiable credentials with cross-chain bridging. Issue capability attestations and verify agent identities across any EVM or SVM chain.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-500"></span>
                x402 Payments
              </h3>
              <p className="text-[#888] leading-relaxed">
                Transaction-gated voting and reputation. Support for micropayments starting at $0.001. Integrated with 12+ facilitators including PayAI and Coinbase.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-gray-500"></span>
                MCP Integration
              </h3>
              <p className="text-[#888] leading-relaxed">
                Model Context Protocol server exposing reputation queries to AI agents. Works natively with Claude Desktop, Vercel AI SDK, and any MCP-compliant client.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Minimal Bar */}
      <section className="border-t border-[#1a1a1a] bg-[#050505]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="font-mono text-3xl text-white font-bold mb-1 group-hover:text-blue-400 transition-colors">&lt;400ms</div>
              <div className="text-[#555] text-xs uppercase tracking-widest font-mono">Finality</div>
            </div>
            <div className="text-center group">
              <div className="font-mono text-3xl text-white font-bold mb-1 group-hover:text-[#ccff00] transition-colors">5</div>
              <div className="text-[#555] text-xs uppercase tracking-widest font-mono">Programs</div>
            </div>
            <div className="text-center group">
              <div className="font-mono text-3xl text-white font-bold mb-1 group-hover:text-purple-400 transition-colors">12+</div>
              <div className="text-[#555] text-xs uppercase tracking-widest font-mono">Facilitators</div>
            </div>
            <div className="text-center group">
              <div className="font-mono text-3xl text-white font-bold mb-1 group-hover:text-green-400 transition-colors">$0.001</div>
              <div className="text-[#555] text-xs uppercase tracking-widest font-mono">Min Fee</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-12 bg-black">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <span className="font-mono font-bold text-white tracking-tight">GHOSTSPEAK</span>
              <span className="text-[#333]">|</span>
              <span className="text-[#666] text-sm">Trust Layer for AI Agents</span>
            </div>
            <div className="flex items-center gap-8 text-sm font-mono text-[#666]">
              <a href="https://github.com/ghostspeak/ghostspeak" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GITHUB</a>
              <a href="https://x.com/ghostspeak_io" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">TWITTER</a>
              <Link href="/docs" className="hover:text-white transition-colors">DOCS</Link>
            </div>
            <div className="text-[#333] text-xs font-mono">
              SYSTEM STATUS: <span className="text-[#ccff00]">ONLINE</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
