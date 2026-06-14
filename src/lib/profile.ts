import { updateProfile } from 'firebase/auth'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getDocs, setDoc } from 'firebase/firestore'
import { auth, storage } from './firebase'
import { participanteDocsForUser } from './linkParticipante'
import { membrosiasRef } from './paths'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const AVATAR_FILE = 'profile.jpg'
const LEGACY_AVATAR_EXTS = ['png', 'webp', 'gif'] as const

export class ProfileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileError'
  }
}

export interface UpdatedProfile {
  displayName?: string
  photoURL?: string | null
}

function avatarRef(uid: string, fileName = AVATAR_FILE) {
  return ref(storage, `avatars/${uid}/${fileName}`)
}

async function syncParticipanteProfile(
  uid: string,
  email: string | null | undefined,
  fields: { nome?: string; photoURL?: string | null },
): Promise<void> {
  const snap = await getDocs(membrosiasRef(uid))
  const updates: Promise<void>[] = []

  for (const d of snap.docs) {
    const refs = await participanteDocsForUser(d.id, uid, email)
    for (const ref of refs) {
      updates.push(setDoc(ref, fields, { merge: true }))
    }
  }

  await Promise.all(updates)
}

async function deleteStoredAvatars(uid: string): Promise<void> {
  const targets = [avatarRef(uid), ...LEGACY_AVATAR_EXTS.map((ext) => avatarRef(uid, `profile.${ext}`))]
  await withTimeout(
    Promise.allSettled(targets.map((r) => deleteObject(r))),
    STORAGE_TIMEOUT_MS,
    STORAGE_TIMEOUT_MSG,
  )
}

async function uploadUserAvatar(uid: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ProfileError('Use uma imagem JPG, PNG, WebP ou GIF.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new ProfileError('Imagem muito grande (máximo 2 MB).')
  }

  const storageRef = avatarRef(uid)
  await withTimeout(
    uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=3600',
    }),
    STORAGE_TIMEOUT_MS,
    STORAGE_TIMEOUT_MSG,
  )
  return withTimeout(getDownloadURL(storageRef), STORAGE_TIMEOUT_MS, STORAGE_TIMEOUT_MSG)
}

function mapProfileError(err: unknown): never {
  if (err instanceof ProfileError) throw err
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
  if (code.startsWith('storage/')) {
    throw new ProfileError('Não foi possível enviar a foto. Tente outra imagem ou mais tarde.')
  }
  if (code === 'permission-denied') {
    throw new ProfileError('Sem permissão para atualizar seu perfil no bolão.')
  }
  throw err instanceof Error ? err : new ProfileError('Erro ao atualizar perfil.')
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new ProfileError(message)), ms)
    }),
  ])
}

const STORAGE_TIMEOUT_MS = 20_000
const STORAGE_TIMEOUT_MSG =
  'Upload da foto demorou demais. Ative o Firebase Storage no console do projeto e tente de novo.'

export async function updateUserProfile(opts: {
  displayName?: string
  photoFile?: File
  removePhoto?: boolean
}): Promise<UpdatedProfile> {
  const user = auth.currentUser
  if (!user) throw new ProfileError('Faça login para atualizar seu perfil.')

  const result: UpdatedProfile = {}
  const profileUpdate: { displayName?: string; photoURL?: string | null } = {}
  const participanteFields: { nome?: string; photoURL?: string | null } = {}

  try {
    if (opts.displayName !== undefined) {
      const nome = opts.displayName.trim()
      if (!nome) throw new ProfileError('Informe um nome.')
      profileUpdate.displayName = nome
      result.displayName = nome
      participanteFields.nome = nome
    }

    if (opts.removePhoto) {
      await deleteStoredAvatars(user.uid)
      profileUpdate.photoURL = null
      result.photoURL = null
      participanteFields.photoURL = null
    } else if (opts.photoFile) {
      profileUpdate.photoURL = await uploadUserAvatar(user.uid, opts.photoFile)
      result.photoURL = profileUpdate.photoURL
      participanteFields.photoURL = profileUpdate.photoURL
    }

    if (Object.keys(profileUpdate).length === 0) return result

    await updateProfile(user, profileUpdate)

    if (Object.keys(participanteFields).length > 0) {
      try {
        await syncParticipanteProfile(user.uid, user.email, participanteFields)
      } catch (syncErr) {
        console.warn('Perfil salvo, mas falhou ao sincronizar nos bolões:', syncErr)
      }
    }

    return result
  } catch (err) {
    mapProfileError(err)
  }
}
