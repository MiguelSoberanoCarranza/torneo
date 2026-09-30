import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme/app_theme.dart';

enum ToastType { success, error, info }

void showToast(BuildContext context, String message,
    [ToastType type = ToastType.info]) {
  final color = switch (type) {
    ToastType.success => AppColors.success,
    ToastType.error => AppColors.danger,
    ToastType.info => Colors.blue,
  };
  final icon = switch (type) {
    ToastType.success => Icons.check_circle,
    ToastType.error => Icons.error,
    ToastType.info => Icons.info,
  };
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      backgroundColor: color,
      duration: const Duration(seconds: 3),
      content: Row(children: [
        Icon(icon, color: Colors.white),
        const SizedBox(width: 12),
        Expanded(
            child: Text(message,
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w500))),
      ]),
    ));
}

Future<bool> confirmDialog(BuildContext context, String message,
    {String confirmLabel = 'Aceptar', bool destructive = false}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      content: Text(message),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar')),
        FilledButton(
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 40),
            backgroundColor: destructive ? AppColors.danger : null,
          ),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}

String errorMessage(Object e) {
  final s = e.toString();
  final m = RegExp(r'message: ([^,]+)').firstMatch(s);
  return m?.group(1) ?? s;
}

// ---------- Formatos de fecha (es) ----------

String formatTime(DateTime? d) =>
    d == null ? '--:--' : DateFormat('HH:mm', 'es').format(d);

String formatDateLong(DateTime? d) =>
    d == null ? '' : DateFormat("EEEE d 'de' MMMM", 'es').format(d);

String formatDateShort(DateTime? d) =>
    d == null ? '' : DateFormat('EEE d MMM', 'es').format(d);

String formatDateMedium(DateTime? d) =>
    d == null ? '' : DateFormat('dd MMM yyyy', 'es').format(d);

String formatDateTimeShort(DateTime? d) =>
    d == null ? '' : DateFormat('EEE d MMM, HH:mm', 'es').format(d);

/// "Hoy" / "Mañana" / fecha corta (Dashboard).
String formatDateRelative(DateTime? d) {
  if (d == null) return '';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(d.year, d.month, d.day);
  final diff = day.difference(today).inDays;
  if (diff == 0) return 'Hoy';
  if (diff == 1) return 'Mañana';
  return formatDateShort(d);
}

String formatSeconds(int total) {
  final m = (total ~/ 60).toString().padLeft(2, '0');
  final s = (total % 60).toString().padLeft(2, '0');
  return '$m:$s';
}

String scoreText(int? score) => score == -1 ? 'P' : '${score ?? 0}';

String statusLabel(String status) => switch (status) {
      'scheduled' => 'Programado',
      'live' => 'En Vivo',
      'break' => 'Entretiempo',
      'finished' => 'Finalizado',
      'postponed' => 'Pospuesto',
      _ => status,
    };

Color? parseHexColor(String? hex) {
  if (hex == null || !hex.startsWith('#') || hex.length != 7) return null;
  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

String toHexColor(Color c) =>
    '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
