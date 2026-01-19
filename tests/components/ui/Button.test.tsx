/**
 * Component Tests: Button
 *
 * Tests button variants, states, and interactions
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Mock Button component based on CVA patterns
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

function Button({
  variant = 'default',
  size = 'default',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50'

  const variantStyles = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  }

  const sizeStyles = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      data-loading={isLoading}
      {...props}
    >
      {isLoading && (
        <span data-testid="loading-spinner" className="mr-2 animate-spin">
          ⏳
        </span>
      )}
      {leftIcon && !isLoading && (
        <span data-testid="left-icon" className="mr-2">
          {leftIcon}
        </span>
      )}
      {children}
      {rightIcon && (
        <span data-testid="right-icon" className="ml-2">
          {rightIcon}
        </span>
      )}
    </button>
  )
}

describe('Button Component', () => {
  describe('rendering', () => {
    it('renders button with children', () => {
      render(<Button>Click me</Button>)

      expect(screen.getByRole('button')).toHaveTextContent('Click me')
    })

    it('applies base styles', () => {
      render(<Button>Button</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('inline-flex')
      expect(button).toHaveClass('rounded-md')
    })
  })

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<Button variant="default">Default</Button>)

      expect(screen.getByRole('button')).toHaveClass('bg-primary')
    })

    it('applies destructive variant styles', () => {
      render(<Button variant="destructive">Delete</Button>)

      expect(screen.getByRole('button')).toHaveClass('bg-destructive')
    })

    it('applies outline variant styles', () => {
      render(<Button variant="outline">Outline</Button>)

      expect(screen.getByRole('button')).toHaveClass('border')
    })

    it('applies secondary variant styles', () => {
      render(<Button variant="secondary">Secondary</Button>)

      expect(screen.getByRole('button')).toHaveClass('bg-secondary')
    })

    it('applies ghost variant styles', () => {
      render(<Button variant="ghost">Ghost</Button>)

      expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')
    })

    it('applies link variant styles', () => {
      render(<Button variant="link">Link</Button>)

      expect(screen.getByRole('button')).toHaveClass('underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('applies default size styles', () => {
      render(<Button size="default">Default</Button>)

      expect(screen.getByRole('button')).toHaveClass('h-10')
    })

    it('applies small size styles', () => {
      render(<Button size="sm">Small</Button>)

      expect(screen.getByRole('button')).toHaveClass('h-9')
    })

    it('applies large size styles', () => {
      render(<Button size="lg">Large</Button>)

      expect(screen.getByRole('button')).toHaveClass('h-11')
    })

    it('applies icon size styles', () => {
      render(<Button size="icon">🔍</Button>)

      expect(screen.getByRole('button')).toHaveClass('w-10')
    })
  })

  describe('disabled state', () => {
    it('can be disabled', () => {
      render(<Button disabled>Disabled</Button>)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('applies disabled styles', () => {
      render(<Button disabled>Disabled</Button>)

      expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50')
    })

    it('prevents click when disabled', () => {
      const handleClick = vi.fn()
      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      )

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>)

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('disables button when loading', () => {
      render(<Button isLoading>Loading</Button>)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('sets data-loading attribute', () => {
      render(<Button isLoading>Loading</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true')
    })

    it('hides left icon when loading', () => {
      render(
        <Button isLoading leftIcon={<span>👈</span>}>
          Loading
        </Button>
      )

      expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
    })
  })

  describe('icons', () => {
    it('renders left icon', () => {
      render(<Button leftIcon={<span>👈</span>}>With Left Icon</Button>)

      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders right icon', () => {
      render(<Button rightIcon={<span>👉</span>}>With Right Icon</Button>)

      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })

    it('renders both icons', () => {
      render(
        <Button leftIcon={<span>👈</span>} rightIcon={<span>👉</span>}>
          Both Icons
        </Button>
      )

      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('passes event to onClick handler', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object))
    })
  })

  describe('custom className', () => {
    it('merges custom className with default styles', () => {
      render(<Button className="custom-class">Custom</Button>)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toHaveClass('inline-flex')
    })
  })

  describe('HTML attributes', () => {
    it('passes through type attribute', () => {
      render(<Button type="submit">Submit</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })

    it('passes through aria attributes', () => {
      render(<Button aria-label="Custom label">Button</Button>)

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Custom label')
    })

    it('passes through data attributes', () => {
      render(<Button data-testid="custom-button">Button</Button>)

      expect(screen.getByTestId('custom-button')).toBeInTheDocument()
    })
  })
})
