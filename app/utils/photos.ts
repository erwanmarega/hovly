import { PHOTO_PAR_DEFAUT } from '~/types'

export function estPhotoParDefaut(photo: string | null | undefined): boolean {
  return photo === PHOTO_PAR_DEFAUT
}
