/// Configuración inyectada en tiempo de compilación.
///
/// Ejecuta con:
///   flutter run --dart-define-from-file=env.json
/// (ver env.example.json). Nunca se versiona env.json.
class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// Dominio público usado para construir los enlaces públicos por torneo
  /// cuando la app corre en Android/iOS (en web se usa el origen actual).
  static const publicBaseUrl = String.fromEnvironment(
    'PUBLIC_BASE_URL',
    defaultValue: 'https://torneo-two.vercel.app',
  );

  static bool get isConfigured =>
      supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
