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

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { path: '/', element: <DashboardScreen /> },
      { path: '/admin-login', element: <AdminLoginScreen /> },
      { path: '/calendar', element: <CalendarScreen /> },
      { path: '/create-league', element: <CreateLeagueScreen /> },
      { path: '/create-team', element: <CreateTeamScreen /> },
      { path: '/directory', element: <DirectoryScreen /> },
      { path: '/fixture-generator', element: <FixtureGeneratorScreen /> },
      { path: '/league-management', element: <LeagueManagementScreen /> },
      { path: '/league-table', element: <LeagueTableScreen /> },
      { path: '/match-details-live', element: <MatchDetailsLiveScreen /> },
      { path: '/match-management', element: <MatchManagementScreen /> },
      { path: '/player-join', element: <PlayerJoinScreen /> },
      { path: '/referee-match-control', element: <RefereeMatchControlScreen /> },
    ],
  },
]);

const Router = () => <RouterProvider router={router} />;

export default Router;
