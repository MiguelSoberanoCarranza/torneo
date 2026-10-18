import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/export_image.dart';
import '../core/poster_repo.dart';
import '../core/repo.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import 'match_poster.dart';
import 'poster_background.dart';

/// Muestra el póster del partido (previa o resultado) y permite compartirlo.
/// Si no se pasan [events] se cargan de la BD (p. ej. desde el Calendario).
Future<void> showPosterDialog(BuildContext context, MatchModel match,
    [List<MatchEvent>? events]) {
  return showDialog(
    context: context,
    builder: (_) => _PosterDialog(match: match, events: events),
  );
}

class _PosterDialog extends StatefulWidget {
  const _PosterDialog({required this.match, this.events});
  final MatchModel match;
  final List<MatchEvent>? events;

  @override
  State<_PosterDialog> createState() => _PosterDialogState();
}

class _PosterDialogState extends State<_PosterDialog> {
  final _key = GlobalKey();
  late Future<PosterData> _data;
  late PosterKind _kind;
  PosterBackground _bg = const PosterBackground();
  bool _exporting = false;

  bool get _hasResult => !widget.match.isScheduled;

  @override
  void initState() {
    super.initState();
    _kind = _hasResult ? PosterKind.result : PosterKind.preview;
    _data = fetchPosterData(widget.match, widget.events);
  }

  Future<void> _share() async {
    setState(() => _exporting = true);
    try {
      final m = widget.match;
      String slug(String? s) {
        const from = 'áéíóúüñ', to = 'aeiouun';
        var t = (s ?? 'equipo').toLowerCase();
        for (var i = 0; i < from.length; i++) {
          t = t.replaceAll(from[i], to[i]);
        }
        return t
            .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
            .replaceAll(RegExp(r'^-+|-+$'), '');
      }

      final name =
          '${_kind == PosterKind.preview ? 'previa' : 'resultado'}-${slug(m.homeTeam?.name)}-vs-${slug(m.awayTeam?.name)}.png';
      await captureAndShare(_key, name);
    } catch (e) {
      if (mounted) {
        showToast(context, 'Error al exportar imagen', ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _pickPhoto() async {
    final img = await pickImage();
    if (img == null) return;
    setState(
        () => _bg = _bg.copyWith(style: PosterBgStyle.photo, photo: img.bytes));
  }

  Widget _swatch(PosterBgStyle style) {
    final selected = _bg.style == style;
    final colors = switch (style) {
      PosterBgStyle.teams => const [Color(0xFFDC2626), Color(0xFF2563EB)],
      PosterBgStyle.night => const [Color(0xFF1E3A8A), Color(0xFF020617)],
      PosterBgStyle.pitch => const [Color(0xFF16A34A), Color(0xFF052E16)],
      PosterBgStyle.fire => const [Color(0xFFF97316), Color(0xFF7F1D1D)],
      PosterBgStyle.gold => const [Color(0xFFEAB308), Color(0xFF1C1917)],
      PosterBgStyle.photo => const [Color(0xFF475569), Color(0xFF1E293B)],
    };
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (style == PosterBgStyle.photo && _bg.photo == null) {
            _pickPhoto();
          } else {
            setState(() => _bg = _bg.copyWith(style: style));
          }
        },
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(colors: colors),
              border: Border.all(
                color: selected ? Colors.white : Colors.transparent,
                width: 2,
              ),
              image: style == PosterBgStyle.photo && _bg.photo != null
                  ? DecorationImage(
                      image: MemoryImage(_bg.photo!), fit: BoxFit.cover)
                  : null,
            ),
            child: style == PosterBgStyle.photo && _bg.photo == null
                ? const Icon(Icons.add_photo_alternate, size: 20)
                : null,
          ),
          const SizedBox(height: 4),
          Text(style.label,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.bold : FontWeight.normal)),
        ]),
      ),
    );
  }

  Widget _backgroundPicker() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Fondo',
          style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      const SizedBox(height: 6),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (final s in PosterBgStyle.values) _swatch(s),
        ]),
      ),
      if (_bg.style == PosterBgStyle.photo && _bg.photo != null)
        Row(children: [
          const Icon(Icons.brightness_6,
              size: 18, color: AppColors.textSecondary),
          Expanded(
            child: Slider(
              value: _bg.photoDarkness,
              min: 0.2,
              max: 0.85,
              label: 'Oscurecer',
              onChanged: (v) =>
                  setState(() => _bg = _bg.copyWith(photoDarkness: v)),
            ),
          ),
          TextButton(onPressed: _pickPhoto, child: const Text('Cambiar foto')),
        ]),
    ]);
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
              child: Text('Póster del partido',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close)),
          ]),
          SegmentedButton<PosterKind>(
            segments: [
              const ButtonSegment(
                  value: PosterKind.preview,
                  icon: Icon(Icons.campaign),
                  label: Text('Previa')),
              ButtonSegment(
                  value: PosterKind.result,
                  icon: const Icon(Icons.scoreboard),
                  label: const Text('Resultado'),
                  enabled: _hasResult),
            ],
            selected: {_kind},
            onSelectionChanged: (s) => setState(() => _kind = s.first),
          ),
          if (!_hasResult)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                  'El póster de resultado se habilita al iniciar el partido.',
                  style:
                      TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ),
          const SizedBox(height: 12),
          Flexible(
            child: FutureBuilder<PosterData>(
              future: _data,
              builder: (context, snap) {
                if (snap.hasError) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No se pudieron cargar los datos del póster.'),
                  );
                }
                if (!snap.hasData) {
                  return const SizedBox(
                      height: 200,
                      child: Center(child: CircularProgressIndicator()));
                }
                // Se dibuja a tamaño fijo y se escala para caber en pantalla;
                // la imagen exportada siempre sale a 1080x1350.
                return FittedBox(
                  fit: BoxFit.contain,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: RepaintBoundary(
                      key: _key,
                      child: MatchPoster(
                          data: snap.data!, kind: _kind, background: _bg),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
          _backgroundPicker(),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _exporting ? null : _share,
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
