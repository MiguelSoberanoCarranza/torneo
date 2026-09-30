import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';
import 'supabase.dart';

/// Estado global de autenticación + rol (sustituye la lógica repetida de
/// BottomNav / ProtectedRoute en la app React).
class SessionController extends ChangeNotifier {
  SessionController() {
    _sub = db.auth.onAuthStateChange.listen((state) {
      switch (state.event) {
        case AuthChangeEvent.signedIn:
        case AuthChangeEvent.tokenRefreshed:
        case AuthChangeEvent.userUpdated:
        case AuthChangeEvent.initialSession:
          refresh();
        case AuthChangeEvent.signedOut:
          profile = null;
          ownsActiveLeague = false;
          notifyListeners();
        default:
          break;
      }
    });
  }

  late final StreamSubscription<AuthState> _sub;

  Profile? profile;
  bool ownsActiveLeague = false;
  bool loading = false;

  User? get user => db.auth.currentUser;
  bool get isLoggedIn => db.auth.currentSession != null;
  String? get role => user == null ? null : (profile?.role ?? 'user');

  bool get isAdmin => role == 'admin' || role == 'superadmin';
  bool get isSuperAdmin => role == 'superadmin';
  bool get isStaff =>
      role == 'admin' || role == 'superadmin' || role == 'referee';

  Future<void> refresh() async {
    final u = user;
    if (u == null) {
      profile = null;
      ownsActiveLeague = false;
      notifyListeners();
      return;
    }
    loading = true;
    try {
      final p = await db.from('profiles').select().eq('id', u.id).maybeSingle();
      profile = p == null ? null : Profile.fromJson(p);
      final owned = await db
          .from('leagues')
          .select('id')
          .eq('owner_id', u.id)
          .eq('is_active', true)
          .limit(1);
      ownsActiveLeague = owned.isNotEmpty;
    } catch (e) {
      debugPrint('Error cargando sesión: $e');
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await db.auth.signOut();
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

/// Instancia única accesible desde el router y las pantallas.
late final SessionController session;
