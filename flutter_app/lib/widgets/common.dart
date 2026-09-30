import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

/// Imagen de red con soporte SVG (los avatares preset de DiceBear son SVG).
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.fallback});

  final String url;
  final BoxFit fit;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final fb = fallback ?? const Icon(Icons.image_not_supported, size: 18);
    if (url.contains('/svg') || url.toLowerCase().endsWith('.svg')) {
      return SvgPicture.network(url, fit: fit, placeholderBuilder: (_) => fb);
    }
    return Image.network(url, fit: fit, errorBuilder: (_, __, ___) => fb);
  }
}

/// Círculo con escudo de equipo o iniciales.
class TeamShield extends StatelessWidget {
  const TeamShield({
    super.key,
    this.url,
    this.name,
    this.size = 40,
    this.icon = Icons.shield,
  });

  final String? url;
  final String? name;
  final double size;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final initials = (name ?? '').trim();
    final fallback = initials.isEmpty
        ? Icon(icon, size: size * 0.5, color: AppColors.textSecondary)
        : Text(
            initials.substring(0, initials.length >= 3 ? 3 : initials.length)
                .toUpperCase(),
            style: TextStyle(
                fontSize: size * 0.28,
                fontWeight: FontWeight.bold,
                color: AppColors.textSecondary),
          );
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.inputDark,
        border: Border.all(color: AppColors.borderDark),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: (url != null && url!.isNotEmpty)
          ? Padding(
              padding: EdgeInsets.all(size * 0.08),
              child: NetImage(url!, fit: BoxFit.contain, fallback: fallback),
            )
          : fallback,
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar({super.key, this.url, this.size = 44, this.icon = Icons.person});
  final String? url;
  final double size;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final fb = Icon(icon, size: size * 0.55, color: AppColors.textSecondary);
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
          shape: BoxShape.circle, color: AppColors.inputDark),
      clipBehavior: Clip.antiAlias,
      child: (url != null && url!.isNotEmpty)
          ? NetImage(url!, fallback: fb)
          : fb,
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key});
  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 56, color: AppColors.textSecondary),
          const SizedBox(height: 12),
          Text(title,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          if (message != null) ...[
            const SizedBox(height: 8),
            Text(message!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary)),
          ],
          if (action != null) ...[const SizedBox(height: 20), action!],
        ]),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 8),
        child: Row(children: [
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold)),
          ),
          if (trailing != null) trailing!,
        ]),
      );
}

/// Selector de liga compacto (sustituye los <select> de React).
class LeagueDropdown extends StatelessWidget {
  const LeagueDropdown({
    super.key,
    required this.leagues,
    required this.selectedId,
    required this.onChanged,
    this.followedIds = const {},
  });

  final List<League> leagues;
  final String? selectedId;
  final ValueChanged<String> onChanged;
  final Set<String> followedIds;

  @override
  Widget build(BuildContext context) {
    if (leagues.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: AppColors.inputDark,
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: leagues.any((l) => l.id == selectedId) ? selectedId : null,
          items: [
            for (final l in leagues)
              DropdownMenuItem(
                value: l.id,
                child: Text(
                  '${l.name}${followedIds.contains(l.id) ? ' ★' : ''}',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
          onChanged: (v) => v == null ? null : onChanged(v),
        ),
      ),
    );
  }
}

/// Cronómetro que avanza solo si el partido está en vivo.
class LiveTimer extends StatefulWidget {
  const LiveTimer({super.key, required this.match, this.style});
  final MatchModel match;
  final TextStyle? style;

  @override
  State<LiveTimer> createState() => _LiveTimerState();
}

class _LiveTimerState extends State<LiveTimer> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void didUpdateWidget(covariant LiveTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    _setup();
  }

  void _setup() {
    _timer?.cancel();
    if (widget.match.status == 'live') {
      _timer = Timer.periodic(
          const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Text(formatSeconds(widget.match.currentSeconds()), style: widget.style);
}

/// Rectángulos amarillos/rojos por tarjeta.
class CardDots extends StatelessWidget {
  const CardDots({super.key, required this.yellow, required this.red});
  final int yellow;
  final int red;

  @override
  Widget build(BuildContext context) {
    Widget card(Color c) => Container(
          width: 8,
          height: 12,
          margin: const EdgeInsets.symmetric(horizontal: 1),
          decoration:
              BoxDecoration(color: c, borderRadius: BorderRadius.circular(2)),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < yellow; i++) card(AppColors.yellowCard),
      for (var i = 0; i < red; i++) card(AppColors.redCard),
    ]);
  }
}

class LiveBadge extends StatelessWidget {
  const LiveBadge({super.key, this.label = 'EN VIVO'});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.live.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                  color: AppColors.live, shape: BoxShape.circle)),
          const SizedBox(width: 6),
          Text(label,
              style: const TextStyle(
                  color: AppColors.live,
                  fontSize: 11,
                  fontWeight: FontWeight.bold)),
        ]),
      );
}

/// Campo con etiqueta arriba (estilo de los formularios React).
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          child,
        ]),
      );
}

const positions = ['Portero', 'Defensa', 'Medio', 'Delantero'];

/// Dropdown genérico de strings / ids.
class SimpleDropdown<T> extends StatelessWidget {
  const SimpleDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
    this.hint,
  });

  final T? value;
  final List<(T, String)> items;
  final ValueChanged<T?> onChanged;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      // La key fuerza a reconstruir si el valor cambia desde fuera.
      key: ValueKey(value),
      initialValue: items.any((i) => i.$1 == value) ? value : null,
      isExpanded: true,
      hint: hint == null ? null : Text(hint!),
      items: [
        for (final (v, label) in items)
          DropdownMenuItem(value: v, child: Text(label)),
      ],
      onChanged: onChanged,
    );
  }
}
