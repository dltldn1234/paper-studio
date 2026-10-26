import { useEffect, useRef, type ReactNode } from 'react'
export function Modal({
  children,
  labelledBy,
  onClose,
}: {
  children: ReactNode
  labelledBy: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="home-dialog"
      aria-labelledby={labelledBy}
      onCancel={onClose}
    >
      {children}
    </dialog>
  )
}
