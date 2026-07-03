import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AdminLoginScreen from './screens/AdminLoginScreen';
import CalendarScreen from './screens/CalendarScreen';
import CreateLeagueScreen from './screens/CreateLeagueScreen';
import CreateTeamScreen from './screens/CreateTeamScreen';
import DashboardScreen from './screens/DashboardScreen';
import DirectoryScreen from './screens/DirectoryScreen';
import FixtureGeneratorScreen from './screens/FixtureGeneratorScreen';
import LeagueManagementScreen from './screens/LeagueManagementScreen';
import LeagueTableScreen from './screens/LeagueTableScreen';
import MatchDetailsLiveScreen from './screens/MatchDetailsLiveScreen';
import LiguillaScreen from './screens/LiguillaScreen';
import MatchManagementScreen from './screens/MatchManagementScreen';
import PlayerJoinScreen from './screens/PlayerJoinScreen';
import RefereeMatchControlScreen from './screens/RefereeMatchControlScreen';
import MyLeaguesScreen from './screens/MyLeaguesScreen';
import MyTeamScreen from './screens/MyTeamScreen';
import MatchDetailsScreen from './screens/MatchDetailsScreen';
import LeagueSelectorScreen from './screens/LeagueSelectorScreen';
import App from './App';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

import ProfileScreen from './screens/ProfileScreen';
import AddPlayerScreen from './screens/AddPlayerScreen';
import AddRefereeScreen from './screens/AddRefereeScreen';
import CreateMatchScreen from './screens/CreateMatchScreen';
import UserManagementScreen from './screens/UserManagementScreen';

// Tournament screens
import TournamentListScreen from './screens/TournamentListScreen';
import TournamentDetailScreen from './screens/TournamentDetailScreen';
import CreateTournamentScreen from './screens/CreateTournamentScreen';

// Public screens
import LeaguePublicScreen from './screens/LeaguePublicScreen';

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      // Login (sin layout principal)
      { path: '/admin-login', element: <AdminLoginScreen /> },

      // Rutas PUBLICAS con su propio layout (sin BottomNav ni header privado)
      // Son páginas standalone, accesibles sin login
      { path: '/l/:slug', element: <LeaguePublicScreen /> },

      {
        element: <MainLayout />,
        children: [
          // RUTAS PRIVADAS (requieren login via ProtectedRoute)
          {
            element: <ProtectedRoute />,
            children: [
              // Home: solo ligas del usuario
              { path: '/', element: <LeagueSelectorScreen /> },
              { path: '/my-leagues', element: <MyLeaguesScreen /> },
              { path: '/admin', element: <DashboardScreen /> },
              { path: '/directory', element: <DirectoryScreen /> },
              { path: '/league-table', element: <LeagueTableScreen /> },
              { path: '/match/:id', element: <MatchDetailsScreen /> },
              { path: '/calendar', element: <CalendarScreen /> },
              { path: '/league/:id', element: <LeagueManagementScreen /> },
              { path: '/match-details-live', element: <MatchDetailsLiveScreen /> },
              { path: '/liguilla', element: <LiguillaScreen /> },

              // Tournament Routes
              { path: '/tournaments', element: <TournamentListScreen /> },
              { path: '/tournament/:id', element: <TournamentDetailScreen /> },

              // Team / Player / Referee
              { path: '/my-team', element: <MyTeamScreen /> },
              { path: '/create-league', element: <CreateLeagueScreen /> },
              { path: '/create-team', element: <CreateTeamScreen /> },
              { path: '/fixture-generator', element: <FixtureGeneratorScreen /> },

              // Match Management
              { path: '/match-management', element: <MatchManagementScreen /> },
              { path: '/player-join', element: <PlayerJoinScreen /> },
              { path: '/referee-match-control', element: <RefereeMatchControlScreen /> },

              // Profile
              { path: '/profile', element: <ProfileScreen /> },
              { path: '/add-player', element: <AddPlayerScreen /> },
              { path: '/add-referee', element: <AddRefereeScreen /> },
              { path: '/create-match', element: <CreateMatchScreen /> },
              { path: '/user-management', element: <UserManagementScreen /> },
              { path: '/create-tournament', element: <CreateTournamentScreen /> },
            ]
          }
        ]
      }
    ],
  },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
