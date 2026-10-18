import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';

/// Estilos de fondo del póster.
enum PosterBgStyle { teams, night, pitch, fire, gold, photo }

extension PosterBgStyleLabel on PosterBgStyle {
  String get label => switch (this) {
        PosterBgStyle.teams => 'Equipos',
        PosterBgStyle.night => 'Noche',
        PosterBgStyle.pitch => 'Cancha',
        PosterBgStyle.fire => 'Fuego',
        PosterBgStyle.gold => 'Oro',
        PosterBgStyle.photo => 'Mi foto',
      };
}

/// Fondo elegido. La foto solo vive en el dispositivo (no se sube a la BD).
class PosterBackground {
  const PosterBackground({
    this.style = PosterBgStyle.teams,
    this.photo,
    this.photoDarkness = 0.55,
  });

  final PosterBgStyle style;
  final Uint8List? photo;

  /// Oscurecimiento sobre la foto (0 = nada, 1 = negro) para que el texto
  /// siga siendo legible.
  final double photoDarkness;

  PosterBackground copyWith({
    PosterBgStyle? style,
    Uint8List? photo,
    double? photoDarkness,
  }) =>
      PosterBackground(
        style: style ?? this.style,
        photo: photo ?? this.photo,
        photoDarkness: photoDarkness ?? this.photoDarkness,
      );
}

/// Capa de fondo dibujada detrás del contenido del póster.
class PosterBackgroundLayer extends StatelessWidget {
  const PosterBackgroundLayer({
    super.key,
    required this.background,
    required this.homeColor,
    required this.awayColor,
  });

  final PosterBackground background;
  final Color homeColor;
  final Color awayColor;

  static const _base = Color(0xFF0B1220);

  Widget _glow(Alignment center, Color c, double alpha) => Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: center,
              radius: 1.1,
              colors: [c.withValues(alpha: alpha), Colors.transparent],
            ),
          ),
        ),
      );

  Widget _linear(List<Color> colors) => Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: colors,
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final layers = <Widget>[
      const Positioned.fill(child: ColoredBox(color: _base))
    ];

    switch (background.style) {
      case PosterBgStyle.teams:
        layers
          ..add(_glow(const Alignment(-1.1, -0.6), homeColor, 0.55))
          ..add(_glow(const Alignment(1.1, 0.7), awayColor, 0.55));
      case PosterBgStyle.night:
        layers
          ..add(_linear(const [Color(0xFF0F172A), Color(0xFF020617)]))
          ..add(_glow(const Alignment(0, -1.2), const Color(0xFF3B82F6), 0.35));
      case PosterBgStyle.pitch:
        layers
          ..add(_linear(const [Color(0xFF166534), Color(0xFF052E16)]))
          ..add(const Positioned.fill(
              child: CustomPaint(painter: _PitchPainter())))
          ..add(const Positioned.fill(
              child: ColoredBox(color: Color(0x66000000))));
      case PosterBgStyle.fire:
        layers
          ..add(_linear(const [Color(0xFF7F1D1D), Color(0xFF1C0A00)]))
          ..add(_glow(const Alignment(0, 1.2), const Color(0xFFF97316), 0.6));
      case PosterBgStyle.gold:
        layers
          ..add(_linear(const [Color(0xFF1C1917), Color(0xFF0C0A09)]))
          ..add(_glow(const Alignment(-0.8, -1), const Color(0xFFEAB308), 0.45))
          ..add(_glow(const Alignment(1, 1), const Color(0xFFCA8A04), 0.25));
      case PosterBgStyle.photo:
        if (background.photo != null) {
          layers
            ..add(Positioned.fill(
                child: Image.memory(background.photo!, fit: BoxFit.cover)))
            // Degradado oscuro: más fuerte abajo, donde van los datos.
            ..add(Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black
                          .withValues(alpha: background.photoDarkness * 0.7),
                      Colors.black.withValues(
                          alpha: math.min(1, background.photoDarkness * 1.3)),
                    ],
                  ),
                ),
              ),
            ));
        } else {
          layers
            ..add(_glow(const Alignment(-1.1, -0.6), homeColor, 0.55))
            ..add(_glow(const Alignment(1.1, 0.7), awayColor, 0.55));
        }
    }

    // Marca de agua (no sobre fotos, para no ensuciarlas).
    if (background.style != PosterBgStyle.photo) {
      layers.add(Positioned(
        right: -40,
        top: 120,
        child: Icon(Icons.sports_soccer,
            size: 220, color: Colors.white.withValues(alpha: 0.04)),
      ));
    }
    return Stack(children: layers);
  }
}

/// Líneas de cancha (franjas de pasto + círculo central + áreas).
class _PitchPainter extends CustomPainter {
  const _PitchPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final stripe = Paint()..color = Colors.white.withValues(alpha: 0.04);
    const n = 9;
    final h = size.height / n;
    for (var i = 0; i < n; i += 2) {
      canvas.drawRect(Rect.fromLTWH(0, i * h, size.width, h), stripe);
    }
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    final c = Offset(size.width / 2, size.height / 2);
    canvas.drawLine(Offset(0, c.dy), Offset(size.width, c.dy), line);
    canvas.drawCircle(c, size.width * 0.17, line);
    final boxW = size.width * 0.6, boxH = size.height * 0.14;
    canvas.drawRect(
        Rect.fromLTWH((size.width - boxW) / 2, -1, boxW, boxH), line);
    canvas.drawRect(
        Rect.fromLTWH(
            (size.width - boxW) / 2, size.height - boxH + 1, boxW, boxH),
        line);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
