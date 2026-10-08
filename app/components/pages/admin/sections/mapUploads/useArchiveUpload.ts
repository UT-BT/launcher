import { useCallback, useEffect, useReducer, useRef } from 'react'
import { uploadMapArchive } from '@/app/utils/api'
import { UPLOAD_IDLE, archiveProblem, uploadReducer } from './uploadState'

export function useArchiveUpload(token: string, onUploaded: (draftIds: number[]) => void) {
  const [state, dispatch] = useReducer(uploadReducer, UPLOAD_IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const onUploadedRef = useRef(onUploaded)
  useEffect(() => { onUploadedRef.current = onUploaded }, [onUploaded])
  useEffect(() => () => controllerRef.current?.abort(), [])

  const upload = useCallback((file: File) => {
    if (controllerRef.current) return
    const problem = archiveProblem(file)
    if (problem) {
      dispatch({ type: 'rejected', fileName: file.name, message: problem })
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    dispatch({ type: 'start', fileName: file.name, size: file.size })
    uploadMapArchive(token, file, file.name, {
      signal: controller.signal,
      onProgress: ({ loaded, total }) => dispatch({ type: 'progress', loaded, total }),
    })
      .then(({ draft_ids }) => {
        dispatch({ type: 'succeeded', draftIds: draft_ids })
        onUploadedRef.current(draft_ids)
      })
      .catch((error: unknown) => dispatch({ type: 'failed', error }))
      .finally(() => { if (controllerRef.current === controller) controllerRef.current = null })
  }, [token])

  const cancel = useCallback(() => {
    dispatch({ type: 'cancel' })
    controllerRef.current?.abort()
  }, [])

  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, upload, cancel, reset }
}
