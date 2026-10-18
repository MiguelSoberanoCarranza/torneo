import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import 'save_png_io.dart' if (dart.library.js_interop) 'save_png_web.dart';

/// Captura un RepaintBoundary como PNG (pixelRatio 3).
/// En web lo descarga; en móvil abre "Compartir".
Future<void> captureAndShare(GlobalKey boundaryKey, String fileName) async {
  final boundary =
      boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
  if (boundary == null) throw Exception('Elemento no encontrado');
  final image = await boundary.toImage(pixelRatio: 3);
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  if (data == null) throw Exception('No se pudo generar la imagen');
  await savePng(data.buffer.asUint8List(), fileName);
}
