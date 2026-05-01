import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import TimeTracker from "./pages/TimeTracker";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Members from "./pages/Members";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import { isTokenExpired, signOut } from "@/lib/auth";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Honour both absence AND expiry.
  if (isTokenExpired()) {
    // Clean up any stale token + workspace selection, then bounce to /auth.
    if (localStorage.getItem("token")) signOut(false);
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route element={<Layout />}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TimeTracker />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Members />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}
