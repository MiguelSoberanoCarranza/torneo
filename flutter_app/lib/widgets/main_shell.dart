import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';

/// Espacio que las pantallas con pestañas deben dejar al final de sus listas
/// para que el último elemento no quede debajo de la barra flotante.
const double kTabBarSpace = 110;

class _NavItem {
  const _NavItem(this.label, this.icon, this.activeIcon, this.path);
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final String path;
}

/// Menú inferior dinámico según rol (port de BottomNav.tsx).
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  List<_NavItem> _items() {
    final items = <_NavItem>[
      const _NavItem('Inicio', Icons.home_outlined, Icons.home, '/'),
      const _NavItem('Tabla', Icons.table_chart_outlined, Icons.table_chart,
          '/league-table'),
      const _NavItem('Liguilla', Icons.workspace_premium_outlined,
          Icons.workspace_premium, '/liguilla'),
    ];
    if (session.ownsActiveLeague) {
      items.add(const _NavItem(
          'Sanciones', Icons.gavel_outlined, Icons.gavel, '/sanciones'));
    }
    if (session.isStaff) {
      items.add(const _NavItem('Calendario', Icons.calendar_month_outlined,
          Icons.calendar_month, '/calendar'));
    }
    if (session.isAdmin) {
      items.add(const _NavItem('Ligas', Icons.emoji_events_outlined,
          Icons.emoji_events, '/my-leagues'));
    } else if (session.role == 'captain') {
      items.add(const _NavItem(
          'Mi Equipo', Icons.groups_outlined, Icons.groups, '/my-team'));
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) {
        final items = _items();
        var index = items.indexWhere((i) => i.path == location);
        if (index < 0) index = 0;
        final bottom = MediaQuery.paddingOf(context).bottom;
        // El contenido ocupa toda la pantalla y la barra flota encima, así
        // se ve pasar por debajo del vidrio al hacer scroll.
        return Scaffold(
          body: Stack(children: [
            Positioned.fill(child: child),
            Positioned(
              left: 16,
              right: 16,
              bottom: bottom + 12,
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: _GlassTabBar(
                    items: items,
                    selected: index,
                    onTap: (i) {
                      if (i != index) HapticFeedback.selectionClick();
                      context.go(items[i].path);
                    },
                  ),
                ),
              ),
            ),
          ]),
        );
      },
    );
  }
}

/// Barra flotante estilo iOS "Liquid Glass": cápsula translúcida con
/// desenfoque y una píldora que se desliza a la pestaña activa.
class _GlassTabBar extends StatelessWidget {
  const _GlassTabBar(
      {required this.items, required this.selected, required this.onTap});

  final List<_NavItem> items;
  final int selected;
  final ValueChanged<int> onTap;

  static const _height = 58.0;
  static const _inset = 5.0;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(_height / 2),
        boxShadow: const [
          BoxShadow(
              color: Color(0x66000000), blurRadius: 24, offset: Offset(0, 8)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_height / 2),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            height: _height,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(_height / 2),
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x40323C50), Color(0x8C141A26)],
              ),
              border: Border.all(color: const Color(0x2EFFFFFF), width: 0.8),
            ),
            padding: const EdgeInsets.all(_inset),
            child: LayoutBuilder(builder: (context, c) {
              final w = c.maxWidth / items.length;
              // Burbuja un poco más ancha que alta, sin pasarse de la celda.
              final pill = (c.maxHeight * 1.35).clamp(0.0, w);
              return Stack(children: [
                // Burbuja de vidrio de la pestaña activa (como Instagram).
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOutBack,
                  left: w * selected + (w - pill) / 2,
                  top: 0,
                  bottom: 0,
                  width: pill,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(pill),
                      gradient: const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x47FFFFFF), Color(0x26FFFFFF)],
                      ),
                      border: Border.all(
                          color: const Color(0x33FFFFFF), width: 0.6),
                    ),
                  ),
                ),
                Row(children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: _TabButton(
                        item: items[i],
                        active: i == selected,
                        onTap: () => onTap(i),
                      ),
                    ),
                ]),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatefulWidget {
  const _TabButton(
      {required this.item, required this.active, required this.onTap});

  final _NavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_TabButton> createState() => _TabButtonState();
}

class _TabButtonState extends State<_TabButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final active = widget.active;
    return Semantics(
      button: true,
      selected: active,
      label: widget.item.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapCancel: () => setState(() => _pressed = false),
        onTapUp: (_) => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _pressed ? 0.88 : 1,
          duration: const Duration(milliseconds: 120),
          child: Center(
            child: Icon(active ? widget.item.activeIcon : widget.item.icon,
                size: 26,
                color: active ? Colors.white : const Color(0xE6FFFFFF)),
          ),
        ),
      ),
    );
  }
}
