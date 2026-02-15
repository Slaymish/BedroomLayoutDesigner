import { useCallback, useEffect, useState } from 'react';
import App from './App';
import LandingPage, { type LandingCtaPlacement } from './components/LandingPage';

type AppRoute = 'landing' | 'planner';
type AnalyticsPrimitive = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;

interface RouteExperienceProps {
  initialRoute: AppRoute;
  onSetSeoForRoute: (route: AppRoute) => void;
  onTrackAnalyticsEvent: (eventName: string, params: AnalyticsParams) => void;
}

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return 'planner';
  }
  return 'landing';
};

export default function RouteExperience({ initialRoute, onSetSeoForRoute, onTrackAnalyticsEvent }: RouteExperienceProps) {
  const [route, setRoute] = useState<AppRoute>(initialRoute);

  useEffect(() => {
    onSetSeoForRoute(route);
  }, [route, onSetSeoForRoute]);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const moveToPlanner = useCallback(() => {
    if (window.location.pathname !== '/app') {
      window.history.pushState(window.history.state, '', '/app');
    }
    setRoute('planner');
  }, []);

  const handleStartPlanning = useCallback((placement: LandingCtaPlacement) => {
    onTrackAnalyticsEvent('landing_start_planning_click', { placement });
    moveToPlanner();
  }, [moveToPlanner, onTrackAnalyticsEvent]);

  const handleDismissOverlay = useCallback(() => {
    onTrackAnalyticsEvent('landing_overlay_dismiss', { placement: 'overlay' });
    moveToPlanner();
  }, [moveToPlanner, onTrackAnalyticsEvent]);

  if (route === 'planner') {
    return <App />;
  }

  return (
    <div className="landing-overlay-app-shell">
      <div className="landing-preview-app" aria-hidden="true">
        <App />
      </div>
      <LandingPage mode="overlay" onStartPlanning={handleStartPlanning} onDismiss={handleDismissOverlay} />
    </div>
  );
}
