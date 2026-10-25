import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/export_image.dart';
import '../core/ui_helpers.dart';
import '../theme/app_theme.dart';

/// Ancho con el que se dibujan las imágenes exportadas (tablas, jornadas).
/// Es un ancho de escritorio: en el celular la vista previa se escala para
/// caber en pantalla, pero la imagen siempre sale "en grande".
const double kExportWidth = 900;

/// Vista previa y descarga/compartir de una imagen.
///
/// [child] se dibuja a [width] píxeles lógicos sin importar el tamaño de la
/// pantalla y se captura a 2x (p. ej. 1800 px de ancho).
Future<void> showExportDialog(
  BuildContext context, {
  required Widget child,
  required String fileName,
  double width = kExportWidth,
}) {
  return showDialog(
    context: context,
    builder: (_) =>
        _ExportDialog(fileName: fileName, width: width, child: child),
  );
}

class _ExportDialog extends StatefulWidget {
  const _ExportDialog(
      {required this.child, required this.fileName, required this.width});
  final Widget child;
  final String fileName;
  final double width;

  @override
  State<_ExportDialog> createState() => _ExportDialogState();
}

class _ExportDialogState extends State<_ExportDialog> {
  final _key = GlobalKey();
  bool _exporting = false;

  Future<void> _export() async {
    setState(() => _exporting = true);
    try {
      await captureAndShare(_key, widget.fileName, pixelRatio: 2);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _exporting = false);
        showToast(context, 'Error al exportar imagen', ToastType.error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppColors.surfaceDark,
      insetPadding: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            const Expanded(
              child: Text('Vista previa',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close)),
          ]),
          Flexible(
            child: SingleChildScrollView(
              // Se dibuja al ancho de exportación y se escala a la pantalla.
              child: FittedBox(
                fit: BoxFit.contain,
                child: SizedBox(
                  width: widget.width,
                  child: RepaintBoundary(key: _key, child: widget.child),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _exporting ? null : _export,
            icon: Icon(kIsWeb ? Icons.download : Icons.share),
            label: Text(_exporting
                ? 'Generando...'
                : kIsWeb
                    ? 'Descargar imagen'
                    : 'Compartir'),
          ),
        ]),
      ),
    );
  }
}
