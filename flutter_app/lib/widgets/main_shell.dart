import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';

class _NavItem {
  const _NavItem(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

/// Menú inferior dinámico según rol (port de BottomNav.tsx).
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  List<_NavItem> _items() {
    final items = <_NavItem>[
      const _NavItem('Inicio', Icons.home, '/'),
      const _NavItem('Tabla', Icons.table_chart, '/league-table'),
      const _NavItem('Liguilla', Icons.workspace_premium, '/liguilla'),
    ];
    if (session.ownsActiveLeague) {
      items.add(const _NavItem('Sanciones', Icons.gavel, '/sanciones'));
    }
    if (session.isStaff) {
      items.add(const _NavItem('Calendario', Icons.calendar_month, '/calendar'));
    }
    if (session.isAdmin) {
      items.add(const _NavItem('Ligas', Icons.emoji_events, '/my-leagues'));
    } else if (session.role == 'captain') {
      items.add(const _NavItem('Mi Equipo', Icons.groups, '/my-team'));
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
          bottomNavigationBar: NavigationBar(
            selectedIndex: index,
            labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
            onDestinationSelected: (i) => context.go(items[i].path),
            destinations: [
              for (final item in items)
                NavigationDestination(icon: Icon(item.icon), label: item.label),
            ],
          ),
        );
      },
    );
  }
}
