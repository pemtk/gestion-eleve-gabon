import * as ImagePicker from 'expo-image-picker';
import { FILE_POLICIES, formatBytes, type FileKind } from '@sge/shared';
import { api, ApiError } from './api';

export interface Picked { uri: string; name: string; type: string; size?: number }

/**
 * Prend une photo (appareil) ou en choisit une (galerie). Retourne `null` si l'utilisateur annule ; lève une erreur lisible si l'accès
 * à l'appareil photo est refusé. Les métadonnées (position GPS…) sont retirées par le serveur ; la qualité est réduite pour rester sous les limites.
 */
export async function pickPhoto(source: 'camera' | 'library', opts: { square?: boolean } = {}): Promise<Picked | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false, allowsEditing: !!opts.square, aspect: opts.square ? [1, 1] : undefined };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez une photo dans la galerie.');
  }
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = r.canceled ? null : r.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg', size: asset.fileSize };
}

/** Envoie la photo (`POST /files`) pour l'usage demandé et retourne l'identifiant à joindre à l'objet (tâche, profil…). */
export async function uploadPhoto(kind: FileKind, photo: Picked): Promise<string> {
  const policy = FILE_POLICIES[kind];
  if (photo.size && photo.size > policy.maxBytes) throw new Error(`Photo trop volumineuse : ${formatBytes(policy.maxBytes)} au maximum.`);
  const form = new FormData();
  form.append('kind', kind);
  // React Native accepte cet objet pour un fichier local (uri, nom, type).
  form.append('file', { uri: photo.uri, name: photo.name, type: photo.type } as unknown as Blob);
  try {
    return (await api.upload<{ id: string }>('/files', form)).id;
  } catch (e) {
    throw e instanceof ApiError ? new Error(e.message) : e;
  }
}
