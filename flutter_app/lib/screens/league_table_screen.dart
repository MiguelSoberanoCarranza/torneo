import 'package:flutter/material.dart';

import '../core/repo.dart';
import '../core/ui_helpers.dart';
import '../logic/standings.dart';
import '../logic/stats.dart';
import '../models/models.dart';
import '../widgets/common.dart';
import '../widgets/export_designs.dart';
import '../widgets/export_dialog.dart';
import '../widgets/main_shell.dart';
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
      if (mounted) {
        showToast(context, 'Error al cargar la tabla', ToastType.error);
      }
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
      if (mounted) {
        showToast(context, 'Error al cargar la tabla', ToastType.error);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _leagueName =>
      _leagues.where((l) => l.id == _selectedId).firstOrNull?.name ??
      'Seleccionar Liga';

  Future<void> _openExport() async {
    final tab = _tabs.index;
    final highlight = ['GENERAL', 'DE GOLEO', 'FAIR PLAY'][tab];
    final body = switch (tab) {
      0 => ExportStandings(standings: _standings),
      1 => ExportScorers(scorers: _stats.scorers),
      _ => ExportCards(stats: _stats.cards),
    };
    final slug = _leagueName.replaceAll(RegExp(r'\s+'), '-').toLowerCase();
    await showExportDialog(
      context,
      fileName: 'tabla-general-$slug.png',
      child: ExportFrame(
        title: 'Tabla',
        highlight: highlight,
        subtitle: _leagueName,
        child: body,
      ),
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
                  ListView(
                      padding:
                          const EdgeInsets.fromLTRB(12, 12, 12, kTabBarSpace),
                      children: [
                        StandingsTable(standings: _standings),
                      ]),
                  ListView(
                      padding:
                          const EdgeInsets.fromLTRB(12, 12, 12, kTabBarSpace),
                      children: [
                        ScorersTable(scorers: _stats.scorers),
                      ]),
                  ListView(
                      padding:
                          const EdgeInsets.fromLTRB(12, 12, 12, kTabBarSpace),
                      children: [
                        CardsTable(stats: _stats.cards),
                      ]),
                ]),
    );
  }
}
