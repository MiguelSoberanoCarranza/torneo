import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';
import '../theme/app_theme.dart';

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
        return Scaffold(
          body: child,
          bottomNavigationBar: _TabBar(
            items: items,
            selected: index,
            onTap: (i) {
              if (i != index) HapticFeedback.selectionClick();
              context.go(items[i].path);
            },
          ),
        );
      },
    );
  }
}

/// Barra de pestañas estilo iOS (como Instagram/Threads): solo íconos,
/// contorno cuando no está activa y relleno cuando sí, línea fina arriba.
class _TabBar extends StatelessWidget {
  const _TabBar(
      {required this.items, required this.selected, required this.onTap});

  final List<_NavItem> items;
  final int selected;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.backgroundDark,
        border: Border(top: BorderSide(color: Color(0x1FFFFFFF), width: 0.5)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 52,
          child: Row(children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: _TabButton(
                  item: items[i],
                  active: i == selected,
                  onTap: () => onTap(i),
                ),
              ),
          ]),
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
      child: Tooltip(
        message: widget.item.label,
        waitDuration: const Duration(milliseconds: 600),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => setState(() => _pressed = true),
          onTapCancel: () => setState(() => _pressed = false),
          onTapUp: (_) => setState(() => _pressed = false),
          onTap: widget.onTap,
          child: Center(
            child: AnimatedScale(
              scale: _pressed ? 0.85 : 1,
              duration: const Duration(milliseconds: 120),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 150),
                child: Icon(
                  active ? widget.item.activeIcon : widget.item.icon,
                  key: ValueKey(active),
                  size: 27,
                  color: active ? Colors.white : const Color(0xFF8E8E93),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
