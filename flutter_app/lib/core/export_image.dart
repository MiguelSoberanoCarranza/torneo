import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart';

/// Captura un RepaintBoundary y lo comparte / descarga como PNG.
/// Sustituye a utils/imageExporter.ts (modern-screenshot / html-to-image).
Future<void> captureAndShare(GlobalKey boundaryKey, String fileName) async {
  final boundary = boundaryKey.currentContext?.findRenderObject()
      as RenderRepaintBoundary?;
  if (boundary == null) throw Exception('Elemento no encontrado');
  final image = await boundary.toImage(pixelRatio: 3);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  if (data == null) throw Exception('No se pudo generar la imagen');
  final bytes = data.buffer.asUint8List();
  await SharePlus.instance.share(ShareParams(
    files: [XFile.fromData(bytes, mimeType: 'image/png', name: fileName)],
    fileNameOverrides: [fileName],
  ));
}
