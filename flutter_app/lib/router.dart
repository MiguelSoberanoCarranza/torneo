import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'screens/add_player_screen.dart';
import 'screens/add_referee_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/create_league_screen.dart';
import 'screens/create_match_screen.dart';
import 'screens/create_team_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/fixture_generator_screen.dart';
import 'screens/league_management_screen.dart';
import 'screens/league_table_screen.dart';
import 'screens/liguilla_screen.dart';
import 'screens/login_screen.dart';
import 'screens/match_details_screen.dart';
import 'screens/match_management_screen.dart';
import 'screens/my_leagues_screen.dart';
import 'screens/my_team_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/public/public_tournament_screen.dart';
import 'screens/referee_match_control_screen.dart';
import 'screens/sanciones_screen.dart';
import 'screens/user_management_screen.dart';
import 'widgets/main_shell.dart';

/// Rutas que requieren sesión (equivalente a ProtectedRoute en React).
bool _isProtected(String path) {
  const exact = {
    '/sanciones',
    '/my-leagues',
    '/my-team',
    '/create-league',
    '/fixture-generator',
    '/match-management',
    '/create-match',
    '/profile',
    '/add-referee',
    '/user-management',
  };
  if (exact.contains(path)) return true;
  return path.startsWith('/referee/') ||
      path.startsWith('/team/') ||
      RegExp(r'^/league/[^/]+/(edit|create-team|add-player)$').hasMatch(path);
}

final appRouter = GoRouter(
  initialLocation: '/',
  refreshListenable: session,
  redirect: (context, state) {
    final path = state.uri.path;
    if (_isProtected(path) && !session.isLoggedIn) {
      return Uri(path: '/admin-login', queryParameters: {'from': state.uri.toString()})
          .toString();
    }
    return null;
  },
  routes: [
    GoRoute(
      path: '/admin-login',
      builder: (_, s) => LoginScreen(from: s.uri.queryParameters['from']),
    ),

    // ---------- Ruta pública por torneo (sin login, sin menú) ----------
    GoRoute(
      path: '/torneo/:id',
      builder: (_, s) => PublicTournamentScreen(leagueId: s.pathParameters['id']!),
      routes: [
        GoRoute(
          path: 'partido/:matchId',
          builder: (_, s) => MatchDetailsScreen(
            matchId: s.pathParameters['matchId']!,
            publicLeagueId: s.pathParameters['id'],
          ),
        ),
      ],
    ),

    // ---------- Pestañas principales con menú inferior ----------
    ShellRoute(
      builder: (context, state, child) =>
          MainShell(location: state.uri.path, child: child),
      routes: [
        GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
        GoRoute(
            path: '/league-table',
            builder: (_, __) => const LeagueTableScreen()),
        GoRoute(path: '/liguilla', builder: (_, __) => const LiguillaScreen()),
        GoRoute(path: '/calendar', builder: (_, __) => const CalendarScreen()),
        GoRoute(
            path: '/sanciones', builder: (_, __) => const SancionesScreen()),
        GoRoute(
            path: '/my-leagues', builder: (_, __) => const MyLeaguesScreen()),
        GoRoute(path: '/my-team', builder: (_, __) => const MyTeamScreen()),
      ],
    ),

    // ---------- Pantallas de detalle / gestión ----------
    GoRoute(
      path: '/match/:id',
      builder: (_, s) => MatchDetailsScreen(matchId: s.pathParameters['id']!),
    ),
    GoRoute(
      path: '/referee/:matchId',
      builder: (_, s) =>
          RefereeMatchControlScreen(matchId: s.pathParameters['matchId']!),
    ),
    GoRoute(
      path: '/league/:id',
      builder: (_, s) =>
          LeagueManagementScreen(leagueId: s.pathParameters['id']!),
      routes: [
        GoRoute(
          path: 'edit',
          builder: (_, s) =>
              CreateLeagueScreen(leagueId: s.pathParameters['id']),
        ),
        GoRoute(
          path: 'create-team',
          builder: (_, s) =>
              CreateTeamScreen(leagueId: s.pathParameters['id']),
        ),
        GoRoute(
          path: 'add-player',
          builder: (_, s) =>
              AddPlayerScreen(leagueId: s.pathParameters['id']!),
        ),
      ],
    ),
    GoRoute(
      path: '/team/:teamId',
      builder: (_, s) => CreateTeamScreen(teamId: s.pathParameters['teamId']),
    ),
    GoRoute(
        path: '/create-league', builder: (_, __) => const CreateLeagueScreen()),
    GoRoute(
        path: '/fixture-generator',
        builder: (_, __) => const FixtureGeneratorScreen()),
    GoRoute(
        path: '/match-management',
        builder: (_, __) => const MatchManagementScreen()),
    GoRoute(
        path: '/create-match', builder: (_, __) => const CreateMatchScreen()),
    GoRoute(path: '/add-referee', builder: (_, __) => const AddRefereeScreen()),
    GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
    GoRoute(
        path: '/user-management',
        builder: (_, __) => const UserManagementScreen()),
  ],
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(),
    body: Center(child: Text('Página no encontrada: ${state.uri.path}')),
  ),
);
