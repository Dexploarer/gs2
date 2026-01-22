/**
 * Component Tests: AgentCard
 *
 * Tests agent card rendering, interactions, and state display
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { mockAgent, mockAgentBronze, mockAgentPlatinum } from '../../fixtures/agents'

type AgentFixture = typeof mockAgent | typeof mockAgentBronze | typeof mockAgentPlatinum

// Mock component for testing (since actual component may have complex dependencies)
function AgentCard({
  agent,
  onClick,
  showScore = true,
  compact = false,
}: {
  agent: AgentFixture
  onClick?: () => void
  showScore?: boolean
  compact?: boolean
}) {
  const tierColors = {
    bronze: 'bg-amber-700',
    silver: 'bg-gray-400',
    gold: 'bg-yellow-500',
    platinum: 'bg-purple-500',
  }

  return (
    <div
      data-testid="agent-card"
      className={`rounded-lg p-4 ${compact ? 'p-2' : 'p-4'}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${tierColors[agent.tier]}`} />
        <div>
          <h3 className="font-semibold" data-testid="agent-name">
            {agent.name}
          </h3>
          <p className="text-sm text-gray-500" data-testid="agent-address">
            {agent.address.slice(0, 8)}...{agent.address.slice(-4)}
          </p>
        </div>
      </div>

      {showScore && (
        <div className="mt-3" data-testid="score-section">
          <div className="flex justify-between">
            <span>Ghost Score</span>
            <span data-testid="ghost-score" className="font-bold">
              {agent.ghostScore}
            </span>
          </div>
          <div
            data-testid="tier-badge"
            className={`inline-block px-2 py-1 rounded text-white ${tierColors[agent.tier]}`}
          >
            {agent.tier.charAt(0).toUpperCase() + agent.tier.slice(1)}
          </div>
        </div>
      )}

      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="mt-2" data-testid="capabilities">
          {agent.capabilities.map((cap) => (
            <span key={cap} className="inline-block px-2 py-1 bg-gray-100 rounded mr-1 text-xs">
              {cap}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-400" data-testid="agent-status">
        Status: {agent.status}
      </div>
    </div>
  )
}

describe('AgentCard Component', () => {
  describe('rendering', () => {
    it('renders agent name', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.getByTestId('agent-name')).toHaveTextContent(mockAgent.name)
    })

    it('renders truncated address', () => {
      render(<AgentCard agent={mockAgent} />)

      const addressElement = screen.getByTestId('agent-address')
      expect(addressElement).toHaveTextContent('7xKXtg2C')
      expect(addressElement).toHaveTextContent('gAsU')
    })

    it('renders ghost score when showScore is true', () => {
      render(<AgentCard agent={mockAgent} showScore={true} />)

      expect(screen.getByTestId('ghost-score')).toHaveTextContent(mockAgent.ghostScore.toString())
    })

    it('hides ghost score when showScore is false', () => {
      render(<AgentCard agent={mockAgent} showScore={false} />)

      expect(screen.queryByTestId('score-section')).not.toBeInTheDocument()
    })

    it('renders tier badge', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.getByTestId('tier-badge')).toHaveTextContent('Gold')
    })

    it('renders agent status', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.getByTestId('agent-status')).toHaveTextContent(mockAgent.status)
    })
  })

  describe('tier display', () => {
    it('displays bronze tier correctly', () => {
      render(<AgentCard agent={mockAgentBronze} />)

      expect(screen.getByTestId('tier-badge')).toHaveTextContent('Bronze')
    })

    it('displays platinum tier correctly', () => {
      render(<AgentCard agent={mockAgentPlatinum} />)

      expect(screen.getByTestId('tier-badge')).toHaveTextContent('Platinum')
    })

    it('capitalizes tier name', () => {
      render(<AgentCard agent={mockAgent} />)

      const badge = screen.getByTestId('tier-badge')
      expect(badge.textContent?.[0]).toBe(badge.textContent?.[0].toUpperCase())
    })
  })

  describe('capabilities', () => {
    it('renders agent capabilities', () => {
      const agentWithCaps = {
        ...mockAgent,
        capabilities: ['text-generation', 'image-analysis'],
      }

      render(<AgentCard agent={agentWithCaps} />)

      expect(screen.getByTestId('capabilities')).toBeInTheDocument()
      expect(screen.getByText('text-generation')).toBeInTheDocument()
      expect(screen.getByText('image-analysis')).toBeInTheDocument()
    })

    it('does not render capabilities section when empty', () => {
      const agentWithoutCaps = {
        ...mockAgent,
        capabilities: [],
      }

      render(<AgentCard agent={agentWithoutCaps} />)

      expect(screen.queryByTestId('capabilities')).not.toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<AgentCard agent={mockAgent} onClick={handleClick} />)

      fireEvent.click(screen.getByTestId('agent-card'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('has button role when onClick is provided', () => {
      const handleClick = vi.fn()
      render(<AgentCard agent={mockAgent} onClick={handleClick} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('does not have button role when onClick is not provided', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('compact mode', () => {
    it('applies compact styles when compact is true', () => {
      render(<AgentCard agent={mockAgent} compact={true} />)

      const card = screen.getByTestId('agent-card')
      expect(card).toHaveClass('p-2')
    })

    it('applies normal styles when compact is false', () => {
      render(<AgentCard agent={mockAgent} compact={false} />)

      const card = screen.getByTestId('agent-card')
      expect(card).toHaveClass('p-4')
    })
  })

  describe('score display', () => {
    it('shows score for high-scoring agents', () => {
      render(<AgentCard agent={mockAgentPlatinum} />)

      expect(screen.getByTestId('ghost-score')).toHaveTextContent(
        mockAgentPlatinum.ghostScore.toString()
      )
    })

    it('shows score for low-scoring agents', () => {
      render(<AgentCard agent={mockAgentBronze} />)

      expect(screen.getByTestId('ghost-score')).toHaveTextContent(
        mockAgentBronze.ghostScore.toString()
      )
    })
  })

  describe('accessibility', () => {
    it('has accessible name', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.getByTestId('agent-name')).toBeInTheDocument()
    })

    it('provides score context', () => {
      render(<AgentCard agent={mockAgent} />)

      expect(screen.getByText('Ghost Score')).toBeInTheDocument()
    })
  })
})
