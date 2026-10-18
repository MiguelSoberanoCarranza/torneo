import 'dart:typed_data';

import 'package:share_plus/share_plus.dart';

/// Android / iOS: abre la hoja de compartir del sistema (WhatsApp, Instagram,
/// Guardar en fotos…).
Future<void> savePng(Uint8List bytes, String fileName) async {
  await SharePlus.instance.share(ShareParams(
    files: [XFile.fromData(bytes, mimeType: 'image/png', name: fileName)],
    fileNameOverrides: [fileName],
  ));
}
