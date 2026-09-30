import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.from});
  final String? from;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  bool _isSignUp = false;
  bool _obscure = true;
  String? _error;
  bool _registered = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  bool _validate() {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      _error = 'Por favor completa todos los campos.';
      return false;
    }
    if (_password.text.length < 6) {
      _error = 'La contraseña debe tener al menos 6 caracteres.';
      return false;
    }
    if (_isSignUp && _password.text != _confirm.text) {
      _error = 'Las contraseñas no coinciden.';
      return false;
    }
    return true;
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!_validate()) {
      setState(() {});
      return;
    }
    setState(() => _loading = true);
    try {
      if (_isSignUp) {
        final res = await db.auth
            .signUp(email: _email.text.trim(), password: _password.text);
        if (res.user != null) {
          // Igual que la app React: intenta crear el perfil con rol admin.
          // (Si existe el trigger handle_new_user, este insert falla y se
          // ignora; ver notas de migración.)
          try {
            await db.from('profiles').insert({
              'id': res.user!.id,
              'email': res.user!.email,
              'role': 'admin',
            });
          } catch (e) {
            debugPrint('Error creating profile: $e');
          }
          setState(() => _registered = true);
        }
      } else {
        await db.auth.signInWithPassword(
            email: _email.text.trim(), password: _password.text);
        if (mounted) context.go(widget.from ?? '/');
      }
    } catch (e) {
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_registered) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.mark_email_read,
                  size: 64, color: AppColors.primary),
              const SizedBox(height: 16),
              const Text('¡Confirma tu correo!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(
                'Hemos enviado un enlace de confirmación a ${_email.text}.\n'
                'Por favor, revisa tu bandeja de entrada para activar tu cuenta.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => setState(() {
                  _registered = false;
                  _isSignUp = false;
                }),
                child: const Text('Volver al Inicio'),
              ),
            ]),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: ListView(
              padding: const EdgeInsets.all(24),
              shrinkWrap: true,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    tooltip: 'Ir al Inicio',
                    icon: const Icon(Icons.home),
                    onPressed: () => context.go('/'),
                  ),
                ),
                const SizedBox(height: 8),
                const Icon(Icons.sports_soccer,
                    size: 56, color: AppColors.primary),
                const SizedBox(height: 8),
                const Text('LigaControl Admin',
                    textAlign: TextAlign.center,
                    style:
                        TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
                const Text(
                  'Gestiona equipos, marcadores y estadísticas en tiempo real.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 32),
                Text(_isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión',
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                Text(
                    _isSignUp
                        ? 'Regístrate para comenzar'
                        : 'Bienvenido de nuevo',
                    style: const TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(children: [
                      const Icon(Icons.error, color: AppColors.danger),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(_error!,
                              style:
                                  const TextStyle(color: AppColors.danger))),
                    ]),
                  ),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.mail),
                    hintText: 'admin@liga.com',
                    labelText: 'Correo Electrónico',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: _obscure,
                  autofillHints: const [AutofillHints.password],
                  onSubmitted: (_) => _isSignUp ? null : _submit(),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock),
                    labelText: 'Contraseña',
                    helperText: _isSignUp ? 'Mínimo 6 caracteres' : null,
                    suffixIcon: IconButton(
                      icon: Icon(
                          _obscure ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                if (_isSignUp) ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _confirm,
                    obscureText: true,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.lock_reset),
                      labelText: 'Confirmar Contraseña',
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _loading ? null : _submit,
                  icon: _loading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.arrow_forward),
                  label: Text(_loading
                      ? 'Procesando...'
                      : _isSignUp
                          ? 'Registrarse'
                          : 'Acceder al Panel'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() {
                    _isSignUp = !_isSignUp;
                    _error = null;
                    _confirm.clear();
                  }),
                  child: Text(_isSignUp
                      ? '¿Ya tienes cuenta? Iniciar Sesión'
                      : '¿No tienes cuenta? Regístrate'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
