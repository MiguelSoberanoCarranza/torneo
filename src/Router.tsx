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
import MatchManagementScreen from './screens/MatchManagementScreen';
import PlayerJoinScreen from './screens/PlayerJoinScreen';
import RefereeMatchControlScreen from './screens/RefereeMatchControlScreen';
import App from './App';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

import ProfileScreen from './screens/ProfileScreen';
import AddPlayerScreen from './screens/AddPlayerScreen';
import AddRefereeScreen from './screens/AddRefereeScreen';
import CreateMatchScreen from './screens/CreateMatchScreen';
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: '/admin-login', element: <AdminLoginScreen /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { path: '/', element: <DashboardScreen /> },
              { path: '/calendar', element: <CalendarScreen /> },
              { path: '/create-league', element: <CreateLeagueScreen /> },
              { path: '/create-team', element: <CreateTeamScreen /> },
              { path: '/directory', element: <DirectoryScreen /> },
              { path: '/fixture-generator', element: <FixtureGeneratorScreen /> },
              { path: '/league/:id', element: <LeagueManagementScreen /> },
              { path: '/league-table', element: <LeagueTableScreen /> },
              { path: '/match-details-live', element: <MatchDetailsLiveScreen /> },
              { path: '/match-management', element: <MatchManagementScreen /> },
              { path: '/player-join', element: <PlayerJoinScreen /> },
              { path: '/referee-match-control', element: <RefereeMatchControlScreen /> },
              { path: '/profile', element: <ProfileScreen /> },
              { path: '/add-player', element: <AddPlayerScreen /> },
              { path: '/add-referee', element: <AddRefereeScreen /> },
              { path: '/create-match', element: <CreateMatchScreen /> },
            ]
          }
        ]
      }
    ],
  },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
