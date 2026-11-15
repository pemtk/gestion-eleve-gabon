import { useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { API_URL, authHeader } from '@/lib/api';
import { C } from '@/theme';
import { Icon } from './icon';

/** Image d'un fichier de l'API : chargée avec la session de l'utilisateur, jamais par une adresse publique. */
export function RemoteImage({
  fileId,
  size,
  style,
  round,
}: {
  fileId: string;
  size: number;
  style?: StyleProp<ImageStyle>;
  round?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: round ? size / 2 : 8 };
  if (failed)
    return (
      <View
        style={[box, { backgroundColor: C.n[300], alignItems: 'center', justifyContent: 'center' }]}
      >
        <Icon name="image" size={Math.min(30, size / 3)} color={C.n[700]} />
      </View>
    );
  return (
    <Image
      source={{ uri: `${API_URL}/files/${fileId}`, headers: authHeader() }}
      style={[box, { backgroundColor: C.n[300] }, style]}
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}
