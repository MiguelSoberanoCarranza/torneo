import 'package:flutter/material.dart';

import '../core/export_image.dart';
import '../core/repo.dart';
import '../core/ui_helpers.dart';
import '../logic/standings.dart';
import '../logic/stats.dart';
import '../models/models.dart';
import '../widgets/common.dart';
import '../widgets/stats_tables.dart';

class LeagueTableScreen extends StatefulWidget {
  const LeagueTableScreen({super.key});

  @override
  State<LeagueTableScreen> createState() => _LeagueTableScreenState();
}

class _LeagueTableScreenState extends State<LeagueTableScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  List<League> _leagues = [];
  String? _selectedId;
  bool _loading = true;
  List<TeamStanding> _standings = [];
  LeagueStats _stats = LeagueStats([], []);

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      final res = await fetchSelectableLeagues();
      _leagues = res.leagues;
      _selectedId = _leagues.isNotEmpty ? _leagues.first.id : null;
      await _load();
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar la tabla', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _load() async {
    final id = _selectedId;
    if (id == null) return;
    setState(() => _loading = true);
    try {
      _standings = await fetchStandings(id);
      _stats = aggregateStats(await fetchFinishedMatchEvents(id));
    } catch (e) {
      if (mounted) showToast(context, 'Error al cargar la tabla', ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _leagueName =>
      _leagues.where((l) => l.id == _selectedId).firstOrNull?.name ??
      'Seleccionar Liga';

  Future<void> _openExport() async {
    final key = GlobalKey();
    final tab = _tabs.index;
    final highlight = ['GENERAL', 'DE GOLEO', 'FAIR PLAY'][tab];
    final body = switch (tab) {
      0 => StandingsTable(standings: _standings),
      1 => ScorersTable(scorers: _stats.scorers, limit: 5),
      _ => CardsTable(stats: _stats.cards),
    };
    await showDialog(
      context: context,
      builder: (ctx) {
        var exporting = false;
        return StatefulBuilder(
          builder: (ctx, setLocal) => AlertDialog(
            title: const Text('Vista Previa'),
            contentPadding: const EdgeInsets.all(8),
            content: SizedBox(
              width: 520,
              child: SingleChildScrollView(
                child: RepaintBoundary(
                  key: key,
                  child: ExportFrame(
                    leagueName: _leagueName,
                    title: 'TABLA',
                    highlight: highlight,
                    child: body,
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancelar')),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size(0, 44)),
                onPressed: exporting
                    ? null
                    : () async {
                        setLocal(() => exporting = true);
                        try {
                          final slug = _leagueName
                              .replaceAll(RegExp(r'\s+'), '-')
                              .toLowerCase();
                          await captureAndShare(
                              key, 'tabla-general-$slug.png');
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            showToast(context, 'Imagen generada correctamente',
                                ToastType.success);
                          }
                        } catch (e) {
                          setLocal(() => exporting = false);
                          if (mounted) {
                            showToast(context, 'Error al exportar imagen',
                                ToastType.error);
                          }
                        }
                      },
                icon: const Icon(Icons.download),
                label: Text(exporting ? 'Exportando...' : 'Descargar Imagen'),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Estadísticas'),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'Compartir Tabla',
            icon: const Icon(Icons.share),
            onPressed: _standings.isEmpty ? null : _openExport,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(112),
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: LeagueDropdown(
                leagues: _leagues,
                selectedId: _selectedId,
                onChanged: (id) {
                  _selectedId = id;
                  _load();
                },
              ),
            ),
            TabBar(
              controller: _tabs,
              tabs: const [
                Tab(text: 'General'),
                Tab(text: 'Goleo'),
                Tab(text: 'Tarjetas'),
              ],
            ),
          ]),
        ),
      ),
      body: _loading
          ? const LoadingView()
          : _standings.isEmpty
              ? EmptyState(
                  icon: Icons.groups, title: 'No hay datos en "$_leagueName"')
              : TabBarView(controller: _tabs, children: [
                  ListView(padding: const EdgeInsets.all(12), children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                            minWidth: MediaQuery.of(context).size.width - 24),
                        child: SizedBox(
                            width: 520,
                            child: StandingsTable(standings: _standings)),
                      ),
                    ),
                  ]),
                  ListView(padding: const EdgeInsets.all(12), children: [
                    ScorersTable(scorers: _stats.scorers),
                  ]),
                  ListView(padding: const EdgeInsets.all(12), children: [
                    CardsTable(stats: _stats.cards),
                  ]),
                ]),
    );
  }
}
