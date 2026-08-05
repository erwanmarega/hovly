export type TypeToast = 'succes' | 'erreur'

export function useToast() {
  const toast = useState<{ texte: string; type: TypeToast } | null>('toast-global', () => null)

  function annoncer(texte: string, type: TypeToast = 'succes') {
    toast.value = { texte, type }
  }

  function fermer() {
    toast.value = null
  }

  return { toast, annoncer, fermer }
}
