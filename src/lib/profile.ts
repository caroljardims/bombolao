import { updateProfile } from 'firebase/auth'
import { getDocs, setDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { auth, storage } from './firebase'
import { membrosiasRef, participanteDoc } from './paths'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export class ProfileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileError'
  }
}

async function syncParticipanteNome(uid: string, nome: string): Promise<void> {
  const snap = await getDocs(membrosiasRef(uid))
  await Promise.all(
    snap.docs.map((d) =>
      setDoc(participanteDoc(d.id, uid), { nome: nome.trim() }, { merge: true }),
    ),
  )
}

function avatarExtension(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

async function uploadUserAvatar(uid: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ProfileError('Use uma imagem JPG, PNG, WebP ou GIF.')
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new ProfileError('Imagem muito grande (máximo 2 MB).')
  }

  const storageRef = ref(storage, `avatars/${uid}/profile.${avatarExtension(file)}`)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}

export async function updateUserProfile(opts: {
  displayName?: string
  photoFile?: File
  removePhoto?: boolean
}): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new ProfileError('Faça login para atualizar seu perfil.')

  const profileUpdate: { displayName?: string; photoURL?: string | null } = {}

  if (opts.displayName !== undefined) {
    const nome = opts.displayName.trim()
    if (!nome) throw new ProfileError('Informe um nome.')
    profileUpdate.displayName = nome
  }

  if (opts.removePhoto) {
    profileUpdate.photoURL = null
  } else if (opts.photoFile) {
    profileUpdate.photoURL = await uploadUserAvatar(user.uid, opts.photoFile)
  }

  if (Object.keys(profileUpdate).length === 0) return

  await updateProfile(user, profileUpdate)

  if (profileUpdate.displayName) {
    await syncParticipanteNome(user.uid, profileUpdate.displayName)
  }

  await user.reload()
}
