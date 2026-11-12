import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, F, R } from '@/theme';
import { Icon } from './icon';

/* ---------- Texte : Cormorant pour les titres, Lora pour le corps ---------- */
type TProps = { children?: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; onPress?: () => void };
export const H = ({ size = 34, italic, semi, color, style, ...p }: TProps & { size?: number; italic?: boolean; semi?: boolean; color?: string }) => (
  <Text {...p} style={[{ fontFamily: semi ? F.headingSemi : italic ? F.headingItalic : F.heading, fontSize: size, lineHeight: size * 1.08, color: color ?? C.text, letterSpacing: -0.015 * size }, style]} />
);
export const B = ({ size = 15, color, italic, semi, style, ...p }: TProps & { size?: number; color?: string; italic?: boolean; semi?: boolean }) => (
  <Text {...p} style={[{ fontFamily: semi ? F.bodySemi : italic ? F.bodyItalic : F.body, fontSize: size, lineHeight: size * 1.45, color: color ?? C.text }, style]} />
);
export const Muted = (p: TProps & { size?: number; italic?: boolean }) => <B size={13} color={C.n[700]} {...p} />;
export const Kicker = ({ children, style }: TProps) => (
  <Text style={[{ fontFamily: F.body, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: C.a[700] }, style]}>{children}</Text>
);
export const Num = ({ size = 40, color, style, children }: TProps & { size?: number; color?: string }) => (
  <Text style={[{ fontFamily: F.heading, fontSize: size, lineHeight: size * 1.05, color: color ?? C.text, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>
);

/* ---------- Boutons (contour doré, jamais de plein) ---------- */
export function Btn({ label, onPress, icon, variant = 'primary', disabled, size = 'lg', style }: { label: string; onPress?: () => void; icon?: string; variant?: 'primary' | 'secondary' | 'link'; disabled?: boolean; size?: 'lg' | 'md'; style?: StyleProp<ViewStyle> }) {
  const primary = variant === 'primary';
  if (variant === 'link') {
    return (
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" hitSlop={8} style={[{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, style]}>
        <B size={14} color={C.a[700]} style={{ textDecorationLine: 'underline' }}>{label}</B>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, { minHeight: size === 'lg' ? 54 : 46, borderColor: primary ? C.accent : C.divider, borderWidth: primary ? 1.5 : 1, backgroundColor: pressed ? (primary ? C.a[300] : C.n[200]) : primary ? C.a[100] : 'transparent', opacity: disabled ? 0.45 : 1 }, style]}>
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} color={primary ? C.a[800] : C.text} />}
      <Text style={{ fontFamily: F.headingSemi, fontSize: size === 'lg' ? 20 : 17, color: primary ? C.a[800] : C.text }}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Choix : segment et pastilles ---------- */
export function Seg<T extends string>({ options, value, onChange, style }: { options: { key: T; label: string; icon?: string }[]; value: T; onChange: (k: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="radiogroup" style={[{ flexDirection: 'row', borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, overflow: 'hidden' }, style]}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.a[100] : 'transparent', borderLeftWidth: i ? 1 : 0, borderLeftColor: C.divider, ...(on ? { borderWidth: 1.5, borderColor: C.accent } : {}) }}>
            {o.icon && <Icon name={o.icon} size={16} color={on ? C.a[800] : C.text} />}
            <B size={14} color={on ? C.a[800] : C.text}>{o.label}</B>
          </Pressable>
        );
      })}
    </View>
  );
}
export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T | null; onChange: (k: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: R.lg, borderWidth: on ? 1.5 : 1, borderColor: on ? C.accent : C.divider, backgroundColor: on ? C.a[100] : 'transparent' }}>
            <B size={14} color={on ? C.a[800] : C.text}>{o.label}</B>
          </Pressable>
        );
      })}
    </View>
  );
}
export function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1 }}><B size={15}>{label}</B>{sub && <Muted size={12}>{sub}</Muted>}</View>
      <View style={{ width: 46, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: value ? C.accent : C.n[400], backgroundColor: value ? C.a[100] : 'transparent', justifyContent: 'center' }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: value ? C.accent : C.n[400], marginLeft: value ? 23 : 3 }} />
      </View>
    </Pressable>
  );
}

/* ---------- Surfaces ---------- */
export const Card = ({ children, tint, style }: { children: React.ReactNode; tint?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: tint ? C.a[300] : C.divider, backgroundColor: tint ? C.a[100] : C.n[100] }, style]}>{children}</View>
);
export const Pill = ({ label }: { label: string }) => (
  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 3, backgroundColor: C.a[100] }}><B size={11} color={C.a[800]}>{label}</B></View>
);
export const Avatar = ({ initials, size = 46, icon }: { initials?: string; size?: number; icon?: string }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.a[200], alignItems: 'center', justifyContent: 'center' }}>
    {icon && !initials ? <Icon name={icon} size={size * 0.45} color={C.a[800]} /> : <Text style={{ fontFamily: F.headingSemi, fontSize: size * 0.4, color: C.a[800] }}>{initials}</Text>}
  </View>
);
export const Hairline = () => <View style={{ height: 1, backgroundColor: C.divider }} />;
export const Bar = ({ pct, height = 8 }: { pct: number; height?: number }) => (
  <View style={{ height, borderRadius: height / 2, backgroundColor: C.a[200], overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: C.accent }} /></View>
);

export function Ring({ size = 84, stroke = 5, pct, children }: { size?: number; stroke?: number; pct: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2; const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.a[300]} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(1, pct))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

/* ---------- Formulaires ---------- */
export function Field({ label, hint, ...p }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Muted size={13}>{label}</Muted>
      <TextInput accessibilityLabel={label} placeholderTextColor={C.n[500]} {...p}
        style={[{ minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderColor: C.divider, borderRadius: R.lg, fontFamily: F.body, fontSize: 16, color: C.text }, p.multiline && { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' }, p.style]} />
      {hint && <Muted size={12}>{hint}</Muted>}
    </View>
  );
}
export const Rules = ({ rules }: { rules: { label: string; ok: boolean }[] }) => (
  <View style={{ gap: 4 }}>
    {rules.map((r) => (
      <View key={r.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name={r.ok ? 'circle-check' : 'circle'} size={15} color={r.ok ? C.a[700] : C.n[500]} />
        <B size={13} color={r.ok ? C.text : C.n[600]}>{r.label}</B>
      </View>
    ))}
  </View>
);

/* ---------- Mise en page ---------- */
export function Screen({ children, padded = true, gap = 18, footer }: { children: React.ReactNode; padded?: boolean; gap?: number; footer?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: padded ? 20 : 0, paddingBottom: 28, gap }}>{children}</ScrollView>
      {footer}
    </View>
  );
}
/** En-tête avec retour (ou fermeture) et titre. */
export function Header({ title, sub, close, onBack, right }: { title: string; sub?: string; close?: boolean; onBack?: () => void; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -10 }}>
      <Pressable onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} accessibilityRole="button" accessibilityLabel={close ? 'Fermer' : 'Retour'} hitSlop={6} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={close ? 'x' : 'chevron-left'} size={24} color={C.text} />
      </Pressable>
      <View style={{ flex: 1 }}><H size={24} semi>{title}</H>{sub && <Muted size={12.5}>{sub}</Muted>}</View>
      {right}
    </View>
  );
}
export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
    <H size={22} semi>{title}</H>
    {action && <Pressable onPress={onAction} accessibilityRole="link" hitSlop={8}><B size={13.5} color={C.a[700]}>{action}</B></Pressable>}
  </View>
);
export const ListRow = ({ onPress, children, style }: { onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <Pressable onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [{ borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: pressed ? C.a[400] : C.divider, backgroundColor: C.n[100] }, style]}>{children}</Pressable>
);
export const Loading = ({ error }: { error?: string | null }) => (
  <View style={{ padding: 40, alignItems: 'center' }}>{error ? <B color={C.a[800]} style={{ textAlign: 'center' }}>{error}</B> : <Muted>Chargement…</Muted>}</View>
);

const s = StyleSheet.create({ btn: { width: '100%', borderRadius: R.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 } });
