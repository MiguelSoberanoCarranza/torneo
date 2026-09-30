import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/supabase.dart';
import '../core/ui_helpers.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';
import '../widgets/common.dart';
import '../widgets/manual_result_sheet.dart';

/// Lista global de partidos con captura de resultado manual.
class MatchManagementScreen extends StatefulWidget {
  const MatchManagementScreen({super.key});

  @override
  State<MatchManagementScreen> createState() => _MatchManagementScreenState();
}

class _MatchManagementScreenState extends State<MatchManagementScreen> {
  List<MatchModel> _matches = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await db
          .from('matches')
          .select(matchWithTeamsSelect)
          .order('start_time', ascending: false);
      _matches = rows.map(MatchModel.fromJson).toList();
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e), ToastType.error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = _matches.where((m) => _filter == 'all' || m.status == _filter).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gestión de Partidos'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'all', label: Text('Todos')),
                ButtonSegment(value: 'scheduled', label: Text('Pendientes')),
                ButtonSegment(value: 'live', label: Text('En Vivo')),
                ButtonSegment(value: 'finished', label: Text('Fin')),
              ],
              selected: {_filter},
              onSelectionChanged: (s) => setState(() => _filter = s.first),
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/create-match');
          _load();
        },
        child: const Icon(Icons.add),
      ),
      body: _loading
          ? const LoadingView()
          : list.isEmpty
              ? const EmptyState(
                  icon: Icons.event_busy,
                  title: 'No hay partidos en esta categoría.')
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final m = list[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text(
                            '${m.homeTeam?.name}  ${scoreText(m.homeScore)} - ${scoreText(m.awayScore)}  ${m.awayTeam?.name}'),
                        subtitle: Text(
                            '${formatDateTimeShort(m.startTime)} · ${statusLabel(m.status)}'),
                        leading: m.isLive
                            ? const Icon(Icons.circle,
                                color: AppColors.live, size: 12)
                            : null,
                        trailing: IconButton(
                          tooltip: 'Cargar Resultado Manual',
                          icon: const Icon(Icons.edit_note),
                          onPressed: () async {
                            final res = await showManualResultSheet(context,
                                match: m,
                                homeName: m.homeTeam?.name ?? 'Local',
                                awayName: m.awayTeam?.name ?? 'Visitante');
                            if (res != null) {
                              setState(() => _matches[
                                      _matches.indexWhere((x) => x.id == m.id)] =
                                  m.merge(res));
                            }
                          },
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
