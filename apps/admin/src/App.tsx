import { useSession } from './lib/useSession';
import { LoginScreen } from './components/LoginScreen';
import { AppShell } from './components/AppShell';

export default function App() {
  const session = useSession();

  if (session.loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-neutral-500 font-medium animate-pulse">
        Loading operations console…
      </div>
    );
  }

  if (!session.session || !session.profile) {
    return <LoginScreen onDemoLogin={session.signInDemo} />;
  }

  return <AppShell session={session} />;
}
