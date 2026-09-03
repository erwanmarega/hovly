export type ToastType = 'succes' | 'erreur'

export function useToast() {
  const toast = useState<{ message: string; type: ToastType } | null>('toast-global', () => null)

  function announce(message: string, type: ToastType = 'succes') {
    toast.value = { message, type }
  }

  function close() {
    toast.value = null
  }

  return { toast, announce, close }
}
