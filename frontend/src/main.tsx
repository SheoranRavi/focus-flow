import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import { AuthProvider } from './context/AuthContext';
import Home from './pages/Home';
import AnalyticsPage from './pages/Analytics';
import { registerNotificationServiceWorker } from './lib/notifications';
import { getSeoLandingPage } from './pages/SeoLandingPages';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home/>,
  },
  {
    path: "/task-focus-timer",
    element: getSeoLandingPage("/task-focus-timer"),
  },
  {
    path: "/focus-session-tracker",
    element: getSeoLandingPage("/focus-session-tracker"),
  },
  {
    path: "/productivity-analytics",
    element: getSeoLandingPage("/productivity-analytics"),
  },
  {
    path: "/app",
    element: <App/>,
  },
  {
    path: "/analytics",
    element: <AnalyticsPage/>,
  },
  {
    path: "/login",
    element: <Login/>
  },
  {
    path: "/register",
    element: <Register/>
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword/>
  }
])

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router}/>
    </AuthProvider>
  </StrictMode>,
)

void registerNotificationServiceWorker();
