import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Navegador: descarga directa del PNG. (Con share_plus, Chrome en Windows
/// abría el panel "Compartir" del sistema en lugar de descargar.)
Future<void> savePng(Uint8List bytes, String fileName) async {
  final blob = web.Blob(
    [bytes.toJS].toJS,
    web.BlobPropertyBag(type: 'image/png'),
  );
  final url = web.URL.createObjectURL(blob);
  final anchor = web.HTMLAnchorElement()
    ..href = url
    ..download = fileName
    ..style.display = 'none';
  web.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  // Se libera después para no cortar la descarga en navegadores lentos.
  Future.delayed(
      const Duration(seconds: 10), () => web.URL.revokeObjectURL(url));
}
