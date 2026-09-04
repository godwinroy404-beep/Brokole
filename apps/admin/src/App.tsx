import { useSession } from './lib/useSession';
import { LoginScreen } from './components/LoginScreen';
import { AppShell } from './components/AppShell';

export default function App() {
  const session = useSession();

  if (session.loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-neutral-500">
        Checking your access…
      </div>
    );
  }

  if (!session.signedIn || !session.profile) return <LoginScreen onSignedIn={session.refresh} />;

  return <AppShell session={session} />;
}
