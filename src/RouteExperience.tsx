import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import LandingPage, { type LandingCtaPlacement } from './components/LandingPage';

type AppRoute = 'landing' | 'planner';
type AnalyticsPrimitive = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;

const PlannerApp = lazy(() => import('./App'));
let preloadPlannerAppPromise: Promise<unknown> | null = null;

const preloadPlannerApp = (): Promise<unknown> => {
  if (!preloadPlannerAppPromise) {
    preloadPlannerAppPromise = import('./App');
  }
  return preloadPlannerAppPromise;
};

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
  const [isOpeningPlanner, setIsOpeningPlanner] = useState(false);
  const [plannerLoadError, setPlannerLoadError] = useState<string | null>(null);

  useEffect(() => {
    onSetSeoForRoute(route);
  }, [route, onSetSeoForRoute]);

  useEffect(() => {
    if (route !== 'landing') return;
    const timeoutId = window.setTimeout(() => {
      void preloadPlannerApp();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [route]);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(resolveRoute(window.location.pathname));
      setIsOpeningPlanner(false);
      setPlannerLoadError(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const moveToPlanner = useCallback(async () => {
    if (isOpeningPlanner) return;
    setPlannerLoadError(null);
    setIsOpeningPlanner(true);

    try {
      await preloadPlannerApp();
      if (window.location.pathname !== '/app') {
        window.history.pushState(window.history.state, '', '/app');
      }
      setRoute('planner');
    } catch {
      setPlannerLoadError('Unable to open the planner right now. Please try again.');
      setIsOpeningPlanner(false);
    }
  }, [isOpeningPlanner]);

  const handleStartPlanning = useCallback((placement: LandingCtaPlacement) => {
    onTrackAnalyticsEvent('landing_start_planning_click', { placement });
    void moveToPlanner();
  }, [moveToPlanner, onTrackAnalyticsEvent]);

  const handleDismissOverlay = useCallback(() => {
    onTrackAnalyticsEvent('landing_overlay_dismiss', { placement: 'overlay' });
    void moveToPlanner();
  }, [moveToPlanner, onTrackAnalyticsEvent]);

  if (route === 'planner') {
    return (
      <Suspense
        fallback={
          <div className="landing-planner-loading" role="status" aria-live="polite">
            Opening planner...
          </div>
        }
      >
        <PlannerApp />
      </Suspense>
    );
  }

  return (
    <div className="landing-overlay-app-shell">
      <div className="landing-preview-shell" aria-hidden="true">
        <div className="landing-preview-shell-gradient" />
        <div className="landing-preview-shell-content">
          <div className="landing-preview-shell-header" />
          <div className="landing-preview-shell-main">
            <div className="landing-preview-shell-canvas" />
            <div className="landing-preview-shell-rail" />
          </div>
        </div>
      </div>
      <LandingPage
        mode="overlay"
        onStartPlanning={handleStartPlanning}
        onDismiss={handleDismissOverlay}
        isOpeningPlanner={isOpeningPlanner}
      />
      {plannerLoadError && (
        <p className="landing-overlay-error" role="alert">
          {plannerLoadError}
        </p>
      )}
    </div>
  );
}
