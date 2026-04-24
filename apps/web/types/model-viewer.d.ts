import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type ModelViewerAttributes = {
  src?: string
  alt?: string
  poster?: string
  'camera-controls'?: boolean | ''
  'auto-rotate'?: boolean | ''
  'shadow-intensity'?: string | number
  exposure?: string | number
  'environment-image'?: string
  ar?: boolean | ''
  'ar-modes'?: string
  'touch-action'?: 'pan-y' | 'pan-x' | 'none'
  'interaction-prompt'?: 'auto' | 'when-focused' | 'none'
  'disable-zoom'?: boolean | ''
  'auto-rotate-delay'?: string | number
  'rotation-per-second'?: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': DetailedHTMLProps<HTMLAttributes<HTMLElement> & ModelViewerAttributes, HTMLElement>
    }
  }
}

export {}
