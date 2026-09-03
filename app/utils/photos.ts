import { DEFAULT_PHOTO } from '~/types'

export function isDefaultPhoto(photo: string | null | undefined): boolean {
  return photo === DEFAULT_PHOTO
}
