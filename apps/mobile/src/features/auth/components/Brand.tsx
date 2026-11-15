import { Image } from 'react-native';

/** Logo et nom de l'application, en tête des écrans d'accès. */
export const Brand = () => (
  <Image
    source={require('../../../../assets/images/logo.png')}
    accessibilityLabel="Gestion Élève Gabon"
    style={{ width: 150, height: 150, alignSelf: 'center' }}
    resizeMode="contain"
  />
);
