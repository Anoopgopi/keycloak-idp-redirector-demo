import React from 'react';
import LoginButtons from './components/LoginButtons';
import Callback from './components/Callback';
import LogoutCallback from './components/LogoutCallback';

function App() {
  // Simple routing based on pathname
  const isCallback = window.location.pathname === '/callback';
  const isLogout = window.location.pathname === '/logout';

  if (isLogout) {
    return <LogoutCallback />;
  }

  return (
    <div className="App">
      {isCallback ? <Callback /> : <LoginButtons />}
    </div>
  );
}

export default App;