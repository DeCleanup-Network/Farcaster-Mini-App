'use client'

import { useEffect, useRef } from 'react'

/**
 * Modal Manager Hook
 * 
 * Prevents multiple modals from stacking by ensuring only one modal
 * is active at a time. When a new modal opens, it closes others.
 * 
 * Usage:
 * ```tsx
 * const { registerModal, unregisterModal, closeAllModals } = useModalManager()
 * 
 * useEffect(() => {
 *   registerModal('myModal', isOpen, () => setIsOpen(false))
 *   return () => unregisterModal('myModal')
 * }, [isOpen])
 * ```
 */
export function useModalManager() {
  const modalsRef = useRef<Map<string, { isOpen: boolean; close: () => void }>>(new Map())

  const registerModal = (id: string, isOpen: boolean, close: () => void) => {
    if (isOpen) {
      // Close all other modals when this one opens
      modalsRef.current.forEach((modal, modalId) => {
        if (modalId !== id && modal.isOpen) {
          modal.close()
        }
      })
    }

    modalsRef.current.set(id, { isOpen, close })
  }

  const unregisterModal = (id: string) => {
    modalsRef.current.delete(id)
  }

  const closeAllModals = () => {
    modalsRef.current.forEach((modal) => {
      if (modal.isOpen) {
        modal.close()
      }
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      modalsRef.current.clear()
    }
  }, [])

  return {
    registerModal,
    unregisterModal,
    closeAllModals,
  }
}

