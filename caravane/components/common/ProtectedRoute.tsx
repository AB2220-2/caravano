import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner'; // Optional: for a loading state

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  
  // Optional: Add a loading state if currentUser is initially null during auth check
  // For this simple mock, direct check is fine.
  // const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // useEffect(() => {
  //   // Simulate async auth check
  //   const timer = setTimeout(() => setIsLoadingAuth(false), 200);
  //   return () => clearTimeout(timer);
  // }, []);

  // if (isLoadingAuth) {
  //   return (
  //     <div className="flex justify-center items-center h-screen">
  //       <LoadingSpinner message="Vérification de l'authentification..." size="lg" />
  //     </div>
  //   );
  // }

  if (!currentUser) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;