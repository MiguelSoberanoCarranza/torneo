import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';

/// Promueve a un usuario registrado (por email) al rol de árbitro.
/// (En React el formulario validaba un campo "nombre" que no existía en la
/// UI y por eso nunca pasaba la validación; aquí solo se pide el email.)
class AddRefereeScreen extends StatefulWidget {
  const AddRefereeScreen({super.key});

  @override
  State<AddRefereeScreen> createState() => _AddRefereeScreenState();
}

class _AddRefereeScreenState extends State<AddRefereeScreen> {
  final _email = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      showToast(context, 'Completa todos los campos', ToastType.error);
      return;
    }
    setState(() => _loading = true);
    try {
      final profile =
          await db.from('profiles').select('id').eq('email', email).maybeSingle();
      if (profile == null) {
        if (mounted) {
          showToast(
              context,
              'Usuario no encontrado. El árbitro debe registrarse primero en la app.',
              ToastType.error);
        }
        return;
      }
      await db
          .from('profiles')
          .update({'role': 'referee'}).eq('id', profile['id'] as String);
      if (!mounted) return;
      showToast(context, 'Usuario promovido a Árbitro exitosamente',
          ToastType.success);
      context.pop();
    } catch (e) {
      if (mounted) showToast(context, 'Error: ${errorMessage(e)}', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar Árbitro')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Row(children: [
            Icon(Icons.info, color: AppColors.primary),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                  'Ingresa el correo electrónico de un usuario registrado en la app para asignarle el rol de Árbitro.'),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        LabeledField(
          label: 'Correo Electrónico del Usuario',
          child: TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(hintText: 'usuario@email.com'),
          ),
        ),
        FilledButton(
          onPressed: _loading ? null : _save,
          child: Text(_loading ? 'Buscando...' : 'Asignar Rol de Árbitro'),
        ),
      ]),
    );
  }
}
