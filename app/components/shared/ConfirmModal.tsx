import { Button } from '@/app/components/ui/button'
import { Modal } from './Modal'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  detail?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'error'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmText = 'Yes',
  cancelText = 'No',
  variant = 'default'
}: ConfirmModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title} 
      variant={variant}
      closeOnOverlayClick={false}
    >
      <p className="modal-subtitle">
        {message}
        {detail && (
          <>
            <br />
            <br />
            {detail}
          </>
        )}
      </p>
      <div className="modal-actions">
        <Button onClick={onConfirm}>{confirmText}</Button>
        <Button variant="ghost" onClick={onClose}>
          {cancelText}
        </Button>
      </div>
    </Modal>
  )
}
