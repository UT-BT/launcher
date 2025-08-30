import { useState, useEffect } from 'react'

interface ConfirmDialogData {
  id: string
  title: string
  message: string
  detail?: string
}

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmDialogData | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleConfirm = (data: ConfirmDialogData) => {
      setDialog(data)
      setIsOpen(true)
    }

    window.utInstall?.onConfirm(handleConfirm)

    return () => {}
  }, [])

  const respond = (confirmed: boolean) => {
    if (dialog?.id) {
      window.utInstall?.respondConfirm(dialog.id, confirmed)
    }
    setIsOpen(false)
    setDialog(null)
  }

  const confirm = () => respond(true)
  const cancel = () => respond(false)

  return {
    dialog,
    isOpen,
    confirm,
    cancel,
    close: cancel
  }
}
