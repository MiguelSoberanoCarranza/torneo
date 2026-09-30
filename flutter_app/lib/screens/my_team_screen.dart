import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/session.dart';
import '../core/supabase.dart';
import '../widgets/common.dart';
import 'create_team_screen.dart';

/// Capitán: edita el equipo que administra (manager_id = usuario).
class MyTeamScreen extends StatefulWidget {
  const MyTeamScreen({super.key});

  @override
  State<MyTeamScreen> createState() => _MyTeamScreenState();
}

class _MyTeamScreenState extends State<MyTeamScreen> {
  bool _loading = true;
  String? _teamId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = session.user;
      if (user == null) return;
      final team = await db
          .from('teams')
          .select('id, league_id')
          .eq('manager_id', user.id)
          .limit(1)
          .maybeSingle();
      _teamId = team?['id'] as String?;
    } catch (e) {
      debugPrint('Error fetching team: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: LoadingView());
    if (_teamId != null) {
      return CreateTeamScreen(teamId: _teamId, embedded: true);
    }
    return Scaffold(
      body: EmptyState(
        icon: Icons.sentiment_dissatisfied,
        title: 'No tienes equipo asignado',
        message:
            'No hemos encontrado un equipo vinculado a tu cuenta. Si crees que es un error, contacta al administrador de la liga.',
        action: FilledButton(
            onPressed: () => context.go('/'),
            child: const Text('Volver al Inicio')),
      ),
    );
  }
}
